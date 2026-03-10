import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GlucoseChart } from "./components/GlucoseChart";
import { GlucoseStatus } from "./components/GlucoseStatus";
import { SettingsForm } from "./components/SettingsForm";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useCredentials } from "./hooks/useCredentials";
import { useGlucoseData } from "./hooks/useGlucoseData";

const PopupApp: React.FC = () => {
  const [currentTab, setCurrentTab] = useState("graph");
  const [graphRenderKey, setGraphRenderKey] = useState(0);
  const { glucoseData, loading, error, forceUpdate } =
    useGlucoseData(currentTab);
  const { credentials, setCredentials, saveCredentials, saveMessage } =
    useCredentials();

  const handleGraphTabClick = () => {
    if (currentTab === "graph") {
      // re-render content of graph-tab
      // so that animations are shown again
      setGraphRenderKey((prev) => prev + 1);
    } else {
      setCurrentTab("graph");
    }
  };

  return (
    <div data-testid="popup-app" className="container">
      <div data-testid="header" className="header">
        <h1>
          <img
            src="../icons/icon128.png"
            alt=""
            width="24"
            height="24"
            style={{ verticalAlign: "middle", marginRight: "8px" }}
          />{" "}
          CGM Glucose Monitor
        </h1>
      </div>

      <div data-testid="tabs" className="tabs">
        <button
          data-testid="tab-graph"
          className={`tab ${currentTab === "graph" ? "active" : ""}`}
          onClick={handleGraphTabClick}
        >
          Graph
        </button>
        <button
          data-testid="tab-settings"
          className={`tab ${currentTab === "settings" ? "active" : ""}`}
          onClick={() => setCurrentTab("settings")}
        >
          Settings
        </button>
      </div>

      <div data-testid="tab-content" className="tab-content">
        {currentTab === "graph" && (
          <div key={graphRenderKey} className="tab-pane active">
            <GlucoseStatus
              value={glucoseData.value}
              lastUpdate={glucoseData.lastUpdate}
              loading={loading}
              onRefresh={forceUpdate}
              isStale={glucoseData.isStale}
              lastError={glucoseData.lastError}
            />

            <GlucoseChart
              data={glucoseData.data || []}
              currentValue={glucoseData.value}
              error={error}
              loading={loading}
            />
          </div>
        )}

        {currentTab === "settings" && (
          <SettingsForm
            credentials={credentials}
            setCredentials={setCredentials}
            onSubmit={saveCredentials}
            saveMessage={saveMessage}
          />
        )}
      </div>
    </div>
  );
};

// Initialize the React app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <ThemeProvider>
      <PopupApp />
    </ThemeProvider>,
  );
}
