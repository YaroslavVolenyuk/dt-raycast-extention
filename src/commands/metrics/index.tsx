import { List, showToast, Toast } from "@raycast/api";
import { useMemo, useState } from "react";
import { useDynatraceRest } from "../../lib/api/useRest";
import { MOCK_METRICS } from "../../lib/api/mock.ts";
import { isMockMode } from "../../lib/devMode";
import { MetricData, TimeframeOptions, TimeframeKey, EntityTypes, EntityType } from "../../lib/types/metric";
import { MetricDetailAction } from "./metric-detail";

/**
 * Metrics Explorer — search and view Dynatrace metrics
 * Allows engineers to find metrics by name and view trends
 */
export default function MetricsCommand() {
  const [searchText, setSearchText] = useState("");
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeKey>("1h");
  const [selectedEntity, setSelectedEntity] = useState<EntityType>("service");

  // In mock mode, return static data
  const mockMetrics = useMemo(() => {
    return MOCK_METRICS;
  }, []);

  // For real API, this would fetch from Dynatrace
  // For now, we filter mock data by search
  const filteredMetrics = useMemo(() => {
    const search = searchText.toLowerCase();
    return mockMetrics.filter(
      (m) =>
        m.metric.displayName.toLowerCase().includes(search) ||
        m.metric.metricId.toLowerCase().includes(search)
    );
  }, [searchText, mockMetrics]);

  if (!isMockMode()) {
    // In real mode, would fetch from API
    // For now, show mock data
  }

  return (
    <List
      isLoading={false}
      searchBarPlaceholder="Search metrics (e.g., CPU, Memory, Response Time)..."
      onSearchTextChange={setSearchText}
      navigationTitle="Metrics Explorer"
      searchText={searchText}
      filtering={false}
    >
      <List.Section title={`Metrics (${filteredMetrics.length})`}>
        {filteredMetrics.length === 0 ? (
          <List.EmptyView title="No metrics found" description="Try a different search term" />
        ) : (
          filteredMetrics.map((metric) => (
            <List.Item
              key={metric.metric.metricId}
              title={metric.metric.displayName}
              subtitle={`${metric.currentValue?.toFixed(1) || "—"} ${metric.metric.unit}`}
              accessories={[
                {
                  text: `${metric.minValue?.toFixed(0) || "—"}–${metric.maxValue?.toFixed(0) || "—"}`,
                  tooltip: `Min–Max`,
                },
              ]}
              actions={
                <MetricDetailAction
                  metric={metric}
                  timeframe={selectedTimeframe}
                  entity={selectedEntity}
                />
              }
            />
          ))
        )}
      </List.Section>

      <List.Section title="Preset Metrics">
        <List.Item
          title="CPU Usage"
          subtitle="Quick access to common metrics"
          actions={
            <MetricDetailAction
              metric={mockMetrics[0]}
              timeframe={selectedTimeframe}
              entity={selectedEntity}
            />
          }
        />
        <List.Item
          title="Memory Usage"
          actions={
            <MetricDetailAction
              metric={mockMetrics[1]}
              timeframe={selectedTimeframe}
              entity={selectedEntity}
            />
          }
        />
        <List.Item
          title="Response Time"
          actions={
            <MetricDetailAction
              metric={mockMetrics[2]}
              timeframe={selectedTimeframe}
              entity={selectedEntity}
            />
          }
        />
        <List.Item
          title="Error Rate"
          actions={
            <MetricDetailAction
              metric={mockMetrics[3]}
              timeframe={selectedTimeframe}
              entity={selectedEntity}
            />
          }
        />
        <List.Item
          title="Throughput"
          actions={
            <MetricDetailAction
              metric={mockMetrics[4]}
              timeframe={selectedTimeframe}
              entity={selectedEntity}
            />
          }
        />
      </List.Section>
    </List>
  );
}
