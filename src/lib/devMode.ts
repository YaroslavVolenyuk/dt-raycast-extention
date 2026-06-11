// src/lib/devMode.ts
// Development mode utilities for testing UI without OAuth setup.
// Provides feature flags and mock data control for rapid UI development.

import { getPreferenceValues, LocalStorage, showToast, Toast } from "@raycast/api";

interface ExtensionPrefs {
  useMockData: boolean;
}

/**
 * Check if mock/development mode is enabled.
 * When enabled, all API calls return mock data instead of hitting real Dynatrace API.
 *
 * Usage:
 *  if (isMockMode()) {
 *    return MOCK_LOGS;
 *  }
 */
export function isMockMode(): boolean {
  const prefs = getPreferenceValues<ExtensionPrefs>();
  return prefs.useMockData === true;
}

/**
 * Development mode logger — only logs in mock mode to reduce noise.
 * Useful for debugging mock data flow.
 *
 * Usage:
 *  devLog("Building DQL query", { query, timeframe });
 */
export function devLog(message: string, data?: unknown): void {
  if (isMockMode()) {
    console.debug(`[DevMode] ${message}`, data);
  }
}

/**
 * Show a mock mode indicator toast (helpful during development).
 * Let users know they're in mock mode with sample data.
 */
export async function showMockModeIndicator(commandName: string): Promise<void> {
  if (isMockMode()) {
    await showToast({
      style: Toast.Style.Animated,
      title: `${commandName} (Mock Mode)`,
      message: "Using sample data — turn off in preferences to use real Dynatrace",
    });
  }
}

/**
 * Development preference manager — easily toggle mock mode and other dev settings.
 * Stores dev preferences separately from extension preferences.
 */
export async function getDevPreferences(): Promise<{
  mockMode: boolean;
  verbose: boolean;
  slowNetworkSimulation: boolean;
}> {
  const stored = await LocalStorage.getItem<string>("dev-prefs");
  if (!stored) {
    return {
      mockMode: isMockMode(),
      verbose: false,
      slowNetworkSimulation: false,
    };
  }

  try {
    return JSON.parse(stored);
  } catch {
    return {
      mockMode: isMockMode(),
      verbose: false,
      slowNetworkSimulation: false,
    };
  }
}

/**
 * Simulate network latency during development (helpful for testing loading states).
 * Range: 100-2000ms
 */
export async function simulateNetworkDelay(minMs = 100, maxMs = 500): Promise<void> {
  const prefs = await getDevPreferences();
  if (prefs.slowNetworkSimulation && isMockMode()) {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
