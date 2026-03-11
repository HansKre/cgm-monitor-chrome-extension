import React from "react";
import { getGlucoseColor } from "../utils/glucoseUtils";
import { CHART_STYLES } from "../config/glucoseConfig";

type Props = {
  currentValue?: number;
};

export const ChartLegend: React.FC<Props> = ({ currentValue }) => {
  const color = getGlucoseColor(currentValue || 100);
  const legendItems = [
    {
      label: "Actual",
      isArea: false,
      style: { backgroundColor: color },
    },
    {
      label: "Projection",
      isArea: false,
      style: {
        backgroundColor: color,
        opacity: 0.8,
        backgroundImage:
          "repeating-linear-gradient(to right, transparent, transparent 2px, white 2px, white 4px)",
      },
    },
    {
      label: "Uncertainty",
      isArea: true,
      style: { backgroundColor: color, opacity: 0.15 },
    },
  ];

  return (
    <div
      data-testid="chart-legend"
      style={{
        padding: "0 32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: CHART_STYLES.axis.fontFamily,
        fontSize: "11px",
        color: "#666",
        gap: "16px",
      }}
    >
      {legendItems.map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "16px",
              height: item.isArea ? "8px" : "2px",
              borderRadius: item.isArea ? "2px" : undefined,
              ...item.style,
            }}
          ></div>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
};
