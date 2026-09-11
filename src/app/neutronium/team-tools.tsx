"use client";
import { ValidatedForm } from "./form";
import { useState } from "react";
import { Actor, Workspace, canAdmin, fullName } from "@/lib/neutronium/model";
type Run = (path: string, data: unknown, success?: string) => Promise<unknown>;
export function HelpInbox({
  w,
  actor,
  run,
}: {
  w: Workspace;
  actor: Actor;
  run: Run;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const admin = canAdmin(actor);
  const requests = (w.helpRequests || [])
    .filter(
      (r) =>
        (status === "all" || status === r.status) &&
        `${r.subject} ${r.body} ${fullName(w.employees.find((e) => e.id === r.employeeId))}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .slice()
    .reverse();
  const active = (w.helpRequests || []).find((r) => r.id === selected);
  return (
    <section className="nt-team-tools">
      <div className="nt-toolbar">
        <input
          aria-label="Search employee help"
          placeholder="Search employee, subject or request…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Help request status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["all", "open", "waiting", "resolved"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span>{requests.length} requests</span>
      </div>
      {!admin && (
        <ValidatedForm
          className="nt-tool-card"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            try {
              await run(
                "help-create",
                Object.fromEntries(new FormData(form)),
                "Request sent to your administrators.",
              );
              form.reset();
            } catch {
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>What do you need?</h2>
          <label>
            Subject
            <input
              name="subject"
              required
              maxLength={150}
              placeholder="A new monitor, a document, help getting started…"
            />
          </label>
          <label>
            Your request
            <textarea name="body" required maxLength={4000} rows={3} />
          </label>
          <button className="nt-button nt-primary" disabled={busy}>
            Send request
          </button>
        </ValidatedForm>
      )}
      <div className="nt-inbox-layout">
        <div className="nt-tool-card">
          <table>
            <thead>
              <tr>
                <th>Employee / request</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      className="nt-link"
                      onClick={() => setSelected(r.id)}
                    >
                      {r.subject}
                    </button>
                    <small>
                      {fullName(w.employees.find((e) => e.id === r.employeeId))}
                    </small>
                  </td>
                  <td>{r.status}</td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!requests.length && <p>No requests match this view.</p>}
        </div>
        <div className="nt-tool-card">
          {active ? (
            <>
              <h2>{active.subject}</h2>
              <p className="nt-preserve">{active.body}</p>
              {active.messages.map((m) => (
                <article className="nt-help-message" key={m.id}>
                  <strong>{m.author}</strong>
                  <small>{new Date(m.at).toLocaleString()}</small>
                  <p className="nt-preserve">{m.body}</p>
                  {m.attachment && (
                    <button
                      className="nt-link"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const result = (await run("files/link", {
                            requestId: active.id,
                            messageId: m.id,
                          })) as { url: string };
                          window.location.assign(result.url);
                        } catch {
                          // The workspace displays the error from run.
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Download {m.attachment.name}
                    </button>
                  )}
                </article>
              ))}
              <ValidatedForm
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  setBusy(true);
                  try {
                    const file = data.get("file") as File | null;
                    let attachment;
                    if (file?.size) {
                      if (file.size > 50000)
                        throw new Error("Files must be at most 50 KB.");
                      const bytes = new Uint8Array(await file.arrayBuffer());
                      attachment = {
                        name: file.name,
                        data: btoa(
                          Array.from(bytes, (b) => String.fromCharCode(b)).join(
                            "",
                          ),
                        ),
                      };
                    }
                    await run(
                      "help-reply",
                      {
                        id: active.id,
                        body: data.get("body"),
                        status: data.get("status"),
                        attachment,
                      },
                      "Response sent.",
                    );
                    form.reset();
                  } catch (error) {
                    if (
                      error instanceof Error &&
                      error.message.includes("50 KB")
                    )
                      alert(error.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Reply
                  <textarea name="body" required maxLength={4000} rows={3} />
                </label>
                {admin && (
                  <>
                    <label>
                      Attach a file (up to 50 KB)
                      <input type="file" name="file" />
                    </label>
                    <label>
                      Status
                      <select name="status">
                        <option value="waiting">Waiting for employee</option>
                        <option value="resolved">Resolved</option>
                        <option value="open">Open</option>
                      </select>
                    </label>
                  </>
                )}
                <button className="nt-button nt-primary" disabled={busy}>
                  Send response
                </button>
              </ValidatedForm>
            </>
          ) : (
            <p>Select a request to read the conversation and respond.</p>
          )}
        </div>
      </div>
    </section>
  );
}
export function Connections({ w, run }: { w: Workspace; run: Run }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="nt-team-tools">
      {["vercel", "jira", "github"].map((provider) => (
        <section key={provider} className="nt-tool-card">
          <h2>
            {provider === "github"
              ? "GitHub Issues"
              : provider === "jira"
                ? "Jira"
                : "Vercel"}
          </h2>
          <p>
            Read-only {provider === "vercel" ? "projects" : "open issues"} · up
            to 100 records per sync. Access provisioning remains manual.
          </p>
          <p>
            Last synced:{" "}
            {w.integrations.find((i) => i.provider === provider)?.checkedAt ||
              "Never"}
          </p>
          {w.demo ? (
            <p>Sign in to a production workspace to connect this provider.</p>
          ) : (
            <ValidatedForm
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                setBusy(true);
                try {
                  await run(
                    "connections/connect",
                    { ...Object.fromEntries(new FormData(form)), provider },
                    "Integration connected and synchronized.",
                  );
                  form.reset();
                } catch {
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {provider === "jira"
                  ? "Atlassian hostname"
                  : provider === "github"
                    ? "Owner/repository"
                    : "Team ID (optional)"}
                <input name="scope" required={provider !== "vercel"} />
              </label>
              {provider === "jira" && (
                <label>
                  Atlassian email
                  <input name="email" type="email" required />
                </label>
              )}
              <label>
                API token
                <input
                  type="password"
                  name="token"
                  required
                  autoComplete="off"
                />
              </label>
              <button className="nt-button" disabled={busy}>
                Connect & sync
              </button>{" "}
              <button
                className="nt-button"
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await run(
                      "connections/sync",
                      { provider },
                      "Integration synchronized.",
                    );
                  } catch {
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Sync saved connection
              </button>
            </ValidatedForm>
          )}
          <ul>
            {w.externalItems?.[provider]?.map((item) => (
              <li key={item.id}>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.title}
                </a>{" "}
                · {item.status}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
export function AccountRisk({ w, run }: { w: Workspace; run: Run }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="nt-tool-card">
      <h2>Account risk</h2>
      <p>
        Microsoft Entra Identity Protection signals for administrator
        investigation. These signals can indicate compromise; they do not prove
        it. No accounts are automatically disabled.
      </p>
      <p>
        Last checked:{" "}
        {w.securityCheckedAt
          ? new Date(w.securityCheckedAt).toLocaleString()
          : "Never — risk has not been assessed"}
      </p>
      <button
        className="nt-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await run(
              "security/sync",
              {},
              w.demo
                ? "Simulated security alert created."
                : "Microsoft risk signals synchronized.",
            );
          } catch {
          } finally {
            setBusy(false);
          }
        }}
      >
        {w.demo
          ? "Simulate compromised account"
          : "Check Microsoft account risk"}
      </button>
      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th>Risk</th>
            <th>State</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {w.securityAlerts?.map((a) => (
            <tr key={a.id}>
              <td>{a.email}</td>
              <td>{a.level}</td>
              <td>{a.state}</td>
              <td>{a.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {w.securityCheckedAt && !w.securityAlerts?.length && (
        <p>No risk records returned at the last check.</p>
      )}
    </section>
  );
}
