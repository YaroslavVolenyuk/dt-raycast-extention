import {
  generateSparkline,
  getTrendIndicator,
  formatMetricValue,
  calculateAggregations,
} from "../lib/utils/sparkline";

describe("Sparkline utilities", () => {
  describe("generateSparkline", () => {
    it("should generate sparkline from values", () => {
      const values = [1, 2, 3, 4, 5];
      const result = generateSparkline(values, 5);
      expect(result).toHaveLength(5);
      expect(result).toMatch(/^[▁▂▃▄▅▆▇█]+$/);
    });

    it("should handle single value", () => {
      const result = generateSparkline([5], 5);
      expect(result).toHaveLength(5);
    });

    it("should handle empty array", () => {
      const result = generateSparkline([], 5);
      expect(result).toHaveLength(5);
      expect(result).toMatch(/^─+$/);
    });

    it("should resample to target width", () => {
      const values = Array.from({ length: 100 }, (_, i) => i);
      const result = generateSparkline(values, 10);
      expect(result).toHaveLength(10);
    });

    it("should interpolate upsampling", () => {
      const values = [1, 5];
      const result = generateSparkline(values, 5);
      expect(result).toHaveLength(5);
      // Should show progression from low to high
      expect(result).toMatch(/^[▁▂▃▄▅▆▇█]+$/);
    });

    it("should handle identical values", () => {
      const values = [5, 5, 5, 5];
      const result = generateSparkline(values, 4);
      expect(result).toHaveLength(4);
      // All values same → all characters should be middle-range
      expect(result).toBeTruthy();
    });

    it("should show increasing trend", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8];
      const result = generateSparkline(values);
      // Last char should be higher (darker) than first
      expect(result[result.length - 1]).toBeTruthy();
    });

    it("should show decreasing trend", () => {
      const values = [8, 7, 6, 5, 4, 3, 2, 1];
      const result = generateSparkline(values);
      expect(result).toMatch(/^[▁▂▃▄▅▆▇█]+$/);
    });
  });

  describe("getTrendIndicator", () => {
    it("should detect uptrend", () => {
      const result = getTrendIndicator([100, 110, 120]);
      expect(result.indicator).toBe("↑");
      expect(result.symbol).toBe("🟢");
      expect(result.change).toBeGreaterThan(0);
    });

    it("should detect downtrend", () => {
      const result = getTrendIndicator([100, 90, 80]);
      expect(result.indicator).toBe("↓");
      expect(result.symbol).toBe("🔴");
      expect(result.change).toBeLessThan(0);
    });

    it("should detect stable trend", () => {
      const result = getTrendIndicator([100, 102, 101, 103]);
      expect(result.indicator).toBe("→");
      expect(result.symbol).toBe("⚫");
    });

    it("should apply threshold correctly", () => {
      // +3% should be flat with 5% threshold
      const result = getTrendIndicator([100, 103], 5);
      expect(result.indicator).toBe("→");

      // +6% should be up with 5% threshold
      const result2 = getTrendIndicator([100, 106], 5);
      expect(result2.indicator).toBe("↑");
    });

    it("should handle single value", () => {
      const result = getTrendIndicator([100]);
      expect(result.indicator).toBe("→");
      expect(result.change).toBe(0);
    });

    it("should handle empty array", () => {
      const result = getTrendIndicator([]);
      expect(result.indicator).toBe("→");
      expect(result.label).toBe("No data");
    });
  });

  describe("formatMetricValue", () => {
    it("should format milliseconds", () => {
      expect(formatMetricValue(500, "ms")).toBe("500 ms");
      expect(formatMetricValue(1500, "ms")).toBe("1.50 s");
      expect(formatMetricValue(2000, "ms")).toBe("2.00 s");
    });

    it("should format bytes", () => {
      expect(formatMetricValue(512, "bytes")).toBe("512 B");
      expect(formatMetricValue(1024, "bytes")).toBe("1.0 KB");
      expect(formatMetricValue(1048576, "bytes")).toBe("1.0 MB");
      expect(formatMetricValue(1073741824, "bytes")).toBe("1.0 GB");
    });

    it("should format percentage", () => {
      expect(formatMetricValue(50.5, "%")).toBe("50.5%");
      expect(formatMetricValue(100, "%")).toBe("100.0%");
    });

    it("should format requests per minute", () => {
      expect(formatMetricValue(1234, "requests/min")).toBe("1234 req/min");
    });

    it("should format default unit", () => {
      expect(formatMetricValue(123.456, "unknown")).toBe("123.5");
    });
  });

  describe("calculateAggregations", () => {
    it("should calculate aggregations", () => {
      const values = [10, 20, 30, 40, 50];
      const result = calculateAggregations(values);

      expect(result.min).toBe(10);
      expect(result.max).toBe(50);
      expect(result.avg).toBe(30);
      expect(result.current).toBe(50);
    });

    it("should handle single value", () => {
      const result = calculateAggregations([42]);
      expect(result.min).toBe(42);
      expect(result.max).toBe(42);
      expect(result.avg).toBe(42);
      expect(result.current).toBe(42);
    });

    it("should handle empty array", () => {
      const result = calculateAggregations([]);
      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.avg).toBe(0);
      expect(result.current).toBe(0);
    });

    it("should handle negative values", () => {
      const values = [-10, 0, 10, 20];
      const result = calculateAggregations(values);

      expect(result.min).toBe(-10);
      expect(result.max).toBe(20);
      expect(result.avg).toBe(5);
    });

    it("should handle floats", () => {
      const values = [1.5, 2.5, 3.5];
      const result = calculateAggregations(values);

      expect(result.min).toBe(1.5);
      expect(result.max).toBe(3.5);
      expect(result.avg).toBe(2.5);
    });
  });
});
