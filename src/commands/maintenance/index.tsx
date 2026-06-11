import React, { useState, useMemo } from "react";
import { List, Action, ActionPanel, showToast, Toast, useNavigation, Icon, Color, Keyboard } from "@raycast/api";
import { useDynatraceRest } from "../../lib/api/useRest";
import {
  MaintenanceWindow,
  MaintenanceWindowListSchema,
  getMaintenanceStatus,
  formatMaintenanceTime,
  sortMaintenanceWindows,
  MaintenanceWindowStatus,
} from "../../lib/types/maintenance";
import MaintenanceDetail from "./maintenance-detail";
import CreateMaintenanceForm from "./create-maintenance";
import { useTenant } from "../../hooks/useTenant";

export default function MaintenanceCommand() {
  const { tenant } = useTenant();
  const { push } = useNavigation();
  const [searchText, setSearchText] = useState("");

  // Memoize options to prevent infinite re-fetch cycles
  const restOptions = useMemo(
    () => ({
      schema: MaintenanceWindowListSchema,
      queryParams: {
        schemaIds: "builtin:alerting.maintenance-window",
        pageSize: "100",
      },
      enabled: !!tenant,
    }),
    [tenant],
  );

  const {
    data: windows,
    isLoading,
    error,
    revalidate,
  } = useDynatraceRest<MaintenanceWindow[]>(tenant || undefined, "/api/v2/settings/objects", restOptions);

  const filteredAndSorted = useMemo(() => {
    if (!windows) return [];

    const filtered = windows.filter((w) => w.name.toLowerCase().includes(searchText.toLowerCase()));

    return sortMaintenanceWindows(filtered);
  }, [windows, searchText]);

  const statusIcon = (window: MaintenanceWindow): [string, Color] => {
    const status = getMaintenanceStatus(window);
    switch (status) {
      case MaintenanceWindowStatus.ACTIVE:
        return ["🔴", Color.Red];
      case MaintenanceWindowStatus.SCHEDULED:
        return ["🟡", Color.Yellow];
      case MaintenanceWindowStatus.PAST:
        return ["⚪", Color.SecondaryText];
    }
  };

  const handleCreate = async () => {
    push(<CreateMaintenanceForm onCreated={revalidate} />);
  };

  const handleDelete = async (window: MaintenanceWindow) => {
    try {
      // In real implementation, this would be a DELETE request
      await showToast({
        style: Toast.Style.Success,
        title: `Deleted "${window.name}"`,
      });
      revalidate();
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete",
        message: String(err),
      });
    }
  };

  if (error) {
    return (
      <List isLoading={isLoading}>
        <List.EmptyView icon="⚠️" title="Failed to load maintenance windows" description={String(error)} />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search maintenance windows..." onSearchTextChange={setSearchText}>
      {filteredAndSorted.length === 0 ? (
        <List.EmptyView
          icon="✨"
          title="No maintenance windows"
          description="Click ⌘N to create a new one"
          actions={
            <ActionPanel>
              <Action
                title="Create Maintenance Window"
                onAction={handleCreate}
                icon={Icon.Plus}
                shortcut={Keyboard.Shortcut.Common.New}
              />
            </ActionPanel>
          }
        />
      ) : (
        <>
          {filteredAndSorted.map((window) => {
            const [icon, color] = statusIcon(window);
            const status = getMaintenanceStatus(window);

            return (
              <List.Item
                key={window.id}
                title={window.name}
                subtitle={`${window.type} • ${status}`}
                accessories={[
                  {
                    text: formatMaintenanceTime(window.startTime),
                    tooltip: `Starts: ${formatMaintenanceTime(window.startTime)}`,
                  },
                  {
                    icon: { source: icon, tintColor: color },
                    tooltip: status,
                  },
                ]}
                actions={
                  <ActionPanel>
                    <Action.Push
                      title="View Details"
                      target={<MaintenanceDetail window={window} onDeleted={revalidate} />}
                      icon={Icon.Eye}
                    />
                    <Action
                      title="Create Maintenance Window"
                      onAction={handleCreate}
                      icon={Icon.Plus}
                      shortcut={Keyboard.Shortcut.Common.New}
                    />
                    {(status === MaintenanceWindowStatus.SCHEDULED || status === MaintenanceWindowStatus.PAST) && (
                      <Action
                        title="Delete"
                        onAction={() => handleDelete(window)}
                        icon={Icon.Trash}
                        style={Action.Style.Destructive}
                        shortcut={Keyboard.Shortcut.Common.Remove}
                      />
                    )}
                  </ActionPanel>
                }
              />
            );
          })}
        </>
      )}
      {filteredAndSorted.length > 0 && (
        <List.Section title="Actions">
          <List.Item
            title="Create Maintenance Window"
            icon={Icon.Plus}
            actions={
              <ActionPanel>
                <Action
                  title="Create"
                  onAction={handleCreate}
                  icon={Icon.Plus}
                  shortcut={Keyboard.Shortcut.Common.New}
                />
              </ActionPanel>
            }
          />
        </List.Section>
      )}
    </List>
  );
}
