// System Status — health dashboard across problems and synthetics.
// Honesty rules:
//   - a failed data source renders "❌ Unavailable (reason)" — never a green checkmark
//   - problems come from Grail (same contract as dt-problems), not a second REST mapping
import { useCallback, useEffect, useState } from "react";
import { Detail, Action, ActionPanel, Icon, Keyboard, launchCommand, LaunchType } from "@raycast/api";
import { useTenant } from "../../hooks/useTenant";
import { executeDqlQueryValidated } from "../../lib/api/grail";
import { dynatraceRest } from "../../lib/api/rest";
import { isMockMode, simulateNetworkDelay } from "../../lib/devMode";
import { MOCK_PROBLEMS } from "../../lib/api/mock";
import { problemSchema, buildProblemsQuery, getProblemsTimeframe, Problem } from "../../lib/types/problem";
import { ExecutionStatus } from "../../lib/types/synthetic";
import type { SyntheticMonitorData } from "../../lib/types/synthetic";
import {
  SyntheticMonitorListResponseSchema,
  apiMonitorToSyntheticMonitorData,
  SYNTHETICS_PATH,
} from "../../lib/api/synthetics";
import {
  formatLastChecked,
  getDashboardSeverity,
  countAvailabilityProblems,
  countFailingMonitors,
} from "../../lib/types/status";

interface Section<T> {
  items: T[] | null;
  error: string | null;
}

interface StatusData {
  problems: Section<Problem>;
  synthetics: Section<SyntheticMonitorData>;
  lastChecked: number;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default function StatusCommand() {
  const { tenant } = useTenant();
  const [isLoading, setIsLoading] = useState(true);
  const [statusData, setStatusData] = useState<StatusData | null>(null);

  const loadStatusData = useCallback(async () => {
    if (!tenant) return;
    setIsLoading(true);

    const fetchProblems = async (): Promise<Section<Problem>> => {
      try {
        if (isMockMode()) {
          await simulateNetworkDelay(100, 300);
          return { items: MOCK_PROBLEMS, error: null };
        }
        const { records } = await executeDqlQueryValidated(tenant, buildProblemsQuery("OPEN"), problemSchema, {
          timeframe: getProblemsTimeframe(),
        });
        return { items: records, error: null };
      } catch (err) {
        return { items: null, error: errMessage(err) };
      }
    };

    const fetchSynthetics = async (): Promise<Section<SyntheticMonitorData>> => {
      try {
        const response = await dynatraceRest(tenant, SYNTHETICS_PATH, {
          schema: SyntheticMonitorListResponseSchema,
        });
        return { items: response.data.monitors.map(apiMonitorToSyntheticMonitorData), error: null };
      } catch (err) {
        return { items: null, error: errMessage(err) };
      }
    };

    const [problems, synthetics] = await Promise.all([fetchProblems(), fetchSynthetics()]);

    setStatusData({ problems, synthetics, lastChecked: Date.now() });
    setIsLoading(false);
  }, [tenant?.id]);

  useEffect(() => {
    if (tenant) {
      loadStatusData();
    }
  }, [tenant?.id, loadStatusData]);

  const buildMarkdown = (): string => {
    if (!statusData) return "Loading...";

    const severity = getDashboardSeverity({
      lastChecked: statusData.lastChecked,
      problems: statusData.problems.items,
      synthetics: statusData.synthetics.items,
    });

    const severityEmoji = { critical: "🔴", warning: "🟡", healthy: "🟢", unknown: "⚪" }[severity];
    const severityNote = severity === "unknown" ? " — some data sources unavailable" : "";

    let markdown = `# ${severityEmoji} System Status${severityNote}\n\n`;
    markdown += `**Last checked:** ${formatLastChecked(statusData.lastChecked)}\n\n`;

    // ── Problems ────────────────────────────────────────────────────────────
    markdown += `## 🚨 Problems\n\n`;
    if (statusData.problems.items !== null) {
      const problems = statusData.problems.items;
      const availability = countAvailabilityProblems(problems);
      const errors = problems.filter((p) => p["event.category"] === "ERROR").length;
      const total = problems.length;

      if (total === 0) {
        markdown += "✅ No open problems\n\n";
      } else {
        markdown += `${availability} availability • ${errors} error • ${total} total\n\n`;
        problems.slice(0, 5).forEach((p) => {
          const cat = p["event.category"];
          const icon = cat === "AVAILABILITY" ? "🔴" : cat === "ERROR" ? "🟠" : "🟡";
          markdown += `${icon} **${p["event.name"]}** (${cat})\n`;
        });
        if (total > 5) markdown += `\n_+ ${total - 5} more problems_\n`;
      }
    } else {
      markdown += `❌ Unavailable — ${statusData.problems.error}\n`;
    }
    markdown += "\n";

    // ── Synthetics ──────────────────────────────────────────────────────────
    markdown += `## 🔗 Synthetics\n\n`;
    if (statusData.synthetics.items !== null) {
      const monitors = statusData.synthetics.items;
      const failing = countFailingMonitors(monitors);
      const total = monitors.length;

      if (total === 0) {
        markdown += "No synthetic monitors configured\n";
      } else if (failing === 0) {
        markdown += `${total} monitors configured — no failures reported by the list API\n`;
      } else {
        markdown += `${failing} failing • ${total} total\n\n`;
        monitors
          .filter((m) => m.lastExecution && m.lastExecution.status !== ExecutionStatus.OK)
          .slice(0, 3)
          .forEach((m) => {
            markdown += `🔴 **${m.monitor.name}** (${m.monitor.type})\n`;
          });
        if (failing > 3) markdown += `\n_+ ${failing - 3} more monitors_\n`;
      }
    } else {
      markdown += `❌ Unavailable — ${statusData.synthetics.error}\n`;
    }

    return markdown;
  };

  return (
    <Detail
      isLoading={isLoading}
      markdown={buildMarkdown()}
      actions={
        <ActionPanel>
          <Action
            title="Refresh"
            onAction={loadStatusData}
            icon={Icon.RotateClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
          />
          <Action
            title="View All Problems"
            icon={Icon.Info}
            shortcut={{ modifiers: ["cmd"], key: "p" }}
            onAction={() => launchCommand({ name: "dt-problems", type: LaunchType.UserInitiated })}
          />
          <Action
            title="View All Synthetics"
            icon={Icon.Info}
            shortcut={{ modifiers: ["cmd"], key: "m" }}
            onAction={() => launchCommand({ name: "dt-synthetics", type: LaunchType.UserInitiated })}
          />
        </ActionPanel>
      }
    />
  );
}
