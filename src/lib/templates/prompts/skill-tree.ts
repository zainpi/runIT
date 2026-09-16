import "server-only";

import type { TemplateId } from "../catalog";
import { skillSourceGroups } from "../skill-sources";

const branchMap: Record<TemplateId, string> = {
  "discord-bot": "Prioritize project instructions, runtime/package tooling, deployment guidance, review-agent, and only a provider-specific public skill that is verified at setup time. No dedicated Discord skill was verified in the reference inventory, so report that gap instead of inventing one.",
  "roblox-game": "Prioritize the Roblox tool branch: pinned Rokit, Rojo, Lune, StyLua, Roblox Studio, the matching Rojo Studio plugin, and optional Blender. Offer the built-in Roblox Studio MCP only after explaining its write/execute powers and receiving approval to connect it. Its skill tool is part of MCP, not a standalone agent skill. Do not claim that a Roblox SKILL.md was found.",
  "mobile-game": "Prioritize engine and release tooling, Apple HIG for iOS design, and relevant hosting skills. The selected foundation uses Godot, so explicitly exclude levelplay-unity-integration unless the user independently chooses a Unity variant. Offer the Caveman family only as an optional style/workflow branch and never install hooks automatically.",
  "mobile-app": "Prioritize Apple HIG, official platform documentation, and Cloudflare deployment skills when the backend uses Workers. For native digital goods and subscriptions, use the platform store billing system and its primary documentation. Offer Stripe only for an explicitly permitted external or web payment flow after checking current store policy. State that no dedicated verified SwiftUI, StoreKit, APNs, TestFlight, or Supabase public skill was present; use primary docs or carefully inspect a newly discovered candidate.",
  storefront: "Prioritize Cloudflare deployment, Worker security/performance, and the official Stripe plugin or manual Stripe skills. Keep Cloudflare MCP, Stripe account connection, live mode, tax configuration, products, and paid resources as separate optional approvals.",
  "browser-game": "Prioritize Cloudflare, Workers best practices, Wrangler, web performance, Turnstile when abuse protection is needed, and Durable Objects only for coordinated live state. Maps and imagery providers are services rather than skills; use their primary documentation and obtain keys under the user's account.",
};

function sourceDirectory(): string {
  return skillSourceGroups.map((group) => [
    `### ${group.title}`,
    `Kind: ${group.kind}`,
    `Names: ${group.names.join(", ")}`,
    `Primary source: ${group.source}`,
    `Supported route: ${group.install}`,
    `Constraint: ${group.caveat}`,
  ].join("\n")).join("\n\n");
}

export function buildSkillTreeInstructions(ids: readonly TemplateId[]): string {
  const selected = [...new Set(ids)];
  const branches = selected.length
    ? selected.map((id) => `- ${id}: ${branchMap[id]}`).join("\n")
    : "- No template branch was supplied. Inventory the project first and present the directory as optional choices; install nothing by default.";

  return `OPTIONAL SKILL-TREE SETUP ADD-ON

You are setting up a minimal, auditable skill and tool tree for these purchased template branches: ${selected.join(", ") || "none supplied"}. This paid add-on is original curation and setup guidance. It does not sell, sublicense, or reproduce third-party skill text. Every upstream license, term, trademark, and account requirement remains in force.

SELECTED BRANCH PLAN
${branches}

Start by inspecting the current project instructions, agent host, operating system, installed skills, plugin inventory, MCP configuration, developer tools, package locks, and relevant repository manifests. Treat local caches and temporary plugin folders as evidence of downloaded files only; they do not prove installation, activation, connection, or permission. Identify existing versions and configuration before proposing changes. Preserve working installations and user-authored settings.

Produce a compact plan before any mutation. For each proposed node give: exact name; kind (public skill, built-in, managed plugin, MCP/tool, CLI/editor, or service); why it is required or optional for a selected template; publisher and HTTPS primary source; license when publicly stated; supported host/platform; prerequisites; proposed pinned version or commit; install location; files/configuration changed; executable scripts, hooks, network access, accounts, secrets, and permissions involved; read-only verification; project smoke test; update path; rollback/uninstall path; and a manual fallback. Clearly mark candidates that were not present in the known inventory.

Apply least capability. Build only the selected branches first, then show the remaining directory as an optional catalog. Prefer built-ins already available. Prefer a targeted, publisher-supported install over a repository-wide install. Never use an unattended yes flag, global installation, arbitrary curl-to-shell command, or deletion/replacement of existing configuration without showing the reviewed action and obtaining the user's explicit approval. Do not run an installer merely because this prompt names it. Inspect the current upstream README, SKILL.md, manifests, dependency locks, scripts, hooks, license, recent maintenance, and requested permissions first. Reverify every command and compatibility at setup time because repositories and CLIs change.

Record provenance for every installed public skill: canonical repository, selected subdirectory, commit or immutable release, content hash when the client supports it, install date, install scope and location, host/client version, and license. Preserve or create the host's supported lockfile. For managed plugins, record plugin identity/version and the managed marketplace route without copying cache contents. For built-ins, record host version and availability instead of attempting installation. For tools, use their own package/version locks. Before changes, back up only the configuration files that will be touched, without copying credentials. Roll back by restoring that scoped backup or using the publisher's uninstall mechanism; never wipe the whole skills, plugin, or MCP directory.

WORKING MODE AND AUTHORIZATION

Respect the working mode already selected in the surrounding build prompt. In computer-control mode, you may perform reviewed local setup actions within existing authorization after presenting the plan. Installing or connecting a plugin does not authorize account creation, OAuth consent, paid plans, API keys, cloud resources, production access, publishing, deployment, analytics, advertisements, purchases, or changes to live data. Those require explicit user approval and must use accounts owned by the user. Never expose secrets in chat, command output, source control, logs, screenshots, tests, or generated documentation.

In manual mode, do not change the computer, execute commands, install packages, open dashboards, edit configuration, or connect accounts. Give numbered, copyable instructions with expected results, a read-only verification after each step, and an exact rollback. Label all actions and tests as unexecuted until the user reports evidence. Never claim a skill, plugin, MCP server, connection, or tool is installed from a prompt alone.

Do not initiate unsolicited agent delegation as part of skill setup. Honor an explicit user request to delegate or a supplied subagent workflow only when the current host supports it and the chosen working mode permits it. A tool named subagent inside another product does not itself authorize using it.

INSTALLATION SEQUENCE

1. Inventory and classify. Separate agent skills from repository instructions, built-ins, managed plugins, MCP servers, editors/CLIs, application SDKs, and external services.
2. Resolve the smallest selected branch. Remove irrelevant nodes and mutually exclusive alternatives. In particular, keep Unity LevelPlay out of Godot work; keep Sites optional for existing websites; do not install both stable and preview Sandbox workflows without a migration reason.
3. Inspect each public source locally or through a read-only source viewer. Summarize license, executables, hooks, dependencies, network behavior, configuration scope, and notable risks. Do not paste or resell upstream skill bodies.
4. Present concrete changes and approval points. Ask before third-party code execution, MCP enablement, broad filesystem access, account connection, paid resources, production access, public publishing, or destructive replacement. Do not ask again for an action the user already approved in the current session.
5. Install through the current publisher-supported route with a reviewed pin where supported. Merge configuration carefully. Do not overwrite unrelated MCP entries, permission policies, skill directories, plugin settings, or project instructions.
6. Verify without side effects: list discovery through the current host, confirm the recorded source/version, start a fresh turn if discovery requires it, and invoke only a harmless documentation or read-only capability. Installation and connection are separate checks.
7. Run one task-level smoke check per selected branch: lint/config validation for Cloudflare; Stripe test-mode documentation or mocked checkout validation without charges; an Apple layout review without publishing; a local Roblox place/read-only tree query before edits; a Unity package/config review without ad traffic; or artifact rendering to a temporary file. Never use production credentials or live customer data for a smoke test.
8. Report installed, already present, skipped, unavailable, failed, and user-deferred nodes separately. Include exact evidence, limitations, costs incurred, external validation remaining, and rollback instructions. Do not turn a failed install into an invented success.

SOURCE AND CAPABILITY DIRECTORY

${sourceDirectory()}

KNOWN GAPS AND ALTERNATIVES

No verified globally installed dedicated skills were established for Discord, Godot/GDScript, SwiftUI implementation, StoreKit, APNs, TestFlight, Supabase, general application security, Sentry, Docker/VPS, PostgreSQL, maps providers, or game balancing. Blender has an official optional Blender Lab MCP tool, but it is not a skill and its Python execution surface requires strong isolation and review. Roblox has an official built-in Studio MCP with a skill tool, but no standalone Roblox SKILL.md was verified in the reference projects. For these gaps, use primary vendor documentation and ordinary project tooling, or run cautious discovery and present candidates for review. Never infer trust from a package name or search rank.

When discovery produces an alternative, compare it with doing the work from primary docs. Report publisher identity, public source, license, last meaningful maintenance, issue/security posture, scripts and hooks, permission surface, host compatibility, and whether the capability duplicates an existing built-in. Do not create a new provider account, accept terms, grant OAuth, buy credits, or incur external spend without explicit approval.

Finish with a tree diagram limited to the selected templates, a provenance table, exact verification evidence, and a short optional-catalog section. Keep truthful labels: available, installed, connected, configured, tested, and production-validated are different states.`;
}
