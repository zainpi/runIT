"use client";

import { useId, useState } from "react";
import type { Integration } from "@/lib/neutronium/model";
import { ValidatedForm } from "./form";
import { requestJson } from "./http";
import { Icon } from "./icons";

export function MicrosoftConnection({
  configured,
  features,
  integration,
  onError,
}: {
  configured: boolean;
  features: Record<string, { name: string; permissions: string[] }>;
  integration?: Integration;
  onError: (message: string) => void;
}) {
  const id = useId();
  const [ready, setReady] = useState(configured);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checked, setChecked] = useState(false);

  return (
    <ValidatedForm
      onSubmit={async (event) => {
        event.preventDefault();
        if (!ready || submitting) return;
        onError("");
        const form = new FormData(event.currentTarget);
        if (!form.getAll("features").length) {
          onError("Select at least one Microsoft feature to continue.");
          return;
        }
        setSubmitting(true);
        try {
          const result = await requestJson(
            "/neutronium/api/microsoft/connect",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenantId: String(form.get("tenantId") || "").trim(),
                features: form.getAll("features"),
              }),
            },
          );
          window.location.assign(result.url);
        } catch (error) {
          onError((error as Error).message);
          setSubmitting(false);
        }
      }}
    >
      {!ready && (
        <div className="nt-warning">
          <Icon name="permissions" />
          <div>
            <strong>Microsoft 365 connection needs server setup</strong>
            <p>
              Ask the Neutronium operator to finish configuring the Microsoft
              connection. Your tenant ID identifies your company, but the server
              also needs its own Microsoft application credentials.
            </p>
            <button
              type="button"
              className="nt-button"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                onError("");
                try {
                  const config = await requestJson("/neutronium/api/config");
                  setReady(config.microsoftConfigured === true);
                  setChecked(true);
                } catch (error) {
                  onError((error as Error).message);
                } finally {
                  setChecking(false);
                }
              }}
            >
              {checking ? "Checking setup…" : "Check setup again"}
            </button>
          </div>
        </div>
      )}
      {checked && (
        <p className="nt-subtle" role="status">
          {ready
            ? "Server setup is ready. Continue to Microsoft to verify your connection."
            : "Server setup is still incomplete. The Neutronium operator needs to finish it before you can continue."}
        </p>
      )}
      <p className="nt-subtle">
        Enter your company’s tenant ID, then sign in to Microsoft as an
        authorized tenant administrator to review and approve access. Neutronium
        verifies the connection before marking it connected.
      </p>
      <div className="nt-field">
        <label htmlFor={id}>Microsoft tenant ID</label>
        <input
          id={id}
          name="tenantId"
          required
          defaultValue={integration?.tenantId || ""}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          aria-describedby={`${id}-help`}
          autoCapitalize="none"
          spellCheck={false}
        />
        <small id={`${id}-help`}>
          Find it in Microsoft Entra admin center → Entra ID → Overview →
          Properties. Use the Tenant ID, not the Application (client) ID.{" "}
          <a
            className="nt-link"
            href="https://learn.microsoft.com/en-us/entra/fundamentals/how-to-find-tenant"
            target="_blank"
            rel="noreferrer"
          >
            How to find your tenant ID
          </a>
        </small>
      </div>
      <h3>Enable only the features you need</h3>
      <div className="nt-check-options">
        {Object.entries(features).map(([key, feature]) => (
          <label key={key}>
            <input
              type="checkbox"
              name="features"
              value={key}
              defaultChecked={
                integration?.status === "connected"
                  ? integration.features.includes(key)
                  : key === "inventory"
              }
            />
            <div>
              <strong>{feature.name}</strong>
              <small>{feature.permissions.join(", ")}</small>
            </div>
          </label>
        ))}
      </div>
      <div className="nt-warning">
        <Icon name="permissions" />
        <p>
          These choices control which features Neutronium can use. Microsoft’s
          consent screen includes all application permissions configured for
          Neutronium. Review that screen before approving access.
        </p>
      </div>
      <button className="nt-button nt-primary" disabled={!ready || submitting}>
        {submitting ? "Opening Microsoft…" : "Continue to Microsoft"}{" "}
        <Icon name="arrow" size={16} />
      </button>
    </ValidatedForm>
  );
}
