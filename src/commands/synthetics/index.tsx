import { List, Icon, Color } from "@raycast/api";
import { useMemo, useState } from "react";
import { SyntheticMonitorData, ExecutionStatus, MonitorType } from "../../lib/types/synthetic";
import { MonitorDetailAction } from "./monitor-detail";
import { useDynatraceRest } from "../../lib/api/useRest";
import { useTenant } from "../../hooks/useTenant";
import {
  SyntheticMonitorListResponseSchema,
  SyntheticMonitorListResponse,
  apiMonitorToSyntheticMonitorData,
  SYNTHETICS_PATH,
} from "../../lib/api/synthetics";

/**
 * Synthetic Monitors — list of monitors with configuration state.
 * The v2 list endpoint does not include availability or response times;
 * those are intentionally not displayed instead of being fabricated.
 */
export default function SyntheticsCommand() {
  const [searchText, setSearchText] = useState("");
  const [selectedType] = useState<MonitorType | "ALL">("ALL");
  const { tenant } = useTenant();

  const { data, isLoading, error } = useDynatraceRest<SyntheticMonitorListResponse>(
    tenant ?? undefined,
    SYNTHETICS_PATH,
    { schema: SyntheticMonitorListResponseSchema, enabled: !!tenant },
  );

  const allMonitors = useMemo(() => (data?.monitors ?? []).map(apiMonitorToSyntheticMonitorData), [data]);

  // Filter by search and type
  const filteredMonitors = useMemo(() => {
    const search = searchText.toLowerCase();
    return allMonitors.filter((m) => {
      const matchesSearch =
        m.monitor.name.toLowerCase().includes(search) || m.monitor.url.toLowerCase().includes(search);
      const matchesType = selectedType === "ALL" || m.monitor.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [searchText, selectedType, allMonitors]);

  // Group by type
  const groupedMonitors = useMemo(() => {
    const groups: { [key in MonitorType]: SyntheticMonitorData[] } = {
      [MonitorType.HTTP]: [],
      [MonitorType.BROWSER]: [],
      [MonitorType.THIRD_PARTY]: [],
    };

    filteredMonitors.forEach((m) => {
      groups[m.monitor.type].push(m);
    });

    return groups;
  }, [filteredMonitors]);

  const getStatusIcon = (status: ExecutionStatus | null): Icon => {
    switch (status) {
      case ExecutionStatus.OK:
        return Icon.CheckCircle;
      case ExecutionStatus.FAILED:
        return Icon.XMarkCircle;
      case ExecutionStatus.PARTIAL_FAILED:
        return Icon.CircleProgress50;
      case ExecutionStatus.TIMEOUT:
        return Icon.Hourglass;
      default:
        return Icon.Circle;
    }
  };

  const getStatusColor = (monitor: SyntheticMonitorData): Color => {
    if (monitor.lastExecution?.status === ExecutionStatus.FAILED) return Color.Red;
    if (!monitor.monitor.enabled) return Color.SecondaryText;
    return Color.Blue;
  };

  const renderMonitorGroup = (type: MonitorType, monitors: SyntheticMonitorData[]) => {
    if (monitors.length === 0) return null;

    return (
      <List.Section key={type} title={`${type} Monitors (${monitors.length})`}>
        {monitors.map((monitor) => {
          const status = monitor.lastExecution?.status ?? null;
          const subtitleParts = [
            monitor.monitor.url || undefined,
            monitor.availability != null ? `${monitor.availability.toFixed(1)}% available` : undefined,
          ].filter(Boolean);

          return (
            <List.Item
              key={monitor.monitor.monitorId}
              title={monitor.monitor.name}
              subtitle={subtitleParts.join(" · ") || undefined}
              icon={{
                source: getStatusIcon(status),
                tintColor: getStatusColor(monitor),
              }}
              accessories={[
                {
                  text: `${monitor.monitor.locations.length} locations`,
                  tooltip: monitor.monitor.locations.join(", "),
                },
                {
                  icon: monitor.monitor.enabled ? Icon.Eye : Icon.EyeDisabled,
                  tooltip: monitor.monitor.enabled ? "Enabled" : "Disabled",
                },
              ]}
              actions={<MonitorDetailAction monitor={monitor} />}
            />
          );
        })}
      </List.Section>
    );
  };

  if (error) {
    return (
      <List>
        <List.EmptyView icon={Icon.Binoculars} title="Error" description={error} />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search monitors (name, URL)..."
      onSearchTextChange={setSearchText}
      navigationTitle="Synthetic Monitors"
      searchText={searchText}
      filtering={false}
    >
      {filteredMonitors.length === 0 && !isLoading ? (
        <List.EmptyView title="No monitors found" description="Try a different search term" />
      ) : (
        <>
          {renderMonitorGroup(MonitorType.HTTP, groupedMonitors[MonitorType.HTTP])}
          {renderMonitorGroup(MonitorType.BROWSER, groupedMonitors[MonitorType.BROWSER])}
          {renderMonitorGroup(MonitorType.THIRD_PARTY, groupedMonitors[MonitorType.THIRD_PARTY])}
        </>
      )}
    </List>
  );
}
