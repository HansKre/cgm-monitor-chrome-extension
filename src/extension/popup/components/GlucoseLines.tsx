import React from "react";
import { Area, Line } from "recharts";
import type { GlucoseData } from "../../../types";
import { ANIMATION_CONFIG } from "../config/glucoseConfig";
import { getGlucoseColor } from "../utils/glucoseUtils";

type Props = {
  data: GlucoseData[];
  currentValue?: number;
};

export const GlucoseLines: React.FC<Props> = ({ data, currentValue }) => {
  const lastDataPoint = data[data.length - 1];
  const strokeColor = getGlucoseColor(lastDataPoint?.Value || 100);

  return (
    <>
      {/* Uncertainty band: single range Area using [lower, upper] pair */}
      <Area
        type="monotone"
        dataKey="projectionBand"
        fill={strokeColor}
        fillOpacity={0.35}
        stroke="none"
        connectNulls={true}
        animationBegin={ANIMATION_CONFIG.projectedLines.begin}
        animationDuration={ANIMATION_CONFIG.projectedLines.duration}
      />

      {/* Time-aware projection line (renders on top of band) */}
      <Line
        type="monotone"
        dataKey="timeAwareProjectedValue"
        stroke={strokeColor}
        strokeWidth={2}
        strokeDasharray="4 2"
        strokeOpacity={0.8}
        dot={false}
        activeDot={{
          r: 4,
          fill: getGlucoseColor(currentValue || 100),
          stroke: "white",
          strokeWidth: 1,
          strokeOpacity: 0.8,
        }}
        connectNulls={true}
        animationBegin={ANIMATION_CONFIG.projectedLines.begin}
        animationDuration={ANIMATION_CONFIG.projectedLines.duration}
      />

      {/* Actual glucose data line */}
      <Line
        type="monotone"
        dataKey="value"
        stroke={strokeColor}
        strokeWidth={3}
        dot={false}
        activeDot={{
          r: 6,
          fill: getGlucoseColor(currentValue || 100),
          stroke: "white",
          strokeWidth: 2,
        }}
        connectNulls={false}
        animationBegin={ANIMATION_CONFIG.actualLine.begin}
        animationDuration={ANIMATION_CONFIG.actualLine.duration}
      />
    </>
  );
};
