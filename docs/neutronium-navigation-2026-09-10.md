# Neutronium navigation simplification

Local implementation, September 10, 2026. No production deployment.

The admin workspace now has five main sections instead of 16 sidebar links.
Related pages appear within their section, keeping all existing tools and view
URLs available. Profile and notifications remain in the header and are also
available through the tool finder.

| Main section | Pages |
| --- | --- |
| Home | Quick actions, attention items, company totals, people, setup checklist, recent activity |
| People | Directory, Workflows, Role templates, Import employees |
| Requests | Employee approvals, Access requests, Employee help |
| Apps | Applications, Permissions, Integrations, Account risk, Test environments |
| Settings | Company settings, Audit log |

Role restrictions are preserved. HR sees its existing tools; employees have
Home, My apps, Requests, and Get help. Managers and approvers also have access
approvals inside Requests. Platform operators have Companies, Requests, Apps,
Activity, and Settings, retaining their existing role-specific destinations.

Home begins with four direct actions: onboard an employee, review requests,
find an employee, and offboard an employee. Company totals use less space and
the setup checklist can be expanded when needed.

The People directory starts with search and status. Additional filters are
inside More filters, with an active-filter count and Clear filters action.
Collapsing them preserves their values.

Find a tool searches available pages by name, section, and description.
It opens with the sidebar button or Command/Ctrl K, supports keyboard focus,
and closes with Escape. Existing employee, application, organization, and
workflow links retain their original view IDs.

Mobile navigation has labeled sections, an explicit close button, Escape
dismissal, focus containment, and no focusable offscreen sidebar controls.

Implementation: `navigation.tsx`, `workspace.tsx`, `people-overview.tsx`, and
`neutronium.css` under `src/app/neutronium/`. No backend or bot commands changed.

Validation: 61 backend tests passed. All 25 browser scenarios passed across
the suite and focused reruns, covering navigation, intake preservation,
application review, account security, onboarding, access approval/revocation,
offboarding, help requests, and test environments. Lint, TypeScript, and the
production build passed. Desktop, directory, and mobile screenshots were
visually reviewed. Tests use local simulated providers or mocked APIs; these
results do not assert live provider behavior.

Local preview: http://127.0.0.1:3010/neutronium/
