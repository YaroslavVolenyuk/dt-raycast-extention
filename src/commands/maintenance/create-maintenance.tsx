import React, { useState } from "react";
import { Form, Action, ActionPanel, showToast, Toast, useNavigation } from "@raycast/api";
import type { MaintenanceType, MaintenanceSuppression } from "../../lib/types/maintenance";
import { createMaintenanceWindow } from "../../lib/api/maintenance";
import { useTenant } from "../../hooks/useTenant";

interface CreateMaintenanceFormProps {
  onCreated: () => void;
}

type ScopeKind = "ENVIRONMENT" | "MANAGEMENT_ZONE" | "ENTITY";

function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export default function CreateMaintenanceForm({ onCreated }: CreateMaintenanceFormProps) {
  const { pop } = useNavigation();
  const { tenant } = useTenant();
  const [isLoading, setIsLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>("PLANNED");
  const [suppression, setSuppression] = useState<MaintenanceSuppression>("DETECT_PROBLEMS_DONT_ALERT");
  const [disableSynthetic, setDisableSynthetic] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date(Date.now() + 60 * 60 * 1000));
  const [scopeKind, setScopeKind] = useState<ScopeKind>("ENVIRONMENT");
  const [scopeValue, setScopeValue] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Name is required" });
      return;
    }
    if (!startDate || !endDate) {
      await showToast({ style: Toast.Style.Failure, title: "Start and end time are required" });
      return;
    }
    if (startDate >= endDate) {
      await showToast({ style: Toast.Style.Failure, title: "End time must be after start time" });
      return;
    }
    if (scopeKind !== "ENVIRONMENT" && !scopeValue.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Zone/Entity ID is required for the selected scope" });
      return;
    }
    if (!tenant) {
      await showToast({ style: Toast.Style.Failure, title: "No tenant configured" });
      return;
    }

    setIsLoading(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      await createMaintenanceWindow(tenant, {
        name: name.trim(),
        description: description.trim() || undefined,
        maintenanceType,
        suppression,
        disableSyntheticMonitorExecution: disableSynthetic,
        startTime: toLocalDateTimeString(startDate),
        endTime: toLocalDateTimeString(endDate),
        timeZone,
        entityId: scopeKind === "ENTITY" ? scopeValue.trim() : undefined,
        managementZone: scopeKind === "MANAGEMENT_ZONE" ? scopeValue.trim() : undefined,
      });

      await showToast({ style: Toast.Style.Success, title: "Maintenance window created", message: name });
      onCreated();
      pop();
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to create",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Name" placeholder="e.g., Database Upgrade" value={name} onChange={setName} />

      <Form.TextArea
        id="description"
        title="Description"
        placeholder="Optional details about this maintenance..."
        value={description}
        onChange={setDescription}
      />

      <Form.Dropdown
        id="maintenanceType"
        title="Type"
        value={maintenanceType}
        onChange={(v) => setMaintenanceType(v as MaintenanceType)}
      >
        <Form.Dropdown.Item value="PLANNED" title="Planned" />
        <Form.Dropdown.Item value="UNPLANNED" title="Unplanned" />
      </Form.Dropdown>

      <Form.Dropdown
        id="suppression"
        title="Suppression"
        info="How Davis treats problems during the window"
        value={suppression}
        onChange={(v) => setSuppression(v as MaintenanceSuppression)}
      >
        <Form.Dropdown.Item value="DETECT_PROBLEMS_AND_ALERT" title="Detect Problems and Alert" />
        <Form.Dropdown.Item value="DETECT_PROBLEMS_DONT_ALERT" title="Detect Problems, Don't Alert" />
        <Form.Dropdown.Item value="DONT_DETECT_PROBLEMS" title="Don't Detect Problems" />
      </Form.Dropdown>

      <Form.Checkbox
        id="disableSynthetic"
        label="Disable Synthetic Monitor Execution"
        value={disableSynthetic}
        onChange={setDisableSynthetic}
      />

      <Form.Separator />

      <Form.DatePicker id="startDate" title="Start" value={startDate} onChange={setStartDate} />
      <Form.DatePicker id="endDate" title="End" value={endDate} onChange={setEndDate} />

      <Form.Separator />

      <Form.Dropdown id="scopeKind" title="Scope" value={scopeKind} onChange={(v) => setScopeKind(v as ScopeKind)}>
        <Form.Dropdown.Item value="ENVIRONMENT" title="All Environment" />
        <Form.Dropdown.Item value="MANAGEMENT_ZONE" title="Management Zone" />
        <Form.Dropdown.Item value="ENTITY" title="Specific Entity" />
      </Form.Dropdown>

      {scopeKind !== "ENVIRONMENT" && (
        <Form.TextField
          id="scopeValue"
          title={scopeKind === "MANAGEMENT_ZONE" ? "Management Zone ID" : "Entity ID"}
          placeholder={scopeKind === "MANAGEMENT_ZONE" ? "e.g., 1234567890" : "e.g., SERVICE-ABC123"}
          value={scopeValue}
          onChange={setScopeValue}
        />
      )}
    </Form>
  );
}
