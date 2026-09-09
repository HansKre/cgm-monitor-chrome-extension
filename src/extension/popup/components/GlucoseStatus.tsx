import React from "react";
import { AnimatedGlucoseValue } from "./AnimatedGlucoseValue";
import { LastUpdatedInfo } from "./LastUpdatedInfo";
import { RefreshButton } from "./RefreshButton";
import { ErrorDisplay } from "./ErrorDisplay";

type Props = {
  value?: number;
  lastUpdate?: number;
  loading: boolean;
  onRefresh: () => void;
  isStale?: boolean;
  lastError?: string;
  isAutoHealing?: boolean;
};

export const GlucoseStatus: React.FC<Props> = ({
  value,
  lastUpdate,
  loading,
  onRefresh,
  isStale = false,
  lastError,
  isAutoHealing = false,
}) => {
  return (
    <div
      data-testid="glucose-status"
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "0px 0px 20px 16px",
        marginBottom: "0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <AnimatedGlucoseValue value={value} isStale={isStale} />
          <LastUpdatedInfo
            lastUpdate={lastUpdate}
            isStale={isStale}
            isAutoHealing={isAutoHealing}
          />
        </div>
        <RefreshButton loading={loading} onRefresh={onRefresh} />
      </div>
      <ErrorDisplay error={lastError} />
    </div>
  );
};
