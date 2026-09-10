"use client";
import { useEffect, useState } from "react";
import {
  Actor,
  Workspace,
  HelpRequest,
  canAdmin,
  fullName,
} from "@/lib/neutronium/model";
import {
  requestKinds,
  fulfillmentStates,
  fulfillment,
  approval,
  viewFilters,
  pilotReport,
} from "@/lib/neutronium/operations";
type Run = (path: string, data: unknown, success?: string) => Promise<any>;
const label = (s: string) => s.replaceAll("_", " ");
const localInputDate = (value?: string) =>
  value
    ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
export function Operations({
  w,
  actor,
  run,
}: {
  w: Workspace;
  actor: Actor;
  run: Run;
}) {
  const admin = canAdmin(actor);
  const [kind, setKind] = useState("general");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState("");
  const [page, setPage] = useState<{
    items: HelpRequest[];
    nextCursor: string | null;
  }>({ items: [], nextCursor: null });
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      fetch(
        `/neutronium/api/operations?${new URLSearchParams({ filter, q, cursor })}`,
      )
        .then(async (r) => {
          const v = await r.json();
          if (!r.ok) throw new Error(v.error);
          if (live) {
            setPage(v);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [filter, q, cursor, w.revision, actor.id]);
  const active = page.items.find((r) => r.id === selected);
  const [context, setContext] = useState<Pick<Workspace, "requests" | "jobs">>({
    requests: [],
    jobs: [],
  });
  useEffect(() => {
    setContext({ requests: [], jobs: [] });
    if (!selected || !admin) return;
    let live = true;
    fetch(
      `/neutronium/api/operations/context?id=${encodeURIComponent(selected)}`,
    )
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok) throw new Error(value.error);
        if (live) setContext(value);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [selected, admin, w.revision, actor.id]);
  const [metrics, setMetrics] = useState<ReturnType<typeof pilotReport> | null>(
    null,
  );
  useEffect(() => {
    if (!admin) return;
    let live = true;
    fetch("/neutronium/api/pilot/report")
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok) throw new Error(value.error);
        if (live) setMetrics(value);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [admin, w.revision, actor.id]);
  async function submit(path: string, data: unknown) {
    setBusy(true);
    setError("");
    try {
      return await run(path, data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const proof = (
    <>
      <label>
        Performed by
        <input name="performedBy" defaultValue={actor.name} required />
      </label>
      <label>
        Provider / service
        <input name="provider" required />
      </label>
      <label>
        Target account, item or document
        <input name="target" required />
      </label>
      <label>
        Verification method
        <input
          name="method"
          placeholder="Checked membership in provider admin console"
          required
        />
      </label>
      <label>
        Evidence
        <textarea name="note" required maxLength={2000} />
      </label>
    </>
  );
  return (
    <section className="nt-team-tools">
      {error && <p role="alert">{error}</p>}
      {admin && metrics && (
        <div className="nt-tool-card">
          <h2>Pilot activity · last 30 days</h2>
          <p>
            {metrics.overdue} overdue requests · {metrics.unverifiedRemovals}{" "}
            removals awaiting verification · {metrics.manualActions} manual
            workflow actions
          </p>
          <p>
            Average completion:{" "}
            {metrics.meanCompletionHours === null
              ? "No completed requests"
              : `${metrics.meanCompletionHours.toFixed(1)} hours`}{" "}
            · {metrics.manualConfirmations} manually confirmed completions
          </p>
        </div>
      )}
      <details className="nt-tool-card" open={!admin}>
        <summary>Create service request</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            void submit(
              "help-create",
              Object.fromEntries(new FormData(form)),
            ).then((r) => {
              if (r) {
                form.reset();
                setKind("general");
                setCursor("");
              }
            });
          }}
        >
          <label>
            Request type
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {requestKinds
                .filter(
                  (k) => admin || !["onboarding", "offboarding"].includes(k),
                )
                .map((k) => (
                  <option key={k}>{k}</option>
                ))}
            </select>
          </label>
          {admin && (
            <label>
              Employee
              <select name="employeeId" required>
                <option value="">Choose employee</option>
                {w.employees
                  .filter((e) => e.status !== "terminated")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {fullName(e)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Subject
            <input name="subject" required maxLength={150} />
          </label>
          <label>
            Your request
            <textarea name="body" required maxLength={4000} />
          </label>
          <label>
            Priority
            <select name="priority">
              {["normal", "low", "high", "urgent"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input name="dueAt" type="datetime-local" />
          </label>
          {["software", "contractor"].includes(kind) && (
            <>
              <label>
                Application
                <select name="applicationId" required>
                  {w.applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                An access request is created automatically using your company’s
                approval policy. Approval and fulfillment remain separate.
              </p>
            </>
          )}
          {kind === "contractor" && (
            <label>
              Access ends
              <input name="expiresAt" type="datetime-local" required />
            </label>
          )}
          {kind === "qa" && admin && (
            <label>
              Environment
              <select name="environmentId">
                <option value="">Choose environment</option>
                {w.testEnvironments
                  ?.filter((e) => e.status === "active")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button className="nt-button nt-primary" disabled={busy}>
            Send request
          </button>
        </form>
      </details>
      <div className="nt-toolbar">
        <input
          aria-label="Search service requests"
          placeholder="Search subject or request"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor("");
          }}
        />
        <select
          aria-label="Service request view"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setCursor("");
          }}
        >
          {viewFilters.map((f) => (
            <option key={f} value={f}>
              {label(f)}
            </option>
          ))}
        </select>
        {w.savedViews?.map((v) => (
          <button
            className="nt-button"
            key={v.id}
            onClick={() => {
              setFilter(v.filter);
              setCursor("");
            }}
          >
            {v.name}
          </button>
        ))}
        <button
          className="nt-button"
          onClick={() =>
            void submit("saved-view", { filter, name: label(filter) })
          }
        >
          Save view
        </button>
      </div>
      <div className="nt-inbox-layout">
        <div className="nt-tool-card">
          <h2>Service requests</h2>
          {page.items.map((r) => (
            <article className="nt-help-message" key={r.id}>
              <button className="nt-link" onClick={() => setSelected(r.id)}>
                {r.subject}
              </button>
              <p>
                {r.kind || "general"} · {label(fulfillment(r))} ·{" "}
                {r.priority || "normal"}
              </p>
              <small>
                {r.dueAt
                  ? `Due ${new Date(r.dueAt).toLocaleString()}`
                  : "No due date"}
              </small>
            </article>
          ))}
          {!page.items.length && <p>No requests match this view.</p>}
          <button
            className="nt-button"
            disabled={!cursor}
            onClick={() => setCursor("")}
          >
            First page
          </button>{" "}
          <button
            className="nt-button"
            disabled={!page.nextCursor}
            onClick={() => setCursor(page.nextCursor!)}
          >
            Next page
          </button>
        </div>
        <div className="nt-tool-card">
          {active ? (
            <>
              <h2>{active.subject}</h2>
              <p>{active.body}</p>
              <p>
                Approval: {label(approval(w, active))} · Fulfillment:{" "}
                {label(fulfillment(active))}
              </p>
              {active.messages.map((m) => (
                <article className="nt-help-message" key={m.id}>
                  <strong>
                    {m.author}
                    {m.internal ? " · Internal note" : ""}
                  </strong>
                  <p>{m.body}</p>
                  {m.attachment && (
                    <button
                      className="nt-link"
                      onClick={() =>
                        void submit("files/link", {
                          requestId: active.id,
                          messageId: m.id,
                        }).then((r) => {
                          if (r) window.location.assign(r.url);
                        })
                      }
                    >
                      Download {m.attachment.name}
                    </button>
                  )}
                </article>
              ))}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    data = new FormData(form);
                  const file = data.get("file") as File;
                  let attachment;
                  if (file?.size) {
                    if (file.size > 50000) {
                      setError("Files must be at most 50 KB.");
                      return;
                    }
                    attachment = {
                      name: file.name,
                      data: btoa(
                        Array.from(
                          new Uint8Array(await file.arrayBuffer()),
                          (b) => String.fromCharCode(b),
                        ).join(""),
                      ),
                    };
                  }
                  const r = await submit(
                    data.get("internal") ? "operation-note" : "help-reply",
                    {
                      id: active.id,
                      body: data.get("body"),
                      attachment,
                      status: "open",
                    },
                  );
                  if (r) form.reset();
                }}
              >
                <label>
                  Reply
                  <textarea name="body" required maxLength={4000} />
                </label>
                {admin && (
                  <>
                    <label>
                      Attach a file (up to 50 KB)
                      <input name="file" type="file" />
                    </label>
                    <label>
                      <input name="internal" type="checkbox" /> Internal admin
                      note
                    </label>
                  </>
                )}
                <button className="nt-button" disabled={busy}>
                  Send response
                </button>
              </form>
              {w.assignedTestAccounts
                ?.filter((a) => a.requestId === active.id)
                .map((a) => (
                  <p key={a.requestId}>
                    <a href={a.url} target="_blank" rel="noreferrer">
                      {a.environment}
                    </a>{" "}
                    · {a.username} · {a.role}
                    <br />
                    {a.notes}
                  </p>
                ))}
              <h3>Checklist</h3>
              {active.tasks?.map((t) => (
                <details key={t.id}>
                  <summary>
                    {t.completedAt ? "✓ " : ""}
                    {t.title}
                    {t.required ? " · Required" : " · Optional"}
                  </summary>
                  {t.evidence && (
                    <p>
                      Manually confirmed by {t.evidence.performedBy}:{" "}
                      {t.evidence.note}
                    </p>
                  )}
                  {admin && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void submit("operation-task", {
                          ...Object.fromEntries(new FormData(e.currentTarget)),
                          id: active.id,
                          taskId: t.id,
                          completed: !t.completedAt,
                        });
                      }}
                    >
                      {!t.completedAt && proof}
                      <button className="nt-button" disabled={busy}>
                        {t.completedAt
                          ? "Reopen task"
                          : "Confirm task completed"}
                      </button>
                    </form>
                  )}
                </details>
              ))}
              {admin && (
                <details>
                  <summary>Manage fulfillment</summary>
                  <form
                    key={active.id + active.updatedAt}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submit("operation-update", {
                        ...Object.fromEntries(new FormData(e.currentTarget)),
                        id: active.id,
                      });
                    }}
                  >
                    <label>
                      Owner
                      <select
                        name="ownerId"
                        defaultValue={active.ownerId || ""}
                      >
                        <option value="">Unassigned</option>
                        {w.employees
                          .filter((e) => e.status === "active")
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              {fullName(e)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Due date
                      <input
                        type="datetime-local"
                        name="dueAt"
                        defaultValue={localInputDate(active.dueAt)}
                      />
                    </label>
                    <label>
                      Fulfillment
                      <select
                        name="fulfillment"
                        defaultValue={fulfillment(active)}
                      >
                        {fulfillmentStates.map((s) => (
                          <option key={s} value={s}>
                            {label(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {["software", "contractor"].includes(active.kind || "") && (
                      <label>
                        Linked access request
                        <select
                          name="accessRequestId"
                          defaultValue={active.accessRequestId || ""}
                        >
                          <option value="">
                            Select approved access workflow
                          </option>
                          {context.requests
                            .filter(
                              (r) =>
                                r.employeeId === active.employeeId &&
                                r.applicationId === active.applicationId,
                            )
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.level} · {r.status} ·{" "}
                                {new Date(r.createdAt).toLocaleDateString()}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    {["onboarding", "offboarding"].includes(
                      active.kind || "",
                    ) && (
                      <label>
                        Lifecycle workflow
                        <select
                          name="workflowId"
                          defaultValue={active.workflowId || ""}
                        >
                          <option value="">Select workflow</option>
                          {context.jobs
                            .filter(
                              (j) =>
                                j.employeeId === active.employeeId &&
                                j.kind ===
                                  (active.kind === "onboarding"
                                    ? "onboard"
                                    : "offboard"),
                            )
                            .map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.kind} · {j.status}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    {active.kind === "qa" && (
                      <label>
                        Environment
                        <select
                          name="environmentId"
                          defaultValue={active.environmentId || ""}
                        >
                          <option value="">Choose environment</option>
                          {w.testEnvironments
                            ?.filter((e) => e.status === "active")
                            .map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    {active.kind === "qa" && (
                      <label>
                        Assigned tester account
                        <select
                          name="testerAccountId"
                          defaultValue={active.testerAccountId || ""}
                        >
                          <option value="">Select account</option>
                          {w.testEnvironments
                            ?.find((e) => e.id === active.environmentId)
                            ?.accounts.filter(
                              (a) =>
                                a.employeeId === active.employeeId &&
                                a.status === "active",
                            )
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.label} · {a.username}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    <p>
                      When completing, record what was delivered and how it was
                      verified.
                    </p>
                    <label>
                      Provider / service
                      <input name="provider" />
                    </label>
                    <label>
                      Target
                      <input name="target" />
                    </label>
                    <label>
                      Verification method
                      <input name="method" />
                    </label>
                    <label>
                      Evidence
                      <textarea name="note" />
                    </label>
                    <button className="nt-button" disabled={busy}>
                      Save fulfillment
                    </button>
                  </form>
                </details>
              )}
            </>
          ) : (
            <p>Select a request to view its checklist and conversation.</p>
          )}
        </div>
      </div>
      {admin && (
        <details className="nt-tool-card">
          <summary>Checklist templates</summary>
          <p>Existing requests keep their original checklist.</p>
          {w.checklistTemplates?.map((t) => (
            <p key={t.id}>
              {t.name} · {t.tasks.length} tasks
            </p>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void submit("checklist-template", {
                name: data.get("name"),
                kind: data.get("kind"),
                tasks: String(data.get("tasks"))
                  .split("\n")
                  .filter(Boolean)
                  .map((title) => ({ title, required: true })),
              });
            }}
          >
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Request type
              <select name="kind">
                {requestKinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              Required tasks · one per line
              <textarea name="tasks" required />
            </label>
            <button className="nt-button" disabled={busy}>
              Save template
            </button>
          </form>
        </details>
      )}
    </section>
  );
}
