import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { seed, uid, Actor } from "../../src/lib/neutronium/model";
import { readViewOnClient } from "../../src/lib/neutronium/read-model";
import { commandOnClient } from "../../src/lib/neutronium/command-store";
import { reportSql } from "../../src/lib/neutronium/pilot-report";
import { claim } from "../../src/lib/neutronium/worker";
import { steps } from "../../src/lib/neutronium/model";
import { workerMutationOnClient } from "../../src/lib/neutronium/worker-store";
test("runtime role enforces tenant scope; list pages and worker writes preserve unrelated records", async () => {
  const db = new PGlite();
  try {
    for (const name of [
      "001_initial.sql",
      "002_social_auth.sql",
      "003_pilot.sql",
      "004_mfa.sql",
      "005_runtime_rls.sql",
    ])
      await db.exec(
        await readFile(`deploy/neutronium/migrations/${name}`, "utf8"),
      );
    const user = uid(),
      w = seed(),
      other = seed();
    w.approvalRule = ["admin"];
    w.demo = false;
    await db.query(
      "insert into neutronium_users(id,email) values($1,'runtime@example.com')",
      [user],
    );
    for (let i = 0; i < 65; i++)
      w.employees.push({
        ...w.employees[0],
        id: uid(),
        email: `person${i}@example.com`,
        firstName: `Person ${i}`,
      });
    w.jobs.push({
      id: uid(),
      employeeId: w.employees[0].id,
      kind: "onboard",
      status: "pending",
      createdAt: new Date().toISOString(),
      scheduledAt: new Date().toISOString(),
      steps: [],
    });
    await db.query("select neutronium_create($1,$2)", [
      JSON.stringify(w),
      user,
    ]);
    await db.query("select neutronium_create($1,$2)", [
      JSON.stringify(other),
      user,
    ]);
    await db.exec("set role neutronium_app");
    assert.equal(
      (await db.query("select * from neutronium_employees")).rows.length,
      0,
    );
    assert.equal(
      (await db.query<{ s: unknown }>("select neutronium_load($1) s", [w.id]))
        .rows[0].s,
      null,
    );
    await db.query("select set_config('neutronium.tenant_id',$1,false)", [
      w.id,
    ]);
    assert.equal(
      (await db.query("select * from neutronium_employees")).rows.length,
      w.employees.length,
    );
    assert.equal(
      (
        await db.query(
          "update neutronium_employees set payload=payload where organization_id=$1 returning id",
          [other.id],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into neutronium_employees(organization_id,id,payload) values($1,$2,$3)",
        [
          other.id,
          uid(),
          JSON.stringify({
            ...other.employees[0],
            email: "forbidden@example.com",
          }),
        ],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        "insert into neutronium_platform_members(user_id,role) values($1,'PLATFORM_OWNER')",
        [user],
      ),
      /permission denied/,
    );
    const client = {
      query: (sql: string, values?: unknown[]) => db.query(sql, values),
      release: () => {},
    } as unknown as PoolClient;
    const actor: Actor = {
      id: user,
      name: "Owner",
      orgId: w.id,
      role: "ORG_OWNER",
      demo: false,
    };
    const first = await readViewOnClient(
      client,
      actor,
      new URLSearchParams({ view: "people" }),
    );
    assert.equal(first.directoryPageIds?.length, 50);
    assert.ok(first.pageInfo?.nextCursor);
    assert.equal(
      first.summary?.employees,
      w.employees.filter((e) => e.status !== "terminated").length,
    );
    const second = await readViewOnClient(
      client,
      actor,
      new URLSearchParams({
        view: "people",
        cursor: first.pageInfo!.nextCursor!,
      }),
    );
    assert.equal(second.directoryPageIds?.length, w.employees.length - 50);
    assert.equal(second.pageInfo?.nextCursor, null);
    assert.equal(
      first.directoryPageIds?.filter((id) =>
        second.directoryPageIds?.includes(id),
      ).length,
      0,
    );
    const employeeView = await readViewOnClient(
      client,
      { ...actor, role: "EMPLOYEE", employeeId: w.employees[0].id },
      new URLSearchParams({ view: "access" }),
    );
    assert.equal(employeeView.employees.length, 1);
    assert.equal(employeeView.employees[0].id, w.employees[0].id);
    assert.equal(employeeView.templates.length, 0);
    const result = await workerMutationOnClient(
      client,
      w.id,
      (state) => {
        assert.ok(state.jobs.length <= 20);
        state.employees[0].firstName = "Worker updated";
        return state.employees[0].id;
      },
      w.jobs[0].id,
    );
    assert.equal(
      (
        await db.query<{ name: string }>(
          "select payload->>'firstName' name from neutronium_employees where id=$1",
          [result],
        )
      ).rows[0].name,
      "Worker updated",
    );
    assert.equal(
      (await db.query("select * from neutronium_employees")).rows.length,
      w.employees.length,
    );
    for (let i = 0; i < 25; i++) {
      const job = {
        ...w.jobs[0],
        id: uid(),
        steps: steps([["Provision", "identity"]]),
      };
      await db.query(
        "insert into neutronium_jobs(organization_id,id,payload) values($1,$2,$3)",
        [w.id, job.id, JSON.stringify(job)],
      );
    }
    const claimed = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const item = await workerMutationOnClient(client, w.id, claim);
      assert.ok(item);
      assert.ok(!claimed.has(item.job.id));
      claimed.add(item.job.id);
    }
    assert.equal(await workerMutationOnClient(client, w.id, claim), null);
    const id = await commandOnClient(client, actor, "request", {
      employeeId: w.employees[1].id,
      applicationId: w.applications.find((a) => a.mode === "development")!.id,
      level: "Read",
      durationMinutes: 60,
      reason: "Pilot database test",
    });
    const beforeRevision = (
      await db.query<{ revision: string }>(
        "select revision from neutronium_organizations where id=$1",
        [w.id],
      )
    ).rows[0].revision;
    await assert.rejects(
      commandOnClient(
        client,
        { ...actor, employeeId: w.employees[1].id },
        "decision",
        { id, decision: "approve" },
      ),
      /not the current approver/,
    );
    assert.equal(
      (
        await db.query<{ revision: string }>(
          "select revision from neutronium_organizations where id=$1",
          [w.id],
        )
      ).rows[0].revision,
      beforeRevision,
    );
    assert.equal((await db.query(reportSql, [w.id])).rows.length, 1);
    assert.equal(
      (await db.query("select id from neutronium_jobs")).rows.length,
      26,
    );

    await db.exec("reset neutronium.tenant_id");
    assert.equal(
      (await db.query("select * from neutronium_jobs")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
