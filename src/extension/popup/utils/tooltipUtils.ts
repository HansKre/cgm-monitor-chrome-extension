import { CHART_STYLES } from "../config/glucoseConfig";
import type { GlucoseData } from "../../../types";
import type { Formatter } from "recharts/types/component/DefaultTooltipContent";

export const formatTooltipValue: Formatter = (value, name) => {
  if (name === "value") {
    return [`${value} mg/dL`, "Actual"];
  }
  if (name === "projectedValue") {
    return [`${value} mg/dL`, "Standard Projection"];
  }
  if (name === "timeAwareProjectedValue") {
    return [`${value} mg/dL`, "Time-aware Projection"];
  }
  return [`${value} mg/dL`, "Glucose"];
};

export const formatTooltipLabel = (label: string) => `Time: ${label}`;

export const tooltipContentStyle = {
  backgroundColor: "white",
  border: "1px solid #ccc",
  borderRadius: "4px",
  fontFamily: CHART_STYLES.axis.fontFamily,
};

// Calculate glucose trend from recent data points
export const calculateGlucoseTrend = (data: GlucoseData[]): number => {
  if (data.length < 2) return 0;

  // Use last few data points for trend analysis
  const recentData = data.slice(-Math.min(5, data.length));

  if (recentData.length < 2) return 0;

  // Calculate trend using linear regression on recent data
  const points = recentData.map((item, index) => ({
    x: index,
    y: item.Value,
  }));

  // Simple linear regression
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  return slope; // Positive = upward trend, negative = downward trend
};
