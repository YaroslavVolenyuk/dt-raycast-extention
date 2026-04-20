// src/commands/tenants/tenant-form.tsx
// Form for creating or editing a Dynatrace tenant configuration.

import { Form, ActionPanel, Action, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import { saveTenant } from "../../lib/tenants";
import type { TenantConfig } from "../../lib/auth";

const DEFAULT_SSO = "https://sso.dynatrace.com/sso/oauth2/token";

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

  async function handleSubmit(values: {
    name: string;
    tenantEndpoint: string;
    clientId: string;
    clientSecret: string;
    ssoEndpoint: string;
    scopes: string;
    accountUrn: string;
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
    } else setEndpointError(undefined);

    if (!values.clientId.trim()) {
      setClientIdError("Client ID is required");
      valid = false;
    } else setClientIdError(undefined);

    if (!values.clientSecret.trim()) {
      setClientSecretError("Client Secret is required");
      valid = false;
    } else setClientSecretError(undefined);

    if (!valid) return;

    const tenant: TenantConfig = {
      id: existing?.id ?? crypto.randomUUID(),
      name: values.name.trim(),
      tenantEndpoint: values.tenantEndpoint.trim().replace(/\/$/, ""),
      clientId: values.clientId.trim(),
      clientSecret: values.clientSecret.trim(),
      ssoEndpoint: values.ssoEndpoint.trim() || DEFAULT_SSO,
      scopes: values.scopes
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean),
      accountUrn: values.accountUrn.trim() || undefined,
    };

    try {
      await saveTenant(tenant);
      await showToast({ style: Toast.Style.Success, title: existing ? "Tenant updated" : "Tenant added" });
      onSave?.();
      pop();
    } catch (err) {
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
      actions={
        <ActionPanel>
          <Action.SubmitForm title={existing ? "Save Changes" : "Add Tenant"} onSubmit={handleSubmit} />
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
      <Form.TextField
        id="scopes"
        title="Scopes"
        placeholder="storage:logs:read storage:problems:read entity:read"
        defaultValue={existing?.scopes.join(" ")}
        info="Space-separated list of OAuth scopes"
      />
      <Form.TextField
        id="accountUrn"
        title="Account URN"
        placeholder="urn:dtaccount:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        defaultValue={existing?.accountUrn ?? ""}
        info="Optional: required for account-level OAuth clients"
      />
    </Form>
  );
}
