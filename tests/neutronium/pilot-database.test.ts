import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { seed, uid, Workspace } from "../../src/lib/neutronium/model";
import { command } from "../../src/lib/neutronium/service";
test("pilot backfill preserves conversations; record update invalidates legacy CAS and SQL pages stay company-scoped", async () => {
  const db = new PGlite();
  try {
    for (const file of ["001_initial.sql", "002_social_auth.sql"])
      await db.exec(
        await readFile(`deploy/neutronium/migrations/${file}`, "utf8"),
      );
    const user = uid();
    await db.query(
      "insert into neutronium_users(id,email) values($1,'pilot@example.com')",
      [user],
    );
    const w = seed(),
      other = seed();
    const a = {
      id: user,
      name: "Admin",
      orgId: w.id,
      role: "ORG_OWNER" as const,
      demo: true,
    };
    for (let i = 0; i < 30; i++)
      command(w, a, "help-create", {
        employeeId: w.employees[0].id,
        kind: "document",
        subject: `Document ${i}`,
        body: "Request",
      });
    const first = w.helpRequests![0];
    first.messages.push({
      id: uid(),
      author: "Admin",
      body: "Attached",
      at: new Date().toISOString(),
      attachment: { name: "letter.txt", data: "YQ==" },
    });
    await db.query("select neutronium_create($1,$2)", [
      JSON.stringify(w),
      user,
    ]);
    await db.query("select neutronium_create($1,$2)", [
      JSON.stringify(other),
      user,
    ]);
    await db.exec(
      await readFile("deploy/neutronium/migrations/003_pilot.sql", "utf8"),
    );
    const loaded = (
      await db.query<{ state: Workspace }>("select neutronium_load($1) state", [
        w.id,
      ])
    ).rows[0].state;
    assert.equal(loaded.helpRequests?.length, 30);
    assert.equal(
      loaded.helpRequests?.find((r) => r.id === first.id)?.messages[0]
        .attachment?.data,
      "YQ==",
    );
    const page = await db.query<{ id: string }>(
      "select id from neutronium_help_requests where organization_id=$1 order by id limit 25",
      [w.id],
    );
    const next = await db.query<{ id: string }>(
      "select id from neutronium_help_requests where organization_id=$1 and id>$2 order by id limit 25",
      [w.id, page.rows[24].id],
    );
    assert.equal(page.rows.length, 25);
    assert.equal(next.rows.length, 5);
    assert.equal(
      (
        await db.query(
          "select id from neutronium_help_requests where organization_id=$1",
          [other.id],
        )
      ).rows.length,
      0,
    );
    await db.query(
      'update neutronium_help_requests set payload=payload||\'{"priority":"urgent"}\' where organization_id=$1 and id=$2',
      [w.id, first.id],
    );
    await db.query(
      "update neutronium_organizations set revision=revision+1 where id=$1",
      [w.id],
    );
    assert.equal(
      (
        await db.query<{ ok: boolean }>("select neutronium_save($1,$2,$3) ok", [
          w.id,
          loaded.revision,
          JSON.stringify(loaded),
        ])
      ).rows[0].ok,
      false,
    );
    await assert.rejects(
      db.query(
        "insert into neutronium_help_requests(organization_id,id,payload) values($1,$2,$3)",
        [other.id, uid(), JSON.stringify(first)],
      ),
      /foreign key/,
    );
  } finally {
    await db.close();
  }
});
