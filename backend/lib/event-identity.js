// Shared, tiny helpers for working with learning_events rows: resolving
// which visitor an event belongs to, timestamp math, and grouping events
// by identity in chronological order. Used by both lib/analytics-service.js
// (state-vs-activity metrics) and lib/journey-analytics.js (funnel/journey/
// category/continue-learning/returning-visitor analytics) -- pulled out to
// its own module so neither of those files needs to import the other.
//
// SESSION MODEL: this project infers session boundaries from event
// timestamps rather than persisting a client-side analytics_session_id.
// Two consecutive events by the same identity belong to the same inferred
// session when the gap between them is <= SESSION_GAP_MS -- the same
// 30-minute inactivity window already used elsewhere in this codebase for
// page-view dedupe (lib/analytics-service.js's PAGE_VIEW_DEDUPE_WINDOW_MS),
// and the same default session-timeout methodology general-purpose web
// analytics tools use. This was chosen over a stored session id because:
// (1) no new migration/column, and no new client-side storage/consent
// integration surface; (2) it works retroactively on every event already
// recorded, with no separate "session tracking started on X" historical
// caveat the way a newly introduced column would have; (3) it is exactly
// as precise a judgment of "is this a continuation of the same visit" as
// the dedupe window already relies on. The accepted tradeoff, identical to
// any inactivity-based sessionization: a tab left idle for >30 minutes and
// then used again is indistinguishable from a genuinely new visit.
export const SESSION_GAP_MS = 30 * 60 * 1000;

export function eventIdentity(event) {
  if (event && event.learning_user_id) return "authenticated:" + event.learning_user_id;
  if (event && event.anonymous_visitor_id) return "anonymous:" + event.anonymous_visitor_id;
  return null;
}

export function toMs(isoTimestamp) {
  if (!isoTimestamp) return null;
  const ms = new Date(isoTimestamp).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function percentOf(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

// UTC calendar day string (YYYY-MM-DD) for a millisecond timestamp.
export function calendarDay(ms) {
  if (ms === null || ms === undefined) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

// Groups events by visitor identity (authenticated or anonymous -- never
// both, never merged -- see eventIdentity), each identity's own list
// sorted chronologically ascending. Events with neither identity are
// dropped (should not occur given the DB's exactly-one-identity
// constraint, but defended against here too).
export function groupEventsByIdentity(events) {
  const map = new Map();
  events.forEach((event) => {
    const identity = eventIdentity(event);
    if (!identity) return;
    if (!map.has(identity)) map.set(identity, []);
    map.get(identity).push(event);
  });
  map.forEach((list) => list.sort((a, b) => toMs(a.created_at) - toMs(b.created_at)));
  return map;
}

// Splits one identity's chronologically-sorted events into inferred
// sessions: a new session starts whenever the gap since the previous
// event exceeds SESSION_GAP_MS (or for the very first event).
export function sessionizeEvents(sortedEvents) {
  const sessions = [];
  let lastMs = null;
  sortedEvents.forEach((event) => {
    const ms = toMs(event.created_at);
    if (ms === null) return;
    if (lastMs === null || ms - lastMs > SESSION_GAP_MS) sessions.push([]);
    sessions[sessions.length - 1].push(event);
    lastMs = ms;
  });
  return sessions;
}
