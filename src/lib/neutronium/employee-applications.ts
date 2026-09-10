import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import {
  Actor,
  DomainError,
  Workspace,
  admins,
  requireRole,
  uid,
  audit,
  notify,
  steps,
} from "./model";
import { postgres, tenantConnection } from "./postgres";
import { commandOnClient } from "./command-store";
import { joinPath } from "./onboarding-link";

export type Applicant = { id: string; email: string };
export type EmployeeApplication = {
  id: string;
  organization_id: string;
  user_id: string;
  email: string;
  details: {
    firstName: string;
    lastName: string;
    title: string;
    location: string;
    note: string;
  };
  status: "pending" | "accepted" | "declined";
  submitted_at: string;
  reviewed_at?: string;
  decision_note: string;
  employee_id?: string;
  job_id?: string;
};
const reviewers = [...admins, "HR_ADMIN"] as Actor["role"][];
function text(value: unknown, label: string, max: number, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new DomainError(
      `Enter ${label}${required ? "" : " if needed"}, using ${max} characters or fewer.`,
    );
  return value.trim();
}
function id(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value))
    throw new DomainError("Invalid application or invitation.");
  return value;
}
async function events(
  client: PoolClient,
  a: Actor,
  action: string,
  target: string,
  next?: unknown,
  recipient?: string,
) {
  const w = {
    demo: false,
    audit: [],
    notifications: [],
  } as unknown as Workspace;
  audit(w, a, action, target, uid(), undefined, next);
  if (recipient)
    notify(
      w,
      recipient,
      action,
      recipient === "admins"
        ? `${a.name} submitted an employee application. Open Employee approvals to review it.`
        : "Your employee application was accepted. Open Neutronium to view your workspace and onboarding tasks.",
    );
  for (const bucket of ["audit", "notifications"] as const)
    for (const item of w[bucket])
      await client.query(
        `insert into neutronium_${bucket}(organization_id,id,payload) values($1,$2,$3)`,
        [a.orgId, item.id, JSON.stringify(item)],
      );
}
export async function createOnboardingLink(a: Actor) {
  requireRole(a, reviewers);
  if (a.demo)
    throw new DomainError(
      "Shareable invitations are available in a company workspace. Use manual onboarding to try the development demo.",
    );
  const client = await tenantConnection(a.orgId);
  const token = randomBytes(32).toString("base64url");
  try {
    await client.query("begin");
    const link = (
      await client.query(
        "insert into neutronium_onboarding_links(id,organization_id,token_hash,created_by,expires_at) values($1,$2,$3,$4,now()+interval '7 days') returning id,expires_at",
        [
          uid(),
          a.orgId,
          createHash("sha256").update(token).digest("hex"),
          a.id,
        ],
      )
    ).rows[0];
    await events(client, a, "Employee invitation link created", link.id);
    await client.query("commit");
    return { ...link, path: joinPath(token) };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
async function invitationClient(token: string) {
  joinPath(token);
  const link = (
    await postgres().query(
      "select * from neutronium_resolve_onboarding_link($1)",
      [createHash("sha256").update(token).digest("hex")],
    )
  ).rows[0];
  if (!link)
    throw new DomainError(
      "This invitation is invalid. Ask your administrator for a new link.",
      404,
    );
  return {
    client: await tenantConnection(link.organization_id),
    orgId: link.organization_id,
    linkId: link.id,
  };
}
const applicationSelect =
  "select a.*,u.email from neutronium_employee_applications a join neutronium_users u on u.id=a.user_id";
export async function readInvitation(token: string, user?: Applicant | null) {
  const { client, orgId, linkId } = await invitationClient(token);
  try {
    const link = (
      await client.query(
        "select l.*,o.name as company_name,l.expires_at>now() and l.revoked_at is null as usable from neutronium_onboarding_links l join neutronium_organizations o on o.id=l.organization_id where l.id=$1 and l.organization_id=$2",
        [linkId, orgId],
      )
    ).rows[0];
    const application = (
      await client.query(
        `${applicationSelect} where a.organization_id=$1 and a.link_id=$2`,
        [orgId, linkId],
      )
    ).rows[0];
    const own = !!user && application?.user_id === user.id;
    return {
      companyName: link.company_name,
      expiresAt: link.expires_at,
      available: !!link.usable && !application,
      application: own ? application : null,
    };
  } finally {
    client.release();
  }
}
export async function submitApplication(
  token: string,
  user: Applicant,
  input: Record<string, unknown>,
) {
  const { client, orgId, linkId } = await invitationClient(token);
  return submitApplicationOnClient(client, orgId, linkId, user, input);
}
export async function submitApplicationOnClient(
  client: PoolClient,
  orgId: string,
  linkId: string,
  user: Applicant,
  input: Record<string, unknown>,
) {
  try {
    await client.query("begin");
    await client.query(
      "select id from neutronium_organizations where id=$1 for update",
      [orgId],
    );
    const verified = (
      await client.query(
        "select id,email from neutronium_users where id=$1 and verified",
        [user.id],
      )
    ).rows[0];
    if (!verified)
      throw new DomainError(
        "Confirm your email before submitting your employee application.",
        403,
      );
    const existing = (
      await client.query(
        "select * from neutronium_employee_applications where organization_id=$1 and link_id=$2",
        [orgId, linkId],
      )
    ).rows[0];
    if (existing?.user_id === user.id) {
      await client.query("commit");
      return existing;
    }
    const link = (
      await client.query(
        "select id from neutronium_onboarding_links where organization_id=$1 and id=$2 and expires_at>now() and revoked_at is null for update",
        [orgId, linkId],
      )
    ).rows[0];
    if (!link || existing)
      throw new DomainError(
        "This invitation is no longer available. Ask your administrator for a new link.",
        410,
      );
    if (
      (
        await client.query(
          "select 1 from neutronium_memberships where organization_id=$1 and user_id=$2",
          [orgId, user.id],
        )
      ).rows.length
    )
      throw new DomainError(
        "Your account is already associated with this company. Sign in to your workspace, or ask an administrator to review your existing membership.",
        409,
      );
    if (
      (
        await client.query(
          "select 1 from neutronium_employee_applications where organization_id=$1 and user_id=$2 and status in ('pending','accepted')",
          [orgId, user.id],
        )
      ).rows.length
    )
      throw new DomainError(
        "You already have an application with this company. Check the original invitation for its status.",
        409,
      );
    const details = {
      firstName: text(input.firstName, "your first name", 100, true),
      lastName: text(input.lastName, "your last name", 100, true),
      title: text(input.title ?? "", "your job title", 100),
      location: text(input.location ?? "", "your location", 100),
      note: text(input.note ?? "", "a message for the administrator", 2000),
    };
    const application = (
      await client.query(
        "insert into neutronium_employee_applications(id,organization_id,link_id,user_id,details) values($1,$2,$3,$4,$5) returning *",
        [uid(), orgId, linkId, user.id, JSON.stringify(details)],
      )
    ).rows[0];
    await events(
      client,
      {
        id: user.id,
        name: `${details.firstName} ${details.lastName}`,
        orgId,
        role: "EMPLOYEE",
        demo: false,
      },
      "Employee application submitted",
      application.id,
      { email: verified.email },
      "admins",
    );
    await client.query("commit");
    return application;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
export async function listEmployeeApplications(
  a: Actor,
  params: URLSearchParams,
) {
  requireRole(a, reviewers);
  if (a.demo)
    return { applications: [], links: [], pendingCount: 0, nextCursor: null };
  const status = params.get("status") || "pending";
  if (!["pending", "accepted", "declined"].includes(status))
    throw new DomainError("Choose a valid review status.");
  const cursor = params.get("cursor") || "";
  if (cursor) id(cursor);
  const client = await tenantConnection(a.orgId);
  try {
    const applications = (
      await client.query(
        `${applicationSelect} where a.organization_id=$1 and a.status=$2 and ($3::uuid is null or (a.submitted_at,a.id)<(select submitted_at,id from neutronium_employee_applications where organization_id=$1 and id=$3)) order by a.submitted_at desc,a.id desc limit 26`,
        [a.orgId, status, cursor || null],
      )
    ).rows;
    const links = (
      await client.query(
        "select l.id,l.created_at,l.expires_at from neutronium_onboarding_links l where l.organization_id=$1 and l.revoked_at is null and l.expires_at>now() and not exists(select 1 from neutronium_employee_applications a where a.link_id=l.id) order by l.created_at desc limit 25",
        [a.orgId],
      )
    ).rows;
    const count = (
      await client.query(
        "select count(*)::int n from neutronium_employee_applications where organization_id=$1 and status='pending'",
        [a.orgId],
      )
    ).rows[0].n;
    return {
      applications: applications.slice(0, 25),
      links,
      pendingCount: count,
      nextCursor: applications.length > 25 ? applications[24].id : null,
    };
  } finally {
    client.release();
  }
}
export async function revokeOnboardingLink(a: Actor, linkId: string) {
  requireRole(a, reviewers);
  id(linkId);
  const client = await tenantConnection(a.orgId);
  try {
    await client.query("begin");
    await client.query(
      "select id from neutronium_organizations where id=$1 for update",
      [a.orgId],
    );
    const link = (
      await client.query(
        "update neutronium_onboarding_links set revoked_at=coalesce(revoked_at,now()) where id=$1 and organization_id=$2 returning id",
        [linkId, a.orgId],
      )
    ).rows[0];
    if (!link)
      throw new DomainError("Invitation not found in this company.", 404);
    await events(client, a, "Employee invitation link revoked", linkId);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
export async function reviewEmployeeApplication(
  a: Actor,
  input: Record<string, unknown>,
) {
  requireRole(a, reviewers);
  if (a.demo)
    throw new DomainError("Employee applications require a company workspace.");
  return reviewApplicationOnClient(await tenantConnection(a.orgId), a, input);
}
export async function reviewApplicationOnClient(
  client: PoolClient,
  a: Actor,
  input: Record<string, unknown>,
) {
  try {
    requireRole(a, reviewers);
    const applicationId = id(input.id);
    if (!["accepted", "declined"].includes(String(input.decision)))
      throw new DomainError("Choose Accept or Decline.");
    const note = text(input.note ?? "", "a decision note", 2000);
    await client.query("begin");
    await client.query(
      "select id from neutronium_organizations where id=$1 for update",
      [a.orgId],
    );
    const application = (
      await client.query(
        `${applicationSelect} where a.organization_id=$1 and a.id=$2 for update of a`,
        [a.orgId, applicationId],
      )
    ).rows[0] as EmployeeApplication | undefined;
    if (!application)
      throw new DomainError("Application not found in this company.", 404);
    if (application.status !== "pending") {
      if (application.status !== input.decision)
        throw new DomainError(
          "Another administrator has already reviewed this application. Refresh to see their decision.",
          409,
        );
      await client.query("commit");
      return application;
    }
    let employeeId: string | null = null,
      jobId: string | null = null;
    if (input.decision === "accepted") {
      if (
        !(
          await client.query(
            "select 1 from neutronium_users where id=$1 and verified",
            [application.user_id],
          )
        ).rows.length
      )
        throw new DomainError(
          "The employee must confirm their email before being accepted.",
          409,
        );
      if (
        (
          await client.query(
            "select 1 from neutronium_memberships where organization_id=$1 and user_id=$2",
            [a.orgId, application.user_id],
          )
        ).rows.length
      )
        throw new DomainError(
          "This account already has a company membership. Review that membership before continuing.",
          409,
        );
      jobId = String(
        await commandOnClient(
          client,
          a,
          "onboard",
          {
            firstName: application.details.firstName,
            lastName: application.details.lastName,
            email: input.email,
            personalEmail: application.email,
            title: input.title ?? application.details.title,
            location: input.location ?? application.details.location,
            department: input.department,
            startDate: input.startDate,
            managerId: input.managerId || "",
            employmentType: input.employmentType || "Full-time",
            usageLocation: input.usageLocation || "",
            templateId: input.templateId,
          },
          false,
        ),
      );
      const job = (
        await client.query(
          "select payload from neutronium_jobs where organization_id=$1 and id=$2",
          [a.orgId, jobId],
        )
      ).rows[0].payload;
      employeeId = job.employeeId;
      for (const step of job.steps)
        if (step.operation === "invitation") {
          step.status = "success";
          step.note =
            "Verified employee account accepted by an administrator; employee portal membership assigned.";
        }
      job.steps.push(
        ...steps([["Arrange secure Microsoft first sign-in", "first_signin"]]),
      );
      await client.query(
        "update neutronium_jobs set payload=$3 where organization_id=$1 and id=$2",
        [a.orgId, jobId, JSON.stringify(job)],
      );
      await client.query(
        "insert into neutronium_memberships(organization_id,user_id,role,employee_id) values($1,$2,'EMPLOYEE',$3)",
        [a.orgId, application.user_id, employeeId],
      );
    }
    const result = (
      await client.query(
        "update neutronium_employee_applications set status=$3,reviewed_at=now(),reviewed_by=$4,decision_note=$5,employee_id=$6,job_id=$7 where organization_id=$1 and id=$2 returning *",
        [a.orgId, applicationId, input.decision, a.id, note, employeeId, jobId],
      )
    ).rows[0];
    await events(
      client,
      a,
      `Employee application ${input.decision}`,
      applicationId,
      { employeeId, userId: application.user_id, note },
      input.decision === "accepted" ? application.user_id : undefined,
    );
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
