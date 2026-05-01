// A4: SLO Dashboard — view all SLOs with compliance status and error budget
import { List, Action, ActionPanel, Icon, Color, useNavigation } from "@raycast/api";
import { useDynatraceRest } from "../../lib/api/useRest";
import { getActiveTenant } from "../../lib/tenants";
import type { TenantConfig } from "../../lib/auth";
import { sloListSchema } from "../../lib/types/slo";
import type { SLO } from "../../lib/types/slo";
import { registerMock } from "../../lib/api/rest";
import { useState, useEffect, useMemo } from "react";
import SloDetailView from "./slo-detail";

// Mock SLO data for development/testing
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
    metricDefinition:
      'fetch metrics | filter metric.name == "service.response_time" and dimension("service.name") == "payment-service"',
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
    metricDefinition:
      'fetch metrics | filter metric.name == "service.request_count" and dimension("service.name") == "api-gateway"',
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
    timeframe: "7d",
    enabled: true,
    metricDefinition:
      'fetch metrics | filter metric.name == "service.errors" and dimension("service.name") == "order-service"',
  },
  {
    id: "slo-auth-service-99.9",
    name: "Auth Service - 99.9%",
    description: "Authentication service SLO",
    target: 99.9,
    warning: 99.5,
    compliance: 99.88,
    errorBudgetRemaining: 8.7,
    evaluatedAt: new Date().toISOString(),
    timeframe: "7d",
    enabled: true,
    metricDefinition:
      'fetch metrics | filter metric.name == "service.response_time" and dimension("service.name") == "auth-service"',
  },
  {
    id: "slo-notification-99",
    name: "Notification Service - 99%",
    description: "Notification delivery SLO",
    target: 99.0,
    warning: 98.5,
    compliance: 99.2,
    errorBudgetRemaining: 18.5,
    evaluatedAt: new Date().toISOString(),
    timeframe: "30d",
    enabled: true,
    metricDefinition:
      'fetch metrics | filter metric.name == "service.request_count" and dimension("service.name") == "notification-service"',
  },
];

export default function SloCommand() {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);

  useEffect(() => {
    // Register mock data for SLOs
    registerMock("/api/v2/slo", MOCK_SLOS);
    getActiveTenant().then(setTenant);
  }, []);

  // Memoize options to prevent infinite re-fetch cycles
  const restOptions = useMemo(
    () => ({
      schema: sloListSchema,
      enabled: !!tenant,
    }),
    [tenant],
  );

  const {
    data: slos = [],
    isLoading,
    error,
    revalidate,
  } = useDynatraceRest<SLO[]>(tenant || undefined, "/api/v2/slo", restOptions);

  const { push } = useNavigation();

  const handleSelectSlo = (slo: SLO) => {
    push(<SloDetailView slo={slo} onRefresh={revalidate} />);
  };

  if (error) {
    return (
      <List>
        <List.EmptyView icon={Icon.Binoculars} title="Error" description={error} />
      </List>
    );
  }

  if (!slos || slos.length === 0) {
    return (
      <List isLoading={isLoading}>
        <List.EmptyView
          icon={Icon.Binoculars}
          title="No SLOs Found"
          description="No Service Level Objectives configured in this tenant"
        />
      </List>
    );
  }

  // Group SLOs by status
  const passing = slos.filter((s) => s.compliance >= s.target);
  const warning = slos.filter((s) => s.compliance >= s.warning && s.compliance < s.target);
  const failed = slos.filter((s) => s.compliance < s.warning);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search SLOs by name...">
      {failed.length > 0 && (
        <List.Section title="🔴 Critical (Below Warning)">
          {failed.map((slo) => (
            <SloListItem key={slo.id} slo={slo} onSelect={handleSelectSlo} />
          ))}
        </List.Section>
      )}

      {warning.length > 0 && (
        <List.Section title="🟡 Warning (Below Target)">
          {warning.map((slo) => (
            <SloListItem key={slo.id} slo={slo} onSelect={handleSelectSlo} />
          ))}
        </List.Section>
      )}

      {passing.length > 0 && (
        <List.Section title="🟢 Healthy (Target Met)">
          {passing.map((slo) => (
            <SloListItem key={slo.id} slo={slo} onSelect={handleSelectSlo} />
          ))}
        </List.Section>
      )}
    </List>
  );
}

interface SloListItemProps {
  slo: SLO;
  onSelect: (slo: SLO) => void;
}

function SloListItem({ slo, onSelect }: SloListItemProps) {
  // Determine status color
  const statusColor =
    slo.compliance >= slo.target ? Color.Green : slo.compliance >= slo.warning ? Color.Yellow : Color.Red;
  const statusIcon =
    slo.compliance >= slo.target ? Icon.Checkmark : slo.compliance >= slo.warning ? Icon.Warning : Icon.Binoculars;

  const errorBudgetText =
    slo.errorBudgetRemaining !== null && slo.errorBudgetRemaining !== undefined
      ? ` / ${slo.errorBudgetRemaining.toFixed(2)}% budget`
      : "";

  const accessories: Array<{
    tag?: { value: string; color: Color };
    text?: string;
    icon?: { source: Icon; tintColor?: Color };
  }> = [];

  // Add status icon
  accessories.push({
    icon: { source: statusIcon, tintColor: statusColor },
  });

  // Add compliance percentage
  accessories.push({
    tag: {
      value: `${slo.compliance.toFixed(2)}%`,
      color: statusColor,
    },
  });

  // Add target percentage
  accessories.push({
    text: `Target: ${slo.target.toFixed(2)}%`,
  });

  return (
    <List.Item
      title={slo.name}
      subtitle={`Timeframe: ${slo.timeframe}${errorBudgetText}`}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action title="View Details" icon={Icon.Eye} onAction={() => onSelect(slo)} />
        </ActionPanel>
      }
    />
  );
}
