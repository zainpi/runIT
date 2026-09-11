"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { ValidatedForm } from "./form";
import { requestJson } from "./http";
async function call(path: string, input?: unknown) {
  return requestJson(
    `/neutronium/api/auth/${path}`,
    input
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      : undefined,
  );
}
export function SecuritySettings({ gate = false }: { gate?: boolean }) {
  const [status, setStatus] = useState<{
    enabled: boolean;
    verified: boolean;
    required: boolean;
  }>();
  const [secret, setSecret] = useState("");
  const [enrollmentUri, setEnrollmentUri] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [codes, setCodes] = useState<string[]>();
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  useEffect(() => {
    call("mfa")
      .then(setStatus)
      .catch((e) => setError(e.message));
    if (!gate)
      call("sessions")
        .then((v) => setSessions(v.sessions))
        .catch((e) => setError(e.message));
  }, [gate]);
  useEffect(() => {
    let active = true;
    setQrFailed(false);
    if (!enrollmentUri) {
      setQrCode("");
      return () => {
        active = false;
      };
    }
    QRCode.toDataURL(enrollmentUri, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 240,
    })
      .then((value) => {
        if (active) setQrCode(value);
      })
      .catch(() => {
        if (active) {
          setQrFailed(true);
          setError(
            "Could not create the authenticator QR code. Use the setup key below.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [enrollmentUri]);
  async function act(fn: () => Promise<void>) {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="nt-tool-card">
      <h2>{gate ? "Secure your session" : "Account security"}</h2>
      {error && (
        <p className="nt-message nt-error" role="alert">
          {error}
        </p>
      )}
      <p>
        Administrators must use an authenticator code before accessing company
        information.
      </p>
      {!status?.enabled && !secret && (
        <button
          className="nt-button"
          disabled={busy || !status}
          onClick={() =>
            void act(async () => {
              const r = await call("mfa/enroll", {});
              setSecret(r.secret);
              setEnrollmentUri(r.uri);
            })
          }
        >
          Set up authenticator
        </button>
      )}
      {secret && (
        <>
          <p>
            Scan this QR code with Microsoft Authenticator, Google
            Authenticator, 1Password, or another TOTP authenticator. The
            enrollment expires in ten minutes.
          </p>
          {qrCode ? (
            <div className="nt-mfa-qr">
              <Image
                src={qrCode}
                alt="QR code for setting up the Neutronium authenticator"
                width={240}
                height={240}
                unoptimized
              />
            </div>
          ) : (
            !qrFailed && <p role="status">Preparing your QR code…</p>
          )}
          <details>
            <summary>Can’t scan? Use the setup key</summary>
            <p>
              Add a time-based account named Neutronium manually with this key.
            </p>
            <code style={{ overflowWrap: "anywhere" }}>{secret}</code>
          </details>
        </>
      )}
      {(status?.enabled || secret) && !codes && (
        <ValidatedForm
          requiredMessages={{
            token:
              "Enter the current code from your authenticator app, or one of your saved recovery codes.",
          }}
          onSubmit={(e) => {
            e.preventDefault();
            const token = new FormData(e.currentTarget).get("token");
            void act(async () => {
              const r = await call("mfa/challenge", { token });
              setSecret("");
              setEnrollmentUri("");
              setQrCode("");
              if (r.recoveryCodes) setCodes(r.recoveryCodes);
              else window.location.reload();
            });
          }}
        >
          <label>
            Authenticator or recovery code
            <input
              name="token"
              autoComplete="one-time-code"
              required
              maxLength={64}
            />
          </label>
          <button className="nt-button nt-primary" disabled={busy}>
            Verify session
          </button>
        </ValidatedForm>
      )}
      {codes && (
        <>
          <p>
            Save these single-use recovery codes in your password manager. They
            are shown once. Using one revokes your other sessions.
          </p>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {codes.join("\n")}
          </pre>
          <button
            className="nt-button"
            onClick={() => window.location.reload()}
          >
            I saved my recovery codes
          </button>
        </>
      )}
      {!gate && status?.enabled && (
        <details>
          <summary>Replace authenticator</summary>
          <p>
            A fresh authenticator or recovery code is required. This signs out
            all sessions; sign in again to enroll the replacement authenticator.
          </p>
          <ValidatedForm
            onSubmit={(e) => {
              e.preventDefault();
              const token = new FormData(e.currentTarget).get("token");
              void act(async () => {
                await call("mfa/reset", { token });
                window.location.reload();
              });
            }}
          >
            <label>
              Current authenticator or recovery code
              <input
                name="token"
                autoComplete="one-time-code"
                required
                maxLength={64}
              />
            </label>
            <button className="nt-button" disabled={busy}>
              Reset authenticator and sign out
            </button>
          </ValidatedForm>
        </details>
      )}
      {!gate && (
        <>
          <h3>Active sessions</h3>
          {sessions.map((s) => (
            <p key={s.id}>
              {s.current ? "This session" : "Other session"} · Started{" "}
              {new Date(s.created_at).toLocaleString()}{" "}
              <button
                className="nt-button"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    if (s.current)
                      await requestJson("/neutronium/api/logout/", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: "{}",
                      });
                    else await call("sessions/revoke", { id: s.id });
                    if (s.current) window.location.reload();
                    else
                      setSessions((current) =>
                        current.filter((x) => x.id !== s.id),
                      );
                  })
                }
              >
                {s.current ? "Sign out" : "Revoke session"}
              </button>
            </p>
          ))}
        </>
      )}
      {gate && (
        <button
          className="nt-button"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              await requestJson("/neutronium/api/logout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              });
              window.location.reload();
            })
          }
        >
          Sign out
        </button>
      )}
    </section>
  );
}
