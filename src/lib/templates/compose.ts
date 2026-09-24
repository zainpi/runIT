import type { BuildMode } from "./catalog";
import { planPrompt, type AppPlan } from "./ai-contract";
import { guidePrompt, type GuideArtifact } from "./guide-contract";

export type Personalization = { name: string; idea: string; features: string; style: string; budget: string; decideBudget?: boolean };
export const emptyPersonalization: Personalization = { name: "", idea: "", features: "", style: "", budget: "", decideBudget: false };

export const modeInstructions: Record<BuildMode, string> = {
  computer: `WORKING MODE: AI CONTROLS MY COMPUTER
Use your available coding, terminal, browser and computer-control tools to implement this project with me. First explain which tools you actually have. Never claim to click, install, test or deploy anything you cannot access. If a tool is missing, switch that step to simple manual instructions and wait for my result.
Inspect the chosen workspace, preserve existing work, and use a new project folder. Implement and run checks in small, reversible steps. Explain each step briefly before acting and report what you verified. I handle passwords, MFA, payment details, identity checks and accepting legal terms myself. Pause for those screens without asking me to paste secrets into chat. Get explicit authorization for paid resources, public publishing, live payments, deleting data, or changing an existing production system. If I have already explicitly authorized that exact action in this session, proceed without asking again. A general request to build does not approve those actions. Never disable security settings to make an integration work.
For account dashboards, use only accounts and projects I identify. Keep a concise change log, explain how to undo changes, and teach me the commands and dashboards so I can operate everything without you.`,
  manual: `WORKING MODE: I DO IT MYSELF
Act as my patient setup guide. Do not operate my computer, change files, execute commands, create accounts or provision services. Give me one small numbered step at a time, with the exact official URL to open, button or field to use, complete command or complete file content where needed, the folder in which to run it, the expected result, and a short fix for common failure. Wait for me to confirm the result before continuing.
Begin by asking my operating system and available tools. Explain technical terms in one plain sentence when first used. Never assume I know what a terminal, environment variable, deployment or webhook is. Use placeholders for secret values and show how I enter them locally or in the provider's protected dashboard without pasting them into chat. When screenshots or errors would help, ask me to redact personal information and credentials. Keep a progress checklist so I can leave and resume.`,
};

function appBrief(details: Personalization): string {
  const field = (value: string, placeholder: string) => value.trim() || `[${placeholder}]`;
  return `=== MY APP: EDIT THIS SECTION ===
Name: ${field(details.name, "Your app name")}
What I want to make and who it is for: ${field(details.idea, "Describe your idea and audience")}
Must-have features, platforms and changes to the foundation: ${field(details.features, "Describe the features you want; say which optional modules to enable")}
Visual style and tone: ${field(details.style, "Describe the look and feel")}
Monthly running budget and expected users: ${details.decideBudget ? "Decide for me. Recommend a practical, low-cost starting budget for my app, state the currency and expected-user assumptions, and explain estimated monthly costs, one-time fees, free-tier limits and what could increase the cost. Ask only for missing details that materially affect the estimate. This requests a recommendation, not authorization to spend money or provision paid services." : field(details.budget, "Your budget, currency and expected number of users")}
=== END OF MY APP BRIEF ===`;
}

function followUpPromptFile(mode: BuildMode, setupOnly = false): string {
  return `FOLLOW-UP PROMPTS I CAN USE NEXT
${mode === "computer"
    ? "Create an actual FOLLOW_UP_PROMPTS.md file in the project root using your available file tools. If file access is unavailable, give me the complete Markdown content and simple instructions to save it at that path."
    : "Give me the complete Markdown content for FOLLOW_UP_PROMPTS.md and one simple step at a time to save it in my project root. Do not write files or run commands for me in manual mode."}
${setupOnly
    ? "Create the initial guide after checking the skill setup, including any unfinished account connections or unsupported tools. Add a Skill setup follow-ups section with 4–6 useful prompts. Keep this session focused on preparing the environment; do not start building the app."
    : "Create the initial guide after the first working milestone so I can resume even if our chat ends early. Update it at each milestone and at handover. Include 8–12 useful follow-up prompts tailored to my app, chosen foundation, implemented features and actual service connections."}
Begin the file with a short, plain-language explanation of how to copy one prompt into the current chat or a new chat with access to this project. Include a dated progress note, what is verified, what remains unfinished, and the next three useful prompts in priority order. If the file already exists, merge and update it; preserve my own notes and useful setup/app sections, remove stale generated suggestions and avoid duplicates.
For each entry provide a clear title, when to use it, any prerequisite, one complete ready-to-copy prompt in a fenced text block, and the expected result. Use real project file paths and chosen service names where known. Mark missing details with obvious bracketed placeholders and explain how to fill them in. Never include passwords, API keys, access tokens, private purchase links or personal data in these examples.
Every follow-up must ask the AI to inspect the current project and relevant README.md, SETUP.md, SERVICES.md and OPERATIONS.md files if present, verify the current state, and identify unknowns before making changes. Make each prompt understandable in a new chat without relying on conversation history. Carry forward my selected ${mode === "computer" ? "computer-control" : "manual"} working mode, preserve existing work, and keep the same boundaries for paid services, publishing, live payments and destructive changes. In manual mode, use the project context I provide and ask for any missing non-sensitive files or results without operating my computer. Do not assume past tests or provider connections still work.
${setupOnly
    ? "Cover resuming unfinished setup, checking installed skills and connections, safely updating or removing tools, and starting a chosen app-build template once setup is ready. Suggest only tools I selected and actually have access to. Preserve any existing app follow-up section."
    : "Group the prompts around resuming or understanding the app, adding features, changing the design and accessibility, diagnosing a redacted error, testing and reviewing security, finishing service setup, preparing a launch, monitoring costs, backups/restoration, and safely updating the app. Include only relevant topics; cover payments or other optional integrations only when selected. Distinguish ready-to-use actions from future ideas that have prerequisites."}
These prompts are a menu of future tasks, not permission to execute them automatically or a substitute for completing this build/setup request. Link the guide from README.md when present. At handover show me the file path, explain how to open it, and point out the next prompt to use.
`;
}

export function composeSkillSetupPrompt(instructions: string, details: Personalization, mode: BuildMode): string {
  return `SET UP MY BUSINESS SKILL TREE

You are my setup guide. Complete the skill and tool setup described below for my own project. This session prepares the development environment; do not start building or publishing the application yet. Explain every step simply, with its official URL, exact action, expected result and a fix for a common error. Preserve my existing work and credentials.

${appBrief(details)}

${modeInstructions[mode]}

${instructions.trim()}

${followUpPromptFile(mode, true)}

Begin by confirming my AI tool, operating system and workspace. Then show the skill tree and carry out its setup in the selected working mode.
`;
}

export function composePrompt(title: string, foundation: string, details: Personalization, mode: BuildMode, subagentInstructions?: string, skillTreeInstructions?: string, appPlan?: AppPlan, guide?: GuideArtifact): string {
  return `BUILD MY ${title.toUpperCase()}

You are my senior engineer and setup guide. Help me create an original, working application I can own, run and maintain myself. Follow this foundation while adapting the product to my brief. Deliver working source and operational instructions, not just a plan or mockup. Do not reuse any existing application's branding, private content, identifiers, assets, credentials or user data. Use synthetic sample data and assets with clear licenses.

${appBrief(details)}

ADAPT THE FOUNDATION TO MY IDEA
My brief and reviewed app specification define the product. The foundation supplies reusable engineering guidance; its example screens, entities, genre, workflows and providers are not mandatory features. Before coding, give me a concise overview and a table with Part and What my app would do columns. Distinguish explicit requirements, provisional assumptions and unresolved decisions. Map my core workflow to appropriate navigation, domain models and integrations. Keep the supplied name and requested platforms; explain any platform mismatch and a feasible alternative before implementation.
Replace irrelevant examples rather than just renaming them. A social climbing app needs people, gyms, skill levels and session invitations instead of a content library or rule builder. A puzzle game need not have combat, prestige or maps. A digital store need not have local delivery. Add product-specific essentials missing from the examples, including visibility, consent and reporting/blocking for social interactions. Keep optional modules absent unless required by my brief or confirmed with me.
Retain applicable security, accessibility, testing, setup, maintenance and handover requirements. Adapt checks to enabled features; do not build an unused feature just to satisfy an example test. Product customization never overrides the selected working mode or authorization boundaries. Ask only questions that materially change the build, state reasonable reversible assumptions, and work toward a manageable complete first release.
${appPlan ? `\n${planPrompt(appPlan)}\n` : ""}
${guide ? `\n${guidePrompt(guide)}\n` : ""}

${modeInstructions[mode]}
${subagentInstructions?.trim() ? `\n=== SUBAGENT WORKFLOW ===\n${subagentInstructions.trim()}\n=== END OF SUBAGENT WORKFLOW ===\n` : ""}
${skillTreeInstructions?.trim() ? `\n=== SKILL TREE SETUP ===\n${skillTreeInstructions.trim()}\n=== END OF SKILL TREE SETUP ===\n` : ""}

HOW TO GUIDE ME
Assume I have no coding experience unless I tell you otherwise. In either working mode, explain unfamiliar terms as they come up, provide complete ready-to-use code, and tell me exactly what to click, paste or check. Briefly explain what each file, command and service does when you introduce it. Do not leave missing programming logic for me to invent.
Start by restating my idea in plain language. Ask only the missing questions that change the build: operating system, target platforms, enabled modules, budget and account ownership. Treat unfilled brackets as questions, never as production values. Recommend a manageable first release and show the later milestones, without quietly omitting required systems.
Give a complete service inventory before setup: what each service does, required vs optional vs alternative, official setup URL, account owner, whether it costs money, current free limits/quotas, credential variable names, where each credential is stored, and a test proving the connection works. Verify current official documentation, SDK compatibility, pricing and store policies; do not invent URLs, dashboard labels, package versions or free tiers. If browsing is unavailable, label the details I must verify. Choose one coherent stack and explicitly explain alternatives.
For EVERY setup action, give: numbered step; direct official URL; exact action or command and working folder; expected visible result; one common error and fix. Keep language simple. In manual mode wait after each step; in computer mode do the reversible work and show the result. Include domain/DNS, HTTPS, auth callbacks, webhook URLs, database migrations, storage, email and scheduled jobs where used. Explain required developer enrollments, hardware, recurring costs and third-party approvals before I depend on them.

IMPLEMENTATION AND HANDOVER CONTRACT
Build in small working milestones: local shell; one complete core workflow; persistence; authentication/authorization if required; external integrations in sandbox; automated checks; staging; then a separately approved release. For each milestone provide runnable source, full file paths, install/run commands, a smoke check and what remains. Do not leave mock success responses or TODO integrations in a release path. Clearly mark test fixtures, unavailable services and any external steps I must finish.
Create README.md, SETUP.md, SERVICES.md, OPERATIONS.md, FOLLOW_UP_PROMPTS.md, an environment-variable example containing placeholders only, versioned schema migrations, a dependency lockfile, and a minimal meaningful test suite. Document environment separation, exact release commands, health checks, provider setup, credential rotation and data retention. Put no secrets in source, public bundles, chat, screenshots or logs. Keep service/admin keys server-side. Use least privilege, MFA for operator accounts, server authorization and input validation, request limits and reliable retries. Default to sandbox payments and test notification recipients. Verify webhook authenticity and idempotency; never trust client-supplied prices, balances, scores or payment success redirects.
Before release, test real happy paths and failure paths, denied access, refresh/retry, duplicate callbacks, outages, backups and restoration. Document accessibility, supported devices and privacy choices appropriate to the product. Provide a short checklist for daily health, weekly error/budget review and monthly updates/backup restore checks. Include troubleshooting, stopping scheduled jobs, pausing paid features, deleting user data, exporting data, safely shutting services down, and rolling back without losing data. Never claim a provider integration works just because mocks pass.

${followUpPromptFile(mode)}

=== APPLICATION FOUNDATION ===
${foundation.trim()}

Begin with the brief, missing decisions and the service inventory. Then take me through the first working milestone in the selected working mode.
`;
}
