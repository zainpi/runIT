import type { ComponentType, SVGProps } from "react";
import {
  BotIcon,
  WorkflowIcon,
  MagnetIcon,
  SyncIcon,
  HeadsetIcon,
  SparklesIcon,
  ChartIcon,
  GearIcon,
  ClockIcon,
  ShieldIcon,
  BrainIcon,
  DocIcon,
} from "@/components/icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export type Service = {
  id: string;
  icon: Icon;
  title: string;
  short: string;
  description: string;
  outcomes: string[];
  useCases: string[];
};

/** Six headline cards used on the home page services grid. */
export const homeServices: Pick<
  Service,
  "id" | "icon" | "title" | "short"
>[] = [
  {
    id: "ai-agents",
    icon: BotIcon,
    title: "AI Agents",
    short:
      "Intelligent assistants that handle customer interactions and internal processes around the clock.",
  },
  {
    id: "workflow-automation",
    icon: WorkflowIcon,
    title: "Workflow Automation",
    short:
      "Automate repetitive business tasks across all of your tools and platforms.",
  },
  {
    id: "lead-automation",
    icon: MagnetIcon,
    title: "Lead Generation Systems",
    short:
      "Capture, qualify, and follow up with every lead automatically — no one slips through.",
  },
  {
    id: "crm-automation",
    icon: SyncIcon,
    title: "CRM Automation",
    short:
      "Keep customer data synchronized and your pipelines moving without manual upkeep.",
  },
  {
    id: "customer-support",
    icon: HeadsetIcon,
    title: "Customer Support Automation",
    short:
      "Deliver faster, consistent support with AI-powered systems that scale.",
  },
  {
    id: "custom",
    icon: SparklesIcon,
    title: "Custom Business Solutions",
    short:
      "Tailored automation designed precisely around how your business actually works.",
  },
];

/** Detailed service entries used on the Services page. */
export const services: Service[] = [
  {
    id: "ai-agents",
    icon: BotIcon,
    title: "AI Agents",
    short:
      "Intelligent assistants that handle customer interactions and internal processes.",
    description:
      "We design AI agents that understand your business context and act on it — answering questions, triaging requests, updating records, and handing off to your team only when it matters. They work 24/7, stay on-brand, and get smarter as your knowledge base grows.",
    outcomes: [
      "24/7 coverage without adding headcount",
      "Consistent, on-brand responses every time",
      "Faster resolution and fewer dropped tasks",
    ],
    useCases: [
      "Inbound sales and qualification assistants",
      "Internal ops copilots for your team",
      "AI front desk for bookings and FAQs",
    ],
  },
  {
    id: "workflow-automation",
    icon: WorkflowIcon,
    title: "Workflow Automation",
    short:
      "Automate repetitive business tasks across multiple tools and platforms.",
    description:
      "We connect the apps you already use and remove the manual handoffs between them. From form submissions to invoicing to multi-step approvals, your workflows run automatically, accurately, and instantly — even while you sleep.",
    outcomes: [
      "Eliminate copy-paste between systems",
      "Remove human error from routine tasks",
      "Reclaim dozens of hours every week",
    ],
    useCases: [
      "Order, invoice, and document automation",
      "Multi-step approvals and notifications",
      "Onboarding and offboarding sequences",
    ],
  },
  {
    id: "crm-automation",
    icon: SyncIcon,
    title: "CRM Automation",
    short:
      "Keep customer data synchronized and workflows running smoothly.",
    description:
      "Your CRM is only as valuable as the data inside it. We automate data entry, enrichment, deduplication, and stage updates so your pipeline reflects reality — and your team spends time selling instead of maintaining records.",
    outcomes: [
      "Always-accurate pipeline data",
      "No more manual CRM updates",
      "Cleaner reporting and forecasting",
    ],
    useCases: [
      "Automatic lead and deal enrichment",
      "Pipeline stage and task automation",
      "Two-way sync across your tool stack",
    ],
  },
  {
    id: "lead-automation",
    icon: MagnetIcon,
    title: "Lead Automation",
    short: "Capture, qualify, and follow up with leads automatically.",
    description:
      "Speed-to-lead wins deals. We build systems that capture leads from every channel, qualify them instantly, and trigger personalized follow-up so prospects hear back in minutes — not days — without anyone lifting a finger.",
    outcomes: [
      "Respond to new leads in seconds",
      "Qualify and route automatically",
      "Higher conversion from existing traffic",
    ],
    useCases: [
      "Instant lead capture and routing",
      "Automated multi-touch follow-up",
      "Appointment booking and reminders",
    ],
  },
  {
    id: "customer-support",
    icon: HeadsetIcon,
    title: "Customer Support Systems",
    short: "Provide faster support with AI-powered systems.",
    description:
      "We deploy AI support systems that resolve common questions instantly, deflect repetitive tickets, and escalate complex issues with full context. Customers get faster answers, and your team focuses on the conversations that actually need a human.",
    outcomes: [
      "Lower ticket volume and faster replies",
      "Higher customer satisfaction scores",
      "Support that scales with you",
    ],
    useCases: [
      "AI chat and email support",
      "Ticket triage and smart routing",
      "Self-serve knowledge assistants",
    ],
  },
  {
    id: "internal-operations",
    icon: GearIcon,
    title: "Internal Operations Automation",
    short:
      "Streamline the back-office work that quietly slows your team down.",
    description:
      "From HR and finance to project handoffs, we automate the internal processes that eat up your team's day. Approvals, reminders, document generation, and status updates happen on their own, so operations run smoothly without constant babysitting.",
    outcomes: [
      "Smoother handoffs between teams",
      "Fewer dropped balls and delays",
      "More focus on high-value work",
    ],
    useCases: [
      "Employee onboarding workflows",
      "Automated document generation",
      "Internal request and approval flows",
    ],
  },
  {
    id: "reporting-analytics",
    icon: ChartIcon,
    title: "Reporting & Analytics",
    short:
      "Turn scattered data into clear, automated reports and dashboards.",
    description:
      "Stop assembling reports by hand. We pull data from your tools, clean it, and deliver the insights your team needs on a schedule or on demand. Decision-makers get a single source of truth without the spreadsheet gymnastics.",
    outcomes: [
      "Real-time visibility into your business",
      "Reports delivered automatically",
      "Decisions backed by clean data",
    ],
    useCases: [
      "Automated KPI dashboards",
      "Scheduled performance reports",
      "Data consolidation across platforms",
    ],
  },
  {
    id: "knowledge-bases",
    icon: BrainIcon,
    title: "AI-Powered Knowledge Bases",
    short:
      "Make your company's knowledge instantly searchable and useful.",
    description:
      "We turn your documents, SOPs, and tribal knowledge into an AI assistant your team and customers can simply ask. Answers are accurate, sourced, and always up to date — so no one wastes time hunting for information.",
    outcomes: [
      "Instant answers from your own content",
      "Less time lost searching for info",
      "Faster onboarding for new hires",
    ],
    useCases: [
      "Internal employee knowledge assistant",
      "Customer-facing help center AI",
      "Searchable SOP and policy library",
    ],
  },
];

export type Benefit = {
  icon: Icon;
  stat: string;
  label: string;
  description: string;
};

export const benefits: Benefit[] = [
  {
    icon: ClockIcon,
    stat: "10–40+",
    label: "Hours saved per week",
    description:
      "Reclaim time lost to manual, repetitive work and redirect it to growth.",
  },
  {
    icon: ChartIcon,
    stat: "Lower",
    label: "Operational costs",
    description:
      "Do more with the team you have by removing expensive manual processes.",
  },
  {
    icon: HeadsetIcon,
    stat: "Faster",
    label: "Customer responses",
    description:
      "Reply to leads and customers in seconds, not hours or days.",
  },
  {
    icon: SparklesIcon,
    stat: "Scale",
    label: "Without new hires",
    description:
      "Handle more volume without proportionally growing your headcount.",
  },
  {
    icon: WorkflowIcon,
    stat: "Smoother",
    label: "Workflow efficiency",
    description:
      "Connected systems mean fewer errors and zero manual handoffs.",
  },
  {
    icon: ShieldIcon,
    stat: "Reliable",
    label: "Consistent execution",
    description:
      "Automations run the same way every time — no missed steps.",
  },
];

export type Step = {
  number: string;
  title: string;
  description: string;
};

export const processSteps: Step[] = [
  {
    number: "01",
    title: "Discovery & Audit",
    description:
      "We analyze your current workflows and identify the highest-impact automation opportunities.",
  },
  {
    number: "02",
    title: "Strategy & Planning",
    description:
      "We design a custom automation roadmap prioritized by ROI and ease of implementation.",
  },
  {
    number: "03",
    title: "Build & Integration",
    description:
      "We develop the solution and connect it securely to your existing systems and tools.",
  },
  {
    number: "04",
    title: "Optimization & Support",
    description:
      "We monitor performance and continuously improve reliability, speed, and results.",
  },
];

export type Problem = {
  icon: Icon;
  title: string;
};

export const problems: Problem[] = [
  { icon: DocIcon, title: "Manual data entry" },
  { icon: MagnetIcon, title: "Lead follow-ups" },
  { icon: HeadsetIcon, title: "Customer inquiries" },
  { icon: ChartIcon, title: "Reporting" },
  { icon: GearIcon, title: "Administrative work" },
];

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
  metric: string;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "runIT automated our entire client onboarding. What used to take our team two days now happens in minutes — and nothing falls through the cracks.",
    name: "Sarah Mitchell",
    role: "Operations Director",
    company: "Northbeam Marketing",
    metric: "25 hrs/week saved",
  },
  {
    quote:
      "Their AI support system handles the bulk of our incoming tickets instantly. Our team finally has room to focus on the customers who really need them.",
    name: "David Chen",
    role: "Founder",
    company: "Lumora Goods",
    metric: "62% fewer tickets",
  },
  {
    quote:
      "We respond to new leads within seconds now. The automated follow-up alone paid for the project in the first month.",
    name: "Marcus Reed",
    role: "Owner",
    company: "Reed Home Services",
    metric: "2.3x more bookings",
  },
];

export type CaseStudy = {
  id: string;
  industry: string;
  title: string;
  summary: string;
  challenge: string;
  solution: string;
  results: { stat: string; label: string }[];
  highlights: string[];
};

export const caseStudies: CaseStudy[] = [
  {
    id: "marketing-agency",
    industry: "Marketing Agency",
    title: "Automating onboarding and reporting for a growing agency",
    summary:
      "A full-service marketing agency was drowning in manual onboarding and weekly client reporting.",
    challenge:
      "Each new client required hours of manual setup, and the team spent every Friday assembling reports by hand. Growth meant more administrative load, not more margin.",
    solution:
      "We built an automated onboarding workflow that provisions accounts, sends welcome sequences, and creates project assets the moment a contract is signed — plus automated client reports pulled directly from their ad and analytics platforms.",
    results: [
      { stat: "25 hrs", label: "Saved per week" },
      { stat: "100%", label: "Onboarding automated" },
      { stat: "3x", label: "Faster client response" },
    ],
    highlights: [
      "Reduced manual work by 25 hours per week",
      "Fully automated client onboarding",
      "Improved response times across the board",
    ],
  },
  {
    id: "ecommerce",
    industry: "E-commerce Store",
    title: "Cutting support volume for a scaling DTC brand",
    summary:
      "A direct-to-consumer brand was overwhelmed by repetitive support tickets during peak seasons.",
    challenge:
      "Order status, returns, and product questions flooded the inbox. Response times slipped and customer satisfaction suffered exactly when sales were highest.",
    solution:
      "We deployed an AI support system that instantly answers common questions, surfaces order details, and escalates complex cases with full context — integrated directly with their store and helpdesk.",
    results: [
      { stat: "62%", label: "Fewer tickets" },
      { stat: "<1 min", label: "First response time" },
      { stat: "+18pts", label: "CSAT increase" },
    ],
    highlights: [
      "Automated the majority of customer support",
      "Dramatically reduced ticket volume",
      "Increased customer satisfaction",
    ],
  },
  {
    id: "local-service",
    industry: "Local Service Business",
    title: "Turning missed leads into booked jobs",
    summary:
      "A local service business was losing leads simply because follow-up was slow and inconsistent.",
    challenge:
      "Inquiries came in across calls, forms, and messages, but follow-up depended on whoever had a free moment. Many warm leads went cold before anyone replied.",
    solution:
      "We built an instant lead-capture and follow-up system that responds within seconds, qualifies the lead, and books appointments automatically with reminders to reduce no-shows.",
    results: [
      { stat: "2.3x", label: "More bookings" },
      { stat: "30 sec", label: "Avg. lead response" },
      { stat: "41%", label: "Fewer no-shows" },
    ],
    highlights: [
      "Automated lead follow-up across channels",
      "Increased booking conversion rates",
      "Reduced no-shows with automated reminders",
    ],
  },
];
