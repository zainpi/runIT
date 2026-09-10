"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EmployeeApplication } from "@/lib/neutronium/employee-applications";
import { ValidatedForm } from "../form";
import { requestJson } from "../http";
import { SecuritySettings } from "../security-settings";
import Link from "next/link";

type User = {
  id: string;
  email: string;
  mfa_required?: boolean;
  mfa_verified_at?: string;
};
type Invitation = {
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
    if (info?.application?.status !== "pending") return;
    const timer = setInterval(
      () => void load().catch((e) => setError(e.message)),
      15000,
    );
    return () => clearInterval(timer);
  }, [info?.application?.status, load]);
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
                  if (result.confirmationRequired)
                    setMessage(
                      "Check your email to confirm your account. The confirmation link will bring you back here to finish your employee application. Already have an account? Sign in below.",
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
              <label>
                First name
                <input
                  name="firstName"
                  required
                  maxLength={100}
                  autoComplete="given-name"
                />
              </label>
              <label>
                Last name
                <input
                  name="lastName"
                  required
                  maxLength={100}
                  autoComplete="family-name"
                />
              </label>
              <label>
                Job title (optional)
                <input
                  name="title"
                  maxLength={100}
                  autoComplete="organization-title"
                />
              </label>
              <label>
                Location (optional)
                <input name="location" maxLength={100} />
              </label>
              <label>
                Message for your administrator (optional)
                <textarea name="note" maxLength={2000} />
              </label>
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
              {application.status === "pending"
                ? "Waiting for administrator approval"
                : application.status === "accepted"
                  ? "You’re accepted"
                  : "Your application was declined"}
            </h2>
            <p>
              {application.status === "pending"
                ? "Your details have been sent for review. You’ll get company access after an administrator accepts your application. This page updates automatically."
                : application.status === "accepted"
                  ? "You can now open your company workspace. Your administrator has started your onboarding."
                  : "You haven’t been given access to this company. Contact your administrator if you think this was a mistake."}
            </p>
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
            {application.status === "pending" && (
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
