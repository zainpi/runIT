import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { seed, uid, type Actor } from "../../src/lib/neutronium/model";
import { executeStep } from "../../src/lib/neutronium/providers";
import {
  createOnboardingLink,
  submitApplicationOnClient,
  reviewApplicationOnClient,
} from "../../src/lib/neutronium/employee-applications";
import {
  joinPath,
  safeAuthReturn,
} from "../../src/lib/neutronium/onboarding-link";

test("invitation return paths cannot redirect outside the join flow", () => {
  const token = randomBytes(32).toString("base64url");
  assert.equal(
    safeAuthReturn(joinPath(token)),
    `/neutronium/join/?token=${token}`,
  );
  for (const bad of [
    "https://evil.example",
    "//evil.example",
    "/neutronium/join/?token=short",
    `${joinPath(token)}&next=https://evil.example`,
    null,
  ])
    assert.equal(safeAuthReturn(bad), "/neutronium/?view=profile");
  assert.throws(() => joinPath("../other"));
});

test("employee applications enforce verified identities, tenant boundaries and atomic reviewed onboarding", async (t) => {
  const db = new PGlite();
  try {
    for (const migration of [
      "001_initial.sql",
      "002_social_auth.sql",
      "003_pilot.sql",
      "004_mfa.sql",
      "005_runtime_rls.sql",
      "007_employee_applications.sql",
    ])
      await db.exec(
        await readFile(`deploy/neutronium/migrations/${migration}`, "utf8"),
      );
    const w = seed(),
      other = seed();
    w.demo = false;
    other.demo = false;
    const ownerId = uid(),
      applicant = { id: uid(), email: "applicant@example.com" },
      declined = { id: uid(), email: "declined@example.com" },
      unverified = { id: uid(), email: "unverified@example.com" };
    for (const user of [
      { id: ownerId, email: "reviewer@example.com" },
      applicant,
      declined,
      unverified,
    ])
      await db.query(
        "insert into neutronium_users(id,email,verified) values($1,$2,$3)",
        [user.id, user.email, user.id !== unverified.id],
      );
    for (const workspace of [w, other])
      await db.query("select neutronium_create($1,$2)", [
        JSON.stringify(workspace),
        ownerId,
      ]);
    // Old app instances can still issue tokens during the additive migration.
    await db.query("insert into neutronium_auth_tokens values($1,$2,'signup',now()+interval '1 day')", ["legacy-token", ownerId]);
    assert.equal((await db.query<any>("select return_to from neutronium_auth_tokens where token_hash='legacy-token'")).rows[0].return_to, null);
    const actor: Actor = {
      id: ownerId,
      name: "Reviewer",
      orgId: w.id,
      role: "ORG_OWNER",
      demo: false,
    };
    const client = {
      query: (sql: string, values?: unknown[]) => db.query(sql, values),
      release() {},
    } as unknown as PoolClient;
    async function scope(org = w.id) {
      await db.exec("set role neutronium_app");
      await db.query("select set_config('neutronium.tenant_id',$1,false)", [
        org,
      ]);
    }
    async function link(expires = "1 day", revoked = false, org = w.id) {
      await scope(org);
      const id = uid(),
        token = randomBytes(32).toString("base64url"),
        hash = createHash("sha256").update(token).digest("hex");
      await db.query(
        "insert into neutronium_onboarding_links(id,organization_id,token_hash,created_by,expires_at,revoked_at) values($1,$2,$3,$4,now()+$5::interval,case when $6 then now() else null end)",
        [id, org, hash, ownerId, expires, revoked],
      );
      return { id, token, hash };
    }
    const first = await link(),
      unused = await link(),
      declineLink = await link();
    const details = {
      firstName: "Sam",
      lastName: "Lee",
      title: "Developer",
      location: "Toronto",
      note: "Ready to join",
    };
    const counts = async () =>
      (
        await db.query(
          "select (select count(*) from neutronium_employees)::int employees,(select count(*) from neutronium_jobs)::int jobs,(select count(*) from neutronium_memberships where organization_id=$1)::int members",
          [w.id],
        )
      ).rows[0];
    let application: any;
    await t.test(
      "tokens resolve minimally and unscoped runtime SQL cannot read applications or links",
      async () => {
        await db.exec("reset neutronium.tenant_id");
        assert.equal(
          (await db.query("select * from neutronium_onboarding_links")).rows
            .length,
          0,
        );
        assert.equal(
          (await db.query("select * from neutronium_employee_applications"))
            .rows.length,
          0,
        );
        assert.deepEqual(
          (
            await db.query(
              "select * from neutronium_resolve_onboarding_link($1)",
              [first.hash],
            )
          ).rows,
          [{ id: first.id, organization_id: w.id }],
        );
        assert.equal(
          (
            await db.query(
              "select * from neutronium_resolve_onboarding_link('invalid')",
            )
          ).rows.length,
          0,
        );
        await scope();
        await assert.rejects(
          createOnboardingLink({ ...actor, role: "EMPLOYEE" }),
          /permission/,
        );
      },
    );
    await t.test(
      "submission requires a verified account and creates only a pending application",
      async () => {
        const before = await counts();
        await assert.rejects(
          submitApplicationOnClient(
            client,
            w.id,
            first.id,
            unverified,
            details,
          ),
          /Confirm your email/,
        );
        application = await submitApplicationOnClient(
          client,
          w.id,
          first.id,
          { ...applicant, email: "spoofed@example.com" },
          { ...details, role: "ORG_OWNER", organization_id: other.id },
        );
        assert.equal(application.status, "pending");
        assert.equal(application.organization_id, w.id);
        assert.deepEqual(await counts(), before);
        assert.equal(
          (
            await db.query(
              "select * from neutronium_memberships where user_id=$1",
              [applicant.id],
            )
          ).rows.length,
          0,
        );
        const retry = await submitApplicationOnClient(
          client,
          w.id,
          first.id,
          applicant,
          { ...details, firstName: "Changed" },
        );
        assert.equal(retry.id, application.id);
        assert.equal(retry.details.firstName, "Sam");
        await assert.rejects(
          submitApplicationOnClient(client, w.id, first.id, declined, details),
          /no longer available/,
        );
        await assert.rejects(
          submitApplicationOnClient(
            client,
            w.id,
            unused.id,
            applicant,
            details,
          ),
          /already have an application/,
        );
      },
    );
    const accept = () => ({
      id: application.id,
      decision: "accepted",
      email: "sam@company.example",
      department: "Engineering",
      startDate: "2026-10-01",
      templateId: w.templates[0].id,
      role: "ORG_OWNER",
    });
    await t.test("unauthorized and cross-company reviews fail", async () => {
      await assert.rejects(
        reviewApplicationOnClient(
          client,
          { ...actor, role: "EMPLOYEE", id: applicant.id },
          accept(),
        ),
        /permission/,
      );
      await scope(other.id);
      await assert.rejects(
        reviewApplicationOnClient(
          client,
          { ...actor, orgId: other.id },
          accept(),
        ),
        /not found/,
      );
      assert.equal(
        (
          await db.query(
            "select * from neutronium_employee_applications where organization_id=$1",
            [w.id],
          )
        ).rows.length,
        0,
      );
      await scope();
      await assert.rejects(
        reviewApplicationOnClient(client, actor, {
          ...accept(),
          templateId: uid(),
        }),
        /not found/,
      );
    });
    await t.test(
      "failure after creating the workflow rolls back employee, job, membership and review",
      async () => {
        const before = await counts();
        await db.exec("reset role");
        await db.exec(
          `alter table neutronium_memberships add constraint simulate_membership_failure check(user_id<>'${applicant.id}'::uuid)`,
        );
        await scope();
        await assert.rejects(
          reviewApplicationOnClient(client, actor, accept()),
          /simulate_membership_failure/,
        );
        assert.deepEqual(await counts(), before);
        assert.equal(
          (
            await db.query<{ status: string }>(
              "select status from neutronium_employee_applications where id=$1",
              [application.id],
            )
          ).rows[0].status,
          "pending",
        );
        await db.exec(
          "reset role; alter table neutronium_memberships drop constraint simulate_membership_failure",
        );
        await scope();
      },
    );
    await t.test(
      "acceptance grants only employee membership and retries cannot create another workflow",
      async () => {
        const result = await reviewApplicationOnClient(client, actor, accept());
        assert.equal(result.status, "accepted");
        assert.ok(result.employee_id && result.job_id);
        const member = (
          await db.query<any>(
            "select * from neutronium_memberships where organization_id=$1 and user_id=$2",
            [w.id, applicant.id],
          )
        ).rows[0];
        assert.equal(member.role, "EMPLOYEE");
        assert.equal(member.employee_id, result.employee_id);
        const employee = (
          await db.query<any>(
            "select payload from neutronium_employees where id=$1",
            [result.employee_id],
          )
        ).rows[0].payload;
        assert.equal(employee.email, "sam@company.example");
        assert.equal(employee.personalEmail, applicant.email);
        const job = (
          await db.query<any>(
            "select payload from neutronium_jobs where id=$1",
            [result.job_id],
          )
        ).rows[0].payload;
        assert.equal(
          job.steps.find((step: any) => step.operation === "invitation").status,
          "success",
        );
        const firstSignIn = job.steps.find(
          (step: any) => step.operation === "first_signin",
        );
        assert.equal(firstSignIn.status, "pending");
        assert.equal(
          (await executeStep({ ...w, employees: [employee] }, job, firstSignIn))
            .status,
          "manual_required",
        );
        const beforeRetry = await counts();
        assert.equal(
          (await reviewApplicationOnClient(client, actor, accept())).id,
          result.id,
        );
        assert.deepEqual(await counts(), beforeRetry);
        await assert.rejects(
          reviewApplicationOnClient(client, actor, {
            id: application.id,
            decision: "declined",
          }),
          /already reviewed/,
        );
      },
    );
    await t.test(
      "decline grants nothing; old links cannot resubmit, but a new invitation permits a new review",
      async () => {
        const before = await counts();
        const request = await submitApplicationOnClient(
          client,
          w.id,
          declineLink.id,
          declined,
          details,
        );
        const result = await reviewApplicationOnClient(client, actor, {
          id: request.id,
          decision: "declined",
          note: "Please contact HR.",
        });
        assert.equal(result.status, "declined");
        assert.equal(result.decision_note, "Please contact HR.");
        assert.deepEqual(await counts(), before);
        assert.equal(
          (
            await submitApplicationOnClient(
              client,
              w.id,
              declineLink.id,
              declined,
              details,
            )
          ).status,
          "declined",
        );
        const again = await link();
        assert.equal(
          (
            await submitApplicationOnClient(
              client,
              w.id,
              again.id,
              declined,
              details,
            )
          ).status,
          "pending",
        );
      },
    );
    await t.test(
      "expired, revoked and wrong-tenant invitations cannot create applications",
      async () => {
        for (const invitation of [
          await link("-1 second"),
          await link("1 day", true),
        ])
          await assert.rejects(
            submitApplicationOnClient(
              client,
              w.id,
              invitation.id,
              applicant,
              details,
            ),
            /no longer available/,
          );
        const foreign = await link("1 day", false, other.id);
        await scope();
        await assert.rejects(
          submitApplicationOnClient(
            client,
            w.id,
            foreign.id,
            applicant,
            details,
          ),
          /no longer available/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
