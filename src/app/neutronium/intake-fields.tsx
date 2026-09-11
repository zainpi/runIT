"use client";
import {
  employmentTypes,
  workArrangements,
  type IntakeDetails,
} from "@/lib/neutronium/intake";
import { countryCodes } from "@/lib/neutronium/country";
export type IntakeOptions = {
  departments: string[];
  titles: string[];
  locations: string[];
};
export function IntakeFields({
  details = {} as IntakeDetails,
  options,
  staff = false,
}: {
  details?: IntakeDetails;
  options?: IntakeOptions;
  staff?: boolean;
}) {
  const choices = (
    name: "department" | "title" | "location",
    label: string,
    values: string[],
  ) => {
    const list = [...new Set([details[name] || "", ...values].filter(Boolean))];
    return (
      <label>
        {label}
        {staff || !list.length ? (
          <input
            name={name}
            maxLength={100}
            defaultValue={details[name] || ""}
            list={`intake-${name}`}
          />
        ) : (
          <select name={name} defaultValue={details[name] || ""}>
            <option value="">Not sure — administrator will confirm</option>
            {list.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        )}
        {staff && (
          <datalist id={`intake-${name}`}>
            {list.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        )}
      </label>
    );
  };
  return (
    <div className="nt-form-grid">
      <label>
        First name
        <input
          name="firstName"
          required
          maxLength={100}
          autoComplete="given-name"
          defaultValue={details.firstName}
        />
      </label>
      <label>
        Last name
        <input
          name="lastName"
          required
          maxLength={100}
          autoComplete="family-name"
          defaultValue={details.lastName}
        />
      </label>
      {choices("department", "Department / team", options?.departments || [])}
      {choices("title", "Job title (optional)", options?.titles || [])}
      {choices("location", "Location (optional)", options?.locations || [])}
      <label>
        Start date
        <input name="startDate" type="date" defaultValue={details.startDate} />
      </label>
      <label>
        Employment type
        <select
          name="employmentType"
          defaultValue={details.employmentType || ""}
        >
          <option value="">Not sure</option>
          {employmentTypes.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        Work arrangement
        <select
          name="workArrangement"
          defaultValue={details.workArrangement || ""}
        >
          <option value="">Not sure</option>
          {workArrangements.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <CountrySelect value={details.usageLocation} />
      <label>
        Message for your administrator (optional)
        <textarea name="note" maxLength={2000} defaultValue={details.note} />
      </label>
    </div>
  );
}
export function CountrySelect({ value = "" }: { value?: string }) {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return (
    <label>
      Microsoft usage country (optional)
      <select name="usageLocation" defaultValue={value}>
        <option value="">Administrator will confirm</option>
        {countryCodes
          .map((code) => ({ code, name: names.of(code) || code }))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(({ code, name }) => (
            <option key={code} value={code}>
              {name} ({code})
            </option>
          ))}
      </select>
    </label>
  );
}
