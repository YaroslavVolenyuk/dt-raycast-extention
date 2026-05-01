import { MenuBarExtra, Icon, Color, showToast, Toast } from "@raycast/api";
import { useMemo, useEffect, useState } from "react";
import { getActiveTenant } from "../../lib/tenants";
import type { SLO } from "../../lib/types/slo";

// Mock SLO data
const MOCK_SLOS: SLO[] = [
  {
    id: "slo-payment-99.9",
    name: "Payment Service - 99.9%",
    description: "Payment processing service SLO",
    target: 99.9,
    warning: 99.5,
    compliance: 99.95,
    errorBudgetRemaining: 12.5,
    evaluatedAt: new Date().toISOString(),
    timeframe: "7d",
    enabled: true,
    metricDefinition: 'fetch metrics | filter metric.name == "service.response_time"',
  },
  {
    id: "slo-api-gateway-99",
    name: "API Gateway - 99%",
    description: "API Gateway availability SLO",
    target: 99.0,
    warning: 98.0,
    compliance: 98.5,
    errorBudgetRemaining: 35.2,
    evaluatedAt: new Date().toISOString(),
    timeframe: "30d",
    enabled: true,
    metricDefinition: 'fetch metrics | filter metric.name == "service.request_count"',
  },
  {
    id: "slo-order-service-99.5",
    name: "Order Service - 99.5%",
    description: "Order processing SLO",
    target: 99.5,
    warning: 99.0,
    compliance: 98.2,
    errorBudgetRemaining: -5.3,
    evaluatedAt: new Date().toISOString(),
    timeframe: "30d",
    enabled: true,
    metricDefinition: 'fetch metrics | filter metric.name == "order.processing_time"',
  },
  {
    id: "slo-user-service-99.9",
    name: "User Service - 99.9%",
    description: "User authentication SLO",
    target: 99.9,
    warning: 99.7,
    compliance: 99.92,
    errorBudgetRemaining: 8.5,
    evaluatedAt: new Date().toISOString(),
    timeframe: "7d",
    enabled: true,
    metricDefinition: 'fetch metrics | filter metric.name == "auth.success_rate"',
  },
  {
    id: "slo-search-99.5",
    name: "Search Service - 99.5%",
    description: "Search availability SLO",
    target: 99.5,
    warning: 99.0,
    compliance: 99.45,
    errorBudgetRemaining: 2.1,
    evaluatedAt: new Date().toISOString(),
    timeframe: "7d",
    enabled: true,
    metricDefinition: 'fetch metrics | filter metric.name == "search.latency"',
  },
];

/**
 * SLO Menubar — shows violated SLOs count in macOS menubar
 * Updates every 5 minutes and provides quick access to dashboard
 */
export default function MenubarSloCommand() {
  const [slos, setSlos] = useState<SLO[]>([]);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // In real mode, would fetch from API
        setSlos(MOCK_SLOS);
        await getActiveTenant();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to load SLOs",
          message: String(error),
        });
      }
    };

    loadData();

    // Refresh every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate violated SLOs
  const violatedSlos = useMemo(() => {
    return slos.filter((slo) => {
      const compliance = slo.compliance;
      const target = slo.target;

      // Failed if below target
      if (compliance < target) return true;
      return false;
    });
  }, [slos]);

  const warningSlos = useMemo(() => {
    return slos.filter((slo) => {
      const compliance = slo.compliance;
      const target = slo.target;
      const warning = slo.warning || target;

      // Warning if below warning threshold but above target
      if (compliance >= target && compliance < warning) return true;
      return false;
    });
  }, [slos]);

  // Determine icon and color
  const getMenubarIcon = () => {
    if (violatedSlos.length > 0) {
      return { source: Icon.XMarkCircle, tintColor: Color.Red };
    }
    if (warningSlos.length > 0) {
      return { source: Icon.ExclamationMark, tintColor: Color.Yellow };
    }
    return { source: Icon.CheckCircle, tintColor: Color.Green };
  };

  // Get menubar title
  const getTitle = (): string => {
    if (violatedSlos.length > 0) {
      return `${violatedSlos.length}`;
    }
    if (warningSlos.length > 0) {
      return `${warningSlos.length}!`;
    }
    return "✓";
  };

  const icon = getMenubarIcon();
  const title = getTitle();

  return (
    <MenuBarExtra icon={icon} title={title} tooltip="SLO Status">
      {violatedSlos.length > 0 && (
        <MenuBarExtra.Section title={`${violatedSlos.length} Violated`}>
          {violatedSlos.slice(0, 5).map((slo) => (
            <MenuBarExtra.Item
              key={slo.id}
              title={slo.name}
              subtitle={`${slo.compliance.toFixed(1)}% (target: ${slo.target}%)`}
              icon={{ source: Icon.XMarkCircle, tintColor: Color.Red }}
            />
          ))}
          {violatedSlos.length > 5 && <MenuBarExtra.Item title={`+${violatedSlos.length - 5} more`} />}
        </MenuBarExtra.Section>
      )}

      {warningSlos.length > 0 && (
        <MenuBarExtra.Section title={`${warningSlos.length} Warnings`}>
          {warningSlos.slice(0, 5).map((slo) => (
            <MenuBarExtra.Item
              key={slo.id}
              title={slo.name}
              subtitle={`${slo.compliance.toFixed(1)}% (warning: ${slo.warning || slo.target}%)`}
              icon={{ source: Icon.ExclamationMark, tintColor: Color.Yellow }}
            />
          ))}
          {warningSlos.length > 5 && <MenuBarExtra.Item title={`+${warningSlos.length - 5} more`} />}
        </MenuBarExtra.Section>
      )}

      {violatedSlos.length === 0 && warningSlos.length === 0 && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item
            title="All SLOs healthy"
            subtitle={`${slos.length} SLOs monitored`}
            icon={{ source: Icon.CheckCircle, tintColor: Color.Green }}
          />
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Open SLO Dashboard"
          subtitle="View full dashboard"
          icon={Icon.Binoculars}
          onAction={() => {
            // Would push to dt-slo command if in a navigation context
            // For menubar, we can only show toast or open browser
            showToast({
              style: Toast.Style.Success,
              title: "Opening SLO Dashboard",
              message: "Use 'dt slo' command in Raycast",
            });
          }}
        />
        <MenuBarExtra.Item
          title="Refresh"
          icon={Icon.ArrowClockwise}
          onAction={() => {
            // Manually refresh
            setTimeout(() => {
              setSlos(MOCK_SLOS);
            }, 500);
          }}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
