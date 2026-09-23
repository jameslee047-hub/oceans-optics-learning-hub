-- Adds consented, first-party anonymous visitor identity to Learning Hub
-- analytics. This UUID is random and is not derived from customer, network,
-- device, or browser attributes. Authenticated progress/state tables are
-- unchanged.

alter table learning_events
  add column anonymous_visitor_id uuid;

-- Every event has exactly one analytics identity. Existing events already
-- have learning_user_id because anonymous recording did not exist before
-- this migration.
alter table learning_events
  add constraint learning_events_exactly_one_identity check (
    num_nonnulls(learning_user_id, anonymous_visitor_id) = 1
  );

-- Supports the same short-window event/resource dedupe used for
-- authenticated visitors, keyed by anonymous visitor instead.
create index learning_events_anonymous_created_idx
  on learning_events(anonymous_visitor_id, created_at)
  where anonymous_visitor_id is not null;
