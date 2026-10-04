import { AI_MESSAGE_LIMIT } from "./ai-contract";
import { EXTRA_TEMPLATE_CENTS, FIRST_TEMPLATE_CENTS, formatPrice, type TemplateCurrency, type TemplateId } from "./catalog";
import { TRIAL_MESSAGE_LIMIT } from "./trial-contract";

// Public buying guidance only. Paid foundations and private plans never belong here.
export const templatePages: Record<TemplateId, {
  title: string;
  description: string;
  introduction: string;
  useCases: readonly { title: string; description: string }[];
  planningQuestion: string;
  planningAnswer: string;
}> = {
  "discord-bot": {
    title: "AI Discord bot template — commands, workflows and alerts",
    description: "Build a Discord bot with AI-guided setup for custom commands, scheduled alerts, data connections and optional AI responses. See what the runsIT template includes.",
    introduction: "The runsIT Discord bot template is an AI build prompt for creating a bot with custom commands, scheduled workflows and connections to your data sources. It guides your coding AI through setup, permissions, hosting, monitoring and recovery.",
    useCases: [
      { title: "Community commands", description: "Plan commands for the information your members ask for, with permissions that distinguish members, moderators and administrators." },
      { title: "Scheduled alerts", description: "Turn updates from an API, spreadsheet or database into scheduled Discord messages. Define which channels receive alerts and how to handle unavailable data." },
      { title: "Optional AI responses", description: "Add summaries, responses or scoring where they serve your community. Choose the data the bot can use and the limits on its actions." },
    ],
    planningQuestion: "What should I decide before building a Discord bot?",
    planningAnswer: "Choose the commands, servers, channels and data sources first. Decide who can use each command, which actions need approval, and how often scheduled jobs should run. You will create your own Discord application and configure its permissions and credentials during the build.",
  },
  "roblox-game": {
    title: "AI Roblox game template — multiplayer, saves and progression",
    description: "Plan and build a Roblox game with AI guidance for Luau, multiplayer, reliable saves and optional progression. Explore the runsIT template and Build Your Room example.",
    introduction: "The runsIT Roblox game template is an AI build prompt for making a Roblox game around your own core loop. It covers building and placement, inventory, progression, multiplayer and reliable saves using Luau, Roblox Studio and DataStore.",
    useCases: [
      { title: "Building and decorating", description: "Design a game where players place objects and create a space of their own. Build Your Room is our published example of a decorating game on Roblox." },
      { title: "Collection and progression", description: "Plan the items players collect, how inventory works, and which actions unlock new options. Adapt the progression to the game you want to make." },
      { title: "Shared play", description: "Specify how players interact in multiplayer and which decisions the server must verify. Include save and recovery behavior in the plan." },
    ],
    planningQuestion: "What should I decide before building a Roblox game?",
    planningAnswer: "Describe what a player does in the first few minutes, what makes them return, and what needs to persist between sessions. Decide whether the game includes optional Robux purchases. Building and publishing still require your own Roblox account, Roblox Studio and testing.",
  },
  "mobile-game": {
    title: "AI mobile game template — game loops, saves and release",
    description: "Build a mobile game with AI guidance for Godot, GDScript, progression, optional cloud saves and iOS or Android release. See runsIT’s The Last Echo example.",
    introduction: "The runsIT mobile game template is an AI build prompt for creating a game in Godot with GDScript. Adapt the game loop, controls, progression and content to your idea, with guidance for optional accounts, cloud saves, purchases, ads and mobile release.",
    useCases: [
      { title: "Progression games", description: "Define upgrades, rewards and reasons to return. The Last Echo, our idle RPG on iOS, is a published example of a game built around progression." },
      { title: "A different core loop", description: "Describe the actions and controls your own game needs. The template is a foundation for your plan; it does not require your game to reproduce The Last Echo." },
      { title: "Optional online features", description: "Choose whether players need accounts or cloud saves, and whether purchases or ads fit the game. Include those decisions before your AI implements them." },
    ],
    planningQuestion: "Does the mobile game template cover iOS and Android?",
    planningAnswer: "The template includes guidance for iOS and Android release. You choose your target platforms and still need to build, test and satisfy each store’s requirements using your own developer accounts. The Last Echo example is available on iOS and through Google Play testing on Android.",
  },
  "mobile-app": {
    title: "AI iPhone app template — SwiftUI, onboarding and subscriptions",
    description: "Plan a native iPhone app with an AI SwiftUI template covering onboarding, optional accounts, subscriptions, notifications and App Store setup. See PulseDeals.",
    introduction: "The runsIT mobile app template is an AI build prompt for a native iPhone app using SwiftUI. It covers Apple glass design, onboarding, offline state and App Store setup, with optional accounts, subscription plans, notifications and a backend.",
    useCases: [
      { title: "Everyday utilities", description: "Start with a task your app makes easier, then define its screens, onboarding and offline behavior. Choose features that support that task." },
      { title: "Discovery and alerts", description: "Plan a feed, saved items and notification preferences. PulseDeals, our iPhone app for Amazon price drops, is a published example." },
      { title: "Optional subscriptions", description: "Decide which features are paid, how the paywall explains them, and what account settings your users need. Subscription features are optional." },
    ],
    planningQuestion: "Is this an iPhone or Android app template?",
    planningAnswer: "This template targets native iPhone apps with SwiftUI. It is not an Android app template. Its listed stack is SwiftUI, Cloudflare and Supabase; you choose which backend and account features your project needs. App Store submission uses your own Apple developer account and requires testing and review.",
  },
  storefront: {
    title: "AI online store template — catalog, cart and Stripe Checkout",
    description: "Build your own online store with AI guidance for a product catalog, shopping cart, Stripe Checkout, orders and fulfillment. Explore the runsIT storefront template.",
    introduction: "The runsIT online store template is an AI build prompt for creating your own storefront with a product catalog, shopping cart, Stripe Checkout and order fulfillment. It covers HTML, CSS and JavaScript, Cloudflare hosting, and operating the store after launch.",
    useCases: [
      { title: "Your product catalog", description: "Define the products you sell, the information buyers need, and how they move from browsing to a shopping cart." },
      { title: "Checkout and orders", description: "Plan payment through Stripe Checkout and how confirmed orders reach your fulfillment workflow. You use your own payment and service accounts." },
      { title: "A store you operate", description: "Include your domain, hosting, order handling and recovery steps in the build plan. Baked@Night is the public storefront example linked to this template." },
    ],
    planningQuestion: "What should I prepare before building an online store?",
    planningAnswer: "Prepare your product details and decide how you will fulfill orders, handle customer support and maintain the catalog. You will configure your own Stripe account, hosting and domain. The template supplies build guidance; it does not include payment processing, hosting or running the business for you.",
  },
  "browser-game": {
    title: "AI browser game template — rounds, scoring and daily challenges",
    description: "Build a browser game with AI guidance for JavaScript, responsive controls, server-verified scoring and optional maps or daily challenges. Try Local Lore.",
    introduction: "The runsIT browser game template is an AI build prompt for making a game people can play from a web link. It covers JavaScript, responsive controls, reliable state, server-verified scoring, usage limits and deployment, with optional maps and daily challenges.",
    useCases: [
      { title: "Round-based play", description: "Define the player’s action, how a round ends and how results are scored. Include the state needed to resume or finish a game reliably." },
      { title: "Daily challenges", description: "Plan a repeatable challenge and decide which results the server verifies. Daily challenges are optional, so a different game loop can use the same foundation." },
      { title: "Map-based games", description: "Add maps and street imagery when your game needs them. Local Lore is our free browser geography game with Street View photos in Toronto, New York City, Vancouver and London." },
    ],
    planningQuestion: "Do I need maps to use the browser game template?",
    planningAnswer: "No. Maps and street imagery are optional. You can describe a different browser game using the same guidance for controls, state, scoring and deployment. If you choose map or imagery services, you configure your own provider accounts, usage limits and billing.",
  },
};

export const templatePagePath = (id: TemplateId) => `/templates/${id}/`;

export function templateBuyingQuestions(currency: TemplateCurrency) {
  const price = (cents: number) => `${formatPrice(cents, currency)} ${currency.toUpperCase()}`;
  return [
    {
      question: "What do I receive when I buy a template?",
      answer: `Each purchased template includes a build prompt, one AI overview and one successful complete build-guide generation. The HTML guide includes a specification, setup and testing steps, official resources and a clickable prototype with sample data. Every order includes ${AI_MESSAGE_LIMIT} AI editing messages shared across its templates; regenerating a guide uses one message. The prototype is a simulation, and you use your own coding AI to implement the finished app.`,
    },
    {
      question: "Do I need coding experience?",
      answer: "No coding experience is needed to get started. Your coding AI writes the code, and the guide explains the steps. You still make product decisions, create your own service accounts, test the result and manage the project after launch. Choose guided manual steps or computer control with a compatible AI tool.",
    },
    {
      question: "How much does a runsIT AI template cost?",
      answer: `The first template is ${price(FIRST_TEMPLATE_CENTS)}, and each additional template in the same order is ${price(EXTRA_TEMPLATE_CENTS)}. It is a one-time purchase. Prices are in CAD on runsit.ca and USD on runs-it.com. Optional extras are charged once per order. Your coding AI, hosting, domain and other third-party services are separate and may have their own fees.`,
    },
    {
      question: "Can I try my idea before buying?",
      answer: `With a valid free-trial code, the trial includes a personalized short plan and ${TRIAL_MESSAGE_LIMIT} AI edits, with no payment card needed. A purchase is required for the complete build guide and downloadable build prompts. Redeem your code from the free-trial option in the template store.`,
    },
  ];
}
