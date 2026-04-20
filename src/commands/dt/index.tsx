import {
  List,
  Action,
  ActionPanel,
  Icon,
  Color,
  useNavigation,
} from "@raycast/api";

interface Command {
  name: string;
  title: string;
  description: string;
  icon: Icon;
  color?: Color;
  target: React.ReactNode;
}

export default function DtHub() {
  const { push } = useNavigation();

  const commands: Command[] = [
    {
      name: "search-logs",
      title: "Search Logs",
      description: "Search Dynatrace Grail logs with DQL filters, full-text search, and pagination",
      icon: Icon.MagnifyingGlass,
      color: Color.Blue,
      target: null, // Will open dt-search-logs command
    },
    {
      name: "problems",
      title: "Active Problems",
      description: "View active Davis AI problems with severity levels and correlations",
      icon: Icon.XMarkCircle,
      color: Color.Red,
      target: null,
    },
    {
      name: "deployments",
      title: "Recent Deployments",
      description: "Track recent deployment events and correlate with problems",
      icon: Icon.Upload,
      color: Color.Green,
      target: null,
    },
    {
      name: "entities",
      title: "Find Entity",
      description: "Search services, hosts, and process groups by name",
      icon: Icon.Globe,
      color: Color.Purple,
      target: null,
    },
    {
      name: "dql-runner",
      title: "Run DQL Query",
      description: "Execute custom DQL queries and explore results",
      icon: Icon.Code,
      color: Color.Orange,
      target: null,
    },
    {
      name: "saved-queries",
      title: "Saved DQL Queries",
      description: "Manage and run your saved DQL query library",
      icon: Icon.CheckCircle,
      color: Color.Yellow,
      target: null,
    },
    {
      name: "tenants",
      title: "Manage Tenants",
      description: "Add, edit, and switch between Dynatrace tenants",
      icon: Icon.Building,
      color: Color.Magenta,
      target: null,
    },
    {
      name: "menubar-problems",
      title: "Problems in Menu Bar",
      description: "Show open problem count in macOS menu bar (updates every 5 min)",
      icon: Icon.Bell,
      color: Color.Red,
      target: null,
    },
  ];

  return (
    <List searchBarPlaceholder="Filter Dynatrace commands...">
      {commands.map((cmd) => (
        <List.Item
          key={cmd.name}
          icon={{ source: cmd.icon, tintColor: cmd.color }}
          title={cmd.title}
          subtitle={cmd.description}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser
                title={`Open ${cmd.title}`}
                url={`raycast://extensions/dynatrace/dt-${cmd.name}`}
              />
              <Action.CopyToClipboard
                title="Copy Command Name"
                content={`dt-${cmd.name}`}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
