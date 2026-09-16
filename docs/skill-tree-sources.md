# Skill-tree source directory

This document records the upstream directory behind the optional skill-tree setup prompt. The paid add-on sells original selection, safety, provenance, and setup guidance. It does not redistribute third-party skill bodies. Upstream licenses and terms continue to apply.

The generator lives in `src/lib/templates/prompts/skill-tree.ts`; its server-only source registry is `src/lib/templates/skill-sources.ts`. Source links were checked on 2026-09-16. Installation commands remain time-sensitive and must be rechecked against the linked publisher documentation before use.

## Public skill sources

| Publisher/group | Included names | Primary source | Supported entry point and limitation |
| --- | --- | --- | --- |
| Cloudflare | `cloudflare`, `workers-best-practices`, `wrangler`, `nextjs-on-cloudflare`, `durable-objects`, `agents-sdk`, `cloudflare-email-service`, `turnstile-spin`, `web-perf`, `sandbox-stable`, `sandbox-next`, `sandbox-migrate-to-next`, `cloudflare-one`, `cloudflare-one-migrations` | https://github.com/cloudflare/skills | Publisher command: `npx skills add https://github.com/cloudflare/skills`, then interactively select only relevant skills. Alternative Codex route: `codex plugin marketplace add cloudflare/skills`, then `codex plugin add cloudflare@cloudflare`; the plugin also adds MCP capability. |
| Stripe | `stripe-best-practices`, `stripe-docs`, `upgrade-stripe`, `connect-recommend`, `stripe-apps`, `stripe-projects`, `stripe-directory` | https://github.com/stripe/ai and https://docs.stripe.com/agents | Prefer `codex plugin add stripe@openai-curated`; publisher-documented manual alternative: `npx skills add https://docs.stripe.com`. Account connection and permissions are separate. |
| Unity Technologies | `levelplay-unity-integration` | https://github.com/Unity-Technologies/skills | Repository documents `npx skills add Unity-Technologies/skills`. Unity-only; it is not a Godot integration. |
| Independent Apple HIG reference | `apple-hig` | https://github.com/justinwetch/HIGAgentSkills | Its README provides an agent-directed request to install `apple-hig` from that Git repository, then describes using the packaged `apple-hig` runtime directory. It does not publish an `npx` command. Inspect and pin first; the observed copy had no standard global lock entry. Apple's primary HIG is https://developer.apple.com/design/human-interface-guidelines/. |
| Vercel Labs Skills CLI | `find-skills` | https://github.com/vercel-labs/skills | Targeted discovery install is documented as `npx skills add vercel-labs/skills@find-skills`; search results still require review. |
| Caveman | `caveman`, `caveman-help`, `caveman-review`, `caveman-commit`, `caveman-compress`, `caveman-stats`, `cavecrew` | https://github.com/JuliusBrussee/caveman | Optional style/workflow branch. No universal pinned command is assumed. Review scripts, hooks, outbound calls, backups, overwrite behavior, and host-specific subagent dependencies. |

Do not run these commands blindly or append unattended flags. Inspect the repository, target package, license, scripts, hooks, dependencies, requested permissions, and current host compatibility. Prefer a project-scoped, pinned install and preserve the host's lockfile.

## Codex built-ins and managed plugins

Codex system skills are `openai-docs`, `imagegen`, `skill-creator`, `skill-installer`, `plugin-creator`, and `review-agent`. They normally ship with Codex and should not be overwritten. Public catalog and setup guidance: https://github.com/openai/skills and https://learn.chatgpt.com/docs/build-skills.

Managed OpenAI plugin/runtime names are:

- Sites: `sites-building`, `sites-hosting`, `sites-preview-troubleshooting`.
- Plugin management: `plugin-management`.
- Artifact runtime: `documents`, `pdf`, `presentations`, `spreadsheets`, `excel-live-control`, `template-creator`.
- Visualization: `visualize`.

Use the managed Codex plugin/runtime experience described at https://learn.chatgpt.com/docs/plugins. No verified public repository contains the exact shipped source for these managed skills. A cache directory is not an installation route or proof that a plugin is active, connected, or permitted.

## Tools kept separate from skills

Roblox Studio has a built-in MCP server documented at https://create.roblox.com/docs/studio/mcp. It exposes a native `skill` tool alongside read, edit, Luau execution, playtest, input, and asset tools. Enable it through Studio Assistant settings and connect a trusted supported client. It is not a standalone `SKILL.md` and no external install repository is required. Because it can modify an open place and execute code, connection and any write/publish action require clear authorization.

The Roblox development toolchain comprises Rokit, Rojo, Lune, StyLua, Roblox Studio, and the Rojo Studio plugin. Primary setup sources are:

- https://github.com/rojo-rbx/rokit
- https://rojo.space/docs/v7/getting-started/installation/
- https://lune-org.github.io/docs/getting-started/1-installation/
- https://github.com/JohnnyMorganz/StyLua
- https://create.roblox.com/docs/studio/setup

These are tools, not agent skills. Preserve reviewed `rokit.toml` pins. Lune is not a full Roblox runtime, so local tests do not replace Studio, multiplayer, device, DataStore, or purchase testing.

Blender is an optional editor/tool for game assets. Use https://www.blender.org/download/ and https://docs.blender.org/manual/en/latest/. Its official optional connector is Blender Lab MCP: canonical setup documentation at https://www.blender.org/lab/mcp-server/ and public source at https://projects.blender.org/lab/blender_mcp.git. The setup has three distinct parts: Blender add-on, Python MCP server, and compatible MCP client; installing Blender alone does not install the connector. Check the current Blender and Python requirements rather than copying an observed local version. The connector can execute arbitrary generated Python inside Blender without guards, so use backed-up or disposable files, exclude sensitive data, and review code before execution.

## Known gaps

The inspected global/project inventories did not establish dedicated installed skills for Discord, Godot/GDScript, SwiftUI implementation, StoreKit, APNs, TestFlight, Supabase, general application security, Sentry, Docker/VPS, PostgreSQL, maps providers, or game balancing. Blender Lab MCP is available as an optional official tool rather than a skill. The generator must report remaining gaps, use primary vendor documentation, or propose separately reviewed discovery results. It must not fabricate a package or relabel an SDK, editor, service, MCP server, repository instruction file, or CLI as a skill.

For every installed node, record canonical source, package path, license, immutable revision, hash when supported, install date, scope/location, host version, permissions, verification, and rollback. Keep the states `available`, `installed`, `connected`, `configured`, `tested`, and `production-validated` distinct.
