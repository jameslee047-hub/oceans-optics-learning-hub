// Minimal in-memory stand-in for the subset of the supabase-js query builder
// this backend actually uses (from/select/insert/upsert/update/delete/eq/
// maybeSingle/single, plus awaiting the builder directly). Good enough to
// prove the real business logic in lib/progress-service.js and
// lib/supabase.js against realistic upsert/idempotency semantics without a
// live database. Not a general-purpose Supabase mock.
import crypto from "node:crypto";

export function createFakeSupabase() {
  const tables = {};

  function ensureTable(name) {
    if (!tables[name]) tables[name] = [];
    return tables[name];
  }

  function matchesFilters(row, filters) {
    return filters.every(([op, col, val]) => {
      if (op === "gte") return row[col] >= val;
      return row[col] === val;
    });
  }

  function from(tableName) {
    const filters = [];
    let pendingOp = null;

    async function execute() {
      const rows = ensureTable(tableName);
      if (!pendingOp) return { data: null, error: null };

      if (pendingOp.type === "select") {
        const matched = rows.filter((row) => matchesFilters(row, filters));
        return { data: matched.map((row) => ({ ...row })), error: null };
      }

      if (pendingOp.type === "insert") {
        // Simulates Postgres's `default gen_random_uuid()` on learning_users.id
        // -- without this, every inserted row that omits `id` (as every real
        // insert in this codebase does) would have the same `undefined` id,
        // making different users indistinguishable to anything that keys off it.
        const newRow = { id: crypto.randomUUID(), ...pendingOp.payload };
        rows.push(newRow);
        return { data: [{ ...newRow }], error: null };
      }

      if (pendingOp.type === "upsert") {
        const conflictCols = (pendingOp.options?.onConflict || "").split(",").filter(Boolean);
        const existingIndex = rows.findIndex((row) => conflictCols.every((col) => row[col] === pendingOp.payload[col]));
        let resultRow;
        if (existingIndex >= 0) {
          rows[existingIndex] = { ...rows[existingIndex], ...pendingOp.payload };
          resultRow = rows[existingIndex];
        } else {
          resultRow = { id: crypto.randomUUID(), ...pendingOp.payload };
          rows.push(resultRow);
        }
        return { data: [{ ...resultRow }], error: null };
      }

      if (pendingOp.type === "update") {
        for (let i = 0; i < rows.length; i += 1) {
          if (matchesFilters(rows[i], filters)) rows[i] = { ...rows[i], ...pendingOp.payload };
        }
        return { data: null, error: null };
      }

      if (pendingOp.type === "delete") {
        const toDelete = rows.filter((row) => matchesFilters(row, filters));
        tables[tableName] = rows.filter((row) => !matchesFilters(row, filters));

        // Simulates the `ON DELETE CASCADE` foreign keys defined in
        // migrations/0001_init.sql for the one relationship this backend's
        // tests need it for. The real cascade guarantee is enforced by
        // Postgres, not by this fake or any application code -- this only
        // lets a unit test observe the end-to-end effect a real webhook
        // call would have.
        if (tableName === "learning_users") {
          const deletedIds = new Set(toDelete.map((row) => row.id));
          for (const child of ["lesson_progress", "knowledge_check_results"]) {
            if (tables[child]) {
              tables[child] = tables[child].filter((row) => !deletedIds.has(row.user_id));
            }
          }
        }

        return { data: null, error: null };
      }

      return { data: null, error: null };
    }

    const builder = {
      select(columns) {
        // `.insert(x).select(cols)` / `.upsert(x).select(cols)` mean "return
        // the written row(s)" -- they must not replace the write op with a
        // read, or the row would never actually get written.
        if (pendingOp && pendingOp.type !== "select") {
          pendingOp.returning = columns;
        } else {
          pendingOp = { type: "select", columns };
        }
        return builder;
      },
      insert(payload) {
        pendingOp = { type: "insert", payload };
        return builder;
      },
      upsert(payload, options) {
        pendingOp = { type: "upsert", payload, options };
        return builder;
      },
      update(payload) {
        pendingOp = { type: "update", payload };
        return builder;
      },
      delete() {
        pendingOp = { type: "delete" };
        return builder;
      },
      eq(column, value) {
        filters.push(["eq", column, value]);
        return builder;
      },
      gte(column, value) {
        filters.push(["gte", column, value]);
        return builder;
      },
      neq() {
        return builder;
      },
      async maybeSingle() {
        const result = await execute();
        const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
        return { data, error: result.error };
      },
      async single() {
        const result = await execute();
        const data = Array.isArray(result.data) ? result.data[0] : result.data;
        return { data, error: result.error };
      },
      then(resolve, reject) {
        execute().then(resolve, reject);
      }
    };

    return builder;
  }

  // Simulates consume_learning_auth_handoff() from
  // migrations/0002_auth_handoffs.sql: matches by code_hash, requires
  // consumed_at IS NULL and expires_at > now(), and marks it consumed --
  // all synchronously (no `await` before the mutation), so two "concurrent"
  // calls made back-to-back (e.g. via Promise.all) can never interleave.
  // This proves the LIBRARY code calls a single atomic operation rather
  // than a separate select-then-update; the real guarantee against actual
  // concurrent database transactions comes from Postgres row locking in
  // the real function, not from this fake.
  function rpc(name, args) {
    async function run() {
      if (name !== "consume_learning_auth_handoff") {
        return { data: null, error: new Error(`fake-supabase: unknown rpc "${name}"`) };
      }

      const handoffs = ensureTable("learning_auth_handoffs");
      const nowIso = new Date().toISOString();
      const row = handoffs.find(
        (h) => h.code_hash === args.p_code_hash && h.consumed_at == null && h.expires_at > nowIso
      );
      if (!row) return { data: [], error: null };

      row.consumed_at = nowIso;
      const user = ensureTable("learning_users").find((u) => u.id === row.user_id);
      return { data: user ? [{ shopify_customer_id: user.shopify_customer_id }] : [], error: null };
    }

    return {
      then(resolve, reject) {
        run().then(resolve, reject);
      },
      async maybeSingle() {
        const { data, error } = await run();
        return { data: Array.isArray(data) ? data[0] ?? null : data, error };
      },
      async single() {
        const { data, error } = await run();
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return { data: null, error: error || new Error("fake-supabase: no rows for single()") };
        return { data: row, error: null };
      }
    };
  }

  return { from, rpc, tables };
}
