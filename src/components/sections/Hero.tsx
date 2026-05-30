"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ButtonLink } from "@/components/ui/Button";
import {
  BotIcon,
  WorkflowIcon,
  SyncIcon,
  SparklesIcon,
  ClockIcon,
  CheckIcon,
} from "@/components/icons";

const trustStats = [
  { value: "10–40+", label: "Hours saved / week" },
  { value: "24/7", label: "Always-on systems" },
  { value: "2–4 wks", label: "Typical go-live" },
];

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[120px]" />
        <div className="absolute right-[8%] top-[20%] h-[320px] w-[320px] rounded-full bg-accent-cyan/10 blur-[120px]" />
        <div className="absolute inset-0 bg-dotgrid opacity-60" />
      </div>

      <div className="container-page grid items-center gap-14 py-20 sm:py-28 lg:grid-cols-[1.05fr_0.95fr] lg:py-32">
        {/* Copy */}
        <div className="flex flex-col items-start gap-7">
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="eyebrow"
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            AI Automation Agency
          </motion.span>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Stop Wasting Time on{" "}
            <span className="text-gradient">Repetitive Work</span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="max-w-xl text-lg leading-relaxed text-slate-400"
          >
            We build AI-powered automation systems that streamline operations,
            eliminate manual tasks, and help your business scale without
            increasing overhead.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.19 }}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <ButtonLink href="/book" size="lg" withArrow>
              Book a Free Strategy Call
            </ButtonLink>
            <ButtonLink href="/services" size="lg" variant="secondary">
              See Our Solutions
            </ButtonLink>
          </motion.div>

          <motion.dl
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.26 }}
            className="mt-2 grid w-full max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6"
          >
            {trustStats.map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <dt className="text-2xl font-semibold text-white">{s.value}</dt>
                <dd className="text-xs leading-snug text-slate-500">
                  {s.label}
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* Visual */}
        <HeroVisual reduce={!!reduce} />
      </div>
    </section>
  );
}

function HeroVisual({ reduce }: { reduce: boolean }) {
  const nodes = [
    { icon: WorkflowIcon, label: "Trigger", sub: "New lead arrives" },
    { icon: BotIcon, label: "AI Agent", sub: "Qualifies & replies" },
    { icon: SyncIcon, label: "CRM Sync", sub: "Updates pipeline" },
  ];

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.96 }}
      animate={reduce ? undefined : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.15 }}
      className="relative mx-auto w-full max-w-md"
    >
      <div className="surface relative overflow-hidden p-6 shadow-card">
        {/* Header bar */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-emerald-400" />
            Automation live
          </span>
        </div>

        {/* Flow nodes */}
        <div className="flex flex-col gap-3">
          {nodes.map((node, i) => (
            <motion.div
              key={node.label}
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={reduce ? undefined : { opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.18 }}
              className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 text-brand-200 ring-1 ring-inset ring-brand-400/30">
                <node.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{node.label}</p>
                <p className="truncate text-xs text-slate-400">{node.sub}</p>
              </div>
              <CheckIcon className="ml-auto h-4 w-4 text-emerald-400" />
            </motion.div>
          ))}
        </div>

        {/* Result chip */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-brand-500/15 to-accent-cyan/10 p-4 ring-1 ring-inset ring-brand-400/20"
        >
          <div className="flex items-center gap-3">
            <ClockIcon className="h-5 w-5 text-accent-cyan" />
            <span className="text-sm text-slate-200">Time saved this week</span>
          </div>
          <span className="text-lg font-semibold text-white">+37 hrs</span>
        </motion.div>
      </div>

      {/* Floating accent card */}
      <motion.div
        aria-hidden
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-4 -top-5 hidden rounded-2xl border border-white/10 bg-ink-800/90 p-3.5 shadow-card backdrop-blur sm:block"
      >
        <p className="text-[11px] text-slate-400">Avg. lead response</p>
        <p className="text-lg font-semibold text-white">30 sec</p>
      </motion.div>
    </motion.div>
  );
}
