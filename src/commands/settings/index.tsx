// B3-1: Settings / Config Management — search and browse configuration objects
import { List, Action, ActionPanel, Icon, Color, useNavigation } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getSettingsTypeLabel, getSettingsTypeIcon } from "../../lib/types/settings";
import type { SettingsObject, SettingsType } from "../../lib/types/settings";
import { fetchSettingsObjects } from "../../lib/api/settings";
import { useState } from "react";
import { useTenant } from "../../hooks/useTenant";
import SettingDetailView from "./setting-detail";

export default function SettingsCommand() {
  const { tenant } = useTenant();
  const [filterSchemaId, setFilterSchemaId] = useState<string | null>(null);

  const {
    data: settings = [],
    isLoading,
    error,
    revalidate,
  } = useCachedPromise(async (t) => fetchSettingsObjects(t), [tenant!], {
    execute: !!tenant,
    keepPreviousData: true,
  });

  const { push } = useNavigation();

  const handleSelectSetting = (setting: SettingsObject) => {
    push(<SettingDetailView setting={setting} tenant={tenant} onRefresh={revalidate} />);
  };

  if (error) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Warning}
          title="Failed to Load Settings"
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

  // Filter by schema type
  let filteredSettings: SettingsObject[] = settings ?? [];
  if (filterSchemaId) {
    filteredSettings = filteredSettings.filter((s) => s.schemaId === filterSchemaId);
  }

  if (!filteredSettings || filteredSettings.length === 0) {
    return (
      <List
        isLoading={isLoading}
        searchBarPlaceholder="Search settings by name..."
        actions={
          <ActionPanel>
            <Action title="Clear Type Filter" onAction={() => setFilterSchemaId(null)} />
          </ActionPanel>
        }
      >
        <List.EmptyView
          icon={Icon.Binoculars}
          title="No Settings Found"
          description="No settings objects configured in this tenant"
        />
      </List>
    );
  }

  // Group by schema type
  const groupedSettings = new Map<string, SettingsObject[]>();
  for (const setting of filteredSettings) {
    if (!groupedSettings.has(setting.schemaId)) {
      groupedSettings.set(setting.schemaId, []);
    }
    groupedSettings.get(setting.schemaId)!.push(setting);
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search settings by name..."
      actions={
        <ActionPanel>
          {filterSchemaId && <Action title="Clear Type Filter" onAction={() => setFilterSchemaId(null)} />}
        </ActionPanel>
      }
    >
      {Array.from(groupedSettings.entries()).map(([schemaId, items]) => (
        <List.Section key={schemaId} title={`${getSettingsTypeIcon(schemaId)} ${getSettingsTypeLabel(schemaId)}`}>
          {items.map((setting) => (
            <SettingsListItem
              key={setting.id}
              setting={setting}
              onSelect={handleSelectSetting}
              onFilterByType={(type) => setFilterSchemaId(type)}
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

interface SettingsListItemProps {
  setting: SettingsObject;
  onSelect: (setting: SettingsObject) => void;
  onFilterByType: (schemaId: SettingsType) => void;
}

function SettingsListItem({ setting, onSelect, onFilterByType }: SettingsListItemProps) {
  const accessories: Array<{
    tag?: { value: string; color: Color };
    text?: string;
    icon?: { source: Icon; tintColor?: Color };
  }> = [];

  // Add scope
  if (setting.scope) {
    const scopeColor = setting.scope === "ENVIRONMENT" ? Color.Blue : Color.Green;
    accessories.push({
      tag: {
        value: setting.scope,
        color: scopeColor,
      },
    });
  }

  // Add author
  if (setting.author) {
    accessories.push({
      text: setting.author,
    });
  }

  // Add modified date
  if (setting.modifiedAt) {
    const now = new Date();
    const modTime = new Date(setting.modifiedAt);
    const diffMs = now.getTime() - modTime.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    let timeStr = "";
    if (diffDays > 0) {
      timeStr = `${diffDays}d ago`;
    } else {
      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      if (diffHours > 0) {
        timeStr = `${diffHours}h ago`;
      } else {
        timeStr = "now";
      }
    }

    accessories.push({
      text: timeStr,
    });
  }

  return (
    <List.Item
      title={setting.displayName}
      subtitle={setting.description || "No description"}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action title="View Details" icon={Icon.Eye} onAction={() => onSelect(setting)} />
          <Action title="Filter by Type" icon={Icon.Filter} onAction={() => onFilterByType(setting.schemaId)} />
        </ActionPanel>
      }
    />
  );
}
