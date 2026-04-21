// P2-S3: Menu Bar Problems — show open problem count in macOS menu bar
import {
  MenuBarExtra,
  Icon,
  Color,
  Action,
  ActionPanel,
  Toast,
  open,
  showToast,
} from "@raycast/api";
import { useDynatraceQuery } from "../../lib/query";
import { getActiveTenant } from "../../lib/tenants";
import type { Problem } from "../../lib/types/problem";
import type { TenantConfig } from "../../lib/auth";
import { useCachedPromise } from "@raycast/utils";
import { useEffect, useState } from "react";

export default function MenuBarProblems() {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const { execute } = useDynatraceQuery<Problem>();

  const fetchOpenProblems = async (): Promise<{
    count: number | string;
    problems: Problem[];
  }> => {
    const activeTenant = await getActiveTenant();
    setTenant(activeTenant);

    if (!activeTenant) {
      return { count: 0, problems: [] };
    }

    // Fetch top 6 to detect if there are more than 5
    const dql = `fetch dt.davis.problems
      | filter event.status == "OPEN"
      | sort event.severity asc, event.start desc
      | limit 6`;

    const results = await execute(dql, undefined, activeTenant);
    if (!results) return { count: 0, problems: [] };

    // Slice to top 5 for display, show "5+" if there are more
    const problems = results.slice(0, 5);
    const count = results.length > 5 ? "5+" : results.length;

    return {
      count,
      problems: (problems as Problem[]) || [],
    };
  };

  const { data, isLoading, revalidate } = useCachedPromise(
    fetchOpenProblems,
    [],
    { keepPreviousData: true },
  );

  const count = data?.count ?? 0;
  const problems = data?.problems ?? [];
  const countNum = typeof count === "string" ? 5 : (count as number);
  const countDisplay = typeof count === "string" ? count : String(count);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "AVAILABILITY":
        return Icon.CircleProgressFull;
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
        return Color.Gray;
    }
  };

  if (!tenant && !isLoading && countNum === 0) {
    return (
      <MenuBarExtra
        icon={{ source: "assets/dynatrace-icon.png" }}
        tooltip="No tenant configured"
      >
        <MenuBarExtra.Item
          title="Configure Tenant"
          icon={Icon.Gear}
          onAction={async () => {
            try {
              await open("raycast://extensions/one-developer-corporation/dynatrace-connector/dt-tenants");
            } catch {
              // Fallback
            }
          }}
        />
      </MenuBarExtra>
    );
  }

  return (
    <MenuBarExtra
      icon={{
        source: "assets/dynatrace-icon.png",
        tintColor: countNum > 0 ? Color.Red : Color.Green,
      }}
      title={countNum > 0 ? countDisplay : undefined}
      tooltip={`${countDisplay} open problems`}
      isLoading={isLoading}
    >
      {problems.length > 0 && (
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
                    const url = `${tenant.tenantEndpoint}/ui/problems/${problem["event.id"]}`;
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
          await open("raycast://extensions/one-developer-corporation/dynatrace-connector/dt-problems");
        }}
      />

      <MenuBarExtra.Item
        title="Refresh"
        icon={Icon.RotateClockwise}
        onAction={() => revalidate()}
      />
    </MenuBarExtra>
  );
}
