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
import {
  intakeDetails,
  intakeOptions,
  openApplication,
  applicationPath,
  type IntakeDetails,
} from "./intake";
import { joinPath } from "./onboarding-link";

export type Applicant = { id: string; email: string };
export type EmployeeApplication = {
  id: string;
  organization_id: string;
  user_id: string | null;
  email: string;
  details: IntakeDetails;
  status: "pending" | "in_review" | "more_info" | "accepted" | "declined";
  revision: number;
  workflow_status?: string;
  contact_email?: string;
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
        ? `${a.name} ${action.endsWith("updated") ? "updated" : "submitted"} an employee application. Open Employee approvals to review it.`
        : "Your employee application was accepted. Open Neutronium to view your workspace and onboarding tasks.",
    );
  if (w.notifications[0])
    w.notifications[0].href =
      recipient === "admins"
        ? applicationPath(a.orgId, target)
        : `/neutronium/?org=${a.orgId}&view=profile`;
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
export const applicationSelect =
  "select a.*,coalesce(u.email,a.contact_email) email,j.payload->>'status' workflow_status from neutronium_employee_applications a left join neutronium_users u on u.id=a.user_id left join neutronium_jobs j on j.organization_id=a.organization_id and j.id=a.job_id";
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
    const catalogs =
      user && (link.usable || own)
        ? await client.query(
            "select metadata, (select coalesce(jsonb_agg(payload),'[]') from neutronium_employees where organization_id=$1) employees, (select coalesce(jsonb_agg(payload),'[]') from neutronium_templates where organization_id=$1) templates from neutronium_organizations where id=$1",
            [orgId],
          )
        : null;
    return {
      options: catalogs?.rows[0] ? intakeOptions(catalogs.rows[0]) : undefined,
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
          "select 1 from neutronium_employee_applications a left join neutronium_users u on u.id=a.user_id where a.organization_id=$1 and (a.user_id=$2 or lower(coalesce(u.email,a.contact_email))=$3) and a.status in ('pending','in_review','more_info','accepted')",
          [orgId, user.id, verified.email.toLowerCase()],
        )
      ).rows.length
    )
      throw new DomainError(
        "You already have an application with this company. Check the original invitation for its status.",
        409,
      );
    const details = intakeDetails(input);
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
  const status = params.get("status") || "all";
  if (
    ![
      "all",
      "pending",
      "in_review",
      "more_info",
      "accepted",
      "complete",
      "declined",
    ].includes(status)
  )
    throw new DomainError("Choose a valid review status.");
  const cursor = params.get("cursor") || "";
  if (cursor) id(cursor);
  const selected = params.get("id");
  if (selected) id(selected);
  const client = await tenantConnection(a.orgId);
  try {
    const applications = (
      await client.query(
        `${applicationSelect} where a.organization_id=$1
         and ($2='all' or a.status=$2 and ($2<>'accepted' or j.payload->>'status' is distinct from 'success') or $2='complete' and a.status='accepted' and j.payload->>'status'='success')
         and ($3::uuid is null or (a.submitted_at,a.id)<(select submitted_at,id from neutronium_employee_applications where organization_id=$1 and id=$3))
         and ($4::uuid is null or a.id=$4)
         and concat_ws(' ',a.details::text,u.email,a.contact_email) ilike $5
         and ($6='' or a.details->>'department'=$6)
         and ($7='' or a.details->>'startDate'>=$7) and ($8='' or a.details->>'startDate'<=$8)
         order by a.submitted_at desc,a.id desc limit 26`,
        [
          a.orgId,
          status,
          cursor || null,
          selected || null,
          `%${(params.get("q") || "").slice(0, 150).replace(/[\\%_]/g, "\\$&")}%`,
          params.get("department") || "",
          params.get("startFrom") || "",
          params.get("startTo") || "",
        ],
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
        "select count(*)::int n from neutronium_employee_applications where organization_id=$1 and status in ('pending','in_review','more_info')",
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
  requireRole(a, admins);
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
    requireRole(a, admins);
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
    if (!openApplication(application.status)) {
      if (application.status !== input.decision)
        throw new DomainError(
          "Another administrator has already reviewed this application. Refresh to see their decision.",
          409,
        );
      await client.query("commit");
      return application;
    }
    if (
      !Number.isInteger(input.revision) ||
      input.revision !== application.revision
    )
      throw new DomainError(
        "This application changed. Refresh it before making a decision.",
        409,
      );
    let employeeId: string | null = null,
      jobId: string | null = null;
    if (input.decision === "accepted") {
      if (
        application.user_id &&
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
            email:
              input.email ||
              application.details.companyEmail ||
              application.email,
            personalEmail: application.email,
            title: input.title ?? application.details.title,
            location: input.location ?? application.details.location,
            department: input.department || application.details.department,
            startDate: input.startDate || application.details.startDate,
            managerId: input.managerId ?? application.details.managerId ?? "",
            employmentType:
              input.employmentType ||
              application.details.employmentType ||
              "Full-time",
            usageLocation:
              input.usageLocation || application.details.usageLocation || "",
            templateId: input.templateId || application.details.templateId,
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
      if (application.user_id)
        for (const step of job.steps)
          if (step.operation === "invitation") {
            step.operation = "accepted_invitation";
            step.name = "Confirm employee portal membership";
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
      if (application.user_id)
        await client.query(
          "insert into neutronium_memberships(organization_id,user_id,role,employee_id) values($1,$2,'EMPLOYEE',$3)",
          [a.orgId, application.user_id, employeeId],
        );
    }
    const result = (
      await client.query(
        "update neutronium_employee_applications set status=$3,revision=revision+1,reviewed_at=now(),reviewed_by=$4,decision_note=$5,employee_id=$6,job_id=$7 where organization_id=$1 and id=$2 returning *",
        [a.orgId, applicationId, input.decision, a.id, note, employeeId, jobId],
      )
    ).rows[0];
    await events(
      client,
      a,
      `Employee application ${input.decision}`,
      applicationId,
      { employeeId, userId: application.user_id, note },
      input.decision === "accepted"
        ? application.user_id || undefined
        : undefined,
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

export async function createStaffApplication(
  a: Actor,
  input: Record<string, unknown>,
) {
  requireRole(a, reviewers);
  if (a.demo)
    throw new DomainError(
      "Use manual onboarding in the development workspace.",
    );
  return createStaffApplicationOnClient(
    await tenantConnection(a.orgId),
    a,
    input,
  );
}
export async function createStaffApplicationOnClient(
  client: PoolClient,
  a: Actor,
  input: Record<string, unknown>,
) {
  try {
    requireRole(a, reviewers);
    const details = intakeDetails(
      { ...input, companyEmail: input.companyEmail || input.email },
      true,
    );
    const email = String(input.personalEmail || input.email || "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new DomainError("Enter a valid employee email.");
    await client.query("begin");
    await client.query(
      "select id from neutronium_organizations where id=$1 for update",
      [a.orgId],
    );
    if (
      (
        await client.query(
          `${applicationSelect} where a.organization_id=$1 and a.status<>'declined' and lower(coalesce(u.email,a.contact_email))=$2`,
          [a.orgId, email],
        )
      ).rows.length
    )
      throw new DomainError(
        "An application already exists for this email. Open it to make changes.",
        409,
      );
    const application = (
      await client.query(
        "insert into neutronium_employee_applications(id,organization_id,contact_email,details,submitted_by) values($1,$2,$3,$4,$5) returning *",
        [uid(), a.orgId, email, JSON.stringify(details), a.id],
      )
    ).rows[0];
    await events(
      client,
      a,
      "Employee application submitted",
      application.id,
      { source: "staff" },
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

export async function updateEmployeeApplication(
  a: Actor,
  input: Record<string, unknown>,
) {
  requireRole(a, reviewers);
  if (a.demo)
    throw new DomainError("Employee applications require a company workspace.");
  return updateApplicationOnClient(await tenantConnection(a.orgId), a, input);
}
export async function updateOwnApplication(
  token: string,
  user: Applicant,
  input: Record<string, unknown>,
) {
  const { client, orgId, linkId } = await invitationClient(token);
  return updateApplicationOnClient(
    client,
    { id: user.id, name: user.email, orgId, role: "EMPLOYEE", demo: false },
    input,
    linkId,
  );
}
export async function updateApplicationOnClient(
  client: PoolClient,
  a: Actor,
  input: Record<string, unknown>,
  linkId?: string,
) {
  try {
    const staff = reviewers.includes(a.role);
    if (!staff && a.role !== "EMPLOYEE")
      throw new DomainError("You do not have permission.", 403);
    const applicationId = id(input.id);
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
    ).rows[0];
    if (
      !application ||
      (!staff &&
        (application.user_id !== a.id ||
          (linkId && application.link_id !== linkId)))
    )
      throw new DomainError("Application not found.", 404);
    if (!openApplication(application.status))
      throw new DomainError(
        "This application has already been decided. Update the employee record in People instead.",
        409,
      );
    if (
      !Number.isInteger(input.revision) ||
      input.revision !== application.revision
    )
      throw new DomainError(
        "This application changed. Refresh it before saving your changes.",
        409,
      );
    const status = staff
      ? String(input.status || application.status)
      : "pending";
    if (!openApplication(status))
      throw new DomainError(
        "Only an administrator can approve or decline an application.",
        403,
      );
    const details = intakeDetails({ ...application.details, ...input }, staff);
    if (!staff)
      for (const key of ["companyEmail", "managerId", "templateId"] as const)
        details[key] = application.details[key];
    const note = staff
      ? text(
          input.decisionNote ?? application.decision_note,
          "a review note",
          2000,
        )
      : application.decision_note;
    const updated = (
      await client.query(
        "update neutronium_employee_applications set details=$3,status=$4,decision_note=$5,revision=revision+1 where organization_id=$1 and id=$2 returning *",
        [a.orgId, applicationId, JSON.stringify(details), status, note],
      )
    ).rows[0];
    await events(
      client,
      a,
      "Employee application updated",
      applicationId,
      { status },
      "admins",
    );
    await client.query("commit");
    return updated;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
