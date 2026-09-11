"use client";

import { useEffect, useRef, useState } from "react";
import {
  type Actor,
  canAdmin,
  canManagePeople,
  platformRoles,
} from "@/lib/neutronium/model";
import { Icon } from "./icons";

export type WorkspaceSection = {
  label: string;
  icon: string;
  hint: string;
  views: string[];
};

// Keep existing view IDs: emailed links and individual tools retain their URLs.
export function workspaceSections(actor: Actor): WorkspaceSection[] {
  if (platformRoles.includes(actor.role)) {
    const security = ["PLATFORM_OWNER", "PLATFORM_SECURITY"].includes(
      actor.role,
    );
    return [
      {
        label: "Companies",
        icon: "building",
        hint: "Workspaces you support",
        views: ["companies", "people"],
      },
      {
        label: "Requests",
        icon: "access",
        hint: "Access and support",
        views: ["access", "support"],
      },
      {
        label: "Apps",
        icon: "applications",
        hint: "Tools and connections",
        views: [
          "applications",
          ...(security ? ["permissions"] : []),
          "integrations",
        ],
      },
      {
        label: "Activity",
        icon: "audit",
        hint: "Jobs and audit history",
        views: ["jobs", ...(security ? ["alerts"] : []), "audit"],
      },
      {
        label: "Settings",
        icon: "settings",
        hint: "Workspace preferences",
        views: ["settings"],
      },
    ];
  }
  if (!canManagePeople(actor)) {
    return [
      {
        label: "Home",
        icon: "overview",
        hint: "Your workday at a glance",
        views: ["home"],
      },
      {
        label: "My apps",
        icon: "applications",
        hint: "Tools and access",
        views: ["apps", "myaccess"],
      },
      {
        label: "Requests",
        icon: "access",
        hint: "Requests and approvals",
        views: [
          "requests",
          ...(["MANAGER", "APPROVER"].includes(actor.role) ? ["access"] : []),
        ],
      },
      {
        label: "Get help",
        icon: "help",
        hint: "Ask your IT team",
        views: ["help"],
      },
    ];
  }
  return [
    {
      label: "Home",
      icon: "overview",
      hint: "What needs your attention",
      views: ["overview"],
    },
    {
      label: "People",
      icon: "people",
      hint: "Employees and workflows",
      views: ["people", "onboarding", "templates", "import"],
    },
    {
      label: "Requests",
      icon: "access",
      hint: "Signups, access and help",
      views: [
        "employee-approvals",
        "access",
        ...(canAdmin(actor) ? ["help"] : []),
      ],
    },
    {
      label: "Apps",
      icon: "applications",
      hint: "Access and connections",
      views: [
        "applications",
        "permissions",
        "integrations",
        ...(canAdmin(actor) ? ["security", "environments"] : []),
      ],
    },
    {
      label: "Settings",
      icon: "settings",
      hint: "Company and activity history",
      views: ["settings", "audit"],
    },
  ];
}

export const sectionViewLabels: Record<string, string> = {
  people: "Directory",
  applications: "Applications",
  import: "Import employees",
  settings: "Company settings",
};

export function ToolFinder({
  sections,
  titles,
  descriptions,
  navigate,
  disabled,
}: {
  sections: WorkspaceSection[];
  titles: Record<string, string>;
  descriptions: Record<string, string>;
  navigate: (view: string) => void;
  disabled: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const open = () => {
    setQuery("");
    dialog.current?.showModal();
  };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (disabled || document.querySelector("dialog[open]")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        dialog.current?.showModal();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [disabled]);
  const destinations = [
    ...sections.flatMap((section) =>
      section.views.map((view) => ({
        view,
        section: section.label,
        icon: section.icon,
      })),
    ),
    { view: "profile", section: "Account", icon: "people" },
    { view: "notifications", section: "Account", icon: "bell" },
  ];
  const matches = destinations.filter(({ view, section }) =>
    `${titles[view]} ${section} ${descriptions[view] || ""} ${sectionViewLabels[view] || ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <button className="nt-find-tool" onClick={open} disabled={disabled}>
        <Icon name="search" size={17} /> Find a tool <kbd>⌘ / Ctrl K</kbd>
      </button>
      <dialog
        className="nt-dialog nt-tool-finder"
        ref={dialog}
        aria-labelledby="nt-tool-finder-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            dialog.current?.close();
          }
        }}
      >
        <div className="nt-dialog-head">
          <h2 id="nt-tool-finder-title">Find a tool</h2>
          <button
            className="nt-icon-button"
            aria-label="Close tool finder"
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="nt-tool-search">
          <label htmlFor="nt-tool-query">What do you want to do?</label>
          <input
            id="nt-tool-query"
            type="search"
            autoFocus
            placeholder="Try onboarding, permissions, or import…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches.length === 1) {
                event.preventDefault();
                dialog.current?.close();
                navigate(matches[0].view);
              }
            }}
          />
        </div>
        <div className="nt-tool-results">
          {matches.map(({ view, section, icon }) => (
            <button
              key={view}
              onClick={() => {
                dialog.current?.close();
                navigate(view);
              }}
            >
              <Icon name={icon} />
              <span>
                <strong>{titles[view]}</strong>
                <small>
                  {section} · {descriptions[view] || "Open this page"}
                </small>
              </span>
              <Icon name="arrow" size={16} />
            </button>
          ))}
          {!matches.length && (
            <p role="status">
              No tools found. Try a page name, such as “access” or “people”.
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}
