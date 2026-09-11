"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EmployeeApplication } from "@/lib/neutronium/employee-applications";
import { ValidatedForm } from "../form";
import { requestJson } from "../http";
import { SecuritySettings } from "../security-settings";
import Link from "next/link";
import { IntakeFields, type IntakeOptions } from "../intake-fields";
import { openApplication, reviewLabels } from "@/lib/neutronium/intake";

type User = {
  id: string;
  email: string;
  mfa_required?: boolean;
  mfa_verified_at?: string;
};
type Invitation = {
  options?: IntakeOptions;
  companyName: string;
  expiresAt: string;
  available: boolean;
  application: EmployeeApplication | null;
};
const post = (path: string, data: unknown) =>
  requestJson(`/neutronium/api/${path}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
export function JoinCompany() {
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<Invitation>();
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState("signup");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const sequence = useRef(0);
  useEffect(() => {
    setToken(new URLSearchParams(location.search).get("token") || "");
  }, []);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    const value =
      token || new URLSearchParams(location.search).get("token") || "";
    const [invitation, status] = await Promise.all([
      requestJson(
        `/neutronium/api/onboarding/invitation/?token=${encodeURIComponent(value)}`,
      ),
      requestJson("/neutronium/api/auth/status/"),
    ]);
    if (current === sequence.current) {
      setInfo(invitation);
      setUser(status.user);
    }
  }, [token]);
  useEffect(() => {
    if (token === null) return;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let alive = true;
    load()
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token, load]);
  useEffect(() => {
    if (!info?.application || !openApplication(info.application.status)) return;
    const timer = setInterval(
      () => void load().catch((e) => setError(e.message)),
      15000,
    );
    return () => clearInterval(timer);
  }, [info?.application, load]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user?.mfa_required && !user.mfa_verified_at)
    return (
      <main className="nt-root nt-security-gate">
        <SecuritySettings gate />
      </main>
    );
  const application = info?.application;
  return (
    <div className="nt-root nt-join-page">
      <section className="nt-tool-card nt-join-card">
        <Link className="nt-brand" href="/neutronium/">
          neutronium.
        </Link>
        <h1>
          {info ? `Join ${info.companyName}` : "Your employee invitation"}
        </h1>
        {error && (
          <p className="nt-message nt-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="nt-message nt-success" role="status">
            {message}
          </p>
        )}
        {loading && <p role="status">Opening your invitation…</p>}
        {!token && !loading && (
          <p>
            Open the complete invitation link shared by your company
            administrator.
          </p>
        )}
        {!loading && token && !info && (
          <button
            className="nt-button"
            onClick={() => void act(load)}
            disabled={busy}
          >
            Try again
          </button>
        )}
        {info && !user && (
          <>
            <p>
              Create your account, confirm your email, then submit your details
              for an administrator to review.
            </p>
            {!info.available && (
              <p className="nt-message nt-error">
                This link has expired, was revoked, or was used. If you already
                applied, sign in to check your status. Otherwise, ask your
                administrator for a new invitation.
              </p>
            )}
            <ValidatedForm
              key={mode}
              onSubmit={(e) => {
                const data = Object.fromEntries(new FormData(e.currentTarget));
                void act(async () => {
                  const result = await post(mode, {
                    ...data,
                    signupRole: "employee",
                    ...(mode === "signup" ? { joinToken: token } : {}),
                  });
                  if (result.existingAccount) {
                    setMode("login");
                    setMessage(
                      "Your account is already verified. Sign in with your existing password to continue this invitation.",
                    );
                  } else if (result.confirmationRequired)
                    setMessage(
                      "If this address needs verification, check your email to confirm your account. The confirmation link returns here. Already verified? Sign in below. Check junk mail if needed.",
                    );
                  else await load();
                });
              }}
            >
              <h2>
                {mode === "signup"
                  ? "Create your employee account"
                  : "Sign in to continue"}
              </h2>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={mode === "signup" ? 12 : undefined}
                  maxLength={128}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                />
              </label>
              <button
                className="nt-button nt-primary"
                disabled={busy || (mode === "signup" && !info.available)}
              >
                {busy
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
              <button
                type="button"
                className="nt-button"
                disabled={busy}
                onClick={(e) => {
                  const email =
                    e.currentTarget.form?.querySelector<HTMLInputElement>(
                      'input[name="email"]',
                    );
                  if (!email?.reportValidity()) return;
                  void act(async () => {
                    await post("auth/resend-confirmation", {
                      email: email.value,
                      joinToken: token,
                    });
                    setMessage(
                      "If your email still needs confirmation, a new link has been requested. Check your inbox and junk mail. Already verified? Sign in.",
                    );
                  });
                }}
              >
                Resend confirmation email
              </button>
              <button
                type="button"
                className="nt-button"
                disabled={busy}
                onClick={() => {
                  setMode(mode === "signup" ? "login" : "signup");
                  setError("");
                  setMessage("");
                }}
              >
                {mode === "signup"
                  ? "Already have an account? Sign in"
                  : "Create a new account"}
              </button>
            </ValidatedForm>
          </>
        )}
        {info &&
          user &&
          !application &&
          (info.available ? (
            <ValidatedForm
              onSubmit={(e) => {
                const data = Object.fromEntries(new FormData(e.currentTarget));
                void act(async () => {
                  await post("onboarding/apply", { ...data, token });
                  await load();
                });
              }}
            >
              <p>
                Email confirmed: <strong>{user.email}</strong>
              </p>
              <h2>Tell your administrator about yourself</h2>
              <IntakeFields options={info.options} />
              <p>
                Your administrator will review these details before you can
                access the company workspace.
              </p>
              <button className="nt-button nt-primary" disabled={busy}>
                {busy ? "Submitting…" : "Submit for approval"}
              </button>
            </ValidatedForm>
          ) : (
            <p>
              This invitation is no longer available. Ask your administrator for
              a new link.
            </p>
          ))}
        {application && (
          <div role="status">
            <h2>
              {openApplication(application.status)
                ? "Waiting for administrator approval"
                : application.status === "accepted"
                  ? "You’re accepted"
                  : "Your application was declined"}
            </h2>
            <p>
              {openApplication(application.status)
                ? "Your details have been sent for review. You’ll get company access after an administrator accepts your application. This page updates automatically."
                : application.status === "accepted"
                  ? "You can now open your company workspace. Your administrator has started your onboarding."
                  : "You haven’t been given access to this company. Contact your administrator if you think this was a mistake."}
            </p>
            <p>
              <strong>Status:</strong> {reviewLabels[application.status]}
            </p>
            <p>
              {application.details.firstName} {application.details.lastName} ·{" "}
              {application.details.department || "Team to be confirmed"} ·{" "}
              {application.details.title || "Job title to be confirmed"} ·{" "}
              {application.details.startDate || "Start date to be confirmed"}
            </p>
            {openApplication(application.status) && !editing && (
              <button className="nt-button" onClick={() => setEditing(true)}>
                View / edit my application
              </button>
            )}
            {editing && (
              <ValidatedForm
                key={application.id}
                onSubmit={(e) => {
                  const details = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  void act(async () => {
                    await post("onboarding/edit-own", {
                      ...details,
                      token,
                      id: application.id,
                      revision: application.revision,
                    });
                    setEditing(false);
                    await load();
                    setMessage("Application updated and returned for review.");
                  });
                }}
              >
                <IntakeFields
                  details={application.details}
                  options={info?.options}
                />
                <button className="nt-button nt-primary" disabled={busy}>
                  Save application
                </button>
                <button
                  type="button"
                  className="nt-button"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </ValidatedForm>
            )}
            {application.decision_note && (
              <p>
                <strong>Note from your administrator:</strong>{" "}
                {application.decision_note}
              </p>
            )}
            {application.status === "accepted" && (
              <a
                className="nt-button nt-primary"
                href={`/neutronium/?org=${application.organization_id}`}
              >
                Open my workspace
              </a>
            )}
            {openApplication(application.status) && (
              <button
                className="nt-button"
                disabled={busy}
                onClick={() => void act(load)}
              >
                Check status
              </button>
            )}
          </div>
        )}
        {user && (
          <p>
            Signed in as {user.email}.{" "}
            <button
              className="nt-link"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await post("logout", {});
                  setUser(null);
                  setInfo(undefined);
                  setMode("login");
                  await load();
                })
              }
            >
              Sign out
            </button>
          </p>
        )}
      </section>
    </div>
  );
}
