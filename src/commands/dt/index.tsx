// src/commands/dt/index.tsx
// Dynatrace hub command — shows all available commands with inline navigation.
// Set alias "dt" in Raycast preferences to invoke with just "dt".

import { List, Action, ActionPanel, Icon, Color, useNavigation } from "@raycast/api";

// Eager static imports — all command modules load when the hub opens
import SearchLogsCommand from "../search-logs/index";
import ProblemsCommand from "../problems/index";
import DeploymentsCommand from "../deployments/index";
import EntitiesCommand from "../entities/index";
import Nl2DqlCommand from "../nl2dql/index";
import AskDavisCommand from "../ask-davis/index";
import SloCommand from "../slo/index";
import DqlRunnerCommand from "../dql-runner/index";
import SavedQueriesCommand from "../saved-queries/index";
import TenantsCommand from "../tenants/index";
import SearchTracesCommand from "../traces/index";
import WorkflowsCommand from "../workflows/index";
import SettingsCommand from "../settings/index";

interface HubEntry {
  title: string;
  subtitle: string;
  icon: Icon;
  color: Color;
  keywords: string[];
  component: React.ReactNode;
}

const EMPTY_SEARCH_LOGS_ARGS = {
  arguments: { timeframeValue: "", timeframeUnit: "h" as const, query: "error" as const },
};

export default function DtHub() {
  const { push } = useNavigation();

  const entries: HubEntry[] = [
    {
      title: "Search Logs",
      subtitle: "dt-logs · Search Grail logs with DQL filters, full-text search, pagination",
      icon: Icon.MagnifyingGlass,
      color: Color.Blue,
      keywords: ["logs", "log", "search", "grail", "dql", "dt-logs"],
      component: <SearchLogsCommand {...EMPTY_SEARCH_LOGS_ARGS} />,
    },
    {
      title: "Convert to DQL (NL2DQL)",
      subtitle: "dt-nl2dql · Ask Davis to convert natural language to DQL queries",
      icon: Icon.MagicWand,
      color: Color.Magenta,
      keywords: ["nl2dql", "natural", "language", "davis", "copilot", "dql", "convert", "dt-nl2dql"],
      component: <Nl2DqlCommand />,
    },
    {
      title: "Ask Davis",
      subtitle: "dt-ask · Ask Davis AI questions about your environment with follow-ups",
      icon: Icon.ChatLines,
      color: Color.Purple,
      keywords: ["ask", "davis", "chat", "copilot", "questions", "ai", "diagnostic", "dt-ask"],
      component: <AskDavisCommand />,
    },
    {
      title: "SLO Dashboard",
      subtitle: "dt-slo · View all SLOs with compliance status and error budget",
      icon: Icon.Binoculars,
      color: Color.Green,
      keywords: ["slo", "objectives", "compliance", "error budget", "status", "dt-slo"],
      component: <SloCommand />,
    },
    {
      title: "Workflows",
      subtitle: "dt-workflows · View and execute automation workflows",
      icon: Icon.Gear,
      color: Color.Orange,
      keywords: ["workflows", "automation", "execute", "schedule", "event", "dt-workflows"],
      component: <WorkflowsCommand />,
    },
    {
      title: "Settings / Config",
      subtitle: "dt-settings · Search and configure alerting, zones, tags, ownership",
      icon: Icon.Sliders,
      color: Color.Purple,
      keywords: ["settings", "config", "alerting", "zones", "tags", "configuration", "dt-settings"],
      component: <SettingsCommand />,
    },
    {
      title: "Active Problems",
      subtitle: "dt-problems · Davis AI problems with severity and correlation actions",
      icon: Icon.XMarkCircle,
      color: Color.Red,
      keywords: ["problems", "alerts", "davis", "incidents", "dt-problems"],
      component: <ProblemsCommand />,
    },
    {
      title: "Search Traces",
      subtitle: "dt-traces · Distributed traces filtered by service, status, duration",
      icon: Icon.Link,
      color: Color.Orange,
      keywords: ["traces", "spans", "tracing", "distributed", "dt-traces"],
      component: <SearchTracesCommand />,
    },
    {
      title: "Recent Deployments",
      subtitle: "dt-deployments · Deployment events with incident correlation",
      icon: Icon.Upload,
      color: Color.Green,
      keywords: ["deployments", "deploy", "release", "events", "dt-deployments"],
      component: <DeploymentsCommand />,
    },
    {
      title: "Find Entity",
      subtitle: "dt-entities · Search services, hosts and process groups",
      icon: Icon.Globe,
      color: Color.Purple,
      keywords: ["entities", "entity", "service", "host", "process", "dt-entities"],
      component: <EntitiesCommand />,
    },
    {
      title: "Run DQL Query",
      subtitle: "dt-dql · Execute arbitrary DQL queries with dynamic result tables",
      icon: Icon.Code,
      color: Color.Yellow,
      keywords: ["dql", "query", "run", "custom", "dt-dql"],
      component: <DqlRunnerCommand />,
    },
    {
      title: "Saved DQL Queries",
      subtitle: "dt-saved · Personal library of saved DQL queries",
      icon: Icon.Bookmark,
      color: Color.Magenta,
      keywords: ["saved", "queries", "library", "favorites", "dt-saved"],
      component: <SavedQueriesCommand />,
    },
    {
      title: "Manage Tenants",
      subtitle: "dt-tenants · Add, edit and switch Dynatrace environments",
      icon: Icon.Building,
      color: Color.SecondaryText,
      keywords: ["tenants", "tenant", "manage", "oauth", "credentials", "dt-tenants"],
      component: <TenantsCommand />,
    },
  ];

  return (
    <List searchBarPlaceholder="Filter commands — logs, problems, traces, dql…">
      {entries.map((entry) => (
        <List.Item
          key={entry.title}
          icon={{ source: entry.icon, tintColor: entry.color }}
          title={entry.title}
          subtitle={entry.subtitle}
          keywords={entry.keywords}
          actions={
            <ActionPanel>
              <Action
                title={`Open ${entry.title}`}
                icon={{ source: entry.icon, tintColor: entry.color }}
                onAction={() => push(entry.component)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
