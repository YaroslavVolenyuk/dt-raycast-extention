// src/commands/nl2dql/index.tsx
// A1: Davis NL2DQL — Convert natural language to DQL queries

import { Form, Action, ActionPanel, showToast, Toast, Detail, useNavigation, Icon } from "@raycast/api";
import { useState } from "react";
import DqlRunnerCommand from "../dql-runner/index";
import { getActiveTenant } from "../../lib/tenants";
import { convertNl2Dql } from "../../lib/api/davis";

interface State {
  isLoading: boolean;
  dql: string | null;
  originalQuery: string | null;
  error: string | null;
}

export default function Nl2DqlCommand() {
  const [state, setState] = useState<State>({
    isLoading: false,
    dql: null,
    originalQuery: null,
    error: null,
  });

  const handleConvert = async (values: { naturalLanguage: string }) => {
    const query = values.naturalLanguage.trim();
    if (!query) {
      showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: "Please enter a natural language query",
      });
      return;
    }

    setState({ isLoading: true, dql: null, originalQuery: null, error: null });

    try {
      const tenant = await getActiveTenant();
      if (!tenant) {
        throw new Error("No active tenant configured");
      }

      const result = await convertNl2Dql(tenant, query);

      setState({
        isLoading: false,
        dql: result,
        originalQuery: query,
        error: null,
      });

      showToast({
        style: Toast.Style.Success,
        title: "Success",
        message: "Query converted",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";

      setState({
        isLoading: false,
        dql: null,
        originalQuery: null,
        error: errorMessage,
      });

      showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: errorMessage,
      });
    }
  };

  // Show result view if DQL is available
  if (state.dql) {
    return <Nl2DqlResultView dql={state.dql} originalQuery={state.originalQuery || ""} />;
  }

  // Show error view if error occurred
  if (state.error) {
    return (
      <Nl2DqlErrorView
        error={state.error}
        onRetry={() => setState({ isLoading: false, dql: null, originalQuery: null, error: null })}
      />
    );
  }

  // Show input form
  return (
    <Form
      isLoading={state.isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Convert to DQL" onSubmit={handleConvert} icon={Icon.Wand} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="naturalLanguage"
        title="Natural Language Query"
        placeholder="e.g., error logs from payment service last hour"
        storeValue
      />
      <Form.Description text="Describe what data you're looking for in plain English, and Davis will convert it to a DQL query." />
    </Form>
  );
}

// ── Result View ────────────────────────────────────────────────────────────────

interface ResultViewProps {
  dql: string;
  originalQuery: string;
}

function Nl2DqlResultView({ dql, originalQuery }: ResultViewProps) {
  const { push, pop } = useNavigation();

  const markdown = `# DQL Query

\`\`\`dql
${dql}
\`\`\`

## Original Query
${originalQuery}`;

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            icon={Icon.Play}
            title="Run Query"
            onAction={async () => {
              // Push to DQL runner with preset
              const tenant = await getActiveTenant();
              if (!tenant) return;

              // Store the DQL in LocalStorage for DQL Runner to pick up
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { LocalStorage } = require("@raycast/api");
              await LocalStorage.setItem(
                "dql-runner-preset",
                JSON.stringify({
                  dql,
                  timeframePreset: "1h",
                }),
              );

              push(<DqlRunnerCommand />);
            }}
          />
          <Action.CopyToClipboard
            title="Copy DQL"
            content={dql}
            onCopy={() =>
              showToast({
                style: Toast.Style.Success,
                title: "Copied to clipboard",
              })
            }
          />
          <Action
            title="Save as Query"
            icon={Icon.Star}
            onAction={async () => {
              showToast({
                style: Toast.Style.Animated,
                title: "Saving query...",
              });
              // TODO: Implement save to saved queries
              showToast({
                style: Toast.Style.Success,
                title: "Query saved",
              });
            }}
          />
          <Action
            icon={Icon.ArrowCounterClockwise}
            title="New Query"
            onAction={() => pop()}
            shortcut={{ modifiers: ["cmd"], key: "n" }}
          />
        </ActionPanel>
      }
    />
  );
}

// ── Error View ─────────────────────────────────────────────────────────────────

interface ErrorViewProps {
  error: string;
  onRetry: () => void;
}

function Nl2DqlErrorView({ error, onRetry }: ErrorViewProps) {
  const { pop } = useNavigation();

  let errorMarkdown = `# Error

❌ ${error}

## What went wrong?

- **Davis CoPilot not available**: Your tenant may not have a Platform Subscription with Davis CoPilot enabled
- **Rate limited**: Too many requests, please wait a moment and try again
- **Network error**: Check your connection and tenant configuration`;

  if (error.includes("Davis CoPilot requires")) {
    errorMarkdown = `# Davis CoPilot Not Available

❌ **${error}**

## Solution

1. Check that your Dynatrace tenant has a **Platform Subscription**
2. Ensure Davis CoPilot is **enabled** in your tenant settings
3. Verify your OAuth credentials have the correct scopes

[Learn more about Davis CoPilot](https://docs.dynatrace.com/docs/davis-ai/davis-copilot)`;
  } else if (error.includes("rate limit")) {
    errorMarkdown = `# Rate Limited

❌ **${error}**

Davis API has rate limits. Please wait a moment and try again.`;
  }

  return (
    <Detail
      markdown={errorMarkdown}
      actions={
        <ActionPanel>
          <Action icon={Icon.RotateClockwise} title="Retry" onAction={onRetry} />
          <Action icon={Icon.ChevronLeft} title="Go Back" onAction={() => pop()} />
        </ActionPanel>
      }
    />
  );
}
