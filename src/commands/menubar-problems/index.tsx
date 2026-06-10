// Menu Bar Problems — show open problem count in macOS menu bar
import { MenuBarExtra, Icon, Color, open, launchCommand, LaunchType, showToast, Toast } from "@raycast/api";
import { useDynatraceQuery } from "../../lib/query";
import { getActiveTenant } from "../../lib/tenants";
import type { Problem } from "../../lib/types/problem";
import { buildProblemsQuery } from "../../lib/types/problem";
import type { TenantConfig } from "../../lib/auth";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";

interface ProblemsResult {
  count: number | string;
  problems: Problem[];
  hasError: boolean;
}

export default function MenuBarProblems() {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const { execute } = useDynatraceQuery<Problem>();

  const fetchOpenProblems = async (): Promise<ProblemsResult> => {
    const activeTenant = await getActiveTenant();
    setTenant(activeTenant);

    if (!activeTenant) {
      return { count: 0, problems: [], hasError: false };
    }

    // Fetch top 6 to detect if there are more than 5
    const dql = buildProblemsQuery("OPEN", 6);

    const results = await execute(dql, undefined, activeTenant);
    // null means API error (execute already showed a toast); distinguish from empty []
    if (results === null) return { count: "?", problems: [], hasError: true };

    const problems = results.slice(0, 5);
    const count = results.length > 5 ? "5+" : results.length;

    return { count, problems: problems as Problem[], hasError: false };
  };

  const { data, isLoading, revalidate } = useCachedPromise(fetchOpenProblems, [], { keepPreviousData: true });

  const count = data?.count ?? 0;
  const problems = data?.problems ?? [];
  const hasError = data?.hasError ?? false;
  const countNum = typeof count === "string" ? 5 : (count as number);
  const countDisplay = typeof count === "string" ? String(count) : String(count);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "AVAILABILITY":
        return Icon.CircleProgress;
      case "ERROR":
        return Icon.ExclamationMark;
      case "PERFORMANCE":
        return Icon.Clock;
      case "RESOURCE_CONTENTION":
        return Icon.ArrowRightCircle;
      default:
        return Icon.QuestionMark;
    }
  };

  const getSeverityColor = (severity: string): Color => {
    switch (severity) {
      case "AVAILABILITY":
        return Color.Red;
      case "ERROR":
        return Color.Orange;
      case "PERFORMANCE":
        return Color.Yellow;
      case "RESOURCE_CONTENTION":
        return Color.Blue;
      default:
        return Color.SecondaryText;
    }
  };

  if (!tenant && !isLoading && countNum === 0 && !hasError) {
    return (
      <MenuBarExtra icon={{ source: "assets/dynatrace-icon.png" }} tooltip="No tenant configured">
        <MenuBarExtra.Item
          title="Configure Tenant"
          icon={Icon.Gear}
          onAction={async () => {
            try {
              await launchCommand({ name: "dt-tenants", type: LaunchType.UserInitiated });
            } catch {
              await showToast({ style: Toast.Style.Failure, title: "Cannot open Manage Tenants" });
            }
          }}
        />
      </MenuBarExtra>
    );
  }

  const getMenuBarIcon = () => {
    if (hasError) {
      return { source: Icon.Warning, tintColor: Color.Yellow };
    }
    if (countNum > 0) {
      return { source: Icon.Warning, tintColor: Color.Red };
    }
    return { source: Icon.Checkmark, tintColor: Color.SecondaryText };
  };

  const tooltipText = hasError ? "Can't reach Dynatrace — check Manage Tenants" : `${countDisplay} open problems`;

  return (
    <MenuBarExtra
      icon={getMenuBarIcon()}
      title={!hasError && countNum > 0 ? countDisplay : undefined}
      tooltip={tooltipText}
      isLoading={isLoading}
    >
      {hasError && (
        <MenuBarExtra.Item
          title="Can't reach Dynatrace"
          subtitle="Check Manage Tenants"
          icon={{ source: Icon.Warning, tintColor: Color.Yellow }}
          onAction={async () => {
            try {
              await launchCommand({ name: "dt-tenants", type: LaunchType.UserInitiated });
            } catch {
              await showToast({ style: Toast.Style.Failure, title: "Cannot open Manage Tenants" });
            }
          }}
        />
      )}

      {!hasError && problems.length > 0 && (
        <>
          <MenuBarExtra.Section title="Top Problems">
            {problems.map((problem, index) => (
              <MenuBarExtra.Item
                key={index}
                title={problem["event.name"]}
                subtitle={problem["event.severity"]}
                icon={{
                  source: getSeverityIcon(problem["event.severity"]),
                  tintColor: getSeverityColor(problem["event.severity"]),
                }}
                onAction={async () => {
                  if (tenant) {
                    const url = `${tenant.tenantEndpoint}/ui/problems/${encodeURIComponent(String(problem["event.id"] ?? ""))}`;
                    await open(url);
                  }
                }}
              />
            ))}
          </MenuBarExtra.Section>

          <MenuBarExtra.Separator />
        </>
      )}

      <MenuBarExtra.Separator />

      <MenuBarExtra.Item
        title="Open Active Problems"
        icon={Icon.ArrowRight}
        onAction={async () => {
          try {
            await launchCommand({ name: "dt-problems", type: LaunchType.UserInitiated });
          } catch {
            await showToast({ style: Toast.Style.Failure, title: "Cannot open Problems" });
          }
        }}
      />

      <MenuBarExtra.Item title="Refresh" icon={Icon.RotateClockwise} onAction={() => revalidate()} />
    </MenuBarExtra>
  );
}
