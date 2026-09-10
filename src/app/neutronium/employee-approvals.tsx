"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Workspace } from "@/lib/neutronium/model";
import type { EmployeeApplication } from "@/lib/neutronium/employee-applications";
import { fullName } from "@/lib/neutronium/model";
import { ValidatedForm } from "./form";
import { requestJson } from "./http";

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
  run,
}: {
  w: Workspace;
  run: (path: string, data: unknown, success?: string) => Promise<unknown>;
}) {
  const [data, setData] = useState<Inbox>();
  const [status, setStatus] = useState("pending");
  const [cursor, setCursor] = useState("");
  const [selected, setSelected] = useState<EmployeeApplication>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    const query = new URLSearchParams({ org: w.id, status, cursor });
    const result = await requestJson(
      `/neutronium/api/onboarding/applications/?${query}`,
    );
    if (current === sequence.current) setData(result);
  }, [w.id, status, cursor]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    const timer = setInterval(
      () => void load().catch((e) => setError(e.message)),
      15000,
    );
    return () => clearInterval(timer);
  }, [load]);
  async function review(input: Record<string, unknown>) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await run(
        "onboarding/review",
        { ...input, id: selected.id, orgId: w.id },
        input.decision === "accepted"
          ? "Employee accepted. Company access is active and onboarding has started."
          : "Employee application declined. No company access was granted.",
      );
      setSelected(undefined);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
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
        <select
          aria-label="Application review status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setCursor("");
            setSelected(undefined);
          }}
        >
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
        </select>
        <button
          className="nt-button"
          disabled={busy}
          onClick={() => {
            setSelected(undefined);
            void load().catch((e) => setError(e.message));
          }}
        >
          Refresh applications
        </button>
      </div>
      {selected ? (
        <ValidatedForm
          key={selected.id}
          className="nt-tool-card"
          onSubmit={(e) =>
            void review({
              ...Object.fromEntries(new FormData(e.currentTarget)),
              decision: "accepted",
            })
          }
        >
          <h2>
            {selected.details.firstName} {selected.details.lastName}
          </h2>
          <p>
            <strong>Verified account email:</strong> {selected.email}
          </p>
          <p>
            Submitted {new Date(selected.submitted_at).toLocaleString()} ·{" "}
            {selected.status}
          </p>
          <p>
            <strong>Employee’s job title:</strong>{" "}
            {selected.details.title || "Not provided"}
          </p>
          <p>
            <strong>Employee’s location:</strong>{" "}
            {selected.details.location || "Not provided"}
          </p>
          {selected.details.note && (
            <p style={{ whiteSpace: "pre-wrap" }}>
              <strong>Employee’s message:</strong> {selected.details.note}
            </p>
          )}
          {selected.status === "pending" ? (
            <>
              <h3>Confirm their onboarding details</h3>
              <p>
                Accepting creates an employee membership and starts the selected
                onboarding workflow. The employee signs in with their verified
                account email above.
              </p>
              <label>
                Company email
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  defaultValue={selected.email}
                />
              </label>
              <label>
                Department
                <input
                  name="department"
                  required
                  maxLength={200}
                  defaultValue="General"
                />
              </label>
              <label>
                Job title
                <input
                  name="title"
                  maxLength={200}
                  defaultValue={selected.details.title}
                />
              </label>
              <label>
                Start date
                <input
                  name="startDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <label>
                Location
                <input
                  name="location"
                  maxLength={200}
                  defaultValue={selected.details.location}
                />
              </label>
              <label>
                Microsoft usage country (optional)
                <input
                  name="usageLocation"
                  minLength={2}
                  maxLength={2}
                  placeholder="CA"
                />
              </label>
              <label>
                Manager
                <select name="managerId" defaultValue="">
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
                  required
                  defaultValue={w.templates.find((t) => t.active)?.id || ""}
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
                Note for the employee (optional)
                <textarea name="note" maxLength={2000} />
              </label>
              <div className="nt-toolbar">
                <button className="nt-button nt-primary" disabled={busy}>
                  {busy ? "Saving…" : "Accept and start onboarding"}
                </button>
                <button
                  type="button"
                  className="nt-button"
                  disabled={busy}
                  onClick={(e) => {
                    const form = e.currentTarget.form!;
                    void review({
                      decision: "declined",
                      note: new FormData(form).get("note") || "",
                    });
                  }}
                >
                  Decline employee
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                Reviewed{" "}
                {selected.reviewed_at
                  ? new Date(selected.reviewed_at).toLocaleString()
                  : ""}
              </p>
              {selected.decision_note && (
                <p>Decision note: {selected.decision_note}</p>
              )}
            </>
          )}
          <button
            type="button"
            className="nt-button"
            disabled={busy}
            onClick={() => setSelected(undefined)}
          >
            Back to applications
          </button>
        </ValidatedForm>
      ) : (
        <>
          {!data && <p role="status">Loading employee applications…</p>}
          {data && !data.applications.length && (
            <div className="nt-tool-card">
              <h2>No {status} applications</h2>
              <p>
                {w.demo
                  ? "Employee applications appear here in a company workspace."
                  : "Use Onboard employee to share an invitation. Submitted applications will appear here for review."}
              </p>
            </div>
          )}
          {data?.applications.map((application) => (
            <article className="nt-tool-card" key={application.id}>
              <h2>
                {application.details.firstName} {application.details.lastName}
              </h2>
              <p>
                {application.email} · {application.status} ·{" "}
                {new Date(application.submitted_at).toLocaleString()}
              </p>
              <button
                className="nt-button"
                onClick={() => setSelected(application)}
              >
                Review {application.details.firstName}{" "}
                {application.details.lastName}
              </button>
            </article>
          ))}
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
            Revoking a link prevents a new submission. Applications already
            submitted keep their review status.
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
                  setError("");
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
