// P2-S1: DQL Runner — execute arbitrary DQL queries
import { Form, Action, ActionPanel, showToast, Toast } from "@raycast/api";
import { useState, useEffect } from "react";
import { getActiveTenant, setActiveTenant, listTenants } from "../../lib/tenants";
import type { TenantConfig } from "../../lib/auth";
import QueryResultsView from "./query-results";

interface FormValues {
  tenantId: string;
  dql: string;
  timeframePreset: string;
  timeframeCustomFrom?: string;
  timeframeCustomTo?: string;
  saveAsTemplate: boolean;
  templateName?: string;
}

export default function DqlRunnerCommand() {
  const [allTenants, setAllTenants] = useState<TenantConfig[]>([]);
  const [activeTenant, setActiveTenantState] = useState<string>("");

  useEffect(() => {
    Promise.all([getActiveTenant(), listTenants()]).then(([active, tenants]) => {
      setAllTenants(tenants);
      if (active) setActiveTenantState(active.id);
    });
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    dql: string;
    timeframe?: { start: string; end: string };
  } | null>(null);

  const handleSubmit = async (values: FormValues) => {
    setIsLoading(true);

    try {
      // Set the selected tenant as active
      if (values.tenantId) {
        await setActiveTenant(values.tenantId);
      }

      const tenant = allTenants.find((t) => t.id === values.tenantId);
      if (!tenant) {
        await showToast({
          style: Toast.Style.Failure,
          title: "No Tenant Selected",
          message: "Please select a tenant",
        });
        setIsLoading(false);
        return;
      }

      // Build timeframe from preset or custom
      let timeframe: { start: string; end: string } | undefined;
      if (values.timeframePreset !== "custom") {
        const now = new Date();
        const start = new Date();

        switch (values.timeframePreset) {
          case "15m":
            start.setMinutes(start.getMinutes() - 15);
            break;
          case "1h":
            start.setHours(start.getHours() - 1);
            break;
          case "4h":
            start.setHours(start.getHours() - 4);
            break;
          case "24h":
            start.setHours(start.getHours() - 24);
            break;
          case "7d":
            start.setDate(start.getDate() - 7);
            break;
        }

        timeframe = {
          start: start.toISOString(),
          end: now.toISOString(),
        };
      } else if (values.timeframeCustomFrom && values.timeframeCustomTo) {
        timeframe = {
          start: new Date(values.timeframeCustomFrom).toISOString(),
          end: new Date(values.timeframeCustomTo).toISOString(),
        };
      }

      // Set results to trigger view transition
      setResults({
        dql: values.dql,
        timeframe,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // If we have results, show the results view
  if (results) {
    return (
      <QueryResultsView
        dql={results.dql}
        timeframe={results.timeframe}
        onClose={() => setResults(null)}
      />
    );
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Run Query" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Execute a custom DQL query against your Dynatrace tenant" />

      {allTenants.length > 0 && (
        <Form.Dropdown
          id="tenantId"
          title="Tenant"
          value={activeTenant}
          onChange={setActiveTenantState}
          storeValue
        >
          {allTenants.map((t) => (
            <Form.Dropdown.Item key={t.id} value={t.id} title={t.displayName} />
          ))}
        </Form.Dropdown>
      )}

      <Form.TextArea
        id="dql"
        title="DQL Query"
        placeholder="fetch dt.entity.service | limit 10"
        defaultValue=""
        storeValue
      />

      <Form.Separator />

      <Form.Dropdown
        id="timeframePreset"
        title="Timeframe"
        defaultValue="1h"
        storeValue
      >
        <Form.Dropdown.Item value="15m" title="Last 15 minutes" />
        <Form.Dropdown.Item value="1h" title="Last hour" />
        <Form.Dropdown.Item value="4h" title="Last 4 hours" />
        <Form.Dropdown.Item value="24h" title="Last 24 hours" />
        <Form.Dropdown.Item value="7d" title="Last 7 days" />
        <Form.Dropdown.Item value="custom" title="Custom range" />
      </Form.Dropdown>

      <Form.DatePicker
        id="timeframeCustomFrom"
        title="From (custom)"
        storeValue
      />
      <Form.DatePicker id="timeframeCustomTo" title="To (custom)" storeValue />

      <Form.Separator />

      <Form.Checkbox
        id="saveAsTemplate"
        title="Save as Template"
        label="Save this query for later use"
        storeValue
      />
      <Form.TextField
        id="templateName"
        title="Template Name"
        placeholder="My custom query"
        storeValue
      />
    </Form>
  );
}
