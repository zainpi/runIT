import "server-only";

export type SkillSourceKind = "public skill" | "built-in" | "managed plugin" | "public skill or managed plugin" | "tool";

export type SkillSourceGroup = {
  readonly title: string;
  readonly kind: SkillSourceKind;
  readonly names: readonly string[];
  readonly source: string;
  readonly install: string;
  readonly caveat: string;
};

export const skillSourceGroups: readonly SkillSourceGroup[] = [
  {
    title: "Cloudflare official skills",
    kind: "public skill or managed plugin",
    names: ["cloudflare", "workers-best-practices", "wrangler", "nextjs-on-cloudflare", "durable-objects", "agents-sdk", "cloudflare-email-service", "turnstile-spin", "web-perf", "sandbox-stable", "sandbox-next", "sandbox-migrate-to-next", "cloudflare-one", "cloudflare-one-migrations"],
    source: "https://github.com/cloudflare/skills",
    install: "Use the publisher-documented interactive command npx skills add https://github.com/cloudflare/skills and select only the needed skills, or use the documented Codex marketplace commands: codex plugin marketplace add cloudflare/skills, then codex plugin add cloudflare@cloudflare.",
    caveat: "Choose one route and classify each installed node accordingly: public skills for Skills CLI, managed plugin for the marketplace route. The plugin also adds Cloudflare MCP capability. Ask before broadening permissions and select only relevant skills.",
  },
  {
    title: "Stripe official plugin and skills",
    kind: "public skill or managed plugin",
    names: ["stripe-best-practices", "stripe-docs", "upgrade-stripe", "connect-recommend", "stripe-apps", "stripe-projects", "stripe-directory"],
    source: "https://github.com/stripe/ai",
    install: "Prefer the publisher-supported Codex command codex plugin add stripe@openai-curated. The documented manual alternative is npx skills add https://docs.stripe.com.",
    caveat: "Choose one installation route. Record the manual route as public skills and the marketplace route as a managed plugin; inspect the actual skill names and versions exposed by that route. Do not install both just to duplicate skills. Account connection, OAuth permissions, Stripe products, and live-mode access are separate choices. Official agent docs: https://docs.stripe.com/agents.",
  },
  {
    title: "Unity LevelPlay",
    kind: "public skill",
    names: ["levelplay-unity-integration"],
    source: "https://github.com/Unity-Technologies/skills",
    install: "Follow the current publisher instructions; the documented discovery/install entry is npx skills add Unity-Technologies/skills.",
    caveat: "This is for Unity only. Do not recommend it for Godot or imply it installs SDKs, creates accounts, or completes consent and store configuration.",
  },
  {
    title: "Apple design guidance",
    kind: "public skill",
    names: ["apple-hig"],
    source: "https://github.com/justinwetch/HIGAgentSkills",
    install: "The publisher README supplies this agent-directed request rather than a package-manager command: Install the apple-hig skill for me from https://github.com/justinwetch/HIGAgentSkills.git. Inspect the repository and runtime package before acting. Treat https://developer.apple.com/design/human-interface-guidelines/ as the primary design authority.",
    caveat: "This is an independent community reference. Verify against Apple's official guidance. The README describes installing the packaged apple-hig directory; record a reviewed commit rather than guessing or inventing an npx route.",
  },
  {
    title: "Skill discovery",
    kind: "public skill",
    names: ["find-skills"],
    source: "https://github.com/vercel-labs/skills",
    install: "Use the current interactive Skills CLI instructions; a supported targeted form is npx skills add vercel-labs/skills@find-skills.",
    caveat: "Discovery results are candidates, not endorsements. Review publisher, license, scripts, hooks, dependencies, permissions, and maintenance before installing.",
  },
  {
    title: "Codex system skills",
    kind: "built-in",
    names: ["openai-docs", "imagegen", "skill-creator", "skill-installer", "plugin-creator", "review-agent"],
    source: "https://github.com/openai/skills",
    install: "These ship with Codex and normally require no installation. Use https://learn.chatgpt.com/docs/build-skills for supported creation and installation behavior.",
    caveat: "Do not overwrite system-managed directories. Public catalog availability does not imply that every shipped implementation is independently installable.",
  },
  {
    title: "OpenAI Sites",
    kind: "managed plugin",
    names: ["sites-building", "sites-hosting", "sites-preview-troubleshooting"],
    source: "https://learn.chatgpt.com/docs/plugins",
    install: "Use the Codex managed plugin marketplace and the Sites plugin card when it is available to the account.",
    caveat: "The exact shipped skill source is proprietary and has no verified public repository. Sites is optional and should be selected only for Sites-hosted work.",
  },
  {
    title: "OpenAI plugin management",
    kind: "managed plugin",
    names: ["plugin-management"],
    source: "https://learn.chatgpt.com/docs/plugins",
    install: "Use the Codex managed plugin experience; never copy a cache directory.",
    caveat: "Installation and connection are distinct. Inspect requested permissions and external dependencies before connecting.",
  },
  {
    title: "OpenAI artifact runtime",
    kind: "managed plugin",
    names: ["documents", "pdf", "presentations", "spreadsheets", "excel-live-control", "template-creator"],
    source: "https://learn.chatgpt.com/docs/plugins",
    install: "Use the bundled or managed Codex runtime when exposed by the current account.",
    caveat: "No verified public installable copy of the exact shipped sources exists. Live Excel and cloud document behavior may require separate connected apps.",
  },
  {
    title: "OpenAI visualization",
    kind: "managed plugin",
    names: ["visualize"],
    source: "https://learn.chatgpt.com/docs/plugins",
    install: "Use the bundled or managed plugin when the current session exposes it.",
    caveat: "Do not represent a cached package as installed or fabricate a filesystem installation route.",
  },
  {
    title: "Caveman family",
    kind: "public skill",
    names: ["caveman", "caveman-help", "caveman-review", "caveman-commit", "caveman-compress", "caveman-stats", "cavecrew"],
    source: "https://github.com/JuliusBrussee/caveman",
    install: "Read the current upstream README and inspect the exact package before following its current installation instructions; no verified lock or universal install command is assumed here.",
    caveat: "Opt-in communication and workflow style only. Never add hooks automatically. Review executable compression scripts, outbound calls, backups, overwrite behavior, and cavecrew's host-specific subagent dependencies.",
  },
  {
    title: "Roblox Studio MCP",
    kind: "tool",
    names: ["Roblox Studio MCP server (includes the skill tool)"],
    source: "https://create.roblox.com/docs/studio/mcp",
    install: "Use the MCP server built into a current Roblox Studio release and the official Studio settings/quick-connect instructions.",
    caveat: "This is an MCP tool surface, not a standalone SKILL.md. It can modify an open place, execute Luau, playtest, and invoke Studio's own skill tool, so connect only a trusted client and require approval before publishing or production access.",
  },
  {
    title: "Roblox development toolchain",
    kind: "tool",
    names: ["Rokit", "Rojo", "Lune", "StyLua", "Roblox Studio", "Rojo Studio plugin"],
    source: "https://github.com/rojo-rbx/rokit",
    install: "Use the project's reviewed Rokit pins and run rokit install only after inspection. Follow https://rojo.space/docs/v7/getting-started/installation/, https://lune-org.github.io/docs/getting-started/1-installation/, https://github.com/JohnnyMorganz/StyLua, and https://create.roblox.com/docs/studio/setup for each publisher-supported component.",
    caveat: "These are CLIs, an editor, and an editor plugin, not agent skills. Preserve existing pins. Lune is not a complete Roblox runtime, and offline checks do not replace Studio/device tests.",
  },
  {
    title: "Blender and official Blender Lab MCP",
    kind: "tool",
    names: ["Blender", "Blender Lab MCP server"],
    source: "https://www.blender.org/lab/mcp-server/",
    install: "Install Blender from https://www.blender.org/download/, then follow the current Blender Lab instructions for its Blender add-on, separate Python MCP server, and compatible MCP client. Verified public source: https://projects.blender.org/lab/blender_mcp.git.",
    caveat: "This is an optional editor and official MCP connector, not an agent skill. The connector requires a compatible Blender and Python version and can execute arbitrary generated Python inside Blender without guards. Verify current requirements, use backups or disposable files, keep sensitive data out of the environment, and review every script.",
  },
] as const;
