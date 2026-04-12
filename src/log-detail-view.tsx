// log-detail-view.tsx
import { Detail, ActionPanel, Action } from "@raycast/api";
import { LogRecord } from "./types/log";

export default function LogDetailView({ log }: { log: LogRecord }) {
  const markdown = `
# Log Content
\`\`\`
${log.content ?? "No content available"}
\`\`\`
  `;

  const na = "N/A";

  return (
    <Detail
      navigationTitle={`${log["service.name"] ?? na} — ${log.loglevel ?? na}`}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard content={log.content ?? ""} title="Copy Log Content" />
          <Action.CopyToClipboard content={log.timestamp ?? ""} title="Copy Timestamp" />
        </ActionPanel>
      }
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Log Level" text={log.loglevel ?? na} />
          <Detail.Metadata.Label title="Status" text={log.status ?? na} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Service" text={log["service.name"] ?? na} />
          <Detail.Metadata.Label title="Host" text={log["dt.entity.host"] ?? na} />
          <Detail.Metadata.Label title="Log Source" text={log["log.source"] ?? na} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Timestamp" text={new Date(log.timestamp).toLocaleString()} />
        </Detail.Metadata>
      }
    />
  );
}
