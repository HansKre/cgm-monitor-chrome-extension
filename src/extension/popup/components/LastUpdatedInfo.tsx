import React from "react";

type Props = {
  lastUpdate?: number;
  isStale?: boolean;
  isAutoHealing?: boolean;
};

export const LastUpdatedInfo: React.FC<Props> = ({
  lastUpdate,
  isStale = false,
  isAutoHealing = false,
}) => {
  let statusSuffix = "";
  if (isAutoHealing) {
    statusSuffix = " (Auto-recovering...)";
  } else if (isStale) {
    statusSuffix = " (Stale)";
  }

  return (
    <div
      data-testid="last-updated-info"
      style={{
        fontSize: "14px",
        color: isStale ? "#888" : "#666",
        fontWeight: "normal",
      }}
    >
      {lastUpdate
        ? `Last updated: ${new Date(lastUpdate).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })}${statusSuffix}`
        : "Loading..."}
    </div>
  );
};
