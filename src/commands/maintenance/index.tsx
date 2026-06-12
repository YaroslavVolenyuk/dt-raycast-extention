import React, { useMemo, useState } from "react";
import {
  List,
  Action,
  ActionPanel,
  showToast,
  Toast,
  useNavigation,
  Icon,
  Color,
  Keyboard,
  Alert,
  confirmAlert,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import {
  MaintenanceWindow,
  getMaintenanceStatus,
  formatMaintenanceTime,
  sortMaintenanceWindows,
  MaintenanceWindowStatus,
} from "../../lib/types/maintenance";
import { fetchMaintenanceWindows, deleteMaintenanceWindow } from "../../lib/api/maintenance";
import MaintenanceDetail from "./maintenance-detail";
import CreateMaintenanceForm from "./create-maintenance";
import { useTenant } from "../../hooks/useTenant";

export default function MaintenanceCommand() {
  const { tenant } = useTenant();
  const { push } = useNavigation();
  const [searchText, setSearchText] = useState("");

  const { data, isLoading, error, revalidate } = useCachedPromise(
    async (t) => {
      const result = await fetchMaintenanceWindows(t);
      if (result.skipped > 0) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Some windows skipped",
          message: `${result.skipped} object(s) did not match the expected Settings 2.0 format`,
        });
      }
      return result.windows;
    },
    [tenant!],
    { execute: !!tenant, keepPreviousData: true },
  );

  const windows = data ?? [];

  const filteredAndSorted = useMemo(() => {
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
    push(<CreateMaintenanceForm onCreated={() => revalidate()} />);
  };

  const handleDelete = async (window: MaintenanceWindow) => {
    if (!tenant) return;
    const confirmed = await confirmAlert({
      title: `Delete "${window.name}"?`,
      message: "The maintenance window will be permanently removed from Dynatrace.",
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;

    try {
      await deleteMaintenanceWindow(tenant, window.id);
      await showToast({ style: Toast.Style.Success, title: `Deleted "${window.name}"` });
      revalidate();
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (error) {
    return (
      <List isLoading={isLoading}>
        <List.EmptyView
          icon="⚠️"
          title="Failed to load maintenance windows"
          description={error instanceof Error ? error.message : String(error)}
          actions={
            <ActionPanel>
              <Action title="Retry" icon={Icon.ArrowClockwise} onAction={() => revalidate()} />
            </ActionPanel>
          }
        />
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
                subtitle={`${window.maintenanceType} • ${window.scheduleType} • ${status}`}
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
                      target={<MaintenanceDetail window={window} onDeleted={() => revalidate()} />}
                      icon={Icon.Eye}
                    />
                    <Action
                      title="Create Maintenance Window"
                      onAction={handleCreate}
                      icon={Icon.Plus}
                      shortcut={Keyboard.Shortcut.Common.New}
                    />
                    <Action
                      title="Delete"
                      onAction={() => handleDelete(window)}
                      icon={Icon.Trash}
                      style={Action.Style.Destructive}
                      shortcut={Keyboard.Shortcut.Common.Remove}
                    />
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
