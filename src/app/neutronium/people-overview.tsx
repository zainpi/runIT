"use client";
import { useCallback, useEffect, useState } from "react";
import type { Workspace } from "@/lib/neutronium/model";
import { fullName } from "@/lib/neutronium/model";
import {
  applicationPath,
  intakeOptions,
  reviewLabels,
} from "@/lib/neutronium/intake";
import { requestJson } from "./http";
type PersonRow = {
  id: string;
  kind: string;
  name: string;
  email: string;
  department: string;
  start_date: string;
  title: string;
  location: string;
  status: string;
  employee_status?: string;
  application_id?: string;
  employee_id?: string;
};
export function PeopleOverview({
  w,
  openEmployee,
}: {
  w: Workspace;
  openEmployee: (id: string) => void;
}) {
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    department: "",
    startFrom: "",
    startTo: "",
    kind: "",
    manager: "",
    sort: "name",
    direction: "asc",
    page: "0",
  });
  const [data, setData] = useState<{
    rows: PersonRow[];
    total: number;
    departments?: string[];
  }>();
  const [error, setError] = useState("");
  const update = (key: string, value: string) =>
    setFilters((f) => ({ ...f, [key]: value, page: "0" }));
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      requestJson(
        `/neutronium/api/people/overview/?${new URLSearchParams({ ...filters, org: w.id })}`,
      )
        .then((r) => {
          if (active) {
            setData(r);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters, w.id, w.revision]);
  const options = intakeOptions(w);
  const extraFilterCount = [
    filters.kind,
    filters.department,
    filters.manager,
    filters.startFrom,
    filters.startTo,
  ].filter(Boolean).length;
  const hasFilters = Boolean(filters.q || filters.status || extraFilterCount);
  return (
    <section className="nt-panel">
      <div className="nt-panel-head">
        <h2>People & employee applications</h2>
        <span>{data?.total ?? "…"} results</span>
      </div>
      <div className="nt-toolbar nt-directory-filters">
        <label>
          Search people
          <input
            type="search"
            placeholder="Name, email or any employee detail"
            value={filters.q}
            onChange={(e) => update("q", e.target.value)}
          />
        </label>
        <label>
          Status
          <select
            value={filters.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries({
              ...reviewLabels,
              active: "Active",
              onboarding: "Onboarding",
              offboarding: "Offboarding",
              terminated: "Terminated",
            }).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button
            className="nt-button"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                q: "",
                status: "",
                kind: "",
                department: "",
                manager: "",
                startFrom: "",
                startTo: "",
                page: "0",
              }))
            }
          >
            Clear filters
          </button>
        )}
      </div>
      <details className="nt-more-filters">
        <summary>
          More filters
          {extraFilterCount > 0 && <span>{extraFilterCount} active</span>}
        </summary>
        <div className="nt-toolbar nt-directory-filters">
          <label>
            Show
            <select
              value={filters.kind}
              onChange={(e) => update("kind", e.target.value)}
            >
              <option value="">Everyone</option>
              <option value="employee">Existing employees</option>
              <option value="application">Employee applications</option>
            </select>
          </label>
          <label>
            Department / team
            <select
              value={filters.department}
              onChange={(e) => update("department", e.target.value)}
            >
              <option value="">All teams</option>
              {[
                ...new Set([
                  ...options.departments,
                  ...(data?.departments || []),
                ]),
              ]
                .sort()
                .map((v) => (
                  <option key={v}>{v}</option>
                ))}
            </select>
          </label>
          <label>
            Manager
            <select
              value={filters.manager}
              onChange={(e) => update("manager", e.target.value)}
            >
              <option value="">All managers</option>
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
            Start date from
            <input
              type="date"
              value={filters.startFrom}
              onChange={(e) => update("startFrom", e.target.value)}
            />
          </label>
          <label>
            Start date to
            <input
              type="date"
              value={filters.startTo}
              onChange={(e) => update("startTo", e.target.value)}
            />
          </label>
        </div>
      </details>
      {error && (
        <p className="nt-message nt-error" role="alert">
          {error}
        </p>
      )}
      <div className="nt-table-scroll">
        <table className="nt-table">
          <thead>
            <tr>
              {[
                ["name", "Name"],
                ["email", "Email"],
                ["department", "Team"],
                ["start_date", "Start date"],
                ["status", "Status"],
              ].map(([v, l]) => (
                <th
                  key={v}
                  aria-sort={
                    filters.sort === v
                      ? filters.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    className="nt-link"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        page: "0",
                        sort: v,
                        direction:
                          f.sort === v && f.direction === "asc"
                            ? "desc"
                            : "asc",
                      }))
                    }
                  >
                    {l}
                  </button>
                </th>
              ))}
              <th>Job title / location</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.email}</td>
                <td>{p.department || "Unassigned"}</td>
                <td>{p.start_date || "—"}</td>
                <td>
                  {reviewLabels[p.status] || p.status}
                  {p.employee_status && p.employee_status !== p.status && (
                    <small>Employee: {p.employee_status}</small>
                  )}
                </td>
                <td>
                  {p.title || "—"}
                  <small>{p.location}</small>
                </td>
                <td>
                  {p.employee_id && (
                    <button
                      className="nt-link"
                      onClick={() => openEmployee(p.employee_id!)}
                    >
                      View / edit employee
                    </button>
                  )}
                  {p.application_id && (
                    <a
                      className="nt-link"
                      href={applicationPath(w.id, p.application_id)}
                    >
                      View application
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && !data.rows.length && (
        <p className="nt-tool-card">No people match these filters.</p>
      )}
      <div className="nt-toolbar">
        <button
          className="nt-button"
          disabled={filters.page === "0"}
          onClick={() =>
            setFilters((f) => ({ ...f, page: String(Number(f.page) - 1) }))
          }
        >
          Previous page
        </button>
        <button
          className="nt-button"
          disabled={!data || (Number(filters.page) + 1) * 50 >= data.total}
          onClick={() =>
            setFilters((f) => ({ ...f, page: String(Number(f.page) + 1) }))
          }
        >
          Next page
        </button>
      </div>
      <p className="nt-tool-card">
        To assign a reporting manager, open an employee and choose Edit details.
        To allow a manager to approve access in the portal, assign the Manager
        portal role on that employee record.
      </p>
    </section>
  );
}
export function AttentionItems({
  w,
  navigate,
}: {
  w: Workspace;
  navigate: (view: string) => void;
}) {
  const [data, setData] = useState<{
    pendingApplications: number;
    applications: {
      id: string;
      details: { firstName: string; lastName: string };
      status: string;
    }[];
    access: number;
    workflows: number;
    help: number;
  }>();
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      requestJson(`/neutronium/api/attention/?org=${w.id}`)
        .then((r) => {
          setData(r);
          setError("");
        })
        .catch((e) => setError(e.message)),
    [w.id],
  );
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load, w.revision]);
  if (error)
    return (
      <p className="nt-tool-card" role="alert">
        Attention items could not load.{" "}
        <button className="nt-link" onClick={() => void load()}>
          Try again
        </button>
      </p>
    );
  if (!data)
    return (
      <p className="nt-tool-card" role="status">
        Checking what needs attention…
      </p>
    );
  const categories = [
    ["Employee applications", data.pendingApplications, "employee-approvals"],
    ["Access requests", data.access, "access"],
    ["Workflows needing action", data.workflows, "onboarding"],
    ["Employee help", data.help, "help"],
  ] as const;
  return (
    <div className="nt-attention-list">
      {categories
        .filter(([, count]) => count > 0)
        .map(([label, count, view]) => (
          <button
            className="nt-attention-item"
            key={view}
            onClick={() => navigate(view)}
          >
            <strong>{label}</strong>
            <span>{count} to review →</span>
          </button>
        ))}
      {data.applications.map((a) => (
        <a
          className="nt-attention-item"
          key={a.id}
          href={applicationPath(w.id, a.id)}
        >
          <span>
            {a.details.firstName} {a.details.lastName}
          </span>
          <small>{reviewLabels[a.status]} →</small>
        </a>
      ))}
      {!categories.some(([, count]) => count > 0) && (
        <p className="nt-tool-card">
          You’re all caught up. Employee applications, access requests, workflow
          issues, and employee help will appear here.
        </p>
      )}
    </div>
  );
}
