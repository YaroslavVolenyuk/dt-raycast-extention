import { MenuBarExtra, Icon, Color, launchCommand, LaunchType } from "@raycast/api";
import { useMemo, useEffect, useState } from "react";
import { getActiveTenant } from "../../lib/tenants";
import { useDynatraceRest } from "../../lib/api/useRest";
import { registerMock } from "../../lib/api/rest";
import { sloListResponseSchema } from "../../lib/types/slo";
import type { SLO, SloListResponse } from "../../lib/types/slo";
import type { TenantConfig } from "../../lib/auth";

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
 * Raycast refreshes this command every 5 minutes per package.json interval setting.
 */
export default function MenubarSloCommand() {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);

  useEffect(() => {
    registerMock("/api/v2/slo", { totalCount: MOCK_SLOS.length, slo: MOCK_SLOS });
    getActiveTenant().then(setTenant);
  }, []);

  const { data, revalidate } = useDynatraceRest<SloListResponse>(tenant ?? undefined, "/api/v2/slo", {
    schema: sloListResponseSchema,
    enabled: !!tenant,
  });

  const slos = data?.slo ?? [];

  const violatedSlos = useMemo(() => slos.filter((slo) => slo.compliance < slo.target), [slos]);

  const warningSlos = useMemo(
    () => slos.filter((slo) => slo.compliance >= slo.target && slo.compliance < slo.warning),
    [slos],
  );

  const getMenubarIcon = () => {
    if (violatedSlos.length > 0) return { source: Icon.XMarkCircle, tintColor: Color.Red };
    if (warningSlos.length > 0) return { source: Icon.ExclamationMark, tintColor: Color.Yellow };
    return { source: Icon.CheckCircle, tintColor: Color.Green };
  };

  const getTitle = (): string => {
    if (violatedSlos.length > 0) return `${violatedSlos.length}`;
    if (warningSlos.length > 0) return `${warningSlos.length}!`;
    return "✓";
  };

  return (
    <MenuBarExtra icon={getMenubarIcon()} title={getTitle()} tooltip="SLO Status">
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
          onAction={() => launchCommand({ name: "dt-slo", type: LaunchType.UserInitiated })}
        />
        <MenuBarExtra.Item title="Refresh" icon={Icon.ArrowClockwise} onAction={() => revalidate()} />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
