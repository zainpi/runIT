"use client";
import { useId, useRef, useState } from "react";
import { httpsLinkError } from "./form";

export function PasswordManagerLink({
  defaultValue = "",
}: {
  defaultValue?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function paste() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text)
        setError(
          "Your clipboard is empty. Create a link on password.link, copy it, then paste it here.",
        );
      else if (httpsLinkError(text))
        setError(
          "Copy the generated HTTPS link, then paste it here. This field is for a link, not the password itself.",
        );
      else {
        setValue(text);
        setMessage("Link pasted. Save the tester account to keep it.");
      }
    } catch {
      setError(
        "Clipboard access was blocked. Select the link field and paste with ⌘V on Mac or Ctrl+V on Windows.",
      );
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }
  return (
    <div className="nt-password-link">
      <label htmlFor={id}>Password manager link</label>
      <div className="nt-input-action">
        <input
          ref={input}
          id={id}
          name="credentialUrl"
          type="url"
          maxLength={2000}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
            setMessage("");
          }}
          aria-describedby={`${id}-help ${id}-feedback`}
          placeholder="Paste your generated link here"
        />
        <button
          type="button"
          className="nt-button"
          disabled={busy}
          onClick={() => void paste()}
        >
          {busy ? "Pasting…" : "Paste"}
        </button>
      </div>
      <p id={`${id}-help`}>
        <a
          href="https://password.link/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Create a link on password.link ↗
        </a>{" "}
        then copy and paste it here. One-time links expire after they’re opened.
      </p>
      <div id={`${id}-feedback`}>
        {error && (
          <p className="nt-message nt-error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </div>
  );
}
