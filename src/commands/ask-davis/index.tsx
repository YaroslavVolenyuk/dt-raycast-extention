// A3: Davis CoPilot — Ask Command
// Single-shot Q&A. Conversation history / entity context are intentionally not
// offered: the underlying API call does not send them (see lib/api/davis.ts).

import { Form, Action, ActionPanel, showToast, Toast, Detail, Icon, useNavigation, open } from "@raycast/api";
import { useState } from "react";
import { getActiveTenant } from "../../lib/tenants";
import { askDavis } from "../../lib/api/davis";
import type { DavisAnswer } from "../../lib/types/davis";

interface State {
  isLoading: boolean;
  answer: DavisAnswer | null;
  currentQuestion: string | null;
  error: string | null;
}

function isSafeSourceUrl(rawUrl: string | undefined): rawUrl is string {
  if (!rawUrl) return false;
  try {
    return new URL(rawUrl).protocol === "https:";
  } catch {
    return false;
  }
}

export default function AskDavisCommand() {
  const [state, setState] = useState<State>({
    isLoading: false,
    answer: null,
    currentQuestion: null,
    error: null,
  });

  const handleAsk = async (values: { question: string }) => {
    const question = values.question.trim();
    if (!question) {
      await showToast({ style: Toast.Style.Failure, title: "Error", message: "Please enter a question" });
      return;
    }

    setState({ ...state, isLoading: true, error: null, answer: null });

    try {
      const tenant = await getActiveTenant();
      if (!tenant) {
        throw new Error("No active tenant configured");
      }

      const result = await askDavis(tenant, question);

      setState({ isLoading: false, answer: result, currentQuestion: question, error: null });
    } catch (err) {
      let errorMessage = "Unknown error";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else if (err && typeof err === "object") {
        errorMessage = JSON.stringify(err);
      }

      setState({ isLoading: false, answer: null, currentQuestion: null, error: errorMessage });

      await showToast({ style: Toast.Style.Failure, title: "Error", message: errorMessage });
    }
  };

  if (state.answer) {
    return (
      <AskDavisAnswerView
        answer={state.answer}
        question={state.currentQuestion || ""}
        onAskAnother={() => setState({ isLoading: false, answer: null, currentQuestion: null, error: null })}
      />
    );
  }

  if (state.error) {
    return (
      <AskDavisErrorView
        error={state.error}
        onRetry={() => setState({ isLoading: false, answer: null, currentQuestion: null, error: null })}
      />
    );
  }

  return (
    <Form
      isLoading={state.isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Ask Davis" onSubmit={handleAsk} icon={Icon.Wand} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="question"
        title="Question"
        placeholder="e.g., What's wrong with order-service? or Are we having performance issues?"
      />

      <Form.Description text="Ask Davis a question about your Dynatrace environment. Each question is answered independently — follow-up context is not yet supported." />
    </Form>
  );
}

// ── Answer View ───────────────────────────────────────────────────────────────

interface AnswerViewProps {
  answer: DavisAnswer;
  question: string;
  onAskAnother: () => void;
}

function AskDavisAnswerView({ answer, question, onAskAnother }: AnswerViewProps) {
  const sources = answer.metadata?.sources ?? [];

  let markdown = `# Davis Answer\n\n${answer.text}`;

  if (sources.length > 0) {
    markdown += `\n\n---\n\n## Sources\n\n`;
    sources.forEach((source, index) => {
      markdown += `${index + 1}. **${source.title ?? "Source"}** (${source.type ?? "unknown"})`;
      if (isSafeSourceUrl(source.url)) {
        markdown += ` - [Open](${source.url})`;
      }
      markdown += `\n`;
    });
  }

  markdown += `\n\n---\n\n## Your Question\n\n${question}`;

  const openableSources = sources.filter((s) => isSafeSourceUrl(s.url));

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action title="Ask Another Question" icon={Icon.Message} onAction={onAskAnother} />
          {openableSources.length > 0 && (
            <ActionPanel.Submenu title="Open Source" icon={Icon.Link}>
              {openableSources.map((source, index) => (
                <Action
                  key={index}
                  title={source.title ?? `Source ${index + 1}`}
                  onAction={async () => {
                    // isSafeSourceUrl guarantees https
                    await open(source.url!);
                  }}
                />
              ))}
            </ActionPanel.Submenu>
          )}
          <Action.CopyToClipboard title="Copy Answer" content={answer.text} />
        </ActionPanel>
      }
    />
  );
}

// ── Error View ───────────────────────────────────────────────────────────────

interface ErrorViewProps {
  error: string;
  onRetry: () => void;
}

function AskDavisErrorView({ error, onRetry }: ErrorViewProps) {
  const { pop } = useNavigation();

  let errorMarkdown = `# Error\n\n❌ ${error}\n\n## Common Issues\n\n- **Davis CoPilot not available**: Your tenant may not have a Platform Subscription with Davis CoPilot enabled\n- **Rate limited**: Too many requests, please wait a moment and try again\n- **Network error**: Check your connection and tenant configuration`;

  if (error.includes("Davis CoPilot requires")) {
    errorMarkdown = `# Davis CoPilot Not Available\n\n❌ **${error}**\n\n## Solution\n\n1. Check that your Dynatrace tenant has a **Platform Subscription**\n2. Enable Davis CoPilot in your tenant: **Settings → Davis AI → CoPilot**\n3. Verify your OAuth credentials include scopes: \`davis-copilot:conversations:execute\`, \`davis-copilot:nl2dql:execute\`\n\n[Enable Davis CoPilot →](https://docs.dynatrace.com/docs/discover-dynatrace/platform/davis-ai/copilot/copilot-getting-started#enable-davis-copilot)`;
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
