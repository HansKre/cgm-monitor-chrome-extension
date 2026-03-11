import React from "react";
import {
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GlucoseData } from "../../../types";
import { Y_AXIS_CONFIG } from "../config/glucoseConfig";
import { getThemeAwareChartStyles } from "../config/themeConfig";
import { useTheme } from "../contexts/ThemeContext";
import { formatChartData, getGlucoseColor } from "../utils/glucoseUtils";
import type { ChartDataPoint } from "../utils/glucoseUtils";
import { ChartLegend } from "./ChartLegend";
import { ChartLoadingStates } from "./ChartLoadingStates";
import { ChartTitle } from "./ChartTitle";
import { GlucoseLines } from "./GlucoseLines";
import { ReferenceElements } from "./ReferenceElements";

type Props = {
  data: GlucoseData[];
  currentValue?: number;
  error?: string | null;
  loading: boolean;
};

export const GlucoseChart: React.FC<Props> = ({
  data,
  currentValue,
  error,
  loading,
}) => {
  const { resolvedTheme, themeColors } = useTheme();
  const themeChartStyles = getThemeAwareChartStyles(resolvedTheme);

  if (error || loading || !data || data.length === 0) {
    return (
      <ChartLoadingStates
        error={error}
        loading={loading}
        hasData={data && data.length > 0}
      />
    );
  }

  const chartData = formatChartData(data);

  // Calculate dynamic time span and tick configuration
  const calculateXAxisConfig = () => {
    if (chartData.length === 0) {
      return {
        ticks: undefined,
        interval: "preserveStartEnd" as const,
        minDomain: undefined,
        maxDomain: undefined,
      };
    }

    // Get time range from actual data (not including projections)
    const actualDataPoints = chartData.filter((d) => !d.isProjected);
    if (actualDataPoints.length === 0) {
      return {
        ticks: undefined,
        interval: "preserveStartEnd" as const,
        minDomain: undefined,
        maxDomain: undefined,
      };
    }

    const minTime = Math.min(...actualDataPoints.map((d) => d.time));
    const maxTime = Math.max(...actualDataPoints.map((d) => d.time));
    const timeSpanHours = (maxTime - minTime) / (1000 * 60 * 60);

    // Debug logging
    console.log(
      `Chart data points: ${data.length} total, ${actualDataPoints.length} actual`,
    );
    console.log(
      `Time span: ${timeSpanHours.toFixed(2)} hours (${new Date(minTime).toLocaleTimeString()} - ${new Date(maxTime).toLocaleTimeString()})`,
    );
    if (data.length > 0) {
      const firstTimestamp = new Date(data[0].Timestamp).toLocaleTimeString();
      const lastTimestamp = new Date(
        data[data.length - 1].Timestamp,
      ).toLocaleTimeString();
      console.log(`Original data range: ${firstTimestamp} - ${lastTimestamp}`);
    }

    // Determine tick interval and count based on time span
    // Aim for 4-6 ticks to avoid overlap in the popup width
    let tickIntervalMs: number;
    if (timeSpanHours <= 2) {
      // 30 minute ticks for <= 2 hours
      tickIntervalMs = 30 * 60 * 1000;
    } else if (timeSpanHours <= 6) {
      // 1 hour ticks for 2-6 hours
      tickIntervalMs = 60 * 60 * 1000;
    } else if (timeSpanHours <= 12) {
      // 2 hour ticks for 6-12 hours
      tickIntervalMs = 2 * 60 * 60 * 1000;
    } else if (timeSpanHours <= 18) {
      // 3 hour ticks for 12-18 hours
      tickIntervalMs = 3 * 60 * 60 * 1000;
    } else {
      // 4 hour ticks for > 18 hours
      tickIntervalMs = 4 * 60 * 60 * 1000;
    }

    // Round minTime down to nearest tick interval for tick generation
    const roundedMinTime =
      Math.floor(minTime / tickIntervalMs) * tickIntervalMs;
    // Round maxTime up to nearest tick interval for clean axis end
    const roundedMaxTime = Math.ceil(maxTime / tickIntervalMs) * tickIntervalMs;

    // Generate tick values from rounded start to rounded end
    const ticks: number[] = [];
    let currentTick = roundedMinTime;
    while (currentTick <= roundedMaxTime) {
      ticks.push(currentTick);
      currentTick += tickIntervalMs;
    }

    // Remove the first tick to eliminate the leftmost label
    const filteredTicks = ticks.slice(1);

    // Extend domain beyond roundedMaxTime to accommodate 60 min of projection
    // data, so the last labeled tick is no longer pinned to the right boundary.
    const projectionEndTime = maxTime + 60 * 60 * 1000;
    return {
      ticks: filteredTicks,
      interval: 0 as const,
      minDomain: minTime,
      maxDomain: Math.max(roundedMaxTime, projectionEndTime),
    };
  };

  const xAxisConfig = calculateXAxisConfig();

  // Calculate dynamic Y-axis configuration
  const calculateYAxisConfig = () => {
    if (chartData.length === 0) {
      return {
        domain: [0, 350] as [number, number],
        ticks: [0, 50, 100, 150, 200, 250, 300, 350],
      };
    }

    // Get all glucose values (both actual and projected, including band bounds)
    const glucoseValues = chartData
      .flatMap((d) => [
        d.value,
        d.timeAwareProjectedValue,
        d.projectionLowerBound,
        d.projectionUpperBound,
      ])
      .filter((v): v is number => v !== null && v !== undefined);

    if (glucoseValues.length === 0) {
      return {
        domain: [0, 350] as [number, number],
        ticks: [0, 50, 100, 150, 200, 250, 300, 350],
      };
    }

    const minValue = Math.min(...glucoseValues);
    const maxValue = Math.max(...glucoseValues);
    const dataRange = maxValue - minValue;

    // Ensure minimum range for readability
    const effectiveRange = Math.max(dataRange, Y_AXIS_CONFIG.minRange);

    // Calculate domain with padding
    const paddingTop = effectiveRange * Y_AXIS_CONFIG.paddingTop;
    const paddingBottom = effectiveRange * Y_AXIS_CONFIG.paddingBottom;

    let domainMin = Math.max(0, Math.floor(minValue - paddingBottom));
    let domainMax = Math.ceil(maxValue + paddingTop);

    // Round to nearest tickInterval for cleaner display
    const tickInterval = Y_AXIS_CONFIG.tickInterval;
    domainMin = Math.floor(domainMin / tickInterval) * tickInterval;
    domainMax = Math.ceil(domainMax / tickInterval) * tickInterval;

    // Generate ticks
    const ticks: number[] = [];
    for (let tick = domainMin; tick <= domainMax; tick += tickInterval) {
      ticks.push(tick);
    }

    return {
      domain: [domainMin, domainMax] as [number, number],
      ticks,
    };
  };

  const yAxisConfig = calculateYAxisConfig();

  type TooltipEntry = {
    dataKey?: string | number | ((obj: unknown) => unknown);
    value?: unknown;
    payload?: unknown;
  };

  const isChartDataPoint = (v: unknown): v is ChartDataPoint =>
    typeof v === "object" &&
    v !== null &&
    "isProjected" in v &&
    "timeLabel" in v;

  const renderTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: ReadonlyArray<TooltipEntry>;
  }) => {
    if (!active || !payload?.length) return null;

    const rawPoint = payload[0]?.payload;
    const point = isChartDataPoint(rawPoint) ? rawPoint : undefined;
    const containerStyle: React.CSSProperties = {
      backgroundColor: themeColors.background.primary,
      border: `1px solid ${themeColors.border.primary}`,
      borderRadius: "4px",
      padding: "8px 12px",
      fontFamily: themeChartStyles.axis.fontFamily,
      fontSize: "12px",
    };
    const labelStyle: React.CSSProperties = {
      color: themeColors.text.primary,
      margin: "0 0 4px",
      fontWeight: "bold",
    };
    const rowStyle = (color: string): React.CSSProperties => ({
      color,
      margin: "2px 0",
    });

    if (point?.isProjected) {
      const low = point.projectionLowerBound;
      const mid = point.timeAwareProjectedValue;
      const high =
        point.projectionUpperBound !== null
          ? Math.round(point.projectionUpperBound)
          : null;
      const color = getGlucoseColor(mid ?? low ?? 100);

      return (
        <div style={containerStyle}>
          <p style={labelStyle}>Time: {point.timeLabel}</p>
          {high !== null && (
            <p style={rowStyle(color)}>Projected High: {high} mg/dL</p>
          )}
          {mid !== null && (
            <p style={rowStyle(color)}>Projected Mid: {mid} mg/dL</p>
          )}
          {low !== null && (
            <p style={rowStyle(color)}>Projected Low: {low} mg/dL</p>
          )}
        </div>
      );
    }

    const rawValue = payload.find((p) => p.dataKey === "value")?.value;
    const value = typeof rawValue === "number" ? rawValue : undefined;
    if (value === undefined) return null;
    const color = getGlucoseColor(value);

    return (
      <div style={containerStyle}>
        <p style={labelStyle}>Time: {point?.timeLabel}</p>
        <p style={rowStyle(color)}>Glucose: {value} mg/dL</p>
      </div>
    );
  };

  return (
    <div
      data-testid="glucose-chart"
      style={{
        background: themeColors.background.primary,
        padding: "0 16px 16px",
      }}
    >
      <ChartTitle />

      <div
        data-testid="chart-container"
        style={{
          background: themeColors.background.primary,
          borderRadius: "0",
          padding: "0",
          margin: "0px -16px",
        }}
      >
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray={themeChartStyles.grid.strokeDasharray}
              stroke={themeChartStyles.grid.stroke}
            />
            <XAxis
              type="number"
              dataKey="time"
              domain={
                xAxisConfig.minDomain && xAxisConfig.maxDomain
                  ? [xAxisConfig.minDomain, xAxisConfig.maxDomain]
                  : ["dataMin", "dataMax"]
              }
              scale="time"
              ticks={xAxisConfig.ticks}
              interval={xAxisConfig.interval}
              tickFormatter={(timestamp) => {
                return new Date(timestamp).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });
              }}
              tick={{
                fontSize: themeChartStyles.axis.fontSize,
                fontFamily: themeChartStyles.axis.fontFamily,
                fill: themeColors.text.secondary,
              }}
              axisLine={{ stroke: themeChartStyles.axis.stroke }}
            />
            <YAxis
              domain={yAxisConfig.domain}
              ticks={yAxisConfig.ticks}
              tick={{
                fontSize: themeChartStyles.axis.fontSize,
                fontFamily: themeChartStyles.axis.fontFamily,
                fill: themeColors.text.secondary,
              }}
              axisLine={{ stroke: themeChartStyles.axis.stroke }}
              width={40}
              label={{
                value: "mg/dL",
                angle: -90,
                position: "insideLeft",
                style: {
                  textAnchor: "middle",
                  fill: themeColors.text.secondary,
                },
                offset: -1,
              }}
            />
            <Tooltip content={renderTooltip} />

            <GlucoseLines data={data} currentValue={currentValue} />
            <ReferenceElements data={data} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend currentValue={currentValue} />
    </div>
  );
};
