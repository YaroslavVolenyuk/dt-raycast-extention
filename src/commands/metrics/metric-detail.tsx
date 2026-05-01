import { Action, ActionPanel, Detail } from "@raycast/api";
import { useMemo, useEffect, useState } from "react";
import { MetricData, TimeframeKey, EntityType, TimeframeOptions } from "../../lib/types/metric";
import {
  generateSparkline,
  getTrendIndicator,
  formatMetricValue,
  calculateAggregations,
} from "../../lib/utils/sparkline";
import { buildDeepLink } from "../../lib/utils/deepLinks";
import { getActiveTenant } from "../../lib/tenants";
import type { TenantConfig } from "../../lib/auth";

interface MetricDetailActionProps {
  metric: MetricData;
  timeframe: TimeframeKey;
  entity: EntityType;
}

/**
 * Action component that pushes to metric detail view
 */
export function MetricDetailAction({ metric, timeframe }: MetricDetailActionProps) {
  return (
    <ActionPanel>
      <Action.Push title="View Details" target={<MetricDetailView metric={metric} timeframe={timeframe} />} />
    </ActionPanel>
  );
}

/**
 * Metric detail view showing trends, aggregations, and sparkline
 */
export function MetricDetailView({
  metric,
  timeframe: initialTimeframe = "1h",
}: {
  metric: MetricData;
  timeframe?: TimeframeKey;
}) {
  const [timeframe] = useState<TimeframeKey>(initialTimeframe || "1h");
  const [tenant, setTenant] = useState<TenantConfig | null>(null);

  useEffect(() => {
    const loadTenant = async () => {
      const activeTenant = await getActiveTenant();
      setTenant(activeTenant);
    };
    loadTenant();
  }, []);

  const sparkline = useMemo(() => {
    if (!metric.dataPoints || metric.dataPoints.length === 0) {
      return "No data available";
    }
    const values = metric.dataPoints.map((p) => p.value);
    return generateSparkline(values);
  }, [metric.dataPoints]);

  const trend = useMemo(() => {
    if (!metric.dataPoints || metric.dataPoints.length === 0) {
      return { indicator: "→", change: 0, symbol: "⚫", label: "No data" };
    }
    const values = metric.dataPoints.map((p) => p.value);
    return getTrendIndicator(values);
  }, [metric.dataPoints]);

  const aggregations = useMemo(() => {
    if (!metric.dataPoints || metric.dataPoints.length === 0) {
      return { min: 0, max: 0, avg: 0, current: 0 };
    }
    const values = metric.dataPoints.map((p) => p.value);
    return calculateAggregations(values);
  }, [metric.dataPoints]);

  const formattedCurrent = useMemo(
    () => formatMetricValue(metric.currentValue || 0, metric.metric.unit),
    [metric.currentValue, metric.metric.unit],
  );
  const formattedMin = useMemo(
    () => formatMetricValue(aggregations.min, metric.metric.unit),
    [aggregations.min, metric.metric.unit],
  );
  const formattedMax = useMemo(
    () => formatMetricValue(aggregations.max, metric.metric.unit),
    [aggregations.max, metric.metric.unit],
  );
  const formattedAvg = useMemo(
    () => formatMetricValue(aggregations.avg, metric.metric.unit),
    [aggregations.avg, metric.metric.unit],
  );

  const markdown = useMemo(
    () => `# ${metric.metric.displayName}

**Current Value:** ${formattedCurrent}

## Trend
${trend.symbol} ${trend.indicator} ${Math.abs(trend.change)}% (${trend.label})

## Sparkline (Last ${TimeframeOptions[timeframe[0] as TimeframeKey].label.replace("Last ", "").toLowerCase()})
\`\`\`
${sparkline}
\`\`\`

## Statistics
| Metric | Value |
|--------|-------|
| **Minimum** | ${formattedMin} |
| **Maximum** | ${formattedMax} |
| **Average** | ${formattedAvg} |
| **Current** | ${formattedCurrent} |

## Details
- **ID:** \`${metric.metric.metricId}\`
- **Unit:** ${metric.metric.unit}
- **Description:** ${metric.metric.description || "N/A"}
- **Last Updated:** ${new Date(metric.lastUpdated).toLocaleString()}
- **Data Points:** ${metric.dataPoints?.length || 0}
`,
    [
      metric.metric.displayName,
      formattedCurrent,
      trend,
      sparkline,
      formattedMin,
      formattedMax,
      formattedAvg,
      metric.metric.metricId,
      metric.metric.unit,
      metric.metric.description,
      metric.lastUpdated,
      metric.dataPoints?.length,
    ],
  );

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Metric ID" content={metric.metric.metricId} />
          <Action.CopyToClipboard title="Copy Current Value" content={formattedCurrent} />
          {tenant && (
            <Action.OpenInBrowser
              title="Open in Dynatrace"
              url={buildDeepLink("entity", metric.metric.metricId, tenant)}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
