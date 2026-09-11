import { DomainError, type Workspace } from "./model";
import { countryCode } from "./country";
export const employmentTypes = [
  "Full-time",
  "Part-time",
  "Contractor",
  "Intern",
  "Temporary",
];
export const workArrangements = ["On-site", "Hybrid", "Remote"];
export const reviewLabels: Record<string, string> = {
  pending: "Needs review",
  in_review: "In review",
  more_info: "Pending information",
  accepted: "Approved · processing",
  complete: "Processed / complete",
  declined: "Declined",
};
export type IntakeDetails = {
  firstName: string;
  lastName: string;
  title: string;
  location: string;
  note: string;
  department?: string;
  startDate?: string;
  employmentType?: string;
  workArrangement?: string;
  usageLocation?: string;
  companyEmail?: string;
  managerId?: string;
  templateId?: string;
};
export const openApplication = (status: string) =>
  ["pending", "in_review", "more_info"].includes(status);
export function intakeDetails(
  input: Record<string, unknown>,
  staff = false,
): IntakeDetails {
  const result: Record<string, string> = {};
  for (const key of [
    "firstName",
    "lastName",
    "title",
    "location",
    "note",
    "department",
    "startDate",
    "employmentType",
    "workArrangement",
    "usageLocation",
    ...(staff ? ["companyEmail", "managerId", "templateId"] : []),
  ]) {
    const value = input[key] ?? "";
    if (
      typeof value !== "string" ||
      value.length > (key === "note" ? 2000 : 254)
    )
      throw new DomainError(`Enter a valid ${key}.`);
    result[key] = value.trim();
  }
  if (!result.firstName || !result.lastName)
    throw new DomainError("Enter a first and last name.");
  for (const [key, allowed] of [
    ["employmentType", employmentTypes],
    ["workArrangement", workArrangements],
  ] as const)
    if (result[key] && !allowed.includes(result[key]))
      throw new DomainError(
        `Choose a valid ${key === "employmentType" ? "employment type" : "work arrangement"}.`,
      );
  if (
    result.startDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(result.startDate) ||
      !Number.isFinite(Date.parse(result.startDate)) ||
      new Date(result.startDate).toISOString().slice(0, 10) !==
        result.startDate)
  )
    throw new DomainError("Choose a valid start date.");
  if (result.usageLocation)
    result.usageLocation = countryCode(result.usageLocation);
  if (
    result.companyEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.companyEmail)
  )
    throw new DomainError("Enter a valid company email.");
  return result as IntakeDetails;
}
export function intakeOptions(w: Pick<Workspace, "employees" | "templates">) {
  return {
    departments: [
      ...new Set(w.employees.map((e) => e.department).filter(Boolean)),
    ].sort(),
    titles: [
      ...new Set(
        [
          ...w.employees.map((e) => e.title),
          ...w.templates.filter((t) => t.active).map((t) => t.name),
        ].filter(Boolean),
      ),
    ].sort(),
    locations: [
      ...new Set(w.employees.map((e) => e.location).filter(Boolean)),
    ].sort(),
  };
}
export function applicationPath(orgId: string, id: string) {
  return `/neutronium/?${new URLSearchParams({ org: orgId, view: "employee-approvals", application: id })}`;
}
