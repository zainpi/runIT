"use client";

import { type ReactNode } from "react";

/* The Last Echo : Idle RPG parchment/wood theme — palette mirrors the redeem page:
   parch #f3e7c9/#e8d3a8/#fbf2dc · wood #6b4423/#8a5a2b/#3f2812 · ink #3a2410/#5a3a1c
   gold #c9a059/#d49a30 · green #5fa233/#7ab648/#36571f · red #d8584a/#6e1d16 */

export function Card({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border-[3px] border-[#5a3a1c] bg-gradient-to-b from-[#f3e7c9] to-[#e8d3a8] shadow-[inset_0_0_0_2px_#c9a059,0_6px_0_rgba(40,22,8,.18),0_12px_22px_rgba(40,22,8,.22)] ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-[#3f2812] bg-gradient-to-b from-[#8a5a2b] to-[#6b4423] px-4 py-2.5 shadow-[inset_0_2px_0_#a87b4c]">
          {title && (
            <h2 className="pixel text-lg !text-[#f3e7c9] [text-shadow:1px_1px_0_#2a1808]">
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border-[3px] border-[#c9a059] bg-[#fbf2dc] p-3.5 shadow-[0_4px_0_rgba(40,22,8,.15)]">
      <div className="text-[11px] uppercase tracking-wider text-[#7a5c36]">{label}</div>
      <div className="pixel mt-1 text-2xl text-[#3a2410]">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-[#5a4226]">{sub}</div>}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  kind = "primary",
  disabled,
  type = "button",
  small,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  small?: boolean;
}) {
  const base =
    "pixel inline-flex items-center justify-center rounded-xl border-[3px] transition active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0";
  const size = small ? "px-3 py-1 text-base" : "px-5 py-2 text-lg";
  const kinds = {
    primary:
      "border-[#36571f] bg-gradient-to-b from-[#7ab648] to-[#5fa233] text-[#0f2d09] shadow-[inset_0_2px_0_rgba(255,255,255,.4),0_3px_0_#36571f] hover:brightness-105",
    ghost:
      "border-[#8a5a2b] bg-gradient-to-b from-[#fbf2dc] to-[#e8d3a8] text-[#3a2410] shadow-[0_3px_0_#8a5a2b] hover:brightness-[1.03]",
    danger:
      "border-[#6e1d16] bg-gradient-to-b from-[#e06a5c] to-[#d8584a] text-[#3d0b06] shadow-[inset_0_2px_0_rgba(255,255,255,.3),0_3px_0_#6e1d16] hover:brightness-105",
  } as const;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${size} ${kinds[kind]}`}>
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border-[3px] border-[#8a5a2b] bg-[#fbf2dc] px-3 py-2 text-sm text-[#3a2410] placeholder:text-[#a08252] focus:border-[#d49a30] focus:shadow-[0_0_0_3px_rgba(212,154,48,.3)] focus:outline-none ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border-[3px] border-[#8a5a2b] bg-[#fbf2dc] px-3 py-2 text-sm text-[#3a2410] placeholder:text-[#a08252] focus:border-[#d49a30] focus:shadow-[0_0_0_3px_rgba(212,154,48,.3)] focus:outline-none ${props.className ?? ""}`}
    />
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "brand";
}) {
  const tones = {
    neutral: "bg-[#6b4423]/10 text-[#5a3a1c] border-[#6b4423]/40",
    good: "bg-[#5fa233]/15 text-[#2c5417] border-[#5fa233]",
    warn: "bg-[#d49a30]/20 text-[#7a5410] border-[#d49a30]",
    bad: "bg-[#d8584a]/15 text-[#8a2a20] border-[#d8584a]",
    brand: "bg-[#3f7a24]/10 text-[#3f7a24] border-[#3f7a24]/50",
  } as const;
  return (
    <span className={`inline-block rounded-full border-2 px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-[#6b4423]/40 text-xs uppercase tracking-wider text-[#6b4423]">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#6b4423]/10 text-[#4a3218]">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-xl border-2 border-[#d8584a] bg-[#d8584a]/10 px-3 py-2 text-sm text-[#8a2a20]">
      {error}
    </div>
  );
}

export function OkNote({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="rounded-xl border-2 border-[#5fa233] bg-[#5fa233]/15 px-3 py-2 text-sm text-[#2c5417]">
      {msg}
    </div>
  );
}

export function Spinner() {
  return <div className="pixel py-8 text-center text-lg text-[#7a5c36]">Loading…</div>;
}
