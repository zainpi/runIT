"use client";
import { ToolFinder, sectionViewLabels, workspaceSections } from "./navigation";
import { AttentionItems, PeopleOverview } from "./people-overview";
import { MicrosoftReadiness } from "./microsoft-readiness";
import { SecuritySettings } from "./security-settings";
import { EmployeeApprovals, OnboardingInvite } from "./employee-approvals";
import { ValidatedForm } from "./form";
import { requestJson } from "./http";
import { Operations } from "./operations";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Actor,
  Workspace,
  Employee,
  Template,
  Job,
  AccessRequest,
  canManagePeople,
  canAdmin,
  fullName,
  mayApprove,
  platformRoles,
} from "@/lib/neutronium/model";
import { Icon, Mark } from "./icons";
import Link from "next/link";
import { TestEnvironments } from "./test-environments";
import { Connections, AccountRisk } from "./team-tools";
type Config = {
  socialProviders?: string[];
  demoAvailable: boolean;
  authConfigured: boolean;
  microsoftFeatures: Record<
    string,
    { name: string; permissions: string[]; reason: string }
  >;
};
type Dialog = { kind: string; id?: string };
const titles: Record<string, string> = {
  "employee-approvals": "Employee approvals",
  environments: "Test environments",
  help: "Employee help",
  security: "Account risk",
  overview: "Home",
  people: "People",
  onboarding: "Workflows",
  access: "Access requests",
  applications: "Applications",
  permissions: "Permissions",
  integrations: "Integrations",
  audit: "Audit log",
  settings: "Settings",
  templates: "Role templates",
  import: "Migration & import",
  home: "My workspace",
  apps: "My applications",
  myaccess: "My access",
  requests: "My requests",
  profile: "My profile",
  companies: "Companies",
  jobs: "Automation jobs",
  alerts: "Review items",
  support: "Support",
  notifications: "Notifications",
};
const descriptions: Record<string, string> = {
  "employee-approvals":
    "Review employee signups before granting company access and starting onboarding.",
  environments:
    "Staging, production, and the tester accounts that belong to each.",
  overview: "Start a task or pick up what needs your attention.",
  people: "Everyone in your organization, in one place.",
  onboarding: "Track onboarding, offboarding, and account changes.",
  access: "The right access, for the right people, at the right time.",
  applications: "Your company’s tools, connected and accounted for.",
  permissions: "A clear picture of who has access to what.",
  integrations: "Connect your providers. Keep control of every permission.",
  audit: "A complete record of what changed, when, and by whom.",
  templates: "Give every new hire the right starting point.",
  settings: "Make Neutronium work the way your company does.",
  home: "Your tools, your access, your next great workday.",
  companies: "A workspace for every company you support.",
  import: "Bring existing employee accounts into your workspace.",
  help: "Ask for help and follow up on employee requests.",
  security: "Review risky accounts and access that needs attention.",
  apps: "Open your work tools or request access to another app.",
  myaccess: "See the access you have and when it expires.",
  requests: "Track the progress of your access requests.",
  profile: "Your details, sign-in security, and active sessions.",
  jobs: "Track automation progress and resolve failed steps.",
  alerts: "Review permissions and accounts that need attention.",
  support: "Find company support information.",
  notifications: "Updates on your requests and workspace activity.",
};
function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
}
function date(value: string) {
  return new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value,
  ).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function time(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function Badge({ value }: { value: string }) {
  return (
    <span
      className={`nt-badge nt-badge-${value.toLowerCase().replaceAll(" ", "_")}`}
    >
      <i />
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return (
    <span className={`nt-avatar nt-avatar-${index % 4}`}>{initials(name)}</span>
  );
}
function AppMark({ app }: { app: Workspace["applications"][number] }) {
  return (
    <span className="nt-app-mark" style={{ background: app.color }}>
      {app.name === "Microsoft 365" ? (
        <span className="nt-ms">
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : (
        app.initials
      )}
    </span>
  );
}
function Empty({
  icon = "overview",
  title,
  children,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="nt-empty">
      <Icon name={icon} size={27} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="nt-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}
function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`nt-panel ${className}`}>
      {title && (
        <div className="nt-panel-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
async function api(path: string, data?: unknown, orgId?: string) {
  return requestJson(
    `/neutronium/api/${path}${data === undefined && orgId ? `${path.includes("?") ? "&" : "?"}org=${encodeURIComponent(orgId)}` : ""}`,
    data === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(data as object),
            ...(orgId ? { orgId } : {}),
          }),
        },
  );
}
export function Neutronium() {
  const [mfaGate, setMfaGate] = useState(false);
  const [config, setConfig] = useState<Config>();
  const [w, setW] = useState<Workspace>();
  const [actor, setActor] = useState<Actor>();
  const [view, setView] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [recordCursor, setRecordCursor] = useState("");
  const readQuery = useRef({
    view: "overview",
    q: "",
    status: "all",
    cursor: "",
  });
  readQuery.current = { view, q: search, status: filter, cursor: recordCursor };
  const [dialog, setDialog] = useState<Dialog>();
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (!mobile) return;
    const sidebar = document.getElementById("nt-workspace-navigation");
    const trigger = document.activeElement as HTMLElement | null;
    sidebar?.querySelector<HTMLButtonElement>(".nt-navigation-close")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        setMobile(false);
      } else if (event.key === "Tab") {
        const controls = Array.from(
          sidebar?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), a[href], summary, input, select",
          ) || [],
        ).filter((element) => element.checkVisibility());
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      trigger?.focus();
    };
  }, [mobile]);
  const [companies, setCompanies] = useState<
    {
      id: string;
      name: string;
      employees: number;
      status: string;
      subscription: string;
      failedJobs: number;
      pendingRequests: number;
    }[]
  >([]);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>(
    [],
  );
  useEffect(() => {
    if (!actor || actor.demo) return;
    void api("auth/workspaces")
      .then((r) => setWorkspaces(r.workspaces || []))
      .catch(() => {});
  }, [actor?.id, actor?.demo]); // eslint-disable-line react-hooks/exhaustive-deps
  const openedRecord = useRef("");
  useEffect(() => {
    if (!w) return;
    const params = new URLSearchParams(location.search);
    const employee = params.get("employee"),
      job = params.get("job");
    const key = employee || job || "";
    if (!key || openedRecord.current === key) return;
    if (employee && w.employees.some((e) => e.id === employee)) {
      setDialog({ kind: "employee", id: employee });
      openedRecord.current = key;
    }
    if (job && w.jobs.some((j) => j.id === job)) {
      setDialog({ kind: "job", id: job });
      openedRecord.current = key;
    }
  }, [w]);
  const org = useRef<string>();
  const refresh = useCallback(async () => {
    const query = new URLSearchParams(readQuery.current).toString();
    const targetJob = new URLSearchParams(location.search).get("job");
    const state = await api(
      `state?${query}${targetJob ? `&job=${encodeURIComponent(targetJob)}` : ""}`,
      undefined,
      org.current,
    );
    if (query !== new URLSearchParams(readQuery.current).toString())
      return state;
    setW(state.workspace);
    setActor(state.actor);
    return state;
  }, []);
  const navigate = useCallback((v: string) => {
    setView(v);
    setRecordCursor("");
    setSearch("");
    setFilter("all");
    setMobile(false);
    const application = new URLSearchParams(location.search).get("application");
    const query = new URLSearchParams({ view: v });
    if (v === "employee-approvals" && application)
      query.set("application", application);
    if (org.current) query.set("org", org.current);
    window.history.replaceState(null, "", `/neutronium/?${query}`);
  }, []);
  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(location.search);
    const requestedView = params.get("view");
    const requestedOrg = params.get("org");
    if (requestedOrg && /^[0-9a-f-]{36}$/i.test(requestedOrg))
      org.current = requestedOrg;
    const authError = params.get("authError");
    if (authError) setError(authError);
    (async () => {
      try {
        const c = await api("config");
        if (!alive) return;
        setConfig(c);
        try {
          const session = await api("session", undefined, org.current);
          if (
            platformRoles.includes(session.actor.role) &&
            !session.actor.orgId
          ) {
            setActor(session.actor);
            navigate("companies");
          } else {
            const state = await refresh();
            if (
              !canManagePeople(state.actor) &&
              !platformRoles.includes(state.actor.role)
            )
              navigate(
                requestedView && titles[requestedView] ? requestedView : "home",
              );
          }
        } catch {
          const status = await api("auth/status").catch(() => ({ user: null }));
          if (status.user?.mfa_required && !status.user.mfa_verified_at) {
            setMfaGate(true);
            return;
          }
          if (c.demoAvailable) {
            const state = await api("demo", {});
            if (alive) {
              setW(state.workspace);
              setActor(state.actor);
            }
          }
        }
        if (alive) {
          const v = requestedView;
          if (v && titles[v]) setView(v);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh, navigate]);
  useEffect(() => {
    if (!actor) return;
    let running = false;
    const interval = setInterval(
      async () => {
        if (running) return;
        running = true;
        try {
          if (actor.demo) await api("worker", {});
          if (actor.orgId) await refresh();
        } catch {
          /* Surface errors on explicit actions; temporary polling errors retry. */
        } finally {
          running = false;
        }
      },
      actor.demo ? 1400 : 5000,
    );
    return () => clearInterval(interval);
  }, [actor?.id, actor?.orgId, actor?.demo, refresh]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (actor && platformRoles.includes(actor.role) && view === "companies")
      api("companies")
        .then((r) => setCompanies(r.companies))
        .catch((e) => setError(e.message));
  }, [view, actor]);
  useEffect(() => {
    if (!actor?.orgId || actor.demo) return;
    const t = setTimeout(() => {
      void refresh().catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [
    view,
    search,
    filter,
    recordCursor,
    actor?.id,
    actor?.orgId,
    actor?.demo,
    refresh,
  ]);
  useEffect(() => {
    setRecordCursor("");
  }, [view, search, filter]);
  async function run(path: string, data: unknown, success = "Changes saved.") {
    setBusy(true);
    setError("");
    try {
      const r = await api(path, data, org.current);
      await refresh();
      setNotice(success);
      setDialog(undefined);
      return r;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function persona(value: string) {
    setBusy(true);
    setError("");
    try {
      const [p, id] = value.split(":");
      const result = await api("persona", { persona: p, employeeId: id });
      setActor(result.actor);
      setW(result.workspace);
      org.current = undefined;
      navigate(
        p === "employee" || p === "manager"
          ? "home"
          : p === "platform"
            ? "companies"
            : "overview",
      );
      setNotice(
        "Development persona changed. Server permissions now match this role.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (mfaGate)
    return (
      <main className="nt-root nt-security-gate">
        {error && (
          <div className="nt-message nt-error" role="alert">
            {error}
          </div>
        )}
        <SecuritySettings gate />
      </main>
    );
  if (loading)
    return (
      <div className="nt-root nt-loading">
        <Mark />
        <strong>Neutronium</strong>
        <span>Opening your workspace…</span>
      </div>
    );
  if (!actor || (!w && !platformRoles.includes(actor.role)))
    return (
      <Auth
        config={config}
        error={error}
        setError={setError}
        onReady={async () => {
          const status = await api("auth/status");
          if (status.user?.mfa_required && !status.user.mfa_verified_at) {
            setMfaGate(true);
            return;
          }
          const state = await refresh();
          const requested = new URLSearchParams(location.search).get("view");
          navigate(
            requested && titles[requested]
              ? requested
              : canManagePeople(state.actor)
                ? "overview"
                : "home",
          );
        }}
      />
    );
  const platform = platformRoles.includes(actor.role);
  const manage = canManagePeople(actor);
  const employee = !manage && !platform;
  const own = w?.employees.find((e) => e.id === actor.employeeId);
  const greetingName =
    own?.firstName.trim() ||
    (actor.name.includes("@") ? "" : actor.name.trim().split(/\s+/)[0]);
  const greetingSuffix = greetingName ? `, ${greetingName}` : "";
  const sections = workspaceSections(actor);
  const section = sections.find((item) => item.views.includes(view));
  const pending = w?.requests.filter((r) => r.status === "pending") || [];
  const activeJobs =
    w?.jobs.filter((j) => !["success"].includes(j.status)) || [];
  const applications = w?.applications || [];
  const appName = (id: string) =>
    applications.find((a) => a.id === id)?.name || "Application";
  const employeeName = (id: string) =>
    fullName(w?.employees.find((e) => e.id === id));
  const matches = (...values: (string | undefined)[]) =>
    values.join(" ").toLowerCase().includes(search.toLowerCase());
  const searchable = !(
    view === "overview" ||
    view === "home" ||
    view === "employee-approvals" ||
    (view === "people" && !w?.demo)
  );
  const reviewItems =
    w?.grants.filter(
      (g) =>
        g.status === "active" &&
        (g.level === "Admin" ||
          w.employees.find((e) => e.id === g.employeeId)?.status ===
            "terminated" ||
          (g.expiresAt && Date.parse(g.expiresAt) - Date.now() < 86400_000)),
    ) || [];
  const actionButton = (
    label: string,
    kind: string,
    icon = "plus",
    secondary = false,
  ) => (
    <button
      className={secondary ? "nt-button" : "nt-button nt-primary"}
      onClick={() => setDialog({ kind })}
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
  const requestCard = (r: AccessRequest) => (
    <div className="nt-request" key={r.id}>
      <div className="nt-row">
        <Avatar name={employeeName(r.employeeId)} index={1} />
        <div className="nt-grow">
          <strong>{employeeName(r.employeeId)}</strong>
          <p>
            {appName(r.applicationId)} <span>· {r.level} access</span>
          </p>
        </div>
        <Badge value={r.status} />
      </div>
      <p className="nt-quote">“{r.reason}”</p>
      <div className="nt-row nt-request-foot">
        <span>
          <Icon name="audit" size={14} />
          {r.durationMinutes
            ? `${r.durationMinutes / 60} hours`
            : "Permanent"}{" "}
          <span className="nt-dot">·</span>{" "}
          {r.stages[
            r.approvals.filter((a) => a.decision === "approve").length
          ] || "All stages"}{" "}
          approval
        </span>
        <button
          className="nt-link"
          onClick={() => setDialog({ kind: "request-detail", id: r.id })}
        >
          Review request <Icon name="arrow" size={14} />
        </button>
      </div>
    </div>
  );
  const peopleTable = (limit?: number) => (
    <div className="nt-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Department</th>
            <th>Status</th>
            <th>Applications</th>
            <th>Start date</th>
            <th>
              <span className="nt-sr">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {w?.employees
            .filter(
              (e) => !w?.directoryPageIds || w.directoryPageIds.includes(e.id),
            )
            .filter(
              (e) =>
                matches(fullName(e), e.email, e.department, e.title) &&
                (filter === "all" || e.status === filter),
            )
            .slice(0, limit)
            .map((e, i) => (
              <tr key={e.id}>
                <td>
                  <button
                    className="nt-person"
                    onClick={() => setDialog({ kind: "employee", id: e.id })}
                  >
                    <Avatar name={fullName(e)} index={i} />
                    <span>
                      <strong>{fullName(e)}</strong>
                      <small>{e.email}</small>
                    </span>
                  </button>
                </td>
                <td>
                  {e.department}
                  <small>{e.title}</small>
                </td>
                <td>
                  <Badge value={e.status} />
                </td>
                <td>
                  <div className="nt-app-stack">
                    {w.grants
                      .filter(
                        (g) => g.employeeId === e.id && g.status === "active",
                      )
                      .map((g) => {
                        const app = applications.find(
                          (a) => a.id === g.applicationId,
                        );
                        return (
                          app && (
                            <span key={g.id} title={`${app.name} · ${g.level}`}>
                              <AppMark app={app} />
                            </span>
                          )
                        );
                      })}
                  </div>
                </td>
                <td>{e.startDate ? date(e.startDate) : "—"}</td>
                <td>
                  <button
                    className="nt-icon-button"
                    aria-label={`View ${fullName(e)}`}
                    onClick={() => setDialog({ kind: "employee", id: e.id })}
                  >
                    <Icon name="chevron" size={16} />
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {!w?.employees.some(
        (e) =>
          matches(fullName(e), e.email, e.department, e.title) &&
          (filter === "all" || e.status === filter),
      ) && (
        <Empty title="No employees found">
          Try a different search or onboard your first employee.
        </Empty>
      )}
    </div>
  );
  const jobList = (jobs: Job[]) => (
    <div className="nt-job-list">
      {jobs.map((j) => (
        <button
          className="nt-job-row"
          key={j.id}
          onClick={() => setDialog({ kind: "job", id: j.id })}
        >
          <span
            className={`nt-job-icon ${j.kind === "offboard" ? "nt-red" : ""}`}
          >
            <Icon
              name={
                j.kind === "onboard"
                  ? "onboarding"
                  : j.kind === "offboard"
                    ? "exit"
                    : "access"
              }
            />
          </span>
          <span className="nt-grow">
            <strong>
              {j.kind === "onboard"
                ? "Onboard"
                : j.kind === "offboard"
                  ? "Offboard"
                  : j.kind === "grant"
                    ? "Grant access to"
                    : "Expire access for"}{" "}
              {employeeName(j.employeeId)}
            </strong>
            <small>
              {
                j.steps.filter((s) => ["success", "skipped"].includes(s.status))
                  .length
              }{" "}
              of {j.steps.length} steps complete{" "}
              {Date.parse(j.scheduledAt) > Date.now()
                ? `· Scheduled ${time(j.scheduledAt)}`
                : ""}
            </small>
            <span className="nt-mini-progress">
              <i
                style={{
                  width: `${(100 * j.steps.filter((s) => ["success", "skipped"].includes(s.status)).length) / j.steps.length}%`,
                }}
              />
            </span>
          </span>
          <Badge value={j.status} />
          <Icon name="chevron" size={15} />
        </button>
      ))}
      {!jobs.length && (
        <Empty icon="onboarding" title="Everything is up to date">
          New onboarding, offboarding, and access workflows will appear here.
        </Empty>
      )}
    </div>
  );
  return (
    <div className="nt-root">
      <aside
        id="nt-workspace-navigation"
        className={`nt-sidebar ${mobile ? "nt-sidebar-open" : ""}`}
      >
        <button
          className="nt-icon-button nt-navigation-close"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <Icon name="close" />
        </button>
        <Link
          className="nt-brand"
          href={
            org.current ? `/neutronium/?org=${org.current}` : "/neutronium/"
          }
          onClick={(e) => {
            e.preventDefault();
            navigate(employee ? "home" : platform ? "companies" : "overview");
          }}
        >
          <Mark />
          <span>
            neutronium<span className="nt-brand-dot">.</span>
          </span>
        </Link>
        <details className="nt-workspace-menu">
          <summary
            className="nt-workspace-switch"
            aria-label="Open workspace menu"
          >
            <span className="nt-company-icon">
              {platform ? (
                <Icon name="building" />
              ) : (
                initials(w?.name || "Workspace")
              )}
            </span>
            <div>
              <strong>{platform ? "Operator console" : w?.name}</strong>
              <small>
                {platform ? "Platform management" : "Company workspace"}
              </small>
            </div>
            <Icon name="down" size={14} />
          </summary>
          <div className="nt-workspace-menu-items">
            <button
              onClick={(e) => {
                e.currentTarget.closest("details")?.removeAttribute("open");
                navigate("profile");
              }}
            >
              My profile
            </button>
            <button
              onClick={(e) => {
                e.currentTarget.closest("details")?.removeAttribute("open");
                navigate(
                  platform ? "companies" : employee ? "home" : "overview",
                );
              }}
            >
              Workspace overview
            </button>
            {canAdmin(actor) && (
              <button
                onClick={(e) => {
                  e.currentTarget.closest("details")?.removeAttribute("open");
                  navigate("settings");
                }}
              >
                Company settings
              </button>
            )}
            {workspaces
              .filter((company) => company.id !== w?.id)
              .map((company) => (
                <a key={company.id} href={`/neutronium/?org=${company.id}`}>
                  {company.name}
                </a>
              ))}
            {workspaces.length <= 1 && (
              <small>
                {w?.name || "Current workspace"} is your current workspace.
              </small>
            )}
          </div>
        </details>
        <ToolFinder
          sections={sections}
          titles={titles}
          descriptions={descriptions}
          navigate={navigate}
          disabled={busy}
        />
        <nav aria-label="Workspace navigation">
          {sections.map((item) => (
            <button
              key={item.label}
              aria-label={item.label}
              className={section === item ? "nt-nav-active" : ""}
              aria-current={section === item ? "true" : undefined}
              disabled={busy}
              onClick={() =>
                navigate(item.views.includes(view) ? view : item.views[0])
              }
            >
              <Icon name={item.icon} />
              <span className="nt-nav-copy">
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="nt-sidebar-bottom">
          <div className="nt-side-note">
            <span className="nt-live-dot" />
            <span>
              {w?.demo ? "Development workspace" : "Secure company workspace"}
            </span>
            <p>
              {w?.demo
                ? "Real workflows. Simulated provider actions."
                : "Access is checked on every request."}
            </p>
          </div>
          <Link href="/" className="nt-back">
            <Icon
              name="arrow"
              size={16}
              style={{ transform: "rotate(180deg)" }}
            />{" "}
            Back to runIT
          </Link>
          <div className="nt-user">
            <button
              className="nt-icon-button"
              aria-label="My profile"
              onClick={() => navigate("profile")}
            >
              <Avatar name={actor.name} />
            </button>
            <div>
              <strong>{actor.name}</strong>
              <small>{actor.role.replaceAll("_", " ").toLowerCase()}</small>
            </div>
            <button
              className="nt-icon-button"
              aria-label="Sign out"
              onClick={async () => {
                await api("logout", {});
                setActor(undefined);
                setW(undefined);
              }}
            >
              <Icon name="exit" size={17} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="nt-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="nt-main">
        <header className="nt-topbar">
          <div className="nt-row">
            <button
              className="nt-icon-button nt-mobile-toggle"
              aria-label="Open navigation"
              aria-expanded={mobile}
              aria-controls="nt-workspace-navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Icon name="menu" />
            </button>
            <span className="nt-breadcrumb">
              {platform ? "Platform" : w?.name}
            </span>
            <span className="nt-divider">/</span>
            {section && section.views.length > 1 && (
              <>
                <button
                  className="nt-breadcrumb-link"
                  onClick={() => navigate(section.views[0])}
                >
                  {section.label}
                </button>
                <span className="nt-divider">/</span>
              </>
            )}
            <span>{sectionViewLabels[view] || titles[view]}</span>
          </div>
          <div className="nt-row">
            {w?.demo && <span className="nt-demo-tag">DEVELOPMENT</span>}
            <button
              className="nt-icon-button nt-notification-button"
              aria-label="Open notifications"
              onClick={() => navigate("notifications")}
            >
              <Icon name="bell" />
              {w?.notifications.some((n) => !n.read) && <i />}
            </button>
            <button
              className="nt-icon-button"
              aria-label="Open my profile"
              onClick={() => navigate("profile")}
            >
              <Avatar name={actor.name} />
            </button>
          </div>
        </header>
        {actor.demo && (
          <div className="nt-demo-bar">
            <span>
              <Icon name="spark" size={14} /> Acme sandbox <b>·</b> No real
              accounts are changed
            </span>
            <label>
              Preview as{" "}
              <select
                aria-label="Development persona"
                value={
                  platform
                    ? "platform"
                    : actor.role === "ORG_OWNER"
                      ? "admin"
                      : `${actor.role === "MANAGER" ? "manager" : "employee"}:${actor.employeeId}`
                }
                disabled={busy}
                onChange={(e) => void persona(e.target.value)}
              >
                <option value="admin">Company admin</option>
                {w?.employees
                  .filter((e) => e.status !== "terminated")
                  .map((e) => (
                    <option value={`employee:${e.id}`} key={e.id}>
                      {fullName(e)} · Employee
                    </option>
                  ))}
                {w?.employees
                  .filter((e) => e.firstName === "Michael")
                  .map((e) => (
                    <option key={e.id} value={`manager:${e.id}`}>
                      Michael Ross · Manager
                    </option>
                  ))}
                <option value="platform">Platform operator</option>
              </select>
            </label>
          </div>
        )}
        <div className="nt-content">
          {error && (
            <div role="alert" className="nt-message nt-error">
              <Icon name="alert" />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="nt-message nt-success">
              <Icon name="check" />
              <span>{notice}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          <div className="nt-page-heading">
            <div>
              <div className="nt-eyebrow">
                {view === "overview"
                  ? "YOUR WORKSPACE, AT A GLANCE"
                  : platform
                    ? "NEUTRONIUM PLATFORM"
                    : employee
                      ? "MADE FOR YOUR WORKDAY"
                      : "COMPANY ADMINISTRATION"}
              </div>
              <h1>
                {view === "overview"
                  ? `Welcome back${greetingSuffix}`
                  : view === "home"
                    ? `Hi${greetingSuffix}`
                    : titles[view]}
              </h1>
              <p>
                {descriptions[view] ||
                  "Clear visibility. Thoughtful controls. Everything in its place."}
              </p>
            </div>
            <div className="nt-heading-actions">
              {manage &&
                ["people", "onboarding", "employee-approvals"].includes(view) &&
                actionButton("Onboard employee", "onboard")}
              {view === "templates" &&
                manage &&
                actionButton("Create template", "template")}
              {employee &&
                ["home", "apps", "myaccess", "requests"].includes(view) &&
                actionButton("Request access", "request", "plus")}
              {view === "overview" && (
                <span className="nt-today">
                  <Icon name="audit" size={14} />
                  {date(new Date().toISOString())}
                </span>
              )}
            </div>
          </div>
          {section && section.views.length > 1 && (
            <nav
              className="nt-section-navigation"
              aria-label={`${section.label} pages`}
            >
              {section.views.map((destination) => (
                <button
                  key={destination}
                  aria-current={view === destination ? "page" : undefined}
                  onClick={() => navigate(destination)}
                  disabled={busy}
                >
                  {sectionViewLabels[destination] || titles[destination]}
                  {destination === "access" && pending.length > 0 && (
                    <span className="nt-nav-count">
                      {w?.summary?.pending ?? pending.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          )}
          {searchable &&
            w &&
            ![
              "settings",
              "profile",
              "integrations",
              "import",
              "support",
              "companies",
              "notifications",
              "help",
              "security",
              "environments",
              "employee-approvals",
            ].includes(view) && (
              <div className="nt-toolbar">
                <label className="nt-search">
                  <Icon name="search" size={17} />
                  <input
                    aria-label={`Search ${titles[view]}`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search ${titles[view].toLowerCase()}…`}
                  />
                  <kbd>⌕</kbd>
                </label>
                {[
                  "people",
                  "access",
                  "requests",
                  "permissions",
                  "onboarding",
                  "jobs",
                ].includes(view) && (
                  <select
                    aria-label="Filter by status"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    {(view === "people"
                      ? ["active", "onboarding", "offboarding", "terminated"]
                      : ["access", "requests"].includes(view)
                        ? [
                            "pending",
                            "more_info",
                            "approved",
                            "fulfilled",
                            "rejected",
                          ]
                        : view === "permissions"
                          ? ["active", "revoked", "revoking", "manual_required"]
                          : [
                              "pending",
                              "running",
                              "success",
                              "failed",
                              "manual_required",
                            ]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          {w?.pageInfo?.view === view && !(view === "people" && !w.demo) && (
            <div className="nt-toolbar" aria-label="Record pagination">
              <span>{w.pageInfo.shown} records on this page</span>
              <button
                className="nt-button"
                disabled={!recordCursor}
                onClick={() => setRecordCursor("")}
              >
                First page
              </button>
              <button
                className="nt-button"
                disabled={!w.pageInfo.nextCursor}
                onClick={() => setRecordCursor(w.pageInfo!.nextCursor!)}
              >
                Next page
              </button>
            </div>
          )}
          {view === "overview" && w && (
            <>
              <section className="nt-start-task" aria-label="Quick actions">
                <h2>What would you like to do?</h2>
                <div className="nt-task-actions">
                  <button
                    aria-label="Onboard employee"
                    onClick={() => setDialog({ kind: "onboard" })}
                  >
                    <Icon name="people" />
                    <span>
                      <strong>Onboard employee</strong>
                      <small>Set up a new teammate</small>
                    </span>
                    <Icon name="arrow" size={16} />
                  </button>
                  <button
                    aria-label="Review requests"
                    onClick={() => navigate("employee-approvals")}
                  >
                    <Icon name="access" />
                    <span>
                      <strong>Review requests</strong>
                      <small>Signups, access and help</small>
                    </span>
                    <Icon name="arrow" size={16} />
                  </button>
                  <button
                    aria-label="Find an employee"
                    onClick={() => navigate("people")}
                  >
                    <Icon name="search" />
                    <span>
                      <strong>Find an employee</strong>
                      <small>View people and their details</small>
                    </span>
                    <Icon name="arrow" size={16} />
                  </button>
                  <button
                    aria-label="Offboard employee"
                    onClick={() => setDialog({ kind: "offboard" })}
                  >
                    <Icon name="exit" />
                    <span>
                      <strong>Offboard employee</strong>
                      <small>Manage a departure</small>
                    </span>
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              </section>
              <div className="nt-stats nt-stats-compact">
                {[
                  {
                    label: "Total employees",
                    value:
                      w.summary?.employees ??
                      w.employees.filter((e) => e.status !== "terminated")
                        .length,
                    icon: "people",
                    note: `${w.summary?.active ?? w.employees.filter((e) => e.status === "active").length} active in your workspace`,
                    view: "people",
                  },
                  {
                    label: "Access requests",
                    value: w.summary?.pending ?? pending.length,
                    icon: "access",
                    note: pending.length
                      ? "Waiting for a decision"
                      : "All requests reviewed",
                    view: "access",
                  },
                  {
                    label: "Active workflows",
                    value: w.summary?.workflows ?? activeJobs.length,
                    icon: "onboarding",
                    note: activeJobs.length
                      ? "Follow every step in real time"
                      : "You’re all caught up",
                    view: "onboarding",
                  },
                  {
                    label: "Company applications",
                    value: applications.length,
                    icon: "applications",
                    note: `${applications.filter((a) => a.mode === "manual").length} managed manually`,
                    view: "applications",
                  },
                ].map((s) => (
                  <button
                    className="nt-stat"
                    key={s.label}
                    onClick={() => navigate(s.view)}
                  >
                    <span>
                      {s.label}
                      <Icon name={s.icon} />
                    </span>
                    <strong>{s.value.toString().padStart(2, "0")}</strong>
                    <small>
                      {s.note}
                      <Icon name="arrow" size={14} />
                    </small>
                  </button>
                ))}
              </div>
              <div className="nt-overview-grid">
                <div className="nt-primary-column">
                  <Panel title="Needs your attention">
                    {w.demo ? (
                      pending.length ? (
                        pending.slice(0, 2).map(requestCard)
                      ) : (
                        <Empty icon="check" title="No pending requests">
                          New access requests will appear here for review.
                        </Empty>
                      )
                    ) : (
                      <AttentionItems w={w} navigate={navigate} />
                    )}
                  </Panel>
                  <Panel
                    title="Your people"
                    action={
                      <button
                        className="nt-link"
                        onClick={() => navigate("people")}
                      >
                        View directory <Icon name="arrow" size={14} />
                      </button>
                    }
                  >
                    {peopleTable(4)}
                  </Panel>
                </div>
                <div className="nt-secondary-column">
                  <details className="nt-panel nt-setup-disclosure">
                    <summary>
                      Workspace setup{" "}
                      <span>Connections and onboarding checklist</span>
                      <Icon name="down" size={16} />
                    </summary>
                    <div className="nt-setup-panel">
                      <div className="nt-setup-icon">
                        <Icon name="permissions" size={24} />
                      </div>
                      <span className="nt-eyebrow">A STRONG START</span>
                      <h2>Good IT starts here.</h2>
                      <p>A few small steps to a more organized workplace.</p>
                      <div className="nt-setup-progress">
                        <i
                          style={{
                            width: `${([w.integrations.some((i) => ["connected", "development"].includes(i.status)), w.templates.length > 0, w.employees.length > 0, w.jobs.some((j) => j.status === "success")].filter(Boolean).length / 4) * 100}%`,
                          }}
                        />
                      </div>
                      {[
                        {
                          label: "Create your workspace",
                          done: true,
                          v: "settings",
                        },
                        {
                          label: "Connect your identity provider",
                          done: w.integrations.some((i) =>
                            ["connected", "development"].includes(i.status),
                          ),
                          v: "integrations",
                        },
                        {
                          label: "Set up a role template",
                          done: w.templates.length > 0,
                          v: "templates",
                        },
                        {
                          label: "Run your first onboarding",
                          done: w.jobs.some(
                            (j) =>
                              j.kind === "onboard" && j.status === "success",
                          ),
                          v: "onboarding",
                        },
                      ].map((s) => (
                        <button
                          className="nt-checklist"
                          key={s.label}
                          onClick={() => navigate(s.v)}
                        >
                          <span className={s.done ? "nt-done" : ""}>
                            {s.done && <Icon name="check" size={12} />}
                          </span>
                          {s.label}
                          <Icon name="chevron" size={13} />
                        </button>
                      ))}
                    </div>
                  </details>
                  <Panel
                    title="Recent activity"
                    action={
                      <button
                        className="nt-icon-button"
                        aria-label="View audit log"
                        onClick={() => navigate("audit")}
                      >
                        <Icon name="arrow" size={16} />
                      </button>
                    }
                  >
                    <div className="nt-activity">
                      {w.audit
                        .slice(-4)
                        .reverse()
                        .map((e) => (
                          <div className="nt-activity-item" key={e.id}>
                            <span>
                              <Icon
                                name={e.result === "failed" ? "alert" : "check"}
                                size={13}
                              />
                            </span>
                            <div>
                              <strong>{e.action}</strong>
                              <p>{e.actor}</p>
                              <small>{time(e.at)}</small>
                            </div>
                          </div>
                        ))}
                    </div>
                  </Panel>
                  <div className="nt-assurance">
                    <Icon name="permissions" size={18} />
                    <div>
                      <strong>Every action, accounted for.</strong>
                      <p>
                        Permissions are checked on the server. Changes are
                        recorded in your audit log.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {view === "people" &&
            w &&
            (!w.demo && manage ? (
              <PeopleOverview
                w={w}
                openEmployee={(id) => setDialog({ kind: "employee", id })}
              />
            ) : (
              <Panel
                title={`Employee directory · ${w.summary?.employees ?? w.employees.length}`}
                action={
                  manage &&
                  actionButton("Offboard employee", "offboard", "exit", true)
                }
              >
                {peopleTable()}
              </Panel>
            ))}
          {["onboarding", "jobs"].includes(view) && w && (
            <Panel
              title="Provisioning & offboarding"
              action={
                <span className="nt-subtle">
                  {actor.demo
                    ? "Development worker · every 1.4 seconds"
                    : "Scheduled worker · every minute"}
                </span>
              }
            >
              {jobList(
                w.jobs
                  .filter(
                    (j) =>
                      matches(employeeName(j.employeeId), j.kind, j.status) &&
                      (filter === "all" || j.status === filter),
                  )
                  .slice()
                  .reverse(),
              )}
            </Panel>
          )}
          {view === "environments" && w && canAdmin(actor) && (
            <TestEnvironments w={w} run={run} />
          )}
          {view === "employee-approvals" && w && manage && (
            <EmployeeApprovals key={w.id} w={w} actor={actor} run={run} />
          )}
          {view === "help" && w && !platform && (
            <Operations key={actor.id} w={w} actor={actor} run={run} />
          )}
          {view === "security" && w && canAdmin(actor) && (
            <AccountRisk w={w} run={run} />
          )}
          {view === "people" && w && manage && (
            <div className="nt-toolbar">
              <button
                className="nt-button"
                onClick={() => navigate("employee-approvals")}
              >
                Review employee signups
              </button>
              <a
                className="nt-button"
                href={`/neutronium/api/employees/export?org=${w.id}`}
              >
                Export employee CSV
              </a>
              {w.demo && canAdmin(actor) && (
                <button
                  className="nt-button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      "test-employee",
                      {},
                      "Test employee created. Select them from the persona menu.",
                    ).catch(() => {})
                  }
                >
                  Create test employee
                </button>
              )}
            </div>
          )}
          {["access", "requests"].includes(view) && w && (
            <div className="nt-request-grid">
              {w.requests
                .filter(
                  (r) =>
                    matches(
                      employeeName(r.employeeId),
                      appName(r.applicationId),
                      r.reason,
                      r.level,
                    ) &&
                    (filter === "all" || r.status === filter) &&
                    (view !== "requests" || r.employeeId === actor.employeeId),
                )
                .slice()
                .reverse()
                .map(requestCard)}
              {!w.requests.some(
                (r) =>
                  matches(
                    employeeName(r.employeeId),
                    appName(r.applicationId),
                    r.reason,
                    r.level,
                  ) &&
                  (filter === "all" || r.status === filter),
              ) && (
                <Panel>
                  <Empty icon="access" title="No requests here">
                    Requests and approval history will appear as people ask for
                    access.
                  </Empty>
                </Panel>
              )}
            </div>
          )}
          {["applications", "apps"].includes(view) && w && (
            <div className="nt-app-grid">
              {applications
                .filter(
                  (app) =>
                    (!w.pageInfo?.ids || w.pageInfo.ids.includes(app.id)) &&
                    matches(app.name) &&
                    (view !== "apps" ||
                      w.grants.some(
                        (g) =>
                          g.applicationId === app.id &&
                          g.employeeId === actor.employeeId &&
                          g.status === "active",
                      )),
                )
                .map((app) => (
                  <Panel key={app.id}>
                    <div className="nt-app-card">
                      <div className="nt-row">
                        <AppMark app={app} />
                        <Badge
                          value={
                            app.mode === "development"
                              ? "Development"
                              : app.mode === "microsoft"
                                ? w.integrations[0]?.status || "disconnected"
                                : app.mode
                          }
                        />
                      </div>
                      <h2>{app.name}</h2>
                      <p>
                        {app.mode === "development"
                          ? "Simulated provisioning for this development workspace."
                          : app.mode === "manual"
                            ? "Tracked here. Provisioned by an administrator in the application."
                            : "Company identity and security group access."}
                      </p>
                      <div className="nt-app-card-details">
                        <span>
                          People with active access
                          <strong>
                            {w.applicationGrantCounts?.[app.id] ??
                              new Set(
                                w.grants
                                  .filter(
                                    (g) =>
                                      g.applicationId === app.id &&
                                      g.status === "active",
                                  )
                                  .map((g) => g.employeeId),
                              ).size}
                          </strong>
                        </span>
                        <span>
                          Provisioning
                          <strong>
                            {app.mode === "manual"
                              ? "Manual"
                              : app.mode === "development"
                                ? "Development adapter"
                                : "Microsoft Graph"}
                          </strong>
                        </span>
                      </div>
                      {employee ? (
                        <a
                          className="nt-button"
                          href={app.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open application <Icon name="arrow" size={15} />
                        </a>
                      ) : (
                        <button
                          className="nt-button"
                          onClick={() =>
                            setDialog({ kind: "application", id: app.id })
                          }
                        >
                          Manage application <Icon name="arrow" size={15} />
                        </button>
                      )}
                    </div>
                  </Panel>
                ))}
            </div>
          )}
          {["permissions", "myaccess", "alerts"].includes(view) && w && (
            <Panel
              title={
                view === "alerts" ? "Access to review" : "Access inventory"
              }
              action={
                <span className="nt-subtle">
                  Review items are not confirmed vulnerabilities
                </span>
              }
            >
              <div className="nt-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Application</th>
                      <th>Permission</th>
                      <th>Status</th>
                      <th>Expires</th>
                      <th>Review item</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(view === "alerts" ? reviewItems : w.grants)
                      .filter(
                        (g) =>
                          matches(
                            employeeName(g.employeeId),
                            appName(g.applicationId),
                            g.level,
                          ) &&
                          (filter === "all" || g.status === filter) &&
                          (view !== "myaccess" ||
                            g.employeeId === actor.employeeId),
                      )
                      .map((g) => (
                        <tr key={g.id}>
                          <td>
                            <strong>{employeeName(g.employeeId)}</strong>
                          </td>
                          <td>{appName(g.applicationId)}</td>
                          <td>
                            <span
                              className={
                                g.level === "Admin" ? "nt-admin-level" : ""
                              }
                            >
                              {g.level}
                            </span>
                          </td>
                          <td>
                            <Badge value={g.status} />
                          </td>
                          <td>
                            {g.expiresAt ? time(g.expiresAt) : "Permanent"}
                          </td>
                          <td>
                            {g.status === "active"
                              ? g.level === "Admin"
                                ? "Elevated permission"
                                : w.employees.find((e) => e.id === g.employeeId)
                                      ?.status === "terminated"
                                  ? "Terminated employee"
                                  : g.expiresAt
                                    ? "Temporary access"
                                    : "—"
                              : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!(view === "alerts" ? reviewItems : w.grants).length && (
                  <Empty icon="permissions" title="No access records to show">
                    Access appears here after provisioning or approval.
                  </Empty>
                )}
              </div>
            </Panel>
          )}
          {view === "templates" && w && (
            <div className="nt-template-grid">
              {w.templates
                .filter(
                  (t) =>
                    (!w.pageInfo?.ids || w.pageInfo.ids.includes(t.id)) &&
                    matches(t.name, t.description),
                )
                .map((t) => (
                  <Panel key={t.id}>
                    <div className="nt-template-card">
                      <div className="nt-row">
                        <span className="nt-template-icon">
                          <Icon name="templates" size={23} />
                        </span>
                        <Badge value={t.active ? "active" : "inactive"} />
                      </div>
                      <h2>{t.name}</h2>
                      <p>{t.description}</p>
                      <div className="nt-template-apps">
                        {t.applications.map((id) => (
                          <span key={id}>{appName(id)}</span>
                        ))}
                      </div>
                      <small>
                        {t.groups.length} groups ·{" "}
                        {t.licenseId ? "1 license" : "No license configured"}
                      </small>
                      <div className="nt-row">
                        <button
                          className="nt-button"
                          onClick={() =>
                            setDialog({ kind: "template", id: t.id })
                          }
                        >
                          Edit template
                        </button>
                        <button
                          className="nt-icon-button"
                          title="Duplicate template"
                          aria-label={`Duplicate ${t.name}`}
                          onClick={() =>
                            void run(
                              "template",
                              { ...t, id: undefined, name: `${t.name} copy` },
                              "Template duplicated.",
                            ).catch(() => {})
                          }
                        >
                          <Icon name="templates" size={16} />
                        </button>
                      </div>
                    </div>
                  </Panel>
                ))}
            </div>
          )}
          {view === "audit" && w && (
            <Panel
              title="Audit trail"
              action={
                <button
                  className="nt-button"
                  onClick={() => {
                    const data = JSON.stringify(w.audit, null, 2);
                    const u = URL.createObjectURL(
                      new Blob([data], { type: "application/json" }),
                    );
                    const a = document.createElement("a");
                    a.href = u;
                    a.download = "neutronium-audit.json";
                    a.click();
                    URL.revokeObjectURL(u);
                  }}
                >
                  Export JSON <Icon name="import" size={14} />
                </button>
              }
            >
              <div className="nt-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th>Actor</th>
                      <th>Target</th>
                      <th>Result</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.audit
                      .filter((e) =>
                        matches(e.actor, e.action, e.target, e.requestId),
                      )
                      .slice()
                      .reverse()
                      .map((e) => (
                        <tr key={e.id}>
                          <td>
                            <strong>{e.action}</strong>
                            <small>
                              Request {e.requestId.slice(0, 8)} ·{" "}
                              {e.integration}
                            </small>
                          </td>
                          <td>{e.actor}</td>
                          <td>
                            {w.employees.some((v) => v.id === e.target)
                              ? employeeName(e.target)
                              : e.target}
                          </td>
                          <td>
                            <Badge value={e.result} />
                          </td>
                          <td>{time(e.at)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
          {view === "integrations" && w && (
            <>
              <Panel>
                <div className="nt-integration-hero">
                  <AppMark app={applications[0]} />
                  <div className="nt-grow">
                    <h2>Microsoft 365</h2>
                    <p>
                      Company identities, account inventory, licenses, and group
                      access.
                    </p>
                  </div>
                  <Badge value={w.integrations[0]?.status || "disconnected"} />
                  {!w.demo && canAdmin(actor) && (
                    <button
                      className="nt-button nt-primary"
                      onClick={() => setDialog({ kind: "connect" })}
                    >
                      Connect Microsoft 365 <Icon name="arrow" size={15} />
                    </button>
                  )}
                </div>
                {w.demo && (
                  <div className="nt-inline-note">
                    <Icon name="spark" />
                    You’re using the development adapter. To connect a real
                    Microsoft tenant, sign in and create a production
                    organization.
                  </div>
                )}
                <div className="nt-feature-list">
                  {Object.entries(config?.microsoftFeatures || {}).map(
                    ([key, f]) => (
                      <div className="nt-feature" key={key}>
                        <Icon name="permissions" />
                        <div className="nt-grow">
                          <strong>{f.name}</strong>
                          <p>{f.reason}</p>
                          <div>
                            {f.permissions.map((p) => (
                              <code key={p}>{p}</code>
                            ))}
                          </div>
                        </div>
                        <Badge
                          value={
                            w.integrations[0]?.features.includes(key)
                              ? w.demo
                                ? "Development"
                                : "Approved"
                              : "Not approved"
                          }
                        />
                      </div>
                    ),
                  )}
                </div>
                {!w.demo && (
                  <div className="nt-panel-footer">
                    <button
                      className="nt-button"
                      disabled={busy || !canAdmin(actor)}
                      onClick={() =>
                        void run(
                          "microsoft/sync",
                          {},
                          "Microsoft account inventory synchronized.",
                        ).catch(() => {})
                      }
                    >
                      Sync existing accounts
                    </button>
                    <span>
                      Last checked:{" "}
                      {w.integrations[0]?.checkedAt
                        ? time(w.integrations[0].checkedAt)
                        : "Not yet"}
                    </span>
                  </div>
                )}
              </Panel>
              {canAdmin(actor) && (
                <>
                  <MicrosoftReadiness w={w} run={run} />
                  <Connections w={w} run={run} />
                </>
              )}
            </>
          )}
          {view === "profile" && !actor.demo && <SecuritySettings />}
          {view === "profile" && !actor.demo && (
            <div className="nt-toolbar">
              {config?.socialProviders?.map((provider) => (
                <button
                  key={provider}
                  className="nt-button"
                  onClick={async () => {
                    try {
                      const r = await api("auth/social", { provider });
                      location.assign(r.url);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Link {provider} sign-in
                </button>
              ))}
            </div>
          )}
          {view === "settings" && w && !platform && (
            <Settings
              w={w}
              busy={busy}
              canEdit={canAdmin(actor)}
              save={(data) => run("settings", data)}
            />
          )}
          {view === "import" && w && (
            <Panel title="Import an existing directory">
              <div className="nt-padded">
                <p className="nt-subtle">
                  Paste a JSON array of employees. Required fields: firstName,
                  lastName, email. Optional: title, department. Existing emails
                  are skipped. After import, Microsoft sync matches company
                  emails to provider identity IDs.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const raw = new FormData(e.currentTarget).get(
                        "employees",
                      ) as string;
                      await run(
                        "import",
                        { employees: JSON.parse(raw) },
                        "Employee inventory imported.",
                      );
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  <Field label="Employee records">
                    <textarea
                      name="employees"
                      rows={9}
                      required
                      placeholder={
                        '[\n  {"firstName": "Sam", "lastName": "Lee", "email": "sam@company.com", "department": "Engineering"}\n]'
                      }
                    />
                  </Field>
                  <button
                    className="nt-button nt-primary"
                    disabled={busy || !canAdmin(actor)}
                  >
                    Import employees <Icon name="import" size={16} />
                  </button>
                </form>
              </div>
            </Panel>
          )}
          {view === "home" && w && (
            <>
              <div className="nt-personal-welcome">
                <div>
                  <span className="nt-eyebrow">YOUR WORK, CONNECTED</span>
                  <h2>
                    Everything you need.
                    <br />
                    One place to find it.
                  </h2>
                  <p>
                    Open your tools or ask for the access you need to keep
                    moving.
                  </p>
                  <button
                    className="nt-button nt-primary"
                    onClick={() => setDialog({ kind: "request" })}
                  >
                    Request access <Icon name="arrow" size={16} />
                  </button>
                </div>
                <div className="nt-orbit" aria-hidden="true">
                  <div>
                    <Mark />
                  </div>
                  {applications.slice(0, 4).map((a, i) => (
                    <span className={`nt-orbit-app nt-orbit-${i}`} key={a.id}>
                      <AppMark app={a} />
                    </span>
                  ))}
                </div>
              </div>
              <Panel
                title="Your applications"
                action={
                  <button className="nt-link" onClick={() => navigate("apps")}>
                    View all <Icon name="arrow" size={14} />
                  </button>
                }
              >
                <div className="nt-personal-apps">
                  {applications
                    .filter((app) =>
                      w.grants.some(
                        (g) =>
                          g.employeeId === actor.employeeId &&
                          g.applicationId === app.id &&
                          g.status === "active",
                      ),
                    )
                    .map((app) => (
                      <a
                        key={app.id}
                        href={app.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <AppMark app={app} />
                        <strong>{app.name}</strong>
                        <Icon name="arrow" size={16} />
                      </a>
                    ))}
                </div>
              </Panel>
              <Panel title="Your recent requests">
                {w.requests
                  .filter((r) => r.employeeId === actor.employeeId)
                  .slice(-3)
                  .map(requestCard)}
                {!w.requests.some((r) => r.employeeId === actor.employeeId) && (
                  <Empty icon="access" title="No requests yet">
                    Need a new tool or elevated access? Start with Request
                    access.
                  </Empty>
                )}
              </Panel>
            </>
          )}
          {view === "profile" && (
            <Panel title="Your account">
              <div className="nt-profile">
                <Avatar name={own ? fullName(own) : actor.name} />
                <h2>{own ? fullName(own) : actor.name}</h2>
                <p>
                  {own
                    ? `${own.title} · ${own.department}`
                    : actor.role.replaceAll("_", " ")}
                </p>
                <dl>
                  <dt>Company email</dt>
                  <dd>{own?.email || actor.name}</dd>
                  <dt>Account status</dt>
                  <dd>
                    <Badge value={own?.status || "active"} />
                  </dd>
                  <dt>Workspace</dt>
                  <dd>{w?.name}</dd>
                </dl>
                <p className="nt-subtle">
                  Contact your company administrator to update your profile.
                </p>
                {!actor.demo && (
                  <form
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      void run(
                        "password",
                        {
                          password: new FormData(ev.currentTarget).get(
                            "password",
                          ),
                        },
                        "Password updated.",
                      ).catch(() => {});
                    }}
                  >
                    <Field label="Set or change your password">
                      <input
                        type="password"
                        name="password"
                        minLength={12}
                        required
                        autoComplete="new-password"
                      />
                    </Field>
                    <button className="nt-button" disabled={busy}>
                      Save password
                    </button>
                  </form>
                )}
              </div>
            </Panel>
          )}
          {view === "notifications" && w && (
            <Panel
              title="Your notifications"
              action={
                <button
                  className="nt-button"
                  onClick={() =>
                    void run(
                      "notifications-read",
                      {},
                      "Notifications marked as read.",
                    ).catch(() => {})
                  }
                >
                  Mark all as read
                </button>
              }
            >
              {w.notifications
                .slice()
                .reverse()
                .map((n) => (
                  <div className="nt-notification" key={n.id}>
                    <Icon name="bell" />
                    <div className="nt-grow">
                      <strong>{n.title}</strong>
                      {n.href && (
                        <a className="nt-link" href={n.href}>
                          Open details →
                        </a>
                      )}
                      <p>{n.body}</p>
                      <small>
                        {time(n.createdAt)} · Email:{" "}
                        {n.emailStatus === "pending" ? "queued" : n.emailStatus}
                        {canAdmin(actor) &&
                          ["failed", "unconfigured"].includes(
                            n.emailStatus,
                          ) && (
                            <button
                              className="nt-link"
                              onClick={() =>
                                void run("notification-retry", {
                                  id: n.id,
                                }).catch(() => {})
                              }
                            >
                              Retry delivery
                            </button>
                          )}
                      </small>
                    </div>
                    {!n.read && <span className="nt-live-dot" />}
                  </div>
                ))}
              {!w.notifications.length && (
                <Empty icon="bell" title="You’re all caught up">
                  Your next update will appear here.
                </Empty>
              )}
            </Panel>
          )}
          {view === "companies" && platform && (
            <Panel title="Customer companies">
              <div className="nt-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Employees</th>
                      <th>Connection</th>
                      <th>Subscription</th>
                      <th>Open requests</th>
                      <th>Failed jobs</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                        </td>
                        <td>{c.employees}</td>
                        <td>
                          <Badge value={c.status} />
                        </td>
                        <td>{c.subscription}</td>
                        <td>{c.pendingRequests}</td>
                        <td>{c.failedJobs}</td>
                        <td>
                          <button
                            className="nt-link"
                            onClick={async () => {
                              org.current = c.id;
                              try {
                                await refresh();
                                navigate("jobs");
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            Inspect <Icon name="arrow" size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
          {platform && view === "support" && w && (
            <Panel title={`${w.name} · Support notes`}>
              <div className="nt-padded">
                {w.supportNotes.map((n) => (
                  <div className="nt-support-note" key={n.id}>
                    <strong>{n.author}</strong>
                    <small>{time(n.at)}</small>
                    <p>{n.body}</p>
                  </div>
                ))}
                {["PLATFORM_OWNER", "PLATFORM_SUPPORT"].includes(
                  actor.role,
                ) && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(
                        "support-note",
                        { body: new FormData(e.currentTarget).get("body") },
                        "Support note saved.",
                      ).catch(() => {});
                    }}
                  >
                    <Field label="Internal note">
                      <textarea
                        name="body"
                        required
                        maxLength={4000}
                        rows={4}
                      />
                    </Field>
                    <button className="nt-button nt-primary" disabled={busy}>
                      Save note
                    </button>
                  </form>
                )}
              </div>
            </Panel>
          )}
          {platform && view === "settings" && (
            <Panel title="Platform access">
              <div className="nt-padded">
                <p>
                  Platform roles are provisioned by a trusted database
                  administrator. Operators can inspect company operational
                  records; they cannot provision identities or approve customer
                  access.
                </p>
                <div className="nt-role-list">
                  {[
                    [
                      "Platform owner",
                      "Operational visibility and support notes",
                    ],
                    [
                      "Support admin",
                      "Operational visibility and support notes",
                    ],
                    [
                      "Security admin",
                      "Read-only security and audit visibility",
                    ],
                    ["Read only support", "Read-only operational visibility"],
                  ].map(([r, d]) => (
                    <div key={r}>
                      <strong>{r}</strong>
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          )}
          {!w && platform && view !== "companies" && view !== "settings" && (
            <Empty icon="building" title="Choose a company first">
              Open Companies and select Inspect to view its records.
            </Empty>
          )}
          <footer className="nt-content-footer">
            <span>
              <Mark />
              neutronium
            </span>
            <p>A calmer way to manage company IT.</p>
            <span>
              <Icon name="permissions" size={13} /> Built with accountability
            </span>
          </footer>
        </div>
      </div>
      {dialog && w && (
        <WorkspaceDialog
          dialog={dialog}
          w={w}
          actor={actor}
          config={config}
          busy={busy}
          error={error}
          close={() => {
            setDialog(undefined);
            setError("");
          }}
          run={run}
          setError={setError}
          navigate={navigate}
        />
      )}
    </div>
  );
}
function Auth({
  config,
  error,
  setError,
  onReady,
}: {
  config?: Config;
  error: string;
  setError: (s: string) => void;
  onReady: () => Promise<void>;
}) {
  const [mode, setMode] = useState("login");
  const [signupRole, setSignupRole] = useState("employee");
  const [signedInEmail, setSignedInEmail] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("authError")) setError(params.get("authError")!);
    if (params.get("auth") === "confirmation")
      setMessage("Check your email to finish verifying your account.");
    api("auth/status")
      .then((r) => {
        if (r.user) {
          setSignupRole(r.user.signup_role || "employee");
          setSignedInEmail(r.user.email || "");
          setMode("organization");
        }
      })
      .catch(() => {});
  }, [setError]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mode === "organization") {
        await api("organization", { name: data.name });
        await onReady();
      } else {
        const r = await api(mode, { ...data, signupRole });
        if (r.existingAccount) {
          setMode("login");
          setMessage(
            "Your account is already verified. Sign in with your existing password; no new confirmation email is needed.",
          );
        } else if (r.confirmationRequired)
          setMessage(
            "If this address needs verification, check your email to confirm your account. If you already confirmed it, sign in. Check junk mail if the message is missing.",
          );
        else {
          try {
            await onReady();
          } catch {
            const status = await api("auth/status");
            setSignupRole(status.user?.signup_role || "employee");
            setSignedInEmail(status.user?.email || "");
            setMode("organization");
          }
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="nt-root nt-auth">
      <div className="nt-auth-story">
        <Link href="/" className="nt-brand">
          <Mark />
          <span>neutronium.</span>
        </Link>
        <div>
          <span className="nt-eyebrow">LESS ADMIN. MORE POSSIBILITY.</span>
          <h1>
            Your people.
            <br />
            Their access.
            <br />
            <em>Under control.</em>
          </h1>
          <p>
            A simpler way to welcome teammates, manage access, and keep your
            company moving.
          </p>
          <div className="nt-auth-points">
            {[
              "A great first day, every time",
              "The right access, with a clear trail",
              "Secure handoffs, without the guesswork",
            ].map((t) => (
              <span key={t}>
                <Icon name="check" />
                {t}
              </span>
            ))}
          </div>
        </div>
        <Link href="/">A product by runIT ↗</Link>
      </div>
      <div className="nt-auth-form">
        <ValidatedForm
          key={`${mode}-${mode === "organization" ? signupRole : ""}`}
          onSubmit={submit}
          requiredMessages={{
            name: "Enter your organization’s name, for example Acme Inc.",
            email: "Enter your work email, for example you@company.com.",
            password:
              mode === "signup"
                ? "Choose a password with at least 12 characters."
                : "Enter your password to sign in.",
          }}
        >
          <span className="nt-eyebrow">WELCOME TO NEUTRONIUM</span>
          <h2>
            {mode === "organization"
              ? signupRole === "employee"
                ? "Join your company"
                : "Create your workspace"
              : mode === "signup"
                ? "A better workday starts here."
                : "Welcome back."}
          </h2>
          <p>
            {mode === "organization"
              ? signupRole === "employee"
                ? "You’re signed in. Open your administrator’s invitation to join a company."
                : "You’re signed in. Create a new workspace, or sign in with the account that already has company access."
              : "Sign in to your company workspace."}
          </p>
          {error && (
            <div className="nt-message nt-error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="nt-message nt-success" role="status">
              {message}
            </div>
          )}
          {mode === "organization" && signedInEmail && (
            <p>
              Signed in as <strong>{signedInEmail}</strong>.
            </p>
          )}
          {(mode === "signup" || mode === "organization") && (
            <Field label="How will you use Neutronium?">
              <select
                value={signupRole}
                onChange={(e) => setSignupRole(e.target.value)}
              >
                <option value="employee">
                  Employee — join an invited company
                </option>
                <option value="admin">Admin — create a new company</option>
              </select>
            </Field>
          )}
          {mode === "organization" && signupRole === "employee" ? (
            <p>
              Open the invitation link from your administrator to submit your
              details or check your application. Your administrator must accept
              your application before you can open this company’s workspace.
            </p>
          ) : mode === "organization" ? (
            <Field label="Organization name">
              <input
                name="name"
                required
                maxLength={100}
                placeholder="Acme Inc."
              />
            </Field>
          ) : (
            <>
              <Field label="Work email">
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  name="password"
                  required
                  minLength={mode === "signup" ? 12 : undefined}
                  maxLength={128}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  placeholder={
                    mode === "signup"
                      ? "At least 12 characters"
                      : "Your password"
                  }
                />
              </Field>
            </>
          )}
          {(mode !== "organization" || signupRole !== "employee") && (
            <button className="nt-button nt-primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "organization"
                  ? "Create workspace"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              <Icon name="arrow" size={16} />
            </button>
          )}
          {mode !== "organization" && (
            <button
              type="button"
              className="nt-link nt-auth-switch"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
                setMessage("");
              }}
            >
              {mode === "login"
                ? "New here? Create an account"
                : "Already have an account? Sign in"}
            </button>
          )}
          {mode === "organization" && (
            <>
              <button
                type="button"
                className="nt-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  setMessage("");
                  try {
                    await api("logout", {});
                    setSignedInEmail("");
                    setMode("login");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Sign in with a different account
              </button>
              <button
                type="button"
                className="nt-button"
                disabled={busy}
                onClick={() => void onReady().catch((e) => setError(e.message))}
              >
                Check my invitation
              </button>
              {config?.socialProviders?.map((provider) => (
                <button
                  type="button"
                  className="nt-button"
                  key={provider}
                  onClick={async () => {
                    try {
                      const r = await api("auth/social", { provider });
                      location.assign(r.url);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Link {provider} sign-in
                </button>
              ))}
            </>
          )}
          {mode !== "organization" && (
            <button
              type="button"
              className="nt-button"
              disabled={busy}
              onClick={async (e) => {
                const email =
                  e.currentTarget.form?.querySelector<HTMLInputElement>(
                    'input[name="email"]',
                  );
                if (!email?.reportValidity()) return;
                setBusy(true);
                setError("");
                try {
                  await api("auth/resend-confirmation", { email: email.value });
                  setMessage(
                    "If this account still needs verification, a new confirmation email has been requested. Check your inbox and junk mail. Already verified? Sign in with your existing password.",
                  );
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Resend confirmation email
            </button>
          )}
          {mode !== "organization" &&
            ["google", "microsoft"].map((provider) => (
              <button
                key={provider}
                type="button"
                className="nt-button"
                disabled={busy || !config?.socialProviders?.includes(provider)}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await api("auth/social", {
                      provider,
                      signupRole,
                    });
                    location.assign(r.url);
                  } catch (e) {
                    setError((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                Continue with {provider === "google" ? "Google" : "Microsoft"}
                {!config?.socialProviders?.includes(provider)
                  ? " (not configured)"
                  : ""}
              </button>
            ))}
          {config?.demoAvailable && (
            <button
              className="nt-button nt-demo-launch"
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("demo", {});
                  await onReady();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Icon name="spark" />
              Open development workspace
            </button>
          )}
          <small>
            Company data stays in your organization. Every sensitive action is
            checked and recorded.
          </small>
        </ValidatedForm>
      </div>
    </div>
  );
}
function Settings({
  w,
  busy,
  canEdit,
  save,
}: {
  w: Workspace;
  busy: boolean;
  canEdit: boolean;
  save: (data: unknown) => Promise<unknown>;
}) {
  return (
    <Panel title="Organization settings">
      <form
        className="nt-settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void save({
            name: f.get("name"),
            domain: f.get("domain"),
            approvalRule: f.getAll("approvalRule"),
          }).catch(() => {});
        }}
      >
        <div className="nt-form-grid">
          <Field label="Company name">
            <input
              name="name"
              defaultValue={w.name}
              required
              disabled={!canEdit}
            />
          </Field>
          <Field label="Company domain">
            <input
              name="domain"
              defaultValue={w.domain}
              placeholder="company.com"
              disabled={!canEdit}
            />
          </Field>
        </div>
        <h3>Access approval policy</h3>
        <p>
          Select approval stages in order. A request moves through each selected
          stage. Requesters cannot approve their own access.
        </p>
        <div className="nt-check-options">
          {[
            ["manager", "Employee’s manager"],
            ["owner", "Application owner"],
            ["admin", "Company administrator"],
          ].map(([v, l]) => (
            <label key={v}>
              <input
                type="checkbox"
                name="approvalRule"
                value={v}
                defaultChecked={w.approvalRule.includes(v as "manager")}
                disabled={!canEdit}
              />
              <span>{l}</span>
            </label>
          ))}
        </div>
        <h3>Email & data policies</h3>
        <p>
          Microsoft identities and email hosting are separate concerns.
          Templates may assign a Microsoft license; mailbox creation is governed
          by that license and your tenant configuration. Data retention and
          ownership transfer require an administrator’s verified offboarding
          step.
        </p>
        <button className="nt-button nt-primary" disabled={busy || !canEdit}>
          Save settings
        </button>
      </form>
    </Panel>
  );
}
function WorkspaceDialog({
  dialog,
  w,
  actor,
  config,
  busy,
  error,
  close,
  run,
  setError,
  navigate,
}: {
  dialog: Dialog;
  w: Workspace;
  actor: Actor;
  config?: Config;
  busy: boolean;
  error: string;
  close: () => void;
  run: (path: string, data: unknown, success?: string) => Promise<any>;
  setError: (s: string) => void;
  navigate: (s: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const [manualOnboarding, setManualOnboarding] = useState(false);
  const [customDuration, setCustomDuration] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(
    dialog.kind === "template"
      ? dialog.id || ""
      : w.templates.find((t) => t.active)?.id || "",
  );
  const [form, setForm] = useState<Record<string, string>>({
    firstName: "",
    lastName: "",
    email: "",
    personalEmail: "",
    department: "Engineering",
    title: "Developer",
    managerId: w.employees.find((e) => e.firstName === "Michael")?.id || "",
    startDate: new Date().toISOString().slice(0, 10),
    location: "",
    employmentType: "Full-time",
  });
  const [selectedEmployee, setSelectedEmployee] = useState(
    dialog.id || w.employees.find((e) => e.status === "active")?.id || "",
  );
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
    };
  }, []);
  const e = w.employees.find((e) => e.id === dialog.id);
  const t = w.templates.find((t) => t.id === dialog.id);
  const job = w.jobs.find((j) => j.id === dialog.id);
  const request = w.requests.find((r) => r.id === dialog.id);
  const app = w.applications.find((a) => a.id === dialog.id);
  const template = w.templates.find((t) => t.id === selectedTemplate);
  const offboardEmployee = w.employees.find((e) => e.id === selectedEmployee);
  const name = (id: string) =>
    w.applications.find((a) => a.id === id)?.name || "Application";
  const title =
    dialog.kind === "onboard"
      ? "Welcome a new teammate"
      : dialog.kind === "offboard"
        ? "Plan a secure departure"
        : dialog.kind === "template"
          ? t
            ? `Edit ${t.name}`
            : "Create a role template"
          : dialog.kind === "employee"
            ? fullName(e)
            : dialog.kind === "job"
              ? "Workflow details"
              : dialog.kind === "request"
                ? "Request the access you need"
                : dialog.kind === "request-detail"
                  ? "Access request"
                  : dialog.kind === "application"
                    ? app?.name
                    : dialog.kind === "connect"
                      ? "Connect Microsoft 365"
                      : "Invite to employee portal";
  const field = (
    key: string,
    label: string,
    type = "text",
    required = false,
  ) => (
    <Field label={label}>
      <input
        type={type}
        value={form[key] || ""}
        required={required}
        maxLength={200}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </Field>
  );
  const safeRun = (path: string, data: unknown, message?: string) =>
    void run(path, data, message).catch(() => {});
  return (
    <dialog
      ref={ref}
      className={`nt-dialog ${dialog.kind === "onboard" ? "nt-dialog-wide" : ""}`}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else close();
      }}
    >
      <div className="nt-dialog-head">
        <div>
          <span className="nt-eyebrow">NEUTRONIUM · {w.name}</span>
          <h2>{title}</h2>
        </div>
        <button
          className="nt-icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={close}
        >
          <Icon name="close" size={20} />
        </button>
      </div>
      {error && (
        <div className="nt-message nt-error" role="alert">
          {error}
        </div>
      )}
      <div className="nt-dialog-body">
        {dialog.kind === "onboard" && !manualOnboarding && (
          <OnboardingInvite
            w={w}
            manual={() => setManualOnboarding(true)}
            reviews={() => {
              close();
              navigate("employee-approvals");
            }}
          />
        )}
        {dialog.kind === "onboard" && manualOnboarding && (
          <>
            <div className="nt-wizard-steps">
              {[
                "Employee details",
                "Role & tools",
                w.demo ? "Review & launch" : "Submit for review",
              ].map((s, i) => (
                <span className={step >= i ? "nt-wizard-current" : ""} key={s}>
                  <i>{step > i ? <Icon name="check" size={13} /> : i + 1}</i>
                  {s}
                </span>
              ))}
            </div>
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                if (step < 2) {
                  setStep(step + 1);
                  return;
                }
                void run(
                  w.demo ? "onboard" : "onboarding/create",
                  { ...form, templateId: selectedTemplate },
                  w.demo
                    ? "Onboarding started. Follow each step in Workflows."
                    : "Employee application submitted for administrator review.",
                )
                  .then(() =>
                    navigate(w.demo ? "onboarding" : "employee-approvals"),
                  )
                  .catch(() => {});
              }}
            >
              {step === 0 && (
                <>
                  <h3>Let’s get to know your new teammate.</h3>
                  <p className="nt-subtle">
                    Start with the essentials. We’ll take care of the next
                    steps.
                  </p>
                  <div className="nt-form-grid">
                    {field("firstName", "First name", "text", true)}
                    {field("lastName", "Last name", "text", true)}
                    {field("email", "Company email", "email", true)}
                    <Field label="Verified Microsoft domain">
                      <select
                        value={form.email.split("@")[1] || ""}
                        onChange={(e) => {
                          const local = [form.firstName, form.lastName]
                            .map((v) =>
                              v
                                .toLowerCase()
                                .normalize("NFKD")
                                .replace(/[^a-z0-9]/g, ""),
                            )
                            .filter(Boolean)
                            .join(".");
                          setForm({
                            ...form,
                            email: `${local}@${e.target.value}`,
                          });
                        }}
                      >
                        <option value="">
                          Choose a domain to suggest an email
                        </option>
                        {w.microsoftReadiness?.domains
                          .filter((d) => d.isVerified)
                          .map((d) => (
                            <option key={d.id}>{d.id}</option>
                          ))}
                      </select>
                    </Field>
                    {field(
                      "personalEmail",
                      "Personal email (optional)",
                      "email",
                    )}
                    {field("title", "Job title")}
                    {field("department", "Department", "text", true)}
                    <Field label="Manager">
                      <select
                        value={form.managerId}
                        onChange={(e) =>
                          setForm({ ...form, managerId: e.target.value })
                        }
                      >
                        <option value="">Assign later</option>
                        {w.employees
                          .filter((e) => e.status === "active")
                          .map((e) => (
                            <option value={e.id} key={e.id}>
                              {fullName(e)}
                            </option>
                          ))}
                      </select>
                    </Field>
                    {field("startDate", "Start date", "date", true)}
                    {field("location", "Location")}
                    <Field label="Country code for Microsoft licensing">
                      <input
                        name="usageLocation"
                        placeholder="CA"
                        maxLength={2}
                        value={form.usageLocation || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            usageLocation: e.target.value,
                          } as typeof form)
                        }
                      />
                    </Field>
                    <Field label="Employment type">
                      <select
                        value={form.employmentType}
                        onChange={(e) =>
                          setForm({ ...form, employmentType: e.target.value })
                        }
                      >
                        {["Full-time", "Part-time", "Contractor", "Intern"].map(
                          (v) => (
                            <option key={v}>{v}</option>
                          ),
                        )}
                      </select>
                    </Field>
                  </div>
                </>
              )}
              {step === 1 && (
                <>
                  <h3>A head start, tailored to their role.</h3>
                  <p className="nt-subtle">
                    Choose the tools and permissions your teammate will start
                    with.
                  </p>
                  <div className="nt-template-options">
                    {w.templates
                      .filter((t) => t.active)
                      .map((t) => (
                        <label
                          className={
                            selectedTemplate === t.id ? "nt-selected" : ""
                          }
                          key={t.id}
                        >
                          <input
                            type="radio"
                            name="template"
                            required
                            value={t.id}
                            checked={selectedTemplate === t.id}
                            onChange={() => setSelectedTemplate(t.id)}
                          />
                          <div>
                            <strong>{t.name}</strong>
                            <p>{t.description}</p>
                            <small>
                              {t.applications.map(name).join(" · ")}
                            </small>
                          </div>
                          <Icon name="templates" size={20} />
                        </label>
                      ))}
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="nt-review-person">
                    <Avatar name={`${form.firstName} ${form.lastName}`} />
                    <div>
                      <h3>
                        {form.firstName} {form.lastName}
                      </h3>
                      <p>
                        {form.email} · {form.department}
                      </p>
                    </div>
                    <Badge value={w.demo ? "Development" : "Ready"} />
                  </div>
                  <h3>Here’s what will happen</h3>
                  <ul className="nt-review-list">
                    <li>
                      <Icon name="check" />
                      Create a company identity
                    </li>
                    {template?.licenseId && (
                      <li>
                        <Icon name="check" />
                        Assign Microsoft 365 license {template.licenseId}
                      </li>
                    )}
                    {template?.groups.map((g) => (
                      <li key={g}>
                        <Icon name="check" />
                        Add to group {g}
                      </li>
                    ))}
                    {template?.applications.map((id) => (
                      <li key={id}>
                        <Icon name="check" />
                        Grant {name(id)} access{" "}
                        <Badge
                          value={
                            w.applications.find((a) => a.id === id)?.mode ||
                            "manual"
                          }
                        />
                      </li>
                    ))}
                    <li>
                      <Icon name="check" />
                      Prepare employee portal invitation
                    </li>
                  </ul>
                  <div className="nt-inline-note">
                    <Icon name="onboarding" />
                    {w.demo
                      ? "The development worker will execute these steps individually. No external accounts are created."
                      : "A background worker will run each step. Manual integrations and initial sign-in setup pause for administrator verification."}
                  </div>
                </>
              )}
              <div className="nt-dialog-actions">
                <button
                  type="button"
                  className="nt-button"
                  disabled={busy}
                  onClick={() => (step ? setStep(step - 1) : close())}
                >
                  {step ? "Back" : "Cancel"}
                </button>
                <span>{step + 1} of 3</span>
                <button
                  className="nt-button nt-primary"
                  disabled={busy || !selectedTemplate}
                >
                  {busy
                    ? "Starting…"
                    : step === 2
                      ? w.demo
                        ? "Start onboarding"
                        : "Submit application for review"
                      : "Continue"}
                  <Icon name="arrow" size={15} />
                </button>
              </div>
            </form>
          </>
        )}
        {dialog.kind === "offboard" && (
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              const data = Object.fromEntries(new FormData(ev.currentTarget));
              void run(
                "offboard",
                { ...data, employeeId: selectedEmployee },
                "Offboarding scheduled. Track each action in Workflows.",
              )
                .then(() => navigate("onboarding"))
                .catch(() => {});
            }}
          >
            <Field label="Employee">
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                required
              >
                {w.employees
                  .filter((e) => e.status === "active")
                  .map((e) => (
                    <option value={e.id} key={e.id}>
                      {fullName(e)} — {e.email}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Schedule (leave empty to start now)">
              <input name="scheduledAt" type="datetime-local" />
            </Field>
            <div className="nt-warning">
              <Icon name="alert" />
              <p>
                Sign-in will be disabled and active sessions revoked. This
                affects your teammate’s ability to work.
              </p>
            </div>
            <h3>Offboarding checklist</h3>
            <ul className="nt-review-list">
              <li>
                <Icon name="exit" />
                Disable company sign-in
              </li>
              <li>
                <Icon name="access" />
                Revoke active sessions
              </li>
              {w.grants
                .filter(
                  (g) =>
                    g.employeeId === selectedEmployee && g.status === "active",
                )
                .map((g) => (
                  <li key={g.id}>
                    <Icon name="close" />
                    Remove {name(g.applicationId)} · {g.level}
                  </li>
                ))}
              <li>
                <Icon name="permissions" />
                Review remaining groups, elevated roles, and device access
              </li>
              <li>
                <Icon name="mail" />
                Preserve email and review data ownership transfers
              </li>
            </ul>
            <Field
              label={`Type ${offboardEmployee?.email || "the company email"} to confirm`}
            >
              <input name="confirmation" required autoComplete="off" />
            </Field>
            <div className="nt-dialog-actions">
              <button className="nt-button" type="button" onClick={close}>
                Cancel
              </button>
              <button
                className="nt-button nt-danger"
                disabled={busy || !offboardEmployee}
              >
                Confirm offboarding <Icon name="arrow" size={16} />
              </button>
            </div>
          </form>
        )}
        {dialog.kind === "template" && (
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              const f = new FormData(ev.currentTarget);
              safeRun(
                "template",
                {
                  id: t?.id,
                  name: f.get("name"),
                  description: f.get("description"),
                  applications: f.getAll("applications"),
                  groups: String(f.get("groups") || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  licenseId: f.get("licenseId"),
                  active: f.get("active") === "on",
                },
                "Role template saved.",
              );
            }}
          >
            <Field label="Template name">
              <input
                name="name"
                required
                defaultValue={t?.name}
                placeholder="e.g. Developer"
                maxLength={100}
              />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                defaultValue={t?.description}
                rows={2}
                maxLength={500}
              />
            </Field>
            <h3>Applications</h3>
            <div className="nt-check-options">
              {w.applications.map((a) => (
                <label key={a.id}>
                  <input
                    type="checkbox"
                    name="applications"
                    value={a.id}
                    defaultChecked={t?.applications.includes(a.id)}
                  />
                  <AppMark app={a} />
                  <span>{a.name}</span>
                  <Badge value={a.mode} />
                </label>
              ))}
            </div>
            <Field label="Microsoft group object IDs (comma separated)">
              <input
                name="groups"
                defaultValue={t?.groups.join(", ")}
                placeholder="Optional"
              />
            </Field>
            <Field label="Microsoft license SKU ID">
              <input
                name="licenseId"
                list="nt-license-skus"
                defaultValue={t?.licenseId}
                placeholder="Optional"
              />
            </Field>
            <datalist id="nt-license-skus">
              {w.microsoftReadiness?.skus.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.available} available
                </option>
              ))}
            </datalist>
            <label className="nt-checkbox">
              <input
                name="active"
                type="checkbox"
                defaultChecked={t?.active ?? true}
              />
              Active template
            </label>
            <div className="nt-dialog-actions">
              <button className="nt-button" type="button" onClick={close}>
                Cancel
              </button>
              <button className="nt-button nt-primary" disabled={busy}>
                Save template
              </button>
            </div>
          </form>
        )}
        {dialog.kind === "request" && (
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              const values = Object.fromEntries(new FormData(ev.currentTarget));
              safeRun(
                "request",
                {
                  ...values,
                  durationMinutes:
                    values.durationMinutes === "custom"
                      ? values.customMinutes
                      : values.durationMinutes,
                },
                "Request submitted. Your approver will be notified.",
              );
            }}
          >
            <p className="nt-subtle">
              Tell us what you need and why. Your company’s approval policy
              takes it from here.
            </p>
            <Field label="Application">
              <select name="applicationId" required>
                {w.applications
                  .filter((a) => a.mode !== "coming_soon")
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}{" "}
                      {a.mode === "manual" ? "(manual provisioning)" : ""}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="nt-form-grid">
              <Field label="Permission level">
                <select name="level">
                  {["Standard", "Read", "Write", "Admin"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Duration">
                <select
                  name="durationMinutes"
                  onChange={(ev) =>
                    setCustomDuration(ev.target.value === "custom")
                  }
                >
                  <option value="60">1 hour</option>
                  <option value="240">4 hours</option>
                  <option value="1440">1 day</option>
                  <option value="10080">7 days</option>
                  <option value="0">Permanent</option>
                  <option value="custom">Custom duration</option>
                  {w.demo && (
                    <option value="1">1 minute (test expiration)</option>
                  )}
                </select>
              </Field>
            </div>
            {customDuration && (
              <Field label="Custom duration in minutes (up to 30 days)">
                <input
                  type="number"
                  name="customMinutes"
                  min={1}
                  max={43200}
                  required
                />
              </Field>
            )}
            <Field label="Why do you need access?">
              <textarea
                name="reason"
                rows={4}
                required
                maxLength={2000}
                placeholder="Help your approver understand the work you need to do."
              />
            </Field>
            <div className="nt-inline-note">
              <Icon name="audit" />
              Temporary access is automatically queued for removal when its
              duration ends. Manual apps require an administrator to confirm
              removal.
            </div>
            <div className="nt-dialog-actions">
              <button className="nt-button" type="button" onClick={close}>
                Cancel
              </button>
              <button className="nt-button nt-primary" disabled={busy}>
                Submit request <Icon name="arrow" size={16} />
              </button>
            </div>
          </form>
        )}
        {dialog.kind === "request-detail" && request && (
          <>
            <div className="nt-row">
              <Avatar
                name={fullName(
                  w.employees.find((e) => e.id === request.employeeId),
                )}
              />
              <div className="nt-grow">
                <strong>
                  {fullName(
                    w.employees.find((e) => e.id === request.employeeId),
                  )}
                </strong>
                <p>
                  {name(request.applicationId)} · {request.level}
                </p>
              </div>
              <Badge value={request.status} />
            </div>
            <p className="nt-quote">{request.reason}</p>
            <dl className="nt-detail-list">
              <dt>Duration</dt>
              <dd>
                {request.durationMinutes
                  ? `${request.durationMinutes} minutes`
                  : "Permanent"}
              </dd>
              <dt>Submitted</dt>
              <dd>{time(request.createdAt)}</dd>
              <dt>Approval chain</dt>
              <dd>{request.stages.join(" → ")}</dd>
            </dl>
            {request.approvals.map((a, i) => (
              <div className="nt-approval-record" key={i}>
                <strong>
                  {a.name} · {a.decision.replace("_", " ")}
                </strong>
                <small>
                  {time(a.at)} · {a.stage}
                </small>
                <p>{a.note}</p>
              </div>
            ))}
            {mayApprove(w, actor, request) ? (
              <form
                onSubmit={(ev) => {
                  ev.preventDefault();
                  const f = new FormData(ev.currentTarget);
                  const decision = (
                    ev.nativeEvent as SubmitEvent
                  ).submitter?.getAttribute("value");
                  safeRun(
                    "decision",
                    { id: request.id, decision, note: f.get("note") },
                    "Decision recorded. Approved access will be provisioned by the worker.",
                  );
                }}
              >
                <Field label="Note (required for rejection or more information)">
                  <textarea name="note" rows={3} maxLength={2000} />
                </Field>
                <div className="nt-decision-actions">
                  <button
                    className="nt-button"
                    value="more_info"
                    disabled={busy}
                  >
                    Ask for information
                  </button>
                  <button
                    className="nt-button nt-danger-outline"
                    value="reject"
                    disabled={busy}
                  >
                    Reject
                  </button>
                  <button
                    className="nt-button nt-primary"
                    value="approve"
                    disabled={busy}
                  >
                    <Icon name="check" size={15} />
                    Approve
                  </button>
                </div>
              </form>
            ) : request.status === "more_info" &&
              request.employeeId === actor.employeeId ? (
              <form
                onSubmit={(ev) => {
                  ev.preventDefault();
                  safeRun(
                    "reply",
                    {
                      id: request.id,
                      note: new FormData(ev.currentTarget).get("note"),
                    },
                    "Additional information sent.",
                  );
                }}
              >
                <Field label="Additional information">
                  <textarea required name="note" rows={3} />
                </Field>
                <button className="nt-button nt-primary" disabled={busy}>
                  Send reply
                </button>
              </form>
            ) : (
              <div className="nt-inline-note">
                <Icon name="permissions" />
                {request.status === "pending"
                  ? "Only the assigned approver can decide this request. In the demo, switch to Michael Ross · Manager to review Sarah’s request."
                  : "This request’s current status is shown above. All decisions are recorded in the audit log."}
              </div>
            )}
          </>
        )}
        {dialog.kind === "job" && job && (
          <>
            <div className="nt-row nt-job-summary">
              <div className="nt-grow">
                <strong>
                  {fullName(w.employees.find((e) => e.id === job.employeeId))}
                </strong>
                <p>
                  {job.kind} · Started {time(job.createdAt)}
                </p>
              </div>
              <Badge value={job.status} />
            </div>
            <div className="nt-workflow-steps">
              {job.steps.map((s, i) => (
                <div className="nt-workflow-step" key={s.id}>
                  <span className={`nt-step-marker nt-step-${s.status}`}>
                    {s.status === "success" ? (
                      <Icon name="check" size={15} />
                    ) : s.status === "failed" ? (
                      <Icon name="close" size={15} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div className="nt-grow">
                    <div className="nt-row">
                      <strong>{s.name}</strong>
                      <Badge value={s.status} />
                    </div>
                    {s.error && <p>{s.error}</p>}
                    {s.status === "pending" &&
                      job.steps
                        .slice(0, i)
                        .some(
                          (previous) =>
                            !["success", "skipped"].includes(previous.status),
                        ) && (
                        <p className="nt-subtle">
                          Waiting for earlier steps. This step has not run.
                        </p>
                      )}
                    {s.attempts > 0 && (
                      <small>
                        {s.attempts} attempt{s.attempts > 1 ? "s" : ""}
                      </small>
                    )}
                    {s.status === "manual_required" &&
                      canAdmin(actor) &&
                      job.steps
                        .slice(0, i)
                        .every((previous) =>
                          ["success", "skipped"].includes(previous.status),
                        ) && (
                        <form
                          onSubmit={(ev) => {
                            ev.preventDefault();
                            safeRun(
                              "manual-complete",
                              {
                                id: job.id,
                                stepId: s.id,
                                note: new FormData(ev.currentTarget).get(
                                  "note",
                                ),
                              },
                              "Manual action verified. The workflow can continue.",
                            );
                          }}
                        >
                          <Field label="Completion evidence">
                            <input
                              name="note"
                              required
                              placeholder="Describe what you verified in the provider"
                            />
                          </Field>
                          <button className="nt-button" disabled={busy}>
                            Confirm completed manually
                          </button>
                        </form>
                      )}
                  </div>
                </div>
              ))}
            </div>
            {job.status === "failed" && canManagePeople(actor) && (
              <button
                className="nt-button nt-primary"
                disabled={busy}
                onClick={() =>
                  safeRun(
                    "retry",
                    { id: job.id },
                    "Failed steps queued for retry.",
                  )
                }
              >
                Retry failed steps
              </button>
            )}
            <div className="nt-inline-note">
              <Icon name="audit" />
              This workflow is stored durably. You can close this dialog and
              return to it later.
            </div>
          </>
        )}
        {dialog.kind === "employee" && e && (
          <>
            <div className="nt-profile nt-profile-compact">
              <Avatar name={fullName(e)} />
              <h3>{e.title}</h3>
              <p>
                {e.department} · {e.email}
              </p>
              <Badge value={e.status} />
            </div>
            <dl className="nt-detail-list">
              <dt>Manager</dt>
              <dd>
                {e.managerId
                  ? fullName(w.employees.find((v) => v.id === e.managerId))
                  : "Not assigned"}
              </dd>
              <dt>Start date</dt>
              <dd>{e.startDate ? date(e.startDate) : "—"}</dd>
              <dt>Location</dt>
              <dd>{e.location || "—"}</dd>
              <dt>Employment</dt>
              <dd>{e.employmentType || "—"}</dd>
              <dt>Identity</dt>
              <dd>
                {e.providerId
                  ? w.demo
                    ? "Development identity"
                    : "Matched Microsoft identity"
                  : "Not provisioned"}
              </dd>
            </dl>
            <h3>Current access</h3>
            <div className="nt-employee-access">
              {w.grants
                .filter((g) => g.employeeId === e.id && g.status === "active")
                .map((g) => (
                  <div key={g.id}>
                    <strong>{name(g.applicationId)}</strong>
                    <span>{g.level}</span>
                    <small>
                      {g.expiresAt
                        ? `Expires ${time(g.expiresAt)}`
                        : "Permanent"}
                    </small>
                  </div>
                ))}
            </div>
            {canManagePeople(actor) && (
              <details className="nt-edit-details">
                <summary>Edit employee details</summary>
                <form
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    safeRun(
                      "employee-update",
                      {
                        id: e.id,
                        ...Object.fromEntries(new FormData(ev.currentTarget)),
                      },
                      "Employee details updated.",
                    );
                  }}
                >
                  <Field label="First name">
                    <input
                      name="firstName"
                      required
                      maxLength={100}
                      defaultValue={e.firstName}
                    />
                  </Field>
                  <Field label="Last name">
                    <input
                      name="lastName"
                      required
                      maxLength={100}
                      defaultValue={e.lastName}
                    />
                  </Field>
                  <Field label="Personal email">
                    <input
                      name="personalEmail"
                      type="email"
                      maxLength={254}
                      defaultValue={e.personalEmail}
                    />
                  </Field>
                  <Field label="Start date">
                    <input
                      name="startDate"
                      type="date"
                      required
                      defaultValue={e.startDate}
                    />
                  </Field>
                  <Field label="Employment type">
                    <select
                      name="employmentType"
                      defaultValue={e.employmentType}
                    >
                      {[
                        "Full-time",
                        "Part-time",
                        "Contractor",
                        "Intern",
                        "Temporary",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Job title">
                    <input name="title" defaultValue={e.title} />
                  </Field>
                  <Field label="Department">
                    <input
                      name="department"
                      defaultValue={e.department}
                      required
                    />
                  </Field>
                  <Field label="Manager">
                    <select name="managerId" defaultValue={e.managerId}>
                      <option value="">Not assigned</option>
                      {w.employees
                        .filter((v) => v.id !== e.id && v.status === "active")
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {fullName(v)}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Location">
                    <input name="location" defaultValue={e.location} />
                  </Field>
                  <button className="nt-button nt-primary" disabled={busy}>
                    Save employee details
                  </button>
                </form>
              </details>
            )}
            {canAdmin(actor) && !w.demo && (
              <form
                onSubmit={(ev) => {
                  ev.preventDefault();
                  safeRun(
                    "invite",
                    {
                      employeeId: e.id,
                      ...Object.fromEntries(new FormData(ev.currentTarget)),
                    },
                    "Employee portal invitation and membership created.",
                  );
                }}
              >
                <h3>Employee portal access</h3>
                <p>
                  Choose Manager to allow this employee to review access
                  requests from their direct reports. Reporting assignments are
                  managed in Edit employee details.
                </p>
                <Field label="Portal role">
                  <select name="role">
                    {[
                      "EMPLOYEE",
                      "MANAGER",
                      "APPROVER",
                      "HR_ADMIN",
                      ...(actor.role === "ORG_OWNER" ? ["ORG_ADMIN"] : []),
                    ].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Existing Neutronium user ID (optional)">
                  <input
                    name="userId"
                    placeholder="Use only for an already registered employee"
                  />
                </Field>
                <button className="nt-button nt-primary" disabled={busy}>
                  Invite to portal
                </button>
              </form>
            )}
            {w.demo && (
              <div className="nt-inline-note">
                <Icon name="people" />
                Use Preview as in the top bar to open this employee’s portal.
              </div>
            )}
          </>
        )}
        {dialog.kind === "application" && app && (
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              safeRun(
                "application",
                {
                  id: app.id,
                  ...Object.fromEntries(new FormData(ev.currentTarget)),
                },
                "Application configuration saved.",
              );
            }}
          >
            <div className="nt-row">
              <AppMark app={app} />
              <Badge value={app.mode} />
            </div>
            <p className="nt-subtle">
              {app.mode === "manual"
                ? "Neutronium tracks requests and records administrator-confirmed changes. This application has no automated provisioning adapter."
                : app.mode === "development"
                  ? "The development adapter simulates provisioning. No changes are made in the real application."
                  : "Microsoft group membership can grant standard application access. Directory administrator roles are not automatically assigned."}
            </p>
            <Field label="Application owner">
              <select name="ownerId" defaultValue={app.ownerId || ""}>
                <option value="">Not assigned</option>
                {w.employees
                  .filter((e) => e.status === "active")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {fullName(e)}
                    </option>
                  ))}
              </select>
            </Field>
            {app.mode === "microsoft" && (
              <Field label="Microsoft security group object ID">
                <input
                  name="groupId"
                  defaultValue={app.groupId}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </Field>
            )}
            <div className="nt-dialog-actions">
              <a
                className="nt-button"
                href={app.url}
                target="_blank"
                rel="noreferrer"
              >
                Open provider <Icon name="arrow" size={15} />
              </a>
              <button
                className="nt-button nt-primary"
                disabled={busy || !canAdmin(actor)}
              >
                Save configuration
              </button>
            </div>
          </form>
        )}
        {dialog.kind === "connect" && (
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              try {
                const f = new FormData(ev.currentTarget);
                const result = await api("microsoft/connect", {
                  tenantId: f.get("tenantId"),
                  features: f.getAll("features"),
                });
                window.location.assign(result.url);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <p className="nt-subtle">
              An authorized Microsoft tenant administrator must grant consent.
              Neutronium validates the tenant and stores credentials encrypted
              on the server.
            </p>
            <Field label="Microsoft tenant ID">
              <input
                name="tenantId"
                required
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </Field>
            <h3>Enable only the features you need</h3>
            <div className="nt-check-options">
              {Object.entries(config?.microsoftFeatures || {}).map(
                ([key, f]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      name="features"
                      value={key}
                      defaultChecked={key === "inventory"}
                    />
                    <div>
                      <strong>{f.name}</strong>
                      <small>{f.permissions.join(", ")}</small>
                    </div>
                  </label>
                ),
              )}
            </div>
            <div className="nt-warning">
              <Icon name="permissions" />
              <p>
                Application permissions use Microsoft’s admin-consent flow. The
                Microsoft consent screen includes all application permissions
                configured in the app registration. Review that screen
                carefully; dynamic per-feature application consent is not
                supported.
              </p>
            </div>
            <button className="nt-button nt-primary">
              Continue to Microsoft <Icon name="arrow" size={16} />
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
