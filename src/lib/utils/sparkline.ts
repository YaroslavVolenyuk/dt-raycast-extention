/**
 * Sparkline generator for displaying metric trends as ASCII art
 */

const SPARKLINE_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
const SPARKLINE_WIDTH = 20;

/**
 * Generate an ASCII sparkline from data points
 *
 * @param values Array of numeric values
 * @param width Optional width (default: 20)
 * @returns ASCII sparkline string
 *
 * @example
 * generateSparkline([1, 5, 3, 9, 7, 2, 8, 6]) // ▁▄▃█▆▁█▅
 */
export function generateSparkline(values: number[], width: number = SPARKLINE_WIDTH): string {
  if (!values || values.length === 0) {
    return "─".repeat(width);
  }

  // Resample to target width if needed
  const resampled = resampleArray(values, width);

  // Find min and max for normalization
  const min = Math.min(...resampled);
  const max = Math.max(...resampled);

  // Avoid division by zero
  const range = max === min ? 1 : max - min;

  // Map each value to a sparkline character
  const sparkline = resampled
    .map((val) => {
      const normalized = (val - min) / range;
      const index = Math.floor(normalized * (SPARKLINE_CHARS.length - 1));
      return SPARKLINE_CHARS[Math.max(0, Math.min(index, SPARKLINE_CHARS.length - 1))];
    })
    .join("");

  return sparkline;
}

/**
 * Resample array to a specific size
 * @param arr Source array
 * @param targetSize Target size
 * @returns Resampled array
 */
function resampleArray(arr: number[], targetSize: number): number[] {
  if (arr.length === targetSize) {
    return arr;
  }

  if (arr.length < targetSize) {
    // Interpolate missing values
    return linearInterpolate(arr, targetSize);
  }

  // Downsample by averaging
  const result: number[] = [];
  const groupSize = arr.length / targetSize;

  for (let i = 0; i < targetSize; i++) {
    const start = Math.floor(i * groupSize);
    const end = Math.floor((i + 1) * groupSize);
    const group = arr.slice(start, end);
    const avg = group.reduce((a, b) => a + b, 0) / group.length;
    result.push(avg);
  }

  return result;
}

/**
 * Linear interpolation to upsampling
 */
function linearInterpolate(arr: number[], targetSize: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < targetSize; i++) {
    const position = (i / targetSize) * (arr.length - 1);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const fraction = position - lowerIndex;

    if (lowerIndex === upperIndex) {
      result.push(arr[lowerIndex]);
    } else {
      const interpolated = arr[lowerIndex] * (1 - fraction) + arr[upperIndex] * fraction;
      result.push(interpolated);
    }
  }

  return result;
}

/**
 * Generate a trend indicator (up/down/flat)
 *
 * @param values Array of numeric values
 * @param threshold Percentage threshold for up/down (default: 5%)
 * @returns Trend indicator and change percentage
 *
 * @example
 * getTrendIndicator([100, 102, 105, 103, 108])
 * // { indicator: '↑', change: 8, symbol: '🟢' }
 */
export interface TrendResult {
  indicator: "↑" | "↓" | "→";
  change: number;
  symbol: "🟢" | "🔴" | "⚫";
  label: string;
}

export function getTrendIndicator(values: number[], threshold: number = 5): TrendResult {
  if (!values || values.length < 2) {
    return {
      indicator: "→",
      change: 0,
      symbol: "⚫",
      label: "No data",
    };
  }

  const first = values[0];
  const last = values[values.length - 1];
  const change = ((last - first) / first) * 100;

  if (change > threshold) {
    return {
      indicator: "↑",
      change: Math.round(change * 10) / 10,
      symbol: "🟢",
      label: "Improving",
    };
  } else if (change < -threshold) {
    return {
      indicator: "↓",
      change: Math.round(change * 10) / 10,
      symbol: "🔴",
      label: "Degrading",
    };
  } else {
    return {
      indicator: "→",
      change: Math.round(change * 10) / 10,
      symbol: "⚫",
      label: "Stable",
    };
  }
}

/**
 * Format numeric value with appropriate unit
 *
 * @param value Numeric value
 * @param unit Unit of measurement
 * @returns Formatted string
 *
 * @example
 * formatMetricValue(1500, "ms") // "1.5 s"
 * formatMetricValue(1024000000, "bytes") // "1 GB"
 */
export function formatMetricValue(value: number, unit: string): string {
  // Handle milliseconds
  if (unit === "ms") {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} s`;
    }
    return `${value.toFixed(0)} ms`;
  }

  // Handle bytes
  if (unit === "bytes") {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    const decimals = unitIndex === 0 ? 0 : 1;
    return `${size.toFixed(decimals)} ${units[unitIndex]}`;
  }

  // Handle percentage
  if (unit === "%") {
    return `${value.toFixed(1)}%`;
  }

  // Handle requests/min
  if (unit.includes("requests")) {
    return `${value.toFixed(0)} req/min`;
  }

  // Default formatting
  return value.toFixed(1);
}

/**
 * Calculate aggregations from data points
 */
export interface MetricAggregations {
  min: number;
  max: number;
  avg: number;
  current: number;
}

export function calculateAggregations(values: number[]): MetricAggregations {
  if (!values || values.length === 0) {
    return { min: 0, max: 0, avg: 0, current: 0 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const current = values[values.length - 1];

  return { min, max, avg, current };
}
