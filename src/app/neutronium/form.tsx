"use client";
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
function controls(form: HTMLFormElement) {
  return Array.from(form.elements).filter(
    (el): el is Control =>
      (el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement) &&
      !el.disabled &&
      !!el.name,
  );
}
export function httpsLinkError(value: string) {
  try {
    const url = new URL(value);
    if (
      value.length <= 2000 &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password
    )
      return "";
  } catch {}
  return "Use a complete HTTPS link without an embedded username or password (up to 2,000 characters).";
}

export function ValidatedForm({
  children,
  onSubmit,
  requiredMessages = {},
  ...props
}: ComponentProps<"form"> & { requiredMessages?: Record<string, string> }) {
  const ref = useRef<HTMLFormElement>(null);
  const id = useId();
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([]);
  useEffect(() => {
    const fields = ref.current ? controls(ref.current) : [];
    errors.forEach((error, i) => {
      const field = fields.find((el) => el.name === error.name);
      if (!field) return;
      field.setAttribute("aria-invalid", "true");
      field.setAttribute(
        "aria-describedby",
        [field.getAttribute("aria-describedby"), `${id}-${i}`]
          .filter(Boolean)
          .join(" "),
      );
    });
    return () => {
      fields.forEach((field) => {
        if (!errors.some((error) => error.name === field.name)) return;
        field.removeAttribute("aria-invalid");
        const describedBy = (field.getAttribute("aria-describedby") || "")
          .split(" ")
          .filter((part) => !part.startsWith(`${id}-`))
          .join(" ");
        if (describedBy) field.setAttribute("aria-describedby", describedBy);
        else field.removeAttribute("aria-describedby");
      });
    };
  }, [errors, id]);
  return (
    <form
      {...props}
      ref={ref}
      noValidate
      onInput={(e) => {
        const target = e.target as Control;
        setErrors((previous) =>
          previous.filter((error) => error.name !== target.name),
        );
        props.onInput?.(e);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        const fields = controls(e.currentTarget);
        const problems: typeof errors = [];
        for (const field of fields) {
          const label = field.labels?.[0]?.textContent?.trim() || field.name;
          const value = field.value;
          let message = "";
          if (field.required && !value.trim())
            message =
              requiredMessages[field.name] || `Enter ${label.toLowerCase()}.`;
          else if (field instanceof HTMLInputElement && value) {
            if (field.type === "email" && field.validity.typeMismatch)
              message =
                "Enter a valid email address, for example you@company.com.";
            else if (field.type === "url")
              message = httpsLinkError(value.trim());
            else if (field.minLength > 0 && value.length < field.minLength)
              message = `${label} needs at least ${field.minLength} characters.`;
            else if (field.maxLength > 0 && value.length > field.maxLength)
              message = `Keep ${label.toLowerCase()} to ${field.maxLength} characters or fewer.`;
            else if (!field.validity.valid)
              message = `Check ${label.toLowerCase()} and try again.`;
          }
          if (message) problems.push({ name: field.name, message });
        }
        setErrors(problems);
        if (problems.length)
          fields.find((field) => field.name === problems[0].name)?.focus();
        else onSubmit?.(e);
      }}
    >
      {!!errors.length && (
        <div className="nt-message nt-error nt-form-errors" role="alert">
          <strong>Please check these fields:</strong>
          <ul>
            {errors.map((error, i) => (
              <li key={error.name} id={`${id}-${i}`}>
                <button
                  type="button"
                  className="nt-link"
                  onClick={() => {
                    if (ref.current)
                      controls(ref.current)
                        .find((field) => field.name === error.name)
                        ?.focus();
                  }}
                >
                  {error.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {children}
    </form>
  );
}
