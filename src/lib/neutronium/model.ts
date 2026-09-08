export type Role =
  | "ORG_OWNER"
  | "ORG_ADMIN"
  | "HR_ADMIN"
  | "MANAGER"
  | "APPROVER"
  | "EMPLOYEE"
  | "PLATFORM_OWNER"
  | "PLATFORM_SUPPORT"
  | "PLATFORM_SECURITY"
  | "PLATFORM_READONLY";
export type Actor = {
  id: string;
  name: string;
  role: Role;
  orgId: string;
  employeeId?: string;
  demo: boolean;
};
export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  personalEmail: string;
  title: string;
  department: string;
  managerId: string;
  startDate: string;
  location: string;
  employmentType: string;
  status: "active" | "onboarding" | "offboarding" | "terminated";
  providerId?: string;
  templateId?: string;
  createdAt: string;
};
export type Application = {
  id: string;
  name: string;
  initials: string;
  color: string;
  mode: "development" | "manual" | "coming_soon" | "microsoft";
  url: string;
  ownerId?: string;
  groupId?: string;
  lastSync?: string;
};
export type Template = {
  id: string;
  name: string;
  description: string;
  applications: string[];
  groups: string[];
  licenseId: string;
  active: boolean;
};
export type Grant = {
  id: string;
  employeeId: string;
  applicationId: string;
  level: string;
  status: "active" | "revoking" | "revoked" | "manual_required";
  source: string;
  expiresAt?: string;
  providerRef?: string;
};
export type AccessRequest = {
  id: string;
  employeeId: string;
  applicationId: string;
  level: string;
  reason: string;
  durationMinutes: number;
  status: "pending" | "more_info" | "approved" | "rejected" | "fulfilled";
  stages: ("manager" | "owner" | "admin")[];
  approvals: {
    actorId: string;
    name: string;
    stage: string;
    decision: string;
    at: string;
    note: string;
  }[];
  createdAt: string;
};
export type Step = {
  id: string;
  name: string;
  operation: string;
  status:
    | "pending"
    | "running"
    | "success"
    | "failed"
    | "retrying"
    | "skipped"
    | "manual_required";
  attempts: number;
  error?: string;
  applicationId?: string;
  grantId?: string;
  providerRef?: string;
  lease?: string;
  leaseUntil?: string;
  nextAttemptAt?: string;
};
export type Job = {
  id: string;
  employeeId: string;
  kind: "onboard" | "offboard" | "grant" | "revoke";
  status: "pending" | "running" | "success" | "failed" | "manual_required";
  steps: Step[];
  createdAt: string;
  scheduledAt: string;
  requestId?: string;
  template?: Template;
};
export type Audit = {
  id: string;
  actorId: string;
  actor: string;
  action: string;
  target: string;
  integration: string;
  at: string;
  result: string;
  requestId: string;
  previous?: unknown;
  next?: unknown;
};
export type Notification = {
  id: string;
  recipientId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  emailStatus: "pending" | "sent" | "unconfigured";
  attempts?: number;
  nextAttemptAt?: string;
};
export type Integration = {
  id: string;
  provider: string;
  status: "development" | "disconnected" | "connected" | "error";
  tenantId?: string;
  features: string[];
  checkedAt?: string;
  error?: string;
};
export type Workspace = {
  id: string;
  name: string;
  domain: string;
  revision: number;
  demo: boolean;
  createdAt: string;
  subscription: string;
  approvalRule: ("manager" | "owner" | "admin")[];
  supportNotes: { id: string; author: string; body: string; at: string }[];
  employees: Employee[];
  applications: Application[];
  templates: Template[];
  grants: Grant[];
  requests: AccessRequest[];
  jobs: Job[];
  audit: Audit[];
  notifications: Notification[];
  integrations: Integration[];
};
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const fullName = (e?: Employee) =>
  e ? `${e.firstName} ${e.lastName}` : "Unknown employee";
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const admins: Role[] = ["ORG_OWNER", "ORG_ADMIN"];
export const canManagePeople = (a: Actor) =>
  [...admins, "HR_ADMIN"].includes(a.role);
export const canAdmin = (a: Actor) => admins.includes(a.role);
export const platformRoles: Role[] = [
  "PLATFORM_OWNER",
  "PLATFORM_SUPPORT",
  "PLATFORM_SECURITY",
  "PLATFORM_READONLY",
];
export function requireRole(actor: Actor, roles: Role[]) {
  if (!roles.includes(actor.role))
    throw new DomainError(
      "You do not have permission to perform this action.",
      403,
    );
}
export function audit(
  w: Workspace,
  a: Actor,
  action: string,
  target: string,
  requestId: string,
  previous?: unknown,
  next?: unknown,
  result = "success",
) {
  w.audit.push({
    id: uid(),
    actorId: a.id,
    actor: a.name,
    action,
    target,
    integration: w.demo ? "Development adapter" : "Neutronium",
    at: now(),
    result,
    requestId,
    previous,
    next,
  });
}
export function notify(
  w: Workspace,
  recipientId: string,
  title: string,
  body: string,
) {
  w.notifications.push({
    id: uid(),
    recipientId,
    title,
    body,
    createdAt: now(),
    read: false,
    emailStatus: "pending",
  });
}
export function steps(items: [string, string, string?][]): Step[] {
  return items.map(([name, operation, applicationId]) => ({
    id: uid(),
    name,
    operation,
    applicationId,
    status: "pending",
    attempts: 0,
  }));
}
export function seed(id = uid(), demo = true, name = "Acme Inc."): Workspace {
  const date = now();
  const employees: Employee[] = demo
    ? [
        {
          id: uid(),
          firstName: "Sarah",
          lastName: "Chen",
          email: "sarah@acme.example",
          personalEmail: "",
          title: "Developer",
          department: "Engineering",
          managerId: "",
          startDate: "2026-08-17",
          location: "Toronto, Canada",
          employmentType: "Full-time",
          status: "active",
          createdAt: date,
        },
        {
          id: uid(),
          firstName: "Michael",
          lastName: "Ross",
          email: "michael@acme.example",
          personalEmail: "",
          title: "Finance Manager",
          department: "Finance",
          managerId: "",
          startDate: "2026-06-01",
          location: "New York, USA",
          employmentType: "Full-time",
          status: "active",
          createdAt: date,
        },
        {
          id: uid(),
          firstName: "Alex",
          lastName: "Patel",
          email: "alex@acme.example",
          personalEmail: "",
          title: "Account Executive",
          department: "Sales",
          managerId: "",
          startDate: "2026-07-06",
          location: "Remote",
          employmentType: "Full-time",
          status: "active",
          createdAt: date,
        },
      ]
    : [];
  if (demo) {
    employees[0].managerId = employees[1].id;
    employees[2].managerId = employees[1].id;
  }
  const applications: Application[] = [
    {
      id: uid(),
      name: "Microsoft 365",
      initials: "M",
      color: "#ee754a",
      mode: demo ? "development" : "microsoft",
      url: "https://www.microsoft365.com",
    },
    {
      id: uid(),
      name: "GitHub",
      initials: "G",
      color: "#24292f",
      mode: demo ? "development" : "manual",
      url: "https://github.com",
    },
    {
      id: uid(),
      name: "Slack",
      initials: "S",
      color: "#692a66",
      mode: "manual",
      url: "https://slack.com/signin",
    },
    {
      id: uid(),
      name: "Notion",
      initials: "N",
      color: "#303432",
      mode: "manual",
      url: "https://www.notion.so",
    },
  ];
  const templates = ["Developer", "Finance", "Sales"].map((n, i) => ({
    id: uid(),
    name: n,
    description: [
      "Everything your engineering team needs to get started.",
      "The right tools for your finance team.",
      "A ready-to-go workspace for customer-facing teams.",
    ][i],
    applications: [
      applications[0].id,
      ...(i === 0 ? [applications[1].id] : []),
    ],
    groups: [],
    licenseId: "",
    active: true,
  }));
  const w: Workspace = {
    id,
    name,
    domain: demo ? "acme.example" : "",
    revision: 0,
    demo,
    createdAt: date,
    subscription: demo ? "Development workspace" : "Trial",
    approvalRule: ["manager"],
    supportNotes: [],
    employees,
    applications,
    templates,
    grants: [],
    requests: [],
    jobs: [],
    audit: [],
    notifications: [],
    integrations: [
      {
        id: uid(),
        provider: "Microsoft 365",
        status: demo ? "development" : "disconnected",
        features: demo
          ? ["inventory", "provisioning", "groups", "offboarding", "licenses"]
          : [],
      },
    ],
  };
  if (demo) {
    employees.forEach((e, i) => {
      e.providerId = `dev-${e.id}`;
      e.templateId = templates[i].id;
      templates[i].applications.forEach((applicationId) =>
        w.grants.push({
          id: uid(),
          employeeId: e.id,
          applicationId,
          level: "Standard",
          status: "active",
          source: "Sample data",
        }),
      );
    });
    w.requests.push({
      id: uid(),
      employeeId: employees[0].id,
      applicationId: applications[1].id,
      level: "Admin",
      reason: "Production deployment investigation",
      durationMinutes: 240,
      status: "pending",
      stages: ["manager"],
      approvals: [],
      createdAt: date,
    });
    audit(
      w,
      { id: "system", name: "Neutronium", role: "ORG_OWNER", orgId: id, demo },
      "Development workspace created",
      name,
      uid(),
    );
    notify(
      w,
      employees[1].id,
      "Sarah Chen requested GitHub Admin",
      "Manager approval needed · 4 hours",
    );
  }
  return w;
}
export function project(w: Workspace, actor: Actor): Workspace {
  if (w.id !== actor.orgId) throw new DomainError("Workspace not found.", 404);
  const copy = structuredClone(w);
  if (platformRoles.includes(actor.role)) {
    copy.employees = copy.employees.map((e) => ({
      ...e,
      personalEmail: "",
      location: "",
      startDate: "",
      employmentType: "",
    }));
    if (!["PLATFORM_OWNER", "PLATFORM_SECURITY"].includes(actor.role))
      copy.grants = [];
    copy.notifications = [];
    copy.audit = copy.audit.map((e) => ({
      ...e,
      previous: undefined,
      next: undefined,
    }));
    return copy;
  }
  copy.supportNotes = [];
  if (!canManagePeople(actor)) {
    const own = actor.employeeId;
    const approvable = w.requests.filter((r) => mayApprove(w, actor, r));
    const visibleIds = new Set([own, ...approvable.map((r) => r.employeeId)]);
    copy.employees = copy.employees
      .filter((e) => w.demo || visibleIds.has(e.id))
      .map((e) => ({
        ...e,
        personalEmail: "",
        location: "",
        startDate: "",
        employmentType: "",
      }));
    copy.grants = copy.grants.filter((g) => g.employeeId === own);
    copy.requests = copy.requests.filter(
      (r) => r.employeeId === own || approvable.some((a) => a.id === r.id),
    );
    copy.jobs = copy.jobs.filter((j) => j.employeeId === own);
    copy.audit = copy.audit.filter(
      (e) => e.actorId === actor.id || (own && e.target === own),
    );
    copy.templates = [];
    copy.integrations = [];
    copy.domain = "";
    copy.approvalRule = [];
  }
  copy.notifications = copy.notifications.filter(
    (n) =>
      n.recipientId === actor.employeeId ||
      n.recipientId === actor.id ||
      (n.recipientId === "admins" && canAdmin(actor)),
  );
  return copy;
}
export function mayApprove(w: Workspace, a: Actor, r: AccessRequest) {
  if (
    a.orgId !== w.id ||
    a.employeeId === r.employeeId ||
    !["pending", "more_info"].includes(r.status)
  )
    return false;
  const stage =
    r.stages[r.approvals.filter((v) => v.decision === "approve").length];
  if (stage === "admin") return canAdmin(a);
  if (stage === "manager")
    return (
      !!a.employeeId &&
      ["MANAGER", ...admins].includes(a.role) &&
      w.employees.find((e) => e.id === r.employeeId)?.managerId === a.employeeId
    );
  if (stage === "owner")
    return (
      !!a.employeeId &&
      ["APPROVER", "MANAGER", ...admins].includes(a.role) &&
      w.applications.find((app) => app.id === r.applicationId)?.ownerId ===
        a.employeeId
    );
  return false;
}
