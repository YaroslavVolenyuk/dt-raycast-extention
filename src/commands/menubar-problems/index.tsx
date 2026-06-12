// P2-S3: Menu Bar Problems — show open problem count in macOS menu bar
import { MenuBarExtra, Icon, Color, open } from "@raycast/api";
import { useDynatraceQuery } from "../../lib/query";
import { getActiveTenant } from "../../lib/tenants";
import type { Problem } from "../../lib/types/problem";
import { getProblemsTimeframe } from "../../lib/types/problem";
import type { TenantConfig } from "../../lib/auth";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";

export default function MenuBarProblems() {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const { execute } = useDynatraceQuery<Problem>();

  const fetchOpenProblems = async (): Promise<{
    count: number | string;
    problems: Problem[];
    failed: boolean;
  }> => {
    const activeTenant = await getActiveTenant();
    setTenant(activeTenant);

    if (!activeTenant) {
      return { count: 0, problems: [], failed: false };
    }

    // Fetch top 6 to detect if there are more than 5
    const dql = `fetch dt.davis.problems
      | filter event.status == "OPEN"
      | sort event.start desc
      | limit 6`;

    const results = await execute(dql, getProblemsTimeframe(), activeTenant);
    // execute() returns null on API failure — never report that as "all clear"
    if (results === null) return { count: 0, problems: [], failed: true };

    // Slice to top 5 for display, show "5+" if there are more
    const problems = results.slice(0, 5);
    const count = results.length > 5 ? "5+" : results.length;

    return {
      count,
      problems: (problems as Problem[]) || [],
      failed: false,
    };
  };

  const { data, isLoading, revalidate } = useCachedPromise(fetchOpenProblems, [], { keepPreviousData: true });

  const count = data?.count ?? 0;
  const problems = data?.problems ?? [];
  const countNum = typeof count === "string" ? 5 : (count as number);
  const countDisplay = typeof count === "string" ? count : String(count);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "AVAILABILITY":
        return Icon.CircleProgress;
      case "ERROR":
        return Icon.ExclamationMark;
      case "SLOWDOWN":
        return Icon.Clock;
      case "RESOURCE_CONTENTION":
        return Icon.ArrowRightCircle;
      case "CUSTOM_ALERT":
        return Icon.Bell;
      default:
        return Icon.QuestionMark;
    }
  };

  const getCategoryColor = (category: string): Color => {
    switch (category) {
      case "AVAILABILITY":
        return Color.Red;
      case "ERROR":
        return Color.Orange;
      case "SLOWDOWN":
        return Color.Yellow;
      case "RESOURCE_CONTENTION":
        return Color.Blue;
      case "CUSTOM_ALERT":
        return Color.Purple;
      default:
        return Color.SecondaryText;
    }
  };

  if (!tenant && !isLoading && countNum === 0) {
    return (
      <MenuBarExtra icon={{ source: "assets/dynatrace-icon.png" }} tooltip="No tenant configured">
        <MenuBarExtra.Item
          title="Configure Tenant"
          icon={Icon.Gear}
          onAction={async () => {
            try {
              await open("raycast://extensions/yaroslav_volenyuk/dynatrace-connector/dt-tenants");
            } catch {
              // Fallback
            }
          }}
        />
      </MenuBarExtra>
    );
  }

  const failed = data?.failed ?? false;

  // Choose icon and tint based on problem count / fetch health
  const getMenuBarIcon = () => {
    if (failed) {
      // API unreachable — never show the "all clear" checkmark
      return {
        source: Icon.WifiDisabled,
        tintColor: Color.Yellow,
      };
    }
    if (countNum > 0) {
      // Problems exist - use warning icon with red tint
      return {
        source: Icon.Warning,
        tintColor: Color.Red,
      };
    } else {
      // No problems - use checkmark icon with gray tint
      return {
        source: Icon.Checkmark,
        tintColor: Color.SecondaryText,
      };
    }
  };

  return (
    <MenuBarExtra
      icon={getMenuBarIcon()}
      title={countNum > 0 && !failed ? countDisplay : undefined}
      tooltip={failed ? "Dynatrace unreachable — problem status unknown" : `${countDisplay} open problems`}
      isLoading={isLoading}
    >
      {failed && (
        <MenuBarExtra.Item
          title="Dynatrace Unreachable"
          subtitle="Problem status unknown"
          icon={{ source: Icon.Warning, tintColor: Color.Yellow }}
          onAction={() => revalidate()}
        />
      )}
      {problems.length > 0 && (
        <>
          <MenuBarExtra.Section title="Top Problems">
            {problems.map((problem) => (
              <MenuBarExtra.Item
                key={problem["event.id"]}
                title={problem["event.name"]}
                subtitle={problem["event.category"]}
                icon={{
                  source: getCategoryIcon(problem["event.category"]),
                  tintColor: getCategoryColor(problem["event.category"]),
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
          await open("raycast://extensions/yaroslav_volenyuk/dynatrace-connector/dt-problems");
        }}
      />

      <MenuBarExtra.Item title="Refresh" icon={Icon.RotateClockwise} onAction={() => revalidate()} />
    </MenuBarExtra>
  );
}
