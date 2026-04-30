import React, { useState, useEffect } from "react";
import {
  Detail,
  Action,
  ActionPanel,
  useNavigation,
  Icon,
  Keyboard,
  showToast,
  Toast,
} from "@raycast/api";
import { useTenant } from "../../hooks/useTenant";
import { dynatraceRest } from "../../lib/api/rest";
import {
  Problem,
  problemSchema,
} from "../../lib/types/problem";
import { SLO, sloSchema } from "../../lib/types/slo";
import {
  ExecutionStatus,
} from "../../lib/types/synthetic";
import type { SyntheticMonitorData } from "../../lib/types/synthetic";
import type { Deployment } from "../../lib/types/deployment";
import { formatLastChecked, getDashboardSeverity } from "../../lib/types/status";
import { buildDeepLink } from "../../lib/utils/deepLinks";

interface StatusData {
  problems: Problem[] | null;
  slos: SLO[] | null;
  synthetics: SyntheticMonitorData[] | null;
  deployments: Deployment[] | null;
  lastChecked: number;
}

export default function StatusCommand() {
  const { push } = useNavigation();
  const { tenant } = useTenant();
  const [isLoading, setIsLoading] = useState(true);
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatusData();
  }, []);

  const loadStatusData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load all data in parallel
      const results = await Promise.allSettled([
        dynatraceRest(
          {
            tenant,
            url: "/api/v2/problems",
            queryParams: { status: "OPEN" },
          },
          null,
        ).catch(() => ({ problems: [] })),
        dynatraceRest(
          {
            tenant,
            url: "/api/v2/slo",
          },
          null,
        ).catch(() => ({ slos: [] })),
        dynatraceRest(
          {
            tenant,
            url: "/api/v2/synthetic/monitors",
          },
          null,
        ).catch(() => ({ synthetics: [] })),
        dynatraceRest(
          {
            tenant,
            url: "/api/v2/deployments",
            queryParams: { pageSize: "3" },
          },
          null,
        ).catch(() => ({ deployments: [] })),
      ]);

      // Extract data from promises
      const [problemsResult, slosResult, syntheticsResult, deploymentsResult] = results;

      const data: StatusData = {
        problems:
          problemsResult.status === "fulfilled" && problemsResult.value?.problems
            ? problemsResult.value.problems
            : null,
        slos:
          slosResult.status === "fulfilled" && slosResult.value?.slos
            ? slosResult.value.slos
            : null,
        synthetics:
          syntheticsResult.status === "fulfilled" && syntheticsResult.value?.synthetics
            ? syntheticsResult.value.synthetics
            : null,
        deployments:
          deploymentsResult.status === "fulfilled" && deploymentsResult.value?.deployments
            ? deploymentsResult.value.deployments
            : null,
        lastChecked: Date.now(),
      };

      setStatusData(data);
    } catch (err) {
      setError(String(err));
      await showToast({
        style: Toast.Style.Error,
        title: "Failed to load status",
        message: String(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buildMarkdown = (): string => {
    if (!statusData) return "Loading...";

    const severity = getDashboardSeverity({
      lastChecked: statusData.lastChecked,
      problems: statusData.problems
        ? {
            total: statusData.problems.length,
            bySeverity: {
              CRITICAL: statusData.problems.filter((p) => p.severity === "CRITICAL").length,
              MAJOR: statusData.problems.filter((p) => p.severity === "MAJOR").length,
              MINOR: statusData.problems.filter((p) => p.severity === "MINOR").length,
              WARNING: statusData.problems.filter((p) => p.severity === "WARNING").length,
            },
            items: statusData.problems,
          }
        : null,
      slos: statusData.slos
        ? {
            total: statusData.slos.length,
            violated: statusData.slos.filter((s) => s.compliance < s.target).length,
            items: statusData.slos,
          }
        : null,
      synthetics: statusData.synthetics
        ? {
            total: statusData.synthetics.length,
            failing: statusData.synthetics.filter(
              (s) =>
                s.lastExecution?.status !== ExecutionStatus.OK &&
                s.lastExecution?.status !== undefined,
            ).length,
            items: statusData.synthetics,
          }
        : null,
      deployments: null,
    });

    const severityEmoji = {
      critical: "🔴",
      warning: "🟡",
      healthy: "🟢",
    }[severity];

    let markdown = `# ${severityEmoji} System Status\n\n`;
    markdown += `**Last checked:** ${formatLastChecked(statusData.lastChecked)}\n\n`;

    // Problems section
    if (statusData.problems !== null) {
      const critical = statusData.problems.filter((p) => p.severity === "CRITICAL").length;
      const major = statusData.problems.filter((p) => p.severity === "MAJOR").length;
      const total = statusData.problems.length;

      markdown += `## 🚨 Problems\n\n`;
      if (total === 0) {
        markdown += "✅ No open problems\n\n";
      } else {
        markdown += `${critical} critical • ${major} major • ${total} total\n\n`;
        statusData.problems.slice(0, 5).forEach((p) => {
          const icon = p.severity === "CRITICAL" ? "🔴" : p.severity === "MAJOR" ? "🟠" : "🟡";
          markdown += `${icon} **${p.title}** (${p.status})\n`;
        });
        if (total > 5) markdown += `\n_+ ${total - 5} more problems_\n`;
      }
      markdown += "\n";
    } else {
      markdown += `## 🚨 Problems\n\n❌ Unavailable\n\n`;
    }

    // SLOs section
    if (statusData.slos !== null) {
      const violated = statusData.slos.filter((s) => s.compliance < s.target).length;
      const total = statusData.slos.length;

      markdown += `## 📊 SLOs\n\n`;
      if (violated === 0) {
        markdown += `✅ All ${total} SLOs met\n\n`;
      } else {
        markdown += `${violated} violated • ${total} total\n\n`;
        statusData.slos
          .filter((s) => s.compliance < s.target)
          .slice(0, 3)
          .forEach((s) => {
            markdown += `⚠️ **${s.name}** (${Math.round(s.compliance)}% / ${s.target}% target)\n`;
          });
        if (violated > 3) markdown += `\n_+ ${violated - 3} more violations_\n`;
      }
      markdown += "\n";
    } else {
      markdown += `## 📊 SLOs\n\n❌ Unavailable\n\n`;
    }

    // Synthetics section
    if (statusData.synthetics !== null) {
      const failing = statusData.synthetics.filter(
        (s) => s.lastExecution?.status !== ExecutionStatus.OK && s.lastExecution,
      ).length;
      const total = statusData.synthetics.length;

      markdown += `## 🔗 Synthetics\n\n`;
      if (failing === 0) {
        markdown += `✅ All ${total} monitors up\n\n`;
      } else {
        markdown += `${failing} failing • ${total} total\n\n`;
        statusData.synthetics
          .filter((s) => s.lastExecution?.status !== ExecutionStatus.OK && s.lastExecution)
          .slice(0, 3)
          .forEach((s) => {
            markdown += `🔴 **${s.monitor.name}** (${s.monitor.type})\n`;
          });
        if (failing > 3) markdown += `\n_+ ${failing - 3} more monitors_\n`;
      }
      markdown += "\n";
    } else {
      markdown += `## 🔗 Synthetics\n\n❌ Unavailable\n\n`;
    }

    // Recent Deployments section
    if (statusData.deployments !== null && statusData.deployments.length > 0) {
      markdown += `## 🚀 Recent Deployments\n\n`;
      statusData.deployments.slice(0, 3).forEach((d) => {
        const icon = d.status === "success" ? "✅" : "❌";
        const time = new Date(d.timestamp).toLocaleString();
        markdown += `${icon} **${d.service}** v${d.version} (${time})\n`;
      });
    }

    return markdown;
  };

  if (error && !statusData) {
    return (
      <Detail
        markdown="# ⚠️ Failed to load status\n\nCheck your connection and try again."
        actions={
          <ActionPanel>
            <Action
              title="Retry"
              onAction={loadStatusData}
              icon={Icon.RotateClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
            />
          </ActionPanel>
        }
      />
    );
  }

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
          <Action.Push
            title="View All Problems"
            target={<span>Problems</span>}
            icon={Icon.Info}
            shortcut={{ modifiers: ["cmd"], key: "p" }}
          />
          <Action.Push
            title="View All SLOs"
            target={<span>SLOs</span>}
            icon={Icon.Info}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
          />
          <Action.Push
            title="View All Synthetics"
            target={<span>Synthetics</span>}
            icon={Icon.Info}
            shortcut={{ modifiers: ["cmd"], key: "m" }}
          />
        </ActionPanel>
      }
    />
  );
}
