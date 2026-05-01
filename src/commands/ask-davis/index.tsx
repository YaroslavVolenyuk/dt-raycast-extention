// A3: Davis CoPilot — Ask Command
// Ask Davis questions with conversation history support

import { Form, Action, ActionPanel, showToast, Toast, Detail, Icon, useNavigation } from "@raycast/api";
import { useState } from "react";
import { getActiveTenant } from "../../lib/tenants";
import { askDavis } from "../../lib/api/davis";
import { buildDeepLink } from "../../lib/utils/deepLinks";
import type { DavisAnswer, ConversationMessage } from "../../lib/types/davis";
import type { DeepLinkType } from "../../lib/utils/deepLinks";

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

    console.log(`[AskDavis] Starting ask request...`);
    console.log(`[AskDavis] Question: ${question.substring(0, 100)}`);

    setState({ ...state, isLoading: true, error: null, answer: null });

    try {
      const tenant = await getActiveTenant();
      if (!tenant) {
        throw new Error("No active tenant configured");
      }

      console.log(`[AskDavis] Using tenant: ${tenant.name}`);
      console.log(`[AskDavis] Tenant endpoint: ${tenant.tenantEndpoint}`);
      console.log(`[AskDavis] Scopes count: ${tenant.scopes.length}`);
      console.log(`[AskDavis] Scopes:`);
      tenant.scopes.forEach((scope, idx) => {
        if (scope.includes("davis") || scope.includes("copilot")) {
          console.log(`[AskDavis]   ${idx + 1}. ${scope} ✓`);
        }
      });

      // Parse entity context if provided
      const context = values.entityContext
        ? {
            entityId: values.entityContext,
            entityType: "SERVICE" as const,
          }
        : undefined;

      // Ask Davis with conversation history
      console.log(`[AskDavis] Calling askDavis API...`);
      const result = await askDavis(tenant, question, context, state.conversationHistory);
      console.log(`[AskDavis] Success, got answer`);

      // Add this exchange to conversation history
      const newHistory: ConversationMessage[] = [
        ...state.conversationHistory,
        { role: "user", content: question },
        { role: "assistant", content: result.answer },
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
        console.error(`[AskDavis] Error: ${err.name} - ${err.message}`);
        console.error(`[AskDavis] Stack:`, err.stack?.substring(0, 300));
      } else if (typeof err === "string") {
        errorMessage = err;
        console.error(`[AskDavis] String error:`, err);
      } else if (err && typeof err === "object") {
        errorMessage = JSON.stringify(err);
        console.error(`[AskDavis] Object error:`, err);
      }

      console.error(`[AskDavis] Final error message:`, errorMessage);

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
  // Build markdown with sources
  let markdown = `# Davis Answer\n\n${answer.answer}`;

  if (answer.sources && answer.sources.length > 0) {
    markdown += `\n\n---\n\n## Sources\n\n`;
    answer.sources.forEach((source, index) => {
      markdown += `${index + 1}. **${source.title}** (${source.type})`;
      if (source.entityId) {
        markdown += ` - Entity: \`${source.entityId}\``;
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
          {answer.sources && answer.sources.length > 0 && (
            <ActionPanel.Submenu title="Open Source" icon={Icon.Link}>
              {answer.sources.map((source, index) => {
                // Map Davis source types to DeepLinkType
                const deepLinkTypeMap: Record<string, DeepLinkType> = {
                  METRIC: "metric",
                  PROBLEM: "problem",
                  TRACE: "trace",
                  EVENT: "deployment",
                  SERVICE: "entity",
                  HOST: "host",
                  LOG: "log-query",
                };

                const deepLinkType: DeepLinkType = deepLinkTypeMap[source.type ?? ""] || "entity";

                return (
                  <Action
                    key={index}
                    title={source.title}
                    onAction={async () => {
                      if (source.entityId) {
                        try {
                          const tenant = await getActiveTenant();
                          if (!tenant) {
                            await showToast({
                              style: Toast.Style.Failure,
                              title: "Error",
                              message: "No active tenant configured",
                            });
                            return;
                          }

                          const url = buildDeepLink(deepLinkType, source.entityId, tenant);
                          await showToast({
                            style: Toast.Style.Success,
                            title: "Deep Link Ready",
                            message: url,
                          });
                        } catch (err) {
                          const message = err instanceof Error ? err.message : "Failed to generate deep link";
                          await showToast({
                            style: Toast.Style.Failure,
                            title: "Error",
                            message,
                          });
                        }
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
    errorMarkdown = `# Davis CoPilot Not Available\n\n❌ **${error}**\n\n## Solution\n\n1. Check that your Dynatrace tenant has a **Platform Subscription**\n2. Ensure Davis CoPilot is **enabled** in your tenant settings\n3. Verify your OAuth credentials have the correct scopes\n\n[Learn more about Davis CoPilot](https://docs.dynatrace.com/docs/davis-ai/davis-copilot)`;
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
