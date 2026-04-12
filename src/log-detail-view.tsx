// LogDetailView.tsx
import { Detail } from "@raycast/api";

export default function LogDetailView({ log }: { log: any }) {
  const markdown = `
# Log Content
\`\`\`
${log.content}
\`\`\`
  `;

  return (
    <Detail
      navigationTitle={`${log["service.name"]} - Log Detail`}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Status" text={log.status} />
          <Detail.Metadata.Label title="Service" text={log["service.name"]} />
          <Detail.Metadata.Label title="Host" text={log["dt.entity.host"]} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Timestamp" text={new Date(log.timestamp).toLocaleString()} />
        </Detail.Metadata>
      }
    />
  );
}
