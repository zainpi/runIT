"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Actor, Workspace } from "@/lib/neutronium/model";
import type { EmployeeApplication } from "@/lib/neutronium/employee-applications";
import { canAdmin, fullName } from "@/lib/neutronium/model";
import { ValidatedForm } from "./form";
import { requestJson } from "./http";

import { IntakeFields } from "./intake-fields";
import {
  intakeOptions,
  openApplication,
  reviewLabels,
} from "@/lib/neutronium/intake";

type LinkInfo = { id: string; url: string; expires_at: string };
export function OnboardingInvite({
  w,
  manual,
  reviews,
}: {
  w: Workspace;
  manual: () => void;
  reviews: () => void;
}) {
  const pending = useRef<Promise<LinkInfo>>();
  const field = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState<LinkInfo>();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(!w.demo);
  const create = useCallback(
    () =>
      requestJson("/neutronium/api/onboarding/link/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: w.id }),
      }),
    [w.id],
  );
  useEffect(() => {
    if (w.demo) return;
    let alive = true;
    pending.current ||= create();
    pending.current
      .then((result) => {
        if (alive) setLink(result);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [create, w.demo]);
  return (
    <div className="nt-tool-card">
      <h3>Share an employee invitation</h3>
      <p>
        Send this link to your new teammate. They’ll create an account, verify
        their email, and submit their details. You can then view, accept, or
        decline their application in Employee approvals.
      </p>
      {busy && <p role="status">Creating your invitation link…</p>}
      {error && (
        <p className="nt-message nt-error" role="alert">
          {error}
        </p>
      )}
      {w.demo && (
        <p>
          Shareable links are available in your company workspace. You can try
          manual onboarding in this development workspace.
        </p>
      )}
      {link && (
        <>
          <label>
            Employee invitation link
            <input
              ref={field}
              readOnly
              value={link.url}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button
            className="nt-button nt-primary"
            onClick={async () => {
              setError("");
              try {
                await navigator.clipboard.writeText(link.url);
                setCopied(true);
              } catch {
                field.current?.focus();
                field.current?.select();
                setError(
                  "Copy was blocked. The link is selected; press ⌘C on Mac or Ctrl+C on Windows to copy it.",
                );
              }
            }}
          >
            {copied ? "Copied" : "Copy invitation link"}
          </button>
          {copied && (
            <p role="status">Link copied. You can send it to the employee.</p>
          )}
          <p>
            One employee per link. Expires{" "}
            {new Date(link.expires_at).toLocaleString()}. Company access starts
            only after approval.
          </p>
        </>
      )}
      {!w.demo && !link && !busy && (
        <button
          className="nt-button"
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              setLink(await create());
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Try creating the link again
        </button>
      )}
      <div className="nt-toolbar">
        <button className="nt-button" onClick={reviews}>
          View employee approvals
        </button>
        <button className="nt-button" onClick={manual}>
          Enter details manually
        </button>
      </div>
    </div>
  );
}

type Inbox = {
  applications: EmployeeApplication[];
  links: { id: string; created_at: string; expires_at: string }[];
  pendingCount: number;
  nextCursor: string | null;
};
export function EmployeeApprovals({
  w,
  actor,
  run,
}: {
  w: Workspace;
  actor: Actor;
  run: (path: string, data: unknown, success?: string) => Promise<any>;
}) {
  const [data, setData] = useState<Inbox>();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [startTo, setStartTo] = useState("");
  const [cursor, setCursor] = useState("");
  const [selected, setSelected] = useState<EmployeeApplication>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const options = intakeOptions(w);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    const query = new URLSearchParams({
      org: w.id,
      status,
      q: search,
      department,
      startFrom,
      startTo,
      cursor,
    });
    const result = await requestJson(
      `/neutronium/api/onboarding/applications/?${query}`,
    );
    if (current === sequence.current) setData(result);
  }, [w.id, status, search, department, startFrom, startTo, cursor]);
  useEffect(() => {
    const timer = setTimeout(
      () => void load().catch((e) => setError(e.message)),
      200,
    );
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const timer = setInterval(
      () => void load().catch((e) => setError(e.message)),
      15000,
    );
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const applicationId = new URLSearchParams(location.search).get(
      "application",
    );
    if (!applicationId) return;
    let alive = true;
    requestJson(
      `/neutronium/api/onboarding/applications/?${new URLSearchParams({ org: w.id, status: "all", id: applicationId })}`,
    )
      .then((result) => {
        if (!alive) return;
        if (!result.applications[0])
          throw new Error("This application is unavailable in this company.");
        setSelected(result.applications[0]);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [w.id]);
  function select(application?: EmployeeApplication) {
    setSelected(application);
    setError("");
    const url = new URL(location.href);
    if (application) url.searchParams.set("application", application.id);
    else url.searchParams.delete("application");
    history.replaceState(null, "", url.pathname + url.search);
  }
  async function save(input: Record<string, unknown>, decision: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      let current = selected;
      if (decision !== "declined") {
        const result = await run(
          "onboarding/update",
          {
            ...input,
            id: selected.id,
            revision: selected.revision,
            orgId: w.id,
          },
          "Application details saved.",
        );
        current = { ...selected, ...result.application };
        setSelected(current);
      }
      if (decision === "accepted" || decision === "declined") {
        await run(
          "onboarding/review",
          {
            ...input,
            email: input.companyEmail,
            id: current.id,
            revision: current.revision,
            decision,
            note: input.decisionNote || "",
            orgId: w.id,
          },
          decision === "accepted"
            ? "Employee approved. Follow progress in Workflows."
            : "Employee application declined.",
        );
        select(undefined);
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const label = (a: EmployeeApplication) =>
    reviewLabels[
      a.status === "accepted" && a.workflow_status === "success"
        ? "complete"
        : a.status
    ];
  return (
    <section className="nt-team-tools">
      {error && (
        <p className="nt-message nt-error" role="alert">
          {error}
        </p>
      )}
      <div className="nt-toolbar">
        <strong>
          {data?.pendingCount ?? "…"} pending employee applications
        </strong>
        <button
          className="nt-button"
          disabled={busy}
          onClick={() => {
            select(undefined);
            void load().catch((e) => setError(e.message));
          }}
        >
          Refresh applications
        </button>
      </div>
      {selected ? (
        <ValidatedForm
          key={`${selected.id}:${selected.revision}`}
          className="nt-tool-card"
          onSubmit={(e) => {
            const decision =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ||
              "save";
            void save(
              Object.fromEntries(new FormData(e.currentTarget)),
              decision,
            );
          }}
        >
          <h2>
            {selected.details.firstName} {selected.details.lastName}
          </h2>
          <p>
            <strong>
              {selected.user_id
                ? "Verified account email:"
                : "Employee contact email:"}
            </strong>{" "}
            {selected.email || selected.contact_email}
          </p>
          <p>
            Submitted {new Date(selected.submitted_at).toLocaleString()} ·{" "}
            {label(selected)}
          </p>
          {openApplication(selected.status) ? (
            <>
              <IntakeFields
                details={selected.details}
                options={options}
                staff
              />
              <h3>Confirm their onboarding details</h3>
              <p>
                HR can prepare and correct the application. A company
                administrator approves access and starts onboarding.
              </p>
              <div className="nt-form-grid">
                <label>
                  Company email
                  <input
                    name="companyEmail"
                    type="email"
                    maxLength={254}
                    defaultValue={
                      selected.details.companyEmail ||
                      selected.email ||
                      selected.contact_email
                    }
                  />
                </label>
                <label>
                  Manager
                  <select
                    name="managerId"
                    defaultValue={selected.details.managerId || ""}
                  >
                    <option value="">No manager assigned</option>
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
                  Onboarding template
                  <select
                    name="templateId"
                    defaultValue={
                      selected.details.templateId ||
                      w.templates.find((t) => t.active)?.id ||
                      ""
                    }
                  >
                    <option value="">Choose a template</option>
                    {w.templates
                      .filter((t) => t.active)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Review status
                  <select name="status" defaultValue={selected.status}>
                    {["pending", "in_review", "more_info"].map((v) => (
                      <option key={v} value={v}>
                        {reviewLabels[v]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Note for the employee (optional)
                  <textarea
                    name="decisionNote"
                    maxLength={2000}
                    defaultValue={selected.decision_note}
                  />
                </label>
              </div>
              <p className="nt-subtle">
                Assign reporting managers in People → open an employee → Edit
                details. Managers need an active employee record; administrator
                access does not automatically create one.
              </p>
              <div className="nt-toolbar">
                <button className="nt-button" value="save" disabled={busy}>
                  Save application
                </button>
                {canAdmin(actor) && (
                  <>
                    <button
                      className="nt-button nt-primary"
                      value="accepted"
                      disabled={busy}
                    >
                      Accept and start onboarding
                    </button>
                    <button
                      className="nt-button"
                      value="declined"
                      disabled={busy}
                    >
                      Decline employee
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <dl>
                {Object.entries(selected.details)
                  .filter(([key]) => !["managerId", "templateId"].includes(key))
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                      <dd>{value || "Not provided"}</dd>
                    </div>
                  ))}
              </dl>
              {selected.decision_note && (
                <p>Decision note: {selected.decision_note}</p>
              )}
              {selected.employee_id && (
                <a
                  className="nt-button"
                  href={`/neutronium/?org=${w.id}&view=people&employee=${selected.employee_id}`}
                >
                  View employee record
                </a>
              )}
              {selected.job_id && (
                <a
                  className="nt-button"
                  href={`/neutronium/?org=${w.id}&view=onboarding&job=${selected.job_id}`}
                >
                  View onboarding workflow
                </a>
              )}
            </>
          )}
          <button
            type="button"
            className="nt-button"
            disabled={busy}
            onClick={() => select(undefined)}
          >
            Back to applications
          </button>
        </ValidatedForm>
      ) : (
        <>
          <div className="nt-toolbar nt-directory-filters">
            <label>
              Search applications
              <input
                type="search"
                placeholder="Name, email or any intake detail"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCursor("");
                }}
              />
            </label>
            <label>
              Application review status
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setCursor("");
                }}
              >
                <option value="all">All statuses</option>
                {Object.entries(reviewLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Department / team
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setCursor("");
                }}
              >
                <option value="">All teams</option>
                {options.departments.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Start date from
              <input
                type="date"
                value={startFrom}
                onChange={(e) => {
                  setStartFrom(e.target.value);
                  setCursor("");
                }}
              />
            </label>
            <label>
              Start date to
              <input
                type="date"
                value={startTo}
                onChange={(e) => {
                  setStartTo(e.target.value);
                  setCursor("");
                }}
              />
            </label>
          </div>
          {!data && <p role="status">Loading employee applications…</p>}
          {data && !data.applications.length && (
            <div className="nt-tool-card">
              <h2>No matching applications</h2>
              <p>
                Use Onboard employee to share an invitation or enter an
                application for review.
              </p>
            </div>
          )}
          {!!data?.applications.length && (
            <div className="nt-table-scroll">
              <table className="nt-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Team</th>
                    <th>Job title</th>
                    <th>Start date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.applications.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.details.firstName} {a.details.lastName}
                      </td>
                      <td>{a.email}</td>
                      <td>{a.details.department || "Unassigned"}</td>
                      <td>{a.details.title || "—"}</td>
                      <td>{a.details.startDate || "—"}</td>
                      <td>{label(a)}</td>
                      <td>
                        <button className="nt-link" onClick={() => select(a)}>
                          Review {a.details.firstName} {a.details.lastName}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="nt-toolbar">
            {cursor && (
              <button className="nt-button" onClick={() => setCursor("")}>
                Newest applications
              </button>
            )}
            {data?.nextCursor && (
              <button
                className="nt-button"
                onClick={() => setCursor(data.nextCursor!)}
              >
                Older applications
              </button>
            )}
          </div>
        </>
      )}
      {!!data?.links.length && (
        <details className="nt-tool-card">
          <summary>Unused invitation links ({data.links.length})</summary>
          <p>
            Revoking a link prevents new submissions. Existing applications
            remain available.
          </p>
          {data.links.map((link) => (
            <p key={link.id}>
              Created {new Date(link.created_at).toLocaleString()} · Expires{" "}
              {new Date(link.expires_at).toLocaleDateString()}{" "}
              <button
                className="nt-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await run(
                      "onboarding/revoke-link",
                      { id: link.id, orgId: w.id },
                      "Invitation link revoked.",
                    );
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Revoke invitation
              </button>
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
