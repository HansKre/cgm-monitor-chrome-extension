import type { GlucoseData } from "../../../types";
import {
  getGlucoseStatusFromConfig,
  getGlucoseColorFromConfig,
  PROJECTION_UNCERTAINTY,
} from "../config/glucoseConfig";

export type GlucoseStatus = {
  status: string;
  color: string;
};

export const getGlucoseStatus = (value: number): GlucoseStatus => {
  return getGlucoseStatusFromConfig(value);
};

export const getGlucoseColor = (value: number): string => {
  return getGlucoseColorFromConfig(value);
};

export type ProjectionPoint = {
  timestamp: number;
  value: number;
  isProjected: true;
};

const sortDataByTimestamp = (data: GlucoseData[]): GlucoseData[] => {
  return [...data].sort(
    (left, right) =>
      new Date(left.Timestamp).getTime() - new Date(right.Timestamp).getTime(),
  );
};

// Calculate average time interval between historic data points
const calculateDataInterval = (data: GlucoseData[]): number => {
  if (data.length < 2) return 5 * 60 * 1000; // Default to 5 minutes

  const intervals: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const currentTime = new Date(data[i].Timestamp).getTime();
    const previousTime = new Date(data[i - 1].Timestamp).getTime();
    intervals.push(currentTime - previousTime);
  }

  // Calculate median interval to avoid outliers affecting the result
  intervals.sort((a, b) => a - b);
  const midIndex = Math.floor(intervals.length / 2);
  return intervals.length % 2 === 0
    ? (intervals[midIndex - 1] + intervals[midIndex]) / 2
    : intervals[midIndex];
};

export const calculateProjection = (
  data: GlucoseData[],
  minutesAhead: number = 60,
): ProjectionPoint[] => {
  const sortedData = sortDataByTimestamp(data);

  if (sortedData.length < 3) return [];

  // Use last 30 minutes of data for trend analysis
  const latestTimestamp = new Date(
    sortedData[sortedData.length - 1].Timestamp,
  ).getTime();
  const thirtyMinutesAgo = latestTimestamp - 30 * 60 * 1000;
  const recentData = sortedData.filter(
    (item) => new Date(item.Timestamp).getTime() >= thirtyMinutesAgo,
  );

  if (recentData.length < 2) return [];

  // Calculate trend using linear regression on recent data
  const points = recentData.map((item, index) => ({
    x: index,
    y: item.Value,
    timestamp: new Date(item.Timestamp).getTime(),
  }));

  // Simple linear regression
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Generate projection points
  const projectionPoints: ProjectionPoint[] = [];
  const lastTimestamp = latestTimestamp;
  const projectionInterval = 5 * 60 * 1000; // 5 minute intervals
  const projectionCount = minutesAhead / 5;

  for (let i = 1; i <= projectionCount; i++) {
    const futureTimestamp = lastTimestamp + i * projectionInterval;
    const futureX = n + i;
    let projectedValue = slope * futureX + intercept;

    // Add some bounds to prevent unrealistic projections and round to integer
    projectedValue = Math.round(Math.max(0, Math.min(400, projectedValue)));

    projectionPoints.push({
      timestamp: futureTimestamp,
      value: projectedValue,
      isProjected: true,
    });
  }

  return projectionPoints;
};

// Time-interval aware projection algorithm
export const calculateTimeAwareProjection = (
  data: GlucoseData[],
  minutesAhead: number = 60,
): ProjectionPoint[] => {
  const sortedData = sortDataByTimestamp(data);

  if (sortedData.length < 3) return [];

  // Calculate the actual time interval between data points
  const dataInterval = calculateDataInterval(sortedData);

  // Use recent data based on data frequency (adjust analysis window)
  const analysisWindowMs = Math.max(30 * 60 * 1000, dataInterval * 6); // At least 6 data points or 30 minutes
  const latestTimestamp = new Date(
    sortedData[sortedData.length - 1].Timestamp,
  ).getTime();
  const analysisStartTime = latestTimestamp - analysisWindowMs;
  const recentData = sortedData.filter(
    (item) => new Date(item.Timestamp).getTime() >= analysisStartTime,
  );

  if (recentData.length < 2) return [];

  // Use time-based regression instead of index-based
  const points = recentData.map((item) => ({
    x: new Date(item.Timestamp).getTime(),
    y: item.Value,
  }));

  // Normalize time to prevent numerical issues
  const baseTime = points[0].x;
  const normalizedPoints = points.map((p) => ({
    x: (p.x - baseTime) / (60 * 1000), // Convert to minutes from base time
    y: p.y,
  }));

  // Time-based linear regression
  const n = normalizedPoints.length;
  const sumX = normalizedPoints.reduce((sum, p) => sum + p.x, 0);
  const sumY = normalizedPoints.reduce((sum, p) => sum + p.y, 0);
  const sumXY = normalizedPoints.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = normalizedPoints.reduce((sum, p) => sum + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Generate projection points respecting the historic data interval
  const projectionPoints: ProjectionPoint[] = [];
  const lastTimestamp = latestTimestamp;

  // Use the calculated data interval for projections, but cap it at reasonable limits
  const projectionInterval = Math.min(
    Math.max(dataInterval, 1 * 60 * 1000),
    15 * 60 * 1000,
  ); // Between 1-15 minutes
  const projectionCount = Math.ceil(
    (minutesAhead * 60 * 1000) / projectionInterval,
  );

  for (let i = 1; i <= projectionCount; i++) {
    const futureTimestamp = lastTimestamp + i * projectionInterval;
    const futureMinutes = (futureTimestamp - baseTime) / (60 * 1000);
    let projectedValue = slope * futureMinutes + intercept;

    // Add some bounds to prevent unrealistic projections and round to integer
    projectedValue = Math.round(Math.max(0, Math.min(400, projectedValue)));

    projectionPoints.push({
      timestamp: futureTimestamp,
      value: projectedValue,
      isProjected: true,
    });
  }

  return projectionPoints;
};

export type ChartDataPoint = {
  time: number; // Unix timestamp for linear time scale
  timeLabel: string; // Formatted time label for display
  value: number | null;
  timeAwareProjectedValue: number | null;
  projectionLowerBound: number | null; // lower edge of uncertainty band (tooltip)
  projectionUpperBound: number | null; // upper edge of uncertainty band (tooltip)
  projectionBand: [number, number] | null; // [lower, upper] for recharts range Area
  timestamp: string;
  color: string;
  isProjected: boolean;
};

// Extended GlucoseData with gap indicator for internal processing
type GlucoseDataWithGap = GlucoseData & {
  isGap?: boolean;
};

// Fill gaps in data to show disconnected lines for missing time intervals
const fillDataGaps = (
  data: GlucoseData[],
  intervalMinutes: number = 15,
): GlucoseDataWithGap[] => {
  if (data.length < 2) return data;

  const result: GlucoseDataWithGap[] = [];
  const intervalMs = intervalMinutes * 60 * 1000;

  for (let i = 0; i < data.length; i++) {
    result.push(data[i]);

    // Check if there's a significant gap to the next data point
    if (i < data.length - 1) {
      const currentTime = new Date(data[i].Timestamp).getTime();
      const nextTime = new Date(data[i + 1].Timestamp).getTime();
      const gap = nextTime - currentTime;

      // If gap is larger than expected interval, add null values to break the line
      if (gap > intervalMs * 1.5) {
        // Add a null point after current data to break the line
        const gapStartTime = currentTime + intervalMs;
        // Create a gap marker with minimal required fields
        const gapMarker: GlucoseDataWithGap = {
          ...data[i], // Copy all fields from current data point
          Timestamp: new Date(gapStartTime).toISOString(),
          Value: 0, // Will be set to null in chart data
          isGap: true,
        };
        result.push(gapMarker);
      }
    }
  }

  return result;
};

export const formatChartData = (data: GlucoseData[]): ChartDataPoint[] => {
  const sortedData = sortDataByTimestamp(data);

  if (sortedData.length === 0) return [];

  // Fill gaps in the data to show disconnections
  const gapFilledData = fillDataGaps(sortedData, 15);

  // Find the last actual data point timestamp for projection connection
  const lastActualTimestamp = sortedData[sortedData.length - 1].Timestamp;

  // Map actual data, but make the last point have both actual and projected values for smooth connection
  const actualData: ChartDataPoint[] = gapFilledData.map((item) => {
    const isGap = item.isGap;
    const isLastOriginalPoint =
      !isGap && item.Timestamp === lastActualTimestamp;

    return {
      time: new Date(item.Timestamp).getTime(), // Use timestamp for linear time scale
      timeLabel: new Date(item.Timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      value: isGap ? null : item.Value,
      // Add projected values to last actual data point to ensure smooth connection
      timeAwareProjectedValue: isLastOriginalPoint ? item.Value : null,
      projectionLowerBound: isLastOriginalPoint ? item.Value : null,
      projectionUpperBound: isLastOriginalPoint ? item.Value : null,
      projectionBand: isLastOriginalPoint ? [item.Value, item.Value] : null,
      timestamp: item.Timestamp,
      color: isGap ? "#000000" : getGlucoseColor(item.Value),
      isProjected: false,
    };
  });

  // Generate time-aware projection data
  const timeAwareProjections = calculateTimeAwareProjection(sortedData);

  const combinedProjections: ChartDataPoint[] = timeAwareProjections.map(
    (proj, i) => {
      const uncertainty =
        PROJECTION_UNCERTAINTY.base +
        PROJECTION_UNCERTAINTY.stepPerInterval * i;
      const upperBound = Math.min(400, proj.value + uncertainty);
      const lowerBound = Math.max(0, proj.value - uncertainty);

      return {
        time: proj.timestamp,
        timeLabel: new Date(proj.timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        value: null,
        timeAwareProjectedValue: proj.value,
        projectionLowerBound: lowerBound,
        projectionUpperBound: upperBound,
        projectionBand: [lowerBound, upperBound],
        timestamp: new Date(proj.timestamp).toISOString(),
        color: getGlucoseColor(proj.value),
        isProjected: true,
      };
    },
  );

  return [...actualData, ...combinedProjections];
};
