// A3: Davis CoPilot — Ask Command
// Ask Davis questions with conversation history support

import { Form, Action, ActionPanel, showToast, Toast, Detail, Icon, useNavigation, open } from "@raycast/api";
import { useState } from "react";
import { getActiveTenant } from "../../lib/tenants";
import { askDavis } from "../../lib/api/davis";
import type { DavisAnswer, ConversationMessage } from "../../lib/types/davis";

interface State {
  isLoading: boolean;
  answer: DavisAnswer | null;
  currentQuestion: string | null;
  conversationHistory: ConversationMessage[];
  error: string | null;
}

export default function AskDavisCommand() {
  const [state, setState] = useState<State>({
    isLoading: false,
    answer: null,
    currentQuestion: null,
    conversationHistory: [],
    error: null,
  });

  const handleAsk = async (values: { question: string; entityContext?: string }) => {
    const question = values.question.trim();
    if (!question) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: "Please enter a question",
      });
      return;
    }

    setState({ ...state, isLoading: true, error: null, answer: null });

    try {
      const tenant = await getActiveTenant();
      if (!tenant) {
        throw new Error("No active tenant configured");
      }

      const context = values.entityContext
        ? {
            entityId: values.entityContext,
            entityType: "SERVICE" as const,
          }
        : undefined;

      const result = await askDavis(tenant, question, context, state.conversationHistory);

      // Add this exchange to conversation history
      const newHistory: ConversationMessage[] = [
        ...state.conversationHistory,
        { role: "user", content: question },
        { role: "assistant", content: result.text },
      ];

      setState({
        isLoading: false,
        answer: result,
        currentQuestion: question,
        conversationHistory: newHistory,
        error: null,
      });

      await showToast({
        style: Toast.Style.Success,
        title: "Success",
        message: "Got answer from Davis",
      });
    } catch (err) {
      let errorMessage = "Unknown error";
      if (err instanceof Error) {
        errorMessage = err.message;
        console.error(`[AskDavis] ${err.name}: ${err.message}`);
      } else if (typeof err === "string") {
        errorMessage = err;
      } else if (err && typeof err === "object") {
        errorMessage = JSON.stringify(err);
      }

      setState({
        isLoading: false,
        answer: null,
        currentQuestion: null,
        conversationHistory: state.conversationHistory,
        error: errorMessage,
      });

      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: errorMessage,
      });
    }
  };

  // Show answer view if we have a response
  if (state.answer) {
    return (
      <AskDavisAnswerView
        answer={state.answer}
        question={state.currentQuestion || ""}
        hasConversationHistory={state.conversationHistory.length > 2}
        onContinueConversation={() => {
          // Return to form for follow-up
          setState({
            ...state,
            answer: null,
            currentQuestion: null,
          });
        }}
        onClearConversation={() => {
          setState({
            isLoading: false,
            answer: null,
            currentQuestion: null,
            conversationHistory: [],
            error: null,
          });
        }}
      />
    );
  }

  // Show error view if error occurred
  if (state.error) {
    return (
      <AskDavisErrorView
        error={state.error}
        onRetry={() =>
          setState({
            isLoading: false,
            answer: null,
            currentQuestion: null,
            conversationHistory: state.conversationHistory,
            error: null,
          })
        }
      />
    );
  }

  // Show input form
  return (
    <Form
      isLoading={state.isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Ask Davis" onSubmit={handleAsk} icon={Icon.Wand} />
          {state.conversationHistory.length > 0 && (
            <Action
              title="Clear Conversation"
              icon={Icon.XMarkCircle}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["cmd"], key: "k" }}
              onAction={() => {
                setState({
                  isLoading: false,
                  answer: null,
                  currentQuestion: null,
                  conversationHistory: [],
                  error: null,
                });
              }}
            />
          )}
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="question"
        title="Question"
        placeholder="e.g., What's wrong with order-service? or Are we having performance issues?"
        storeValue
      />

      <Form.Dropdown
        id="entityContext"
        title="Entity Context (Optional)"
        placeholder="Select a service for context"
        storeValue
      >
        <Form.Dropdown.Item value="" title="None (All Services)" />
        <Form.Dropdown.Item value="order-service" title="Order Service" />
        <Form.Dropdown.Item value="payment-service" title="Payment Service" />
        <Form.Dropdown.Item value="api-gateway" title="API Gateway" />
        <Form.Dropdown.Item value="auth-service" title="Auth Service" />
        <Form.Dropdown.Item value="notification-service" title="Notification Service" />
      </Form.Dropdown>

      <Form.Description text="Ask me anything about your Dynatrace environment. You can ask follow-up questions within the same session." />

      {state.conversationHistory.length > 0 && (
        <>
          <Form.Separator />
          <Form.Description text={`Conversation history: ${state.conversationHistory.length} messages`} />
        </>
      )}
    </Form>
  );
}

// ── Answer View ───────────────────────────────────────────────────────────────

interface AnswerViewProps {
  answer: DavisAnswer;
  question: string;
  hasConversationHistory: boolean;
  onContinueConversation: () => void;
  onClearConversation: () => void;
}

function AskDavisAnswerView({
  answer,
  question,
  hasConversationHistory,
  onContinueConversation,
  onClearConversation,
}: AnswerViewProps) {
  const sources = answer.metadata?.sources ?? [];

  // Build markdown with sources
  let markdown = `# Davis Answer\n\n${answer.text}`;

  if (sources.length > 0) {
    markdown += `\n\n---\n\n## Sources\n\n`;
    sources.forEach((source, index) => {
      markdown += `${index + 1}. **${source.title ?? "Source"}** (${source.type ?? "unknown"})`;
      if (source.url) {
        markdown += ` - [Open](${source.url})`;
      }
      markdown += `\n`;
    });
  }

  markdown += `\n\n---\n\n## Your Question\n\n${question}`;

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action title="Ask Follow-Up Question" icon={Icon.Message} onAction={onContinueConversation} />
          {sources.length > 0 && (
            <ActionPanel.Submenu title="Open Source" icon={Icon.Link}>
              {sources.map((source, index) => {
                return (
                  <Action
                    key={index}
                    title={source.title ?? `Source ${index + 1}`}
                    onAction={async () => {
                      if (source.url) {
                        await open(source.url);
                      }
                    }}
                  />
                );
              })}
            </ActionPanel.Submenu>
          )}
          <Action title="New Conversation" icon={Icon.RotateClockwise} onAction={onClearConversation} />
          {hasConversationHistory && (
            <Action
              title="Clear Conversation"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              onAction={onClearConversation}
            />
          )}
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
