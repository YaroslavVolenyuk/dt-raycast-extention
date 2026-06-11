import React, { useState } from "react";
import { Form, Action, ActionPanel, showToast, Toast, useNavigation } from "@raycast/api";
import { MaintenanceWindowType, MaintenanceScopeType } from "../../lib/types/maintenance";
import { useTenant } from "../../hooks/useTenant";
import { dynatraceRest } from "../../lib/api/rest";

interface CreateMaintenanceFormProps {
  onCreated: () => void;
}

export default function CreateMaintenanceForm({ onCreated }: CreateMaintenanceFormProps) {
  const { pop } = useNavigation();
  const { tenant } = useTenant();
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    type: MaintenanceWindowType.ONE_TIME,
    scopeType: MaintenanceScopeType.ENVIRONMENT,
    scopeValue: "",
    suppressAlerting: true,
    suppressProblems: false,
    startDate: new Date().toISOString().split("T")[0],
    startTime: "02:00",
    endDate: new Date().toISOString().split("T")[0],
    endTime: "03:00",
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Name is required",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Parse dates and times
      const startDateTime = new Date(`${form.startDate}T${form.startTime}`);
      const endDateTime = new Date(`${form.endDate}T${form.endTime}`);

      if (startDateTime >= endDateTime) {
        await showToast({
          style: Toast.Style.Failure,
          title: "End time must be after start time",
        });
        return;
      }

      // Create maintenance window object
      const payload = {
        type: "application/json",
        value: {
          name: form.name,
          description: form.description,
          type: form.type,
          startTime: startDateTime.getTime(),
          endTime: endDateTime.getTime(),
          suppressAlertingEnabled: form.suppressAlerting,
          suppressProblemsEnabled: form.suppressProblems,
          scope:
            form.scopeType !== MaintenanceScopeType.ENVIRONMENT
              ? {
                  type: form.scopeType,
                  value: form.scopeValue,
                }
              : undefined,
        },
      };

      // POST request to create maintenance window
      if (!tenant) {
        throw new Error("No tenant configured");
      }
      await dynatraceRest(tenant, "/api/v2/settings/objects", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await showToast({
        style: Toast.Style.Success,
        title: "Maintenance window created",
        message: form.name,
      });

      onCreated();
      pop();
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to create",
        message: String(err),
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
      <Form.TextField
        id="name"
        title="Name"
        placeholder="e.g., Database Upgrade"
        value={form.name}
        onChange={(name) => setForm({ ...form, name })}
      />

      <Form.TextArea
        id="description"
        title="Description"
        placeholder="Optional details about this maintenance..."
        value={form.description}
        onChange={(description) => setForm({ ...form, description })}
      />

      <Form.Dropdown
        id="type"
        title="Type"
        value={form.type}
        onChange={(type) => setForm({ ...form, type: type as MaintenanceWindowType })}
      >
        <Form.Dropdown.Item value={MaintenanceWindowType.ONE_TIME} title="One Time" />
        <Form.Dropdown.Item value={MaintenanceWindowType.PLANNED} title="Planned" />
        <Form.Dropdown.Item value={MaintenanceWindowType.RECURRING} title="Recurring" />
      </Form.Dropdown>

      <Form.Separator />

      <Form.TextField
        id="startDate"
        title="Start Date"
        value={form.startDate}
        onChange={(startDate) => setForm({ ...form, startDate })}
        placeholder="YYYY-MM-DD"
      />

      <Form.TextField
        id="startTime"
        title="Start Time"
        placeholder="HH:MM"
        value={form.startTime}
        onChange={(startTime) => setForm({ ...form, startTime })}
      />

      <Form.TextField
        id="endDate"
        title="End Date"
        value={form.endDate}
        onChange={(endDate) => setForm({ ...form, endDate })}
        placeholder="YYYY-MM-DD"
      />

      <Form.TextField
        id="endTime"
        title="End Time"
        placeholder="HH:MM"
        value={form.endTime}
        onChange={(endTime) => setForm({ ...form, endTime })}
      />

      <Form.Separator />

      <Form.Dropdown
        id="scopeType"
        title="Scope"
        value={form.scopeType}
        onChange={(scopeType) => setForm({ ...form, scopeType: scopeType as MaintenanceScopeType })}
      >
        <Form.Dropdown.Item value={MaintenanceScopeType.ENVIRONMENT} title="All Environment" />
        <Form.Dropdown.Item value={MaintenanceScopeType.MANAGEMENT_ZONE} title="Management Zone" />
        <Form.Dropdown.Item value={MaintenanceScopeType.ENTITY} title="Specific Entity" />
      </Form.Dropdown>

      {form.scopeType !== MaintenanceScopeType.ENVIRONMENT && (
        <Form.TextField
          id="scopeValue"
          title="Zone/Entity ID"
          placeholder="e.g., zone-prod-db or SERVICE-api-gateway"
          value={form.scopeValue}
          onChange={(scopeValue) => setForm({ ...form, scopeValue })}
        />
      )}

      <Form.Separator />

      <Form.Checkbox
        id="suppressAlerting"
        label="Suppress Alerting"
        value={form.suppressAlerting}
        onChange={(suppressAlerting) => setForm({ ...form, suppressAlerting })}
      />

      <Form.Checkbox
        id="suppressProblems"
        label="Suppress Problems"
        value={form.suppressProblems}
        onChange={(suppressProblems) => setForm({ ...form, suppressProblems })}
      />
    </Form>
  );
}
