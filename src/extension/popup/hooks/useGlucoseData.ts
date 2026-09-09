import { useState, useEffect, useRef, useCallback } from "react";
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
  const [isAutoHealing, setIsAutoHealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoHealInProgressRef = useRef(false);

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

  const forceUpdate = useCallback(async (isHealing: boolean = false) => {
    setLoading(true);
    if (isHealing) {
      setIsAutoHealing(true);
    }
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
    } catch (err) {
      console.error("Failed to force update:", err);
      setError(
        "Failed to update glucose data. Please check your credentials or network.",
      );
    } finally {
      setLoading(false);
      setIsAutoHealing(false);
      autoHealInProgressRef.current = false;
    }
  }, []);

  const loadGlucoseData = useCallback(async () => {
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

        // Auto-heal: If data is stale and not already updating, initiate self-healing
        if (response.data.isStale && !autoHealInProgressRef.current) {
          console.log(
            "🩺 Stale data detected on popup load. Initiating auto-healing...",
          );
          autoHealInProgressRef.current = true;
          forceUpdate(true);
        }
      } else {
        setError(
          "No glucose data available. Please configure your credentials in Settings.",
        );
      }
    } catch (err) {
      console.error("Failed to load glucose data:", err);
      setError(
        "Failed to load glucose data. Please check your internet connection.",
      );
    } finally {
      if (!autoHealInProgressRef.current) {
        setLoading(false);
      }
    }
  }, [forceUpdate]);

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
  }, [currentTab, loadGlucoseData]);

  return {
    glucoseData,
    loading,
    isAutoHealing,
    error,
    forceUpdate: () => forceUpdate(false),
  };
};
