"use client";
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { hasControlCharacters, isHttpsUrl } from "@/lib/neutronium/validation";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const fieldKey = (field: Control) => field.name || field.id;
function controls(form: HTMLFormElement) {
  return Array.from(form.elements).filter(
    (el): el is Control =>
      (el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement) &&
      !el.disabled &&
      el.willValidate,
  );
}
export function httpsLinkError(value: string) {
  if (isHttpsUrl(value)) return "";
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
      const field = fields.find((el) => fieldKey(el) === error.name);
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
        if (!errors.some((error) => error.name === fieldKey(field))) return;
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
          previous.filter((error) => error.name !== fieldKey(target)),
        );
        props.onInput?.(e);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if ((e.nativeEvent as SubmitEvent).submitter?.hasAttribute("disabled"))
          return;
        const submitButtons = Array.from(
          e.currentTarget.querySelectorAll<
            HTMLButtonElement | HTMLInputElement
          >('button:not([type]), button[type="submit"], input[type="submit"]'),
        );
        if (
          submitButtons.length &&
          submitButtons.every((button) => button.disabled)
        )
          return;
        const fields = controls(e.currentTarget);
        const problems: typeof errors = [];
        for (const field of fields) {
          const label =
            field.labels?.[0]?.textContent?.trim() ||
            field.name ||
            "this field";
          const value = field.value;
          let message = "";
          if (hasControlCharacters(value))
            message = `Remove unsupported control characters from ${label.toLowerCase()}.`;
          else if (
            field.validity.valueMissing ||
            (field.required && !value.trim())
          )
            message =
              requiredMessages[field.name] || `Enter ${label.toLowerCase()}.`;
          else if (value) {
            if (
              field instanceof HTMLInputElement &&
              field.type === "email" &&
              field.validity.typeMismatch
            )
              message =
                "Enter a valid email address, for example you@company.com.";
            else if (field instanceof HTMLInputElement && field.type === "url")
              message = httpsLinkError(value.trim());
            else if (
              "minLength" in field &&
              field.minLength > 0 &&
              value.length < field.minLength
            )
              message = `${label} needs at least ${field.minLength} characters.`;
            else if (
              "maxLength" in field &&
              field.maxLength > 0 &&
              value.length > field.maxLength
            )
              message = `Keep ${label.toLowerCase()} to ${field.maxLength} characters or fewer.`;
            else if (!field.validity.valid)
              message = `Check ${label.toLowerCase()} and try again.`;
          }
          if (
            message &&
            !problems.some((problem) => problem.name === fieldKey(field))
          )
            problems.push({ name: fieldKey(field), message });
        }
        setErrors(problems);
        if (problems.length)
          fields.find((field) => fieldKey(field) === problems[0].name)?.focus();
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
                        .find((field) => fieldKey(field) === error.name)
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
