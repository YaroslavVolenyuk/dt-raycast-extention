// DQL Runner — execute arbitrary DQL queries
import { Form, Action, ActionPanel, showToast, Toast, LocalStorage } from "@raycast/api";
import type { LaunchProps } from "@raycast/api";
import { useState, useEffect } from "react";
import { saveSavedQuery } from "../../lib/savedQueries";
import { useActiveTenant } from "../../lib/hooks/useActiveTenant";
import { StorageKeys } from "../../lib/storageKeys";
import { parseTimeframe, parseTimeExpression } from "../../lib/utils/parseTimeframe";
import QueryResultsView from "./query-results";

interface DqlPreset {
  dql: string;
  timeframePreset?: string;
}

interface FormValues {
  tenantId: string;
  dql: string;
  timeframePreset: string;
  customFrom?: string;
  customTo?: string;
  saveAsTemplate: boolean;
  templateName?: string;
}

interface FormState {
  timeframePreset: string;
  customFrom: string;
  customTo: string;
}

export default function DqlRunnerCommand(props: Partial<LaunchProps> = {}) {
  const { tenant: activeTenantObj, tenants: allTenants } = useActiveTenant();
  const [activeTenant, setActiveTenantState] = useState<string>("");
  const [dqlValue, setDqlValue] = useState<string>("");
  const [formState, setFormState] = useState<FormState>({ timeframePreset: "1h", customFrom: "-1h", customTo: "now" });
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    dql: string;
    timeframe?: { start: string; end: string };
  } | null>(null);

  useEffect(() => {
    if (activeTenantObj && !activeTenant) {
      setActiveTenantState(activeTenantObj.id);
    }
  }, [activeTenantObj, activeTenant]);

  useEffect(() => {
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
        if (storedPreset) await LocalStorage.removeItem(StorageKeys.dqlRunnerPreset);
      }
    });
  }, []);

  const handleSubmit = async (values: FormValues) => {
    setIsLoading(true);

    try {
      const tenant = allTenants.find((t) => t.id === values.tenantId);
      if (!tenant) {
        await showToast({ style: Toast.Style.Failure, title: "No Tenant Selected", message: "Please select a tenant" });
        return;
      }

      // Build timeframe
      let timeframe: { start: string; end: string } | undefined;
      if (values.timeframePreset === "custom") {
        const from = parseTimeExpression(formState.customFrom);
        const to = parseTimeExpression(formState.customTo);
        if (!from || !to) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Invalid timeframe",
            message: 'Use expressions like "-2h", "-30m", "now", or an ISO date.',
          });
          return;
        }
        timeframe = { start: from.toISOString(), end: to.toISOString() };
      } else {
        timeframe = parseTimeframe(values.timeframePreset);
      }

      // Save template if requested — run independently so save errors don't block the query
      if (values.saveAsTemplate) {
        const templateName =
          values.templateName?.trim() ||
          `Query - ${new Date().toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
        try {
          await saveSavedQuery({
            name: templateName,
            dql: values.dql,
            tenantId: values.tenantId || undefined,
            timeframe:
              values.timeframePreset === "custom" ? `${timeframe!.start}|${timeframe!.end}` : values.timeframePreset,
            isFavorite: false,
          });
          await showToast({ style: Toast.Style.Success, title: "Template saved", message: templateName });
        } catch (saveErr) {
          const msg = saveErr instanceof Error ? saveErr.message : "Unknown error";
          await showToast({ style: Toast.Style.Failure, title: "Failed to save template", message: msg });
        }
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

      <Form.Dropdown
        id="timeframePreset"
        title="Timeframe"
        value={formState.timeframePreset}
        onChange={(value) => setFormState((prev) => ({ ...prev, timeframePreset: value }))}
        storeValue
      >
        <Form.Dropdown.Section>
          <Form.Dropdown.Item value="custom" title="Custom range…" />
        </Form.Dropdown.Section>
        <Form.Dropdown.Section title="Relative">
          <Form.Dropdown.Item value="15m" title="Last 15 minutes" />
          <Form.Dropdown.Item value="30m" title="Last 30 minutes" />
          <Form.Dropdown.Item value="1h" title="Last 1 hour" />
          <Form.Dropdown.Item value="2h" title="Last 2 hours" />
          <Form.Dropdown.Item value="6h" title="Last 6 hours" />
          <Form.Dropdown.Item value="12h" title="Last 12 hours" />
          <Form.Dropdown.Item value="24h" title="Last 24 hours" />
          <Form.Dropdown.Item value="3d" title="Last 3 days" />
          <Form.Dropdown.Item value="7d" title="Last 7 days" />
        </Form.Dropdown.Section>
        <Form.Dropdown.Section title="Calendar">
          <Form.Dropdown.Item value="today" title="Today" />
          <Form.Dropdown.Item value="yesterday" title="Yesterday" />
        </Form.Dropdown.Section>
      </Form.Dropdown>

      {formState.timeframePreset === "custom" && (
        <>
          <Form.TextField
            id="customFrom"
            title="From"
            placeholder="-2h"
            value={formState.customFrom}
            onChange={(v) => setFormState((prev) => ({ ...prev, customFrom: v }))}
            info='Relative: "-30m", "-2h", "-3d" — or an ISO date'
          />
          <Form.TextField
            id="customTo"
            title="To"
            placeholder="now"
            value={formState.customTo}
            onChange={(v) => setFormState((prev) => ({ ...prev, customTo: v }))}
            info='"now" or an ISO date'
          />
        </>
      )}

      <Form.Separator />

      <Form.Checkbox id="saveAsTemplate" title="Save as Template" label="Reuse this query later" />
      <Form.TextField id="templateName" title="Template Name" placeholder="e.g. 'Auth Service Errors'" />
    </Form>
  );
}
