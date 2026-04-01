import { useState, useEffect } from "react";
import type { GlucoseData } from "../../../types";

export type StoredGlucoseData = {
  value?: number;
  data?: GlucoseData[];
  lastUpdate?: number;
  lastError?: string;
  lastErrorTime?: number;
  isStale: boolean;
};

export const useGlucoseData = (currentTab: string | null) => {
  const [glucoseData, setGlucoseData] = useState<StoredGlucoseData>({
    isStale: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = (
    message: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    data?: StoredGlucoseData;
    error?: string;
  }> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(
          response || {
            success: false,
            error: "No response from background script",
          },
        );
      });
    });
  };

  const loadGlucoseData = async () => {
    try {
      const response = await sendMessage({ type: "GET_GLUCOSE_DATA" });
      if (response.success && response.data) {
        // Clear lastError if we have fresh data (not stale)
        const dataWithClearedError = {
          ...response.data,
          lastError: response.data.isStale
            ? response.data.lastError
            : undefined,
        };
        setGlucoseData(dataWithClearedError);
        setError(null);
      } else {
        setError(
          "No glucose data available. Please configure your credentials in Settings.",
        );
      }
    } catch (error) {
      console.error("Failed to load glucose data:", error);
      setError(
        "Failed to load glucose data. Please check your internet connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  const forceUpdate = async () => {
    setLoading(true);
    try {
      const response = await sendMessage({ type: "FORCE_UPDATE" });
      if (response.success && response.data) {
        // Clear lastError if we have fresh data (not stale)
        const dataWithClearedError = {
          ...response.data,
          lastError: response.data.isStale
            ? response.data.lastError
            : undefined,
        };
        setGlucoseData(dataWithClearedError);
        setError(null);
      } else {
        setError(response.error || "Failed to update glucose data");
      }
    } catch (error) {
      console.error("Failed to force update:", error);
      setError("Failed to update glucose data. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab !== "graph") {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadGlucoseData();

    // Auto-refresh every minute
    const interval = setInterval(() => {
      if (currentTab === "graph") {
        loadGlucoseData();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [currentTab]);

  return {
    glucoseData,
    loading,
    error,
    forceUpdate,
  };
};
