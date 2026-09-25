// Single source of truth for whether BEHAVIOURAL analytics (learning_events
// writes -- page views, lesson views, quiz attempts, category/hub views)
// should happen in the current runtime. Authenticated learner STATE
// (learning_users/lesson_progress/knowledge_check_results, via
// lib/progress-service.js and lib/supabase.js's findOrCreateLearningUser)
// is never gated by this -- see the project report's contamination audit
// for why progress persistence and behavioural analytics must stay fully
// independent: a Preview/dev tester must still be able to log in, complete
// lessons, and save quiz results while analytics writes are suppressed.
//
// Vercel sets VERCEL_ENV to exactly one of "production", "preview", or
// "development" for every deployment/invocation; unlike a client-supplied
// hostname or Origin header, this is a server-side, Vercel-assigned value
// a request can never influence, which is exactly why it -- not the
// storefront's Origin, not NODE_ENV -- is the authoritative signal here.
// Running outside Vercel entirely (a bare `node` process, this test suite,
// `vercel dev` without linking) leaves VERCEL_ENV unset, which this
// deliberately treats the same as "disabled": analytics must be opt-in for
// confirmed production traffic only, never opt-out for everything else.
export function isBehavioralAnalyticsEnabled(env = process.env) {
  return env.VERCEL_ENV === "production";
}
