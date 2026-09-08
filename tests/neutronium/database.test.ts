import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { seed, uid } from "../../src/lib/neutronium/model";
test("PostgreSQL migration: tenant isolation, atomic CAS, foreign keys, audit immutability", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);",
    );
    await db.exec(
      await readFile(
        "supabase/migrations/20260908000000_neutronium.sql",
        "utf8",
      ),
    );
    const owner = uid();
    await db.query("insert into auth.users values($1)", [owner]);
    const a = seed();
    const b = seed();
    await db.query("select neutronium_create($1,$2)", [
      JSON.stringify(a),
      owner,
    ]);
    await db.query("select neutronium_create($1,$2)", [
      JSON.stringify(b),
      owner,
    ]);
    const loaded = await db.query<{ state: ReturnType<typeof seed> }>(
      "select neutronium_load($1) state",
      [a.id],
    );
    const state = loaded.rows[0].state;
    assert.equal(state.employees.length, 3);
    assert.equal(state.revision, 1);
    state.name = "Acme Updated";
    const saved = await db.query<{ ok: boolean }>(
      "select neutronium_save($1,$2,$3) ok",
      [a.id, 1, JSON.stringify(state)],
    );
    assert.equal(saved.rows[0].ok, true);
    const stale = await db.query<{ ok: boolean }>(
      "select neutronium_save($1,$2,$3) ok",
      [a.id, 1, JSON.stringify(state)],
    );
    assert.equal(stale.rows[0].ok, false);
    const unchanged = await db.query<{ state: ReturnType<typeof seed> }>(
      "select neutronium_load($1) state",
      [b.id],
    );
    assert.equal(unchanged.rows[0].state.name, "Acme Inc.");
    await assert.rejects(
      db.query(
        "update neutronium_audit set payload=payload where organization_id=$1",
        [a.id],
      ),
      /append-only/,
    );
    const grant = { ...a.grants[0], id: uid(), employeeId: b.employees[0].id };
    await assert.rejects(
      db.query(
        "insert into neutronium_grants(organization_id,id,payload) values($1,$2,$3)",
        [a.id, grant.id, JSON.stringify(grant)],
      ),
      /foreign key/,
    );
    await db.exec("set role authenticated;");
    await assert.rejects(
      db.query("select * from neutronium_employees"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select neutronium_load($1)", [a.id]),
      /permission denied/,
    );
    await db.exec("reset role;");
    const limited = [];
    for (let i = 0; i < 3; i++) {
      const r = await db.query<{ ok: boolean }>(
        "select neutronium_rate_limit($1,2,60) ok",
        ["test"],
      );
      limited.push(r.rows[0].ok);
    }
    assert.deepEqual(limited, [true, true, false]);
  } finally {
    await db.close();
  }
});
