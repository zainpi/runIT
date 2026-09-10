"use client";
import { useState } from "react";
import { PasswordManagerLink } from "./password-manager-link";
import { ValidatedForm } from "./form";
import {
  Workspace,
  TestEnvironment,
  TesterAccount,
  fullName,
} from "@/lib/neutronium/model";
type Props = {
  w: Workspace;
  run: (path: string, data: unknown, success?: string) => Promise<unknown>;
};
export function TestEnvironments({ w, run }: Props) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [archived, setArchived] = useState(false);
  const [environmentForm, setEnvironmentForm] = useState<
    TestEnvironment | "new"
  >();
  const [accountForm, setAccountForm] = useState<{
    environmentId: string;
    account?: TesterAccount;
  }>();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const environments = (w.testEnvironments || []).filter(
    (env) =>
      (archived || env.status === "active") &&
      (kind === "all" || env.kind === kind) &&
      [
        env.name,
        env.url,
        env.notes,
        ...env.accounts
          .filter((a) => archived || a.status === "active")
          .flatMap((a) => [
            a.label,
            a.username,
            a.role,
            fullName(w.employees.find((e) => e.id === a.employeeId)),
          ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const editing =
    environmentForm && environmentForm !== "new" ? environmentForm : undefined;
  async function save(path: string, data: unknown, close: () => void) {
    setBusy(true);
    setFormError("");
    try {
      await run(path, data, "Directory updated.");
      close();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="nt-team-tools">
      <p>
        Keep staging and production links alongside their tester accounts.
        Register accounts that already exist in each application; store
        passwords in your team’s password manager.
      </p>
      <div className="nt-toolbar">
        <input
          aria-label="Search environments and tester accounts"
          placeholder="Search environment, username or assigned tester…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Environment type filter"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">All environments</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
          <option value="development">Development</option>
        </select>
        <button
          className="nt-button nt-primary"
          disabled={busy}
          onClick={() => {
            setEnvironmentForm("new");
            setFormError("");
            setAccountForm(undefined);
          }}
        >
          Add environment
        </button>
      </div>
      <label>
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />{" "}
        Show archived environments and accounts
      </label>
      {environmentForm && (
        <ValidatedForm
          key={editing?.id || "new"}
          className="nt-tool-card"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              "test-environment-save",
              {
                ...Object.fromEntries(new FormData(e.currentTarget)),
                id: editing?.id,
              },
              () => setEnvironmentForm(undefined),
            );
          }}
        >
          <h2>{editing ? "Edit environment" : "New environment"}</h2>
          {formError && (
            <p className="nt-message nt-error" role="alert">
              {formError}
            </p>
          )}
          <label>
            Environment name
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={editing?.name}
              placeholder="Customer portal staging"
            />
          </label>
          <label>
            Environment type
            <select
              aria-label="Environment type"
              name="kind"
              defaultValue={editing?.kind || "staging"}
            >
              <option value="staging">Staging</option>
              <option value="production">Production</option>
              <option value="development">Development</option>
            </select>
          </label>
          <label>
            Environment URL
            <input
              name="url"
              type="url"
              required
              maxLength={2000}
              defaultValue={editing?.url}
              placeholder="https://staging.example.com"
            />
          </label>
          <label>
            Environment notes
            <textarea
              name="notes"
              maxLength={2000}
              defaultValue={editing?.notes}
              placeholder="Release branch, test-data reset schedule, or usage instructions"
            />
          </label>
          <label>
            Environment status
            <select
              aria-label="Environment status"
              name="status"
              defaultValue={editing?.status || "active"}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <button className="nt-button nt-primary" disabled={busy}>
            Save environment
          </button>{" "}
          <button
            type="button"
            className="nt-button"
            disabled={busy}
            onClick={() => setEnvironmentForm(undefined)}
          >
            Cancel
          </button>
        </ValidatedForm>
      )}
      {accountForm && (
        <ValidatedForm
          key={accountForm.account?.id || accountForm.environmentId}
          className="nt-tool-card"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              "tester-account-save",
              {
                ...Object.fromEntries(new FormData(e.currentTarget)),
                id: accountForm.account?.id,
                environmentId: accountForm.environmentId,
              },
              () => setAccountForm(undefined),
            );
          }}
        >
          <h2>
            {accountForm.account
              ? "Edit tester account"
              : "Register tester account"}
          </h2>
          {formError && (
            <p className="nt-message nt-error" role="alert">
              {formError}
            </p>
          )}
          <p>
            {
              w.testEnvironments?.find(
                (env) => env.id === accountForm.environmentId,
              )?.name
            }
          </p>
          <label>
            Account label
            <input
              name="label"
              required
              maxLength={100}
              defaultValue={accountForm.account?.label}
              placeholder="QA administrator"
            />
          </label>
          <label>
            Username or email
            <input
              name="username"
              required
              maxLength={254}
              defaultValue={accountForm.account?.username}
            />
          </label>
          <label>
            Application role
            <input
              name="role"
              required
              maxLength={100}
              defaultValue={accountForm.account?.role || "Tester"}
            />
          </label>
          <label>
            Assigned tester
            <select
              name="employeeId"
              aria-label="Assigned tester"
              defaultValue={accountForm.account?.employeeId || ""}
            >
              <option value="">Unassigned / shared</option>
              {w.employees
                .filter(
                  (e) =>
                    e.status !== "terminated" ||
                    e.id === accountForm.account?.employeeId,
                )
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {fullName(e)}
                    {e.status === "terminated"
                      ? " (terminated — reassign)"
                      : ""}
                  </option>
                ))}
            </select>
          </label>
          <PasswordManagerLink
            defaultValue={accountForm.account?.credentialUrl}
          />
          <label>
            Account notes
            <textarea
              name="notes"
              maxLength={2000}
              defaultValue={accountForm.account?.notes}
              placeholder="MFA contact, account purpose, or test instructions. Do not enter passwords."
            />
          </label>
          <label>
            Account status
            <select
              name="status"
              aria-label="Account status"
              defaultValue={accountForm.account?.status || "active"}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <p>
            Archiving changes this directory only. It does not disable the
            account in the application.
          </p>
          <button className="nt-button nt-primary" disabled={busy}>
            Save tester account
          </button>{" "}
          <button
            type="button"
            className="nt-button"
            disabled={busy}
            onClick={() => setAccountForm(undefined)}
          >
            Cancel
          </button>
        </ValidatedForm>
      )}
      {!environments.length && (
        <div className="nt-tool-card">
          <h2>No environments found</h2>
          <p>
            Add a staging or production URL, then register its associated tester
            accounts.
          </p>
        </div>
      )}
      {environments.map((env) => (
        <section key={env.id} className="nt-tool-card">
          <div className="nt-environment-heading">
            <div>
              <span
                className={`nt-environment-kind ${env.kind === "production" ? "nt-environment-production" : ""}`}
              >
                {env.kind} · {env.status}
              </span>
              <h2>{env.name}</h2>
              <a href={env.url} target="_blank" rel="noreferrer">
                {env.url} ↗
              </a>
            </div>
            <button
              className="nt-button"
              disabled={busy}
              onClick={() => {
                setEnvironmentForm(env);
                setFormError("");
                setAccountForm(undefined);
              }}
            >
              Edit {env.name}
            </button>
          </div>
          {env.notes && <p className="nt-preserve">{env.notes}</p>}
          <table>
            <thead>
              <tr>
                <th>Tester account</th>
                <th>Application role</th>
                <th>Assigned tester</th>
                <th>Credentials</th>
                <th>Status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {env.accounts
                .filter((a) => archived || a.status === "active")
                .map((account) => (
                  <tr key={account.id}>
                    <td>
                      <strong>{account.label}</strong>
                      <small>{account.username}</small>
                      {account.notes && (
                        <p className="nt-preserve">{account.notes}</p>
                      )}
                    </td>
                    <td>{account.role}</td>
                    <td>
                      {account.employeeId
                        ? fullName(
                            w.employees.find(
                              (e) => e.id === account.employeeId,
                            ),
                          )
                        : "Unassigned / shared"}
                    </td>
                    <td>
                      {account.credentialUrl ? (
                        <a
                          href={account.credentialUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open password manager ↗
                        </a>
                      ) : (
                        "No link added"
                      )}
                    </td>
                    <td>{account.status}</td>
                    <td>
                      <button
                        className="nt-button"
                        disabled={busy || env.status === "archived"}
                        onClick={() => {
                          setAccountForm({ environmentId: env.id, account });
                          setFormError("");
                          setEnvironmentForm(undefined);
                        }}
                      >
                        Edit {account.label}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!env.accounts.some((a) => archived || a.status === "active") && (
            <p>No tester accounts listed.</p>
          )}
          <button
            className="nt-button"
            disabled={busy || env.status === "archived"}
            onClick={() => {
              setAccountForm({ environmentId: env.id });
              setFormError("");
              setEnvironmentForm(undefined);
            }}
          >
            Add tester account to {env.name}
          </button>
        </section>
      ))}
    </section>
  );
}
