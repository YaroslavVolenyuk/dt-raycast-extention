// DQL Runner — execute arbitrary DQL queries
import { Form, Action, ActionPanel, showToast, Toast, LocalStorage } from "@raycast/api";
import type { LaunchProps } from "@raycast/api";
import { useState, useEffect } from "react";
import { saveSavedQuery } from "../../lib/savedQueries";
import { useActiveTenant } from "../../lib/hooks/useActiveTenant";
import { StorageKeys } from "../../lib/storageKeys";
import QueryResultsView from "./query-results";

interface DqlPreset {
  dql: string;
  timeframePreset?: string;
  timeframeCustomFrom?: string;
  timeframeCustomTo?: string;
}

interface FormValues {
  tenantId: string;
  dql: string;
  timeframePreset: string;
  timeframeCustomFrom?: string;
  timeframeCustomTo?: string;
  saveAsTemplate: boolean;
  templateName?: string;
}

interface FormState {
  timeframePreset: string;
  customFrom?: Date;
  customTo?: Date;
}

export default function DqlRunnerCommand(props: Partial<LaunchProps> = {}) {
  const { tenant: activeTenantObj, tenants: allTenants } = useActiveTenant();
  const [activeTenant, setActiveTenantState] = useState<string>("");
  // Controlled DQL value — required so async preset actually populates the field
  const [dqlValue, setDqlValue] = useState<string>("");
  const [formState, setFormState] = useState<FormState>({ timeframePreset: "1h" });
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    dql: string;
    timeframe?: { start: string; end: string };
  } | null>(null);

  // Sync active tenant selection when hook resolves
  useEffect(() => {
    if (activeTenantObj && !activeTenant) {
      setActiveTenantState(activeTenantObj.id);
    }
  }, [activeTenantObj, activeTenant]);

  useEffect(() => {
    // Prefer preset from launchContext (B2 fix); fall back to LocalStorage for backward compat
    const contextPreset = (props.launchContext?.preset as DqlPreset | undefined) ?? null;

    LocalStorage.getItem(StorageKeys.dqlRunnerPreset).then(async (storedPreset) => {
      const preset: DqlPreset | null = contextPreset
        ? contextPreset
        : storedPreset
          ? (() => {
              try {
                return JSON.parse(String(storedPreset)) as DqlPreset;
              } catch {
                return null;
              }
            })()
          : null;

      if (preset) {
        setDqlValue(preset.dql || "");
        const timeframe = preset.timeframePreset || "1h";
        setFormState((prev) => ({ ...prev, timeframePreset: timeframe }));
        // Clean up LocalStorage preset after loading
        if (storedPreset) await LocalStorage.removeItem(StorageKeys.dqlRunnerPreset);
      }
    });
  }, []);

  const handleSubmit = async (values: FormValues) => {
    setIsLoading(true);

    try {
      // Use the selected tenant locally — do NOT write to tenants:active
      const tenant = allTenants.find((t) => t.id === values.tenantId);
      if (!tenant) {
        await showToast({ style: Toast.Style.Failure, title: "No Tenant Selected", message: "Please select a tenant" });
        return;
      }

      // Save template if requested
      if (values.saveAsTemplate && values.templateName?.trim()) {
        await saveSavedQuery({
          name: values.templateName.trim(),
          dql: values.dql,
          tenantId: values.tenantId || undefined,
          timeframe: values.timeframePreset ?? "",
          isFavorite: false,
        });
        await showToast({ style: Toast.Style.Success, title: "Template saved", message: values.templateName.trim() });
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
        timeframe = { start: start.toISOString(), end: now.toISOString() };
      } else if (formState.customFrom && formState.customTo) {
        timeframe = { start: formState.customFrom.toISOString(), end: formState.customTo.toISOString() };
      }

      setResults({ dql: values.dql, timeframe });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (results) {
    return <QueryResultsView dql={results.dql} timeframe={results.timeframe} onClose={() => setResults(null)} />;
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
      {allTenants.length > 0 && (
        <Form.Dropdown id="tenantId" title="Tenant" value={activeTenant} onChange={setActiveTenantState} storeValue>
          {allTenants.map((t) => (
            <Form.Dropdown.Item key={t.id} value={t.id} title={t.name} />
          ))}
        </Form.Dropdown>
      )}

      {allTenants.length > 0 && <Form.Separator />}

      <Form.Description text="Write your DQL query" />
      <Form.TextArea
        id="dql"
        title="Query"
        placeholder="fetch logs | filter dt.process.name == 'Service' | limit 100"
        value={dqlValue}
        onChange={setDqlValue}
      />

      <Form.Separator />

      <Form.Description text="Select timeframe for the query" />
      <Form.Dropdown
        id="timeframePreset"
        title="Timeframe"
        value={formState.timeframePreset}
        onChange={(value) => setFormState({ timeframePreset: value })}
        storeValue
      >
        <Form.Dropdown.Item value="15m" title="Last 15 minutes" />
        <Form.Dropdown.Item value="1h" title="Last hour" />
        <Form.Dropdown.Item value="4h" title="Last 4 hours" />
        <Form.Dropdown.Item value="24h" title="Last 24 hours" />
        <Form.Dropdown.Item value="7d" title="Last 7 days" />
        <Form.Dropdown.Item value="custom" title="Custom range" />
      </Form.Dropdown>

      {formState.timeframePreset === "custom" && (
        <>
          <Form.DatePicker
            id="timeframeCustomFrom"
            title="From"
            value={formState.customFrom}
            onChange={(date) => setFormState((prev) => ({ ...prev, customFrom: date ?? undefined }))}
          />
          <Form.DatePicker
            id="timeframeCustomTo"
            title="To"
            value={formState.customTo}
            onChange={(date) => setFormState((prev) => ({ ...prev, customTo: date ?? undefined }))}
          />
        </>
      )}

      <Form.Separator />

      <Form.Checkbox id="saveAsTemplate" title="Save as Template" label="Reuse this query later" />
      <Form.TextField id="templateName" title="Template Name" placeholder="e.g. 'Auth Service Errors'" />
    </Form>
  );
}
