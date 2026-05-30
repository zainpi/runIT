"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FieldShell, Input, Textarea, Select } from "@/components/ui/Field";
import { CheckIcon } from "@/components/icons";

const revenueOptions = [
  "Under $10k / month",
  "$10k – $50k / month",
  "$50k – $250k / month",
  "$250k – $1M / month",
  "$1M+ / month",
  "Prefer not to say",
];

type Status = "idle" | "submitting" | "success" | "error";

type LeadFormProps = {
  /** Show the extended booking questionnaire fields. */
  variant?: "contact" | "booking";
};

export function LeadForm({ variant = "contact" }: LeadFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrors({});

    const form = event.currentTarget;
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        setErrors(json.errors ?? {});
        setStatus("error");
        return;
      }
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
      setErrors({ form: "Something went wrong. Please try again or email us." });
    }
  }

  if (status === "success") {
    return (
      <div className="surface flex flex-col items-center gap-4 p-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
          <CheckIcon className="h-7 w-7" />
        </span>
        <h3 className="text-2xl font-semibold text-white">Thanks — we got it!</h3>
        <p className="max-w-md text-slate-400">
          We&apos;ll review your details and get back to you within one business
          day to schedule your free strategy call.
        </p>
        <Button
          variant="secondary"
          type="button"
          onClick={() => setStatus("idle")}
        >
          Submit another response
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="surface flex flex-col gap-5 p-7 sm:p-8">
      {/* Honeypot field — hidden from humans, catches bots. */}
      <div className="absolute left-[-9999px]" aria-hidden>
        <label htmlFor="company_website">Company website</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell label="Name" htmlFor="name" required>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Jane Doe"
            aria-invalid={!!errors.name}
            required
          />
          {errors.name && <FieldError msg={errors.name} />}
        </FieldShell>

        <FieldShell label="Business Name" htmlFor="businessName">
          <Input
            id="businessName"
            name="businessName"
            type="text"
            autoComplete="organization"
            placeholder="Acme Inc."
          />
        </FieldShell>

        <FieldShell label="Email" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="jane@acme.com"
            aria-invalid={!!errors.email}
            required
          />
          {errors.email && <FieldError msg={errors.email} />}
        </FieldShell>

        <FieldShell label="Phone" htmlFor="phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+1 (555) 000-0000"
          />
        </FieldShell>
      </div>

      {variant === "booking" && (
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldShell label="Team size" htmlFor="teamSize">
            <Select id="teamSize" name="teamSize" defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              <option>Just me</option>
              <option>2–10</option>
              <option>11–50</option>
              <option>51–200</option>
              <option>200+</option>
            </Select>
          </FieldShell>
          <FieldShell label="Ideal timeline" htmlFor="timeline">
            <Select id="timeline" name="timeline" defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              <option>As soon as possible</option>
              <option>Within 1 month</option>
              <option>1–3 months</option>
              <option>Just exploring</option>
            </Select>
          </FieldShell>
        </div>
      )}

      <FieldShell
        label="Current Challenge"
        htmlFor="challenge"
        required
        hint="What's the most time-consuming or frustrating manual process in your business right now?"
      >
        <Textarea
          id="challenge"
          name="challenge"
          placeholder="e.g. We spend hours every week manually following up with leads and updating our CRM…"
          aria-invalid={!!errors.challenge}
          required
        />
        {errors.challenge && <FieldError msg={errors.challenge} />}
      </FieldShell>

      <FieldShell label="Estimated Monthly Revenue" htmlFor="revenue">
        <Select id="revenue" name="revenue" defaultValue="">
          <option value="" disabled>
            Select a range…
          </option>
          {revenueOptions.map((opt) => (
            <option key={opt}>{opt}</option>
          ))}
        </Select>
      </FieldShell>

      {variant === "booking" && (
        <FieldShell label="How did you hear about us?" htmlFor="source">
          <Input
            id="source"
            name="source"
            type="text"
            placeholder="Google, referral, social…"
          />
        </FieldShell>
      )}

      {errors.form && (
        <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-500/20">
          {errors.form}
        </p>
      )}

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="submit"
          size="lg"
          withArrow
          disabled={status === "submitting"}
        >
          {status === "submitting"
            ? "Sending…"
            : variant === "booking"
              ? "Request My Free Call"
              : "Send Message"}
        </Button>
        <p className="text-xs text-slate-500">
          We&apos;ll reply within one business day. No spam, ever.
        </p>
      </div>
    </form>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p role="alert" className="text-xs text-rose-300">
      {msg}
    </p>
  );
}
