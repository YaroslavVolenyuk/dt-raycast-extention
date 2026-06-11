// src/commands/tenants/tenant-form.tsx
// Form for creating or editing a Dynatrace tenant configuration.

import { Form, ActionPanel, Action, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import { randomUUID } from "crypto";
import { saveTenant } from "../../lib/tenants";
import { validateTenantCredentials } from "../../lib/auth";
import type { TenantConfig } from "../../lib/auth";
import { assertHttps, isKnownDynatraceHost } from "../../lib/utils/urlSafety";

const DEFAULT_SSO = "https://sso.dynatrace.com/sso/oauth2/token";

const DEFAULT_SCOPES = [
  "storage:logs:read",
  "storage:problems:read",
  "storage:events:read",
  "storage:spans:read",
  "storage:metrics:read",
  "entity:read",
  "settings:objects:read",
  "settings:objects:write",
  "settings:schemas:read",
  "settings:objects:admin",
  "slo:read",
  "automation:workflows:read",
  "automation:workflows:write",
  "automation:workflows:execute",
  "davis:analyzers:read",
  "davis:analyzers:execute",
  "davis-copilot:conversations:execute",
  "davis-copilot:nl2dql:execute",
  "davis-copilot:dql2nl:execute",
  "davis-copilot:document-search:execute",
  "hub:catalog:read",
  "oauth2:clients:manage",
].join(" ");

interface Props {
  existing?: TenantConfig;
  onSave?: () => void;
}

export default function TenantForm({ existing, onSave }: Props) {
  const { pop } = useNavigation();
  const [nameError, setNameError] = useState<string | undefined>();
  const [endpointError, setEndpointError] = useState<string | undefined>();
  const [clientIdError, setClientIdError] = useState<string | undefined>();
  const [clientSecretError, setClientSecretError] = useState<string | undefined>();
  const [isValidating, setIsValidating] = useState(false);

  async function handleSubmit(values: {
    name: string;
    tenantEndpoint: string;
    clientId: string;
    clientSecret: string;
    ssoEndpoint: string;
    scopes: string;
    accountUrn: string;
    useClassicProxy: boolean;
  }) {
    // Basic validation
    let valid = true;
    if (!values.name.trim()) {
      setNameError("Name is required");
      valid = false;
    } else setNameError(undefined);

    if (!values.tenantEndpoint.trim()) {
      setEndpointError("Endpoint is required");
      valid = false;
    } else {
      try {
        assertHttps(values.tenantEndpoint.trim(), "Tenant Endpoint");
        setEndpointError(undefined);
      } catch (e) {
        setEndpointError(e instanceof Error ? e.message : "Invalid URL");
        valid = false;
      }
    }

    if (!values.clientId.trim()) {
      setClientIdError("Client ID is required");
      valid = false;
    } else if (!values.clientId.includes(".")) {
      setClientIdError("Invalid format. Should start with dt0s02.XXXXXXXX");
      valid = false;
    } else setClientIdError(undefined);

    if (!values.clientSecret.trim()) {
      setClientSecretError("Client Secret is required");
      valid = false;
    } else if (!values.clientSecret.includes(".") || values.clientSecret.length < 30) {
      setClientSecretError("Invalid format. Should be at least 30 chars with dots (dt0s02.XXXX.XXXXX...)");
      valid = false;
    } else setClientSecretError(undefined);

    if (!valid) return;

    // Warn (non-blocking) if endpoint is not a known Dynatrace host (Managed is OK)
    const endpointUrl = values.tenantEndpoint.trim();
    if (!isKnownDynatraceHost(endpointUrl)) {
      await showToast({
        style: Toast.Style.Animated,
        title: "Custom endpoint detected",
        message: "Credentials will be sent to a non-Dynatrace host. Proceed only if using Dynatrace Managed.",
      });
    }

    // Validate SSO endpoint HTTPS
    const ssoUrl = values.ssoEndpoint.trim() || DEFAULT_SSO;
    try {
      assertHttps(ssoUrl, "SSO Endpoint");
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Invalid SSO Endpoint",
        message: e instanceof Error ? e.message : "Invalid URL",
      });
      return;
    }

    const tenant: TenantConfig = {
      id: existing?.id ?? randomUUID(),
      name: values.name.trim(),
      tenantEndpoint: values.tenantEndpoint.trim().replace(/\/$/, ""),
      clientId: values.clientId.trim(),
      clientSecret: values.clientSecret.trim(),
      ssoEndpoint: values.ssoEndpoint.trim() || DEFAULT_SSO,
      scopes: values.scopes
        .split(/[\s\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      accountUrn: values.accountUrn.trim() || undefined,
      useClassicProxy: values.useClassicProxy,
    };

    try {
      // Validate credentials before saving
      setIsValidating(true);
      await showToast({ style: Toast.Style.Animated, title: "Validating credentials..." });

      const validation = await validateTenantCredentials(tenant);
      if (!validation.valid) {
        setIsValidating(false);
        await showToast({
          style: Toast.Style.Failure,
          title: "Validation Failed",
          message: validation.error,
        });
        return;
      }

      await saveTenant(tenant);
      setIsValidating(false);
      await showToast({ style: Toast.Style.Success, title: existing ? "Tenant updated" : "Tenant added" });
      onSave?.();
      pop();
    } catch (err) {
      setIsValidating(false);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save tenant",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <Form
      navigationTitle={existing ? "Edit Tenant" : "Add Tenant"}
      isLoading={isValidating}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isValidating ? "Validating…" : existing ? "Save Changes" : "Add Tenant"}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        placeholder="Production"
        defaultValue={existing?.name}
        error={nameError}
        onChange={() => setNameError(undefined)}
      />
      <Form.TextField
        id="tenantEndpoint"
        title="Tenant Endpoint"
        placeholder="https://abc123.live.dynatrace.com"
        defaultValue={existing?.tenantEndpoint}
        error={endpointError}
        onChange={() => setEndpointError(undefined)}
      />
      <Form.TextField
        id="clientId"
        title="Client ID"
        placeholder="dt0s02.XXXXXXXX"
        defaultValue={existing?.clientId}
        error={clientIdError}
        onChange={() => setClientIdError(undefined)}
      />
      <Form.PasswordField
        id="clientSecret"
        title="Client Secret"
        placeholder="dt0s02.XXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXX"
        defaultValue={existing?.clientSecret}
        error={clientSecretError}
        onChange={() => setClientSecretError(undefined)}
      />
      <Form.TextField
        id="ssoEndpoint"
        title="SSO Endpoint"
        placeholder={DEFAULT_SSO}
        defaultValue={existing?.ssoEndpoint ?? DEFAULT_SSO}
      />
      <Form.TextArea
        id="scopes"
        title="Scopes"
        placeholder={DEFAULT_SCOPES}
        defaultValue={existing?.scopes.join("\n") || DEFAULT_SCOPES.split(" ").join("\n")}
        info="One scope per line (or space-separated)"
      />
      <Form.TextField
        id="accountUrn"
        title="Account URN"
        placeholder="urn:dtaccount:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        defaultValue={existing?.accountUrn ?? ""}
        info="Optional: required for account-level OAuth clients"
      />
      <Form.Checkbox
        id="useClassicProxy"
        label="Use Classic API Proxy"
        defaultValue={existing?.useClassicProxy ?? true}
        info="Routes /api/v2/ calls through /platform/classic/environment-api/v2/ for OAuth. Disable if your environment returns 'REST endpoint is not available'."
      />
    </Form>
  );
}
