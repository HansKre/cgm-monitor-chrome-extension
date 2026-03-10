import axios from "axios";
import { ChromeStorage } from "../utils/storage";
import { IconGenerator } from "../utils/iconGenerator";
import type {
  GlucoseData,
  ApiResponse,
  LoginResponse,
  ConnectionsResponse,
  GraphResponse,
} from "../../types";

// Type for API error response with minimum version requirement
type ApiMinimumVersionError = {
  status: number;
  data: {
    minimumVersion: string;
  };
};

// API Configuration
const buildApiUrl = (region?: string): string => {
  return region
    ? `https://api-${region}.libreview.io`
    : "https://api.libreview.io";
};

let API_BASE_URL = buildApiUrl();
const DEFAULT_API_VERSION = "4.16.0";

// Dynamic headers that use persisted minimum version if available
const getHeaders = async (): Promise<Record<string, string>> => {
  const storedVersion = await ChromeStorage.getApiMinimumVersion();
  const version = storedVersion || DEFAULT_API_VERSION;

  return {
    "accept-encoding": "gzip",
    "cache-control": "no-cache",
    connection: "Keep-Alive",
    "content-type": "application/json",
    product: "llu.android",
    version,
  };
};

// Configure axios instance with base URL only (headers set dynamically per request)
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Helper function to update axios default headers with stored version
const updateAxiosHeaders = async (): Promise<void> => {
  const headers = await getHeaders();
  // Update axios instance defaults with dynamic headers
  apiClient.defaults.headers.common = {
    ...apiClient.defaults.headers.common,
    ...headers,
  };
};

// Helper function to detect and handle minimum version errors
const handleMinimumVersionError = async (error: unknown): Promise<boolean> => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as
      | ApiMinimumVersionError
      | undefined;
    const minimumVersion = responseData?.data?.minimumVersion;
    const status = error.response?.status;

    // Check if this is a 403 error with minimum version requirement
    if (status === 403 && minimumVersion) {
      console.log(
        `🔄 API requires minimum version ${minimumVersion}. Updating stored version...`,
      );
      await ChromeStorage.setApiMinimumVersion(minimumVersion);
      // Update axios headers with new version
      await updateAxiosHeaders();
      return true; // Indicates version was updated
    }
  }
  return false; // No version update needed
};

class LibreViewAPI {
  private auth: ApiResponse | null = null;

  private async performLogin(
    email: string,
    password: string,
  ): Promise<{ jwtToken: string; accountId: string }> {
    await updateAxiosHeaders();

    let loginResponse: LoginResponse;
    try {
      const response = await apiClient.post<LoginResponse>("/llu/auth/login", {
        email,
        password,
      });
      loginResponse = response.data;
    } catch (error) {
      const versionUpdated = await handleMinimumVersionError(error);
      if (versionUpdated) {
        console.log("🔄 Retrying authentication with updated API version...");
        return this.performLogin(email, password);
      }
      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data as LoginResponse | undefined;
        const serverMessage = responseData?.error?.message;
        throw new Error(
          serverMessage ||
            `HTTP ${error.response?.status || "N/A"}: ${error.message}`,
        );
      }
      throw error;
    }

    // Handle region redirect
    if (
      loginResponse?.status === 0 &&
      loginResponse?.data?.redirect === true &&
      loginResponse?.data?.region
    ) {
      const region = loginResponse.data.region;
      const newApiUrl = buildApiUrl(region);

      console.log(
        `Login redirect detected for region: ${region}, adjusting API URL to: ${newApiUrl}`,
      );

      API_BASE_URL = newApiUrl;
      apiClient.defaults.baseURL = newApiUrl;

      const retryResponse = await apiClient.post<LoginResponse>(
        "/llu/auth/login",
        { email, password },
      );
      loginResponse = retryResponse.data;
    }

    const jwtToken = loginResponse?.data?.authTicket?.token;
    const accountId = loginResponse?.data?.user?.id;

    if (!jwtToken) {
      throw new Error(loginResponse?.error?.message || "Authentication failed");
    }
    if (!accountId) throw new Error("Account ID not found");

    return { jwtToken, accountId };
  }

  async validateCredentials(email: string, password: string): Promise<void> {
    await this.performLogin(email, password);
  }

  async authenticate(): Promise<ApiResponse> {
    const credentials = await ChromeStorage.getCredentials();

    if (!credentials.email || !credentials.password) {
      throw new Error(
        "No credentials stored. Please configure in extension popup.",
      );
    }

    const { jwtToken, accountId } = await this.performLogin(
      credentials.email,
      credentials.password,
    );

    const accountIdHash = await this.sha256(accountId);

    // Retrieve patientId with version error handling
    let connectionsResponse: { data: ConnectionsResponse };
    try {
      connectionsResponse = await apiClient.get<ConnectionsResponse>(
        "/llu/connections",
        {
          headers: {
            authorization: `Bearer ${jwtToken}`,
            "account-id": accountIdHash,
          },
        },
      );
    } catch (error) {
      const versionUpdated = await handleMinimumVersionError(error);
      if (versionUpdated) {
        console.log(
          "🔄 Retrying connections request with updated API version...",
        );
        return this.authenticate();
      }
      throw error;
    }

    const patientId = connectionsResponse.data?.data?.[0]?.patientId;
    if (!patientId) throw new Error("No patient ID found");

    this.auth = { jwtToken, accountIdHash, patientId };
    return this.auth;
  }

  private async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async fetchGlucoseData(): Promise<{
    data: GlucoseData[];
    currentMeasurementValue?: number;
  }> {
    if (!this.auth) {
      await this.authenticate();
    }

    if (!this.auth) {
      throw new Error("Authentication required");
    }

    let graphResponse: GraphResponse;

    try {
      const response = await apiClient.get<GraphResponse>(
        `/llu/connections/${this.auth.patientId}/graph`,
        {
          headers: {
            authorization: `Bearer ${this.auth.jwtToken}`,
            "account-id": this.auth.accountIdHash,
          },
        },
      );

      graphResponse = response.data;
    } catch (error) {
      // Check for minimum version error and update if needed
      const versionUpdated = await handleMinimumVersionError(error);
      if (versionUpdated) {
        // Retry with updated version
        console.log("🔄 Retrying request with updated API version...");
        return this.fetchGlucoseData();
      }

      // Try to re-authenticate once on failure
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log("🔑 401 Unauthorized - Attempting re-authentication...");
        this.auth = null;
        await this.authenticate();
        return this.fetchGlucoseData();
      }

      // Enhanced error message with more context
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const url = error.config?.url;
        throw new Error(
          `Failed to fetch glucose data: HTTP ${status || "N/A"} ${statusText || error.message} (${url || "unknown endpoint"})`,
        );
      }

      throw new Error(
        `Failed to fetch glucose data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    const currentMeasurementValue =
      graphResponse?.data?.connection?.glucoseMeasurement?.Value;

    return {
      data: graphResponse?.data?.graphData || [],
      currentMeasurementValue,
    };
  }
}

class BackgroundService {
  private api = new LibreViewAPI();
  private lastUpdateTime = 0;
  private readonly MIN_UPDATE_INTERVAL_MS = 55000; // Minimum 55 seconds between updates
  private readonly DATA_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // CGM cloud sync updates every 5 minutes
  readonly ALARM_NAME = "glucoseUpdate";

  async initialize() {
    console.log("CGM Extension Background Service Starting...");

    // Check if credentials exist before starting updates
    const credentials = await ChromeStorage.getCredentials();
    if (credentials.email && credentials.password) {
      console.log("Credentials found, starting periodic updates...");

      // Check if we have existing glucose data to display immediately
      const existingData = await ChromeStorage.getGlucoseData();
      if (existingData.value) {
        console.log(
          `Found existing glucose data: ${existingData.value} mg/dL${existingData.isStale ? " (stale)" : ""}`,
        );
        await IconGenerator.updateBrowserIcon(
          existingData.value,
          existingData.isStale,
        );
      }

      // Start periodic updates
      this.startPeriodicUpdates();
      // Initial update (respecting rate limiting)
      await this.updateGlucoseData();
    } else {
      console.log("No credentials found, waiting for user configuration...");
      // Set initial title to indicate setup needed
      if (chrome.action && chrome.action.setTitle) {
        chrome.action.setTitle({
          title: "CGM Glucose Monitor - Setup Required",
        });
      }
    }
  }

  private startPeriodicUpdates() {
    // Clear any existing alarm
    chrome.alarms.clear(this.ALARM_NAME);

    // Initial fetch happens immediately in initialize()
    // We'll schedule the next alarm after receiving data
    console.log(
      "Periodic updates will be scheduled dynamically based on data timestamps",
    );
  }

  private scheduleNextUpdate(lastDataTimestamp: string) {
    // Parse the last data timestamp
    const lastUpdate = new Date(lastDataTimestamp);
    const now = new Date();

    // Calculate when the next data point should be available (5 minutes after last timestamp)
    const nextDataAvailable = new Date(
      lastUpdate.getTime() + this.DATA_UPDATE_INTERVAL_MS,
    );

    // Add a small buffer (10 seconds) to ensure data is available
    const nextFetchTime = new Date(nextDataAvailable.getTime() + 10000);

    // Calculate delay in minutes
    let delayMs = nextFetchTime.getTime() - now.getTime();

    // If the calculated time is in the past or very soon, fetch in 1 minute
    if (delayMs < 60000) {
      delayMs = 60000;
    }

    const delayMinutes = delayMs / 60000;

    // Clear any existing alarm and create new one
    chrome.alarms.clear(this.ALARM_NAME);
    chrome.alarms.create(this.ALARM_NAME, {
      delayInMinutes: delayMinutes,
    });

    console.log(
      `📅 Next glucose update scheduled in ${delayMinutes.toFixed(1)} minutes at ${nextFetchTime.toLocaleTimeString()} (last data: ${lastUpdate.toLocaleTimeString()})`,
    );
  }

  async updateGlucoseData() {
    try {
      // Rate limiting: Check if enough time has passed since last update
      const now = Date.now();
      const timeSinceLastUpdate = now - this.lastUpdateTime;

      if (
        this.lastUpdateTime > 0 &&
        timeSinceLastUpdate < this.MIN_UPDATE_INTERVAL_MS
      ) {
        console.log(
          `⏸️ Rate limiting: Only ${Math.round(
            timeSinceLastUpdate / 1000,
          )}s since last update, minimum ${
            this.MIN_UPDATE_INTERVAL_MS / 1000
          }s required`,
        );
        return;
      }

      // Double-check credentials before fetching
      const credentials = await ChromeStorage.getCredentials();
      if (!credentials.email || !credentials.password) {
        console.log(
          "⚠️ No credentials available, skipping glucose data update",
        );
        return;
      }

      const timeSinceLastUpdateDisplay =
        this.lastUpdateTime > 0
          ? `${Math.round(timeSinceLastUpdate / 1000)}s since last update`
          : "first update";

      console.log(
        `🔄 Updating glucose data... (${timeSinceLastUpdateDisplay})`,
      );

      const result = await this.api.fetchGlucoseData();

      if (result && result.data && result.data.length > 0) {
        // Use currentMeasurementValue as the very latest value if available,
        // otherwise fall back to the last item from graphData
        const latestValue =
          result.currentMeasurementValue ??
          result.data[result.data.length - 1].Value;

        // Ensure graph data includes the current measurement if it's newer
        const processedData = [...result.data];
        if (result.currentMeasurementValue && processedData.length > 0) {
          const lastDataPoint = processedData[processedData.length - 1];
          const currentTime = new Date();
          const lastDataTime = new Date(lastDataPoint.Timestamp);

          // If current measurement is different from the last graph point,
          // add it as a new data point (don't overwrite historical data)
          if (lastDataPoint.Value !== result.currentMeasurementValue) {
            // Add current measurement as a new data point if it's reasonably newer
            const timeDifferenceMinutes =
              (currentTime.getTime() - lastDataTime.getTime()) / (1000 * 60);

            if (timeDifferenceMinutes >= 1) {
              // Add new data point for current measurement
              const newDataPoint: GlucoseData = {
                ...lastDataPoint, // Copy all properties from last data point
                Value: result.currentMeasurementValue,
                ValueInMgPerDl: result.currentMeasurementValue,
                Timestamp: currentTime.toISOString(),
                FactoryTimestamp: currentTime.toISOString(),
              };
              processedData.push(newDataPoint);
              console.log(
                `📊 Added current measurement as new data point: ${result.currentMeasurementValue} mg/dL at ${currentTime.toLocaleTimeString()}`,
              );
            } else {
              // If time difference is small, update the last point to avoid clustering
              processedData[processedData.length - 1] = {
                ...lastDataPoint,
                Value: result.currentMeasurementValue,
                ValueInMgPerDl: result.currentMeasurementValue,
                Timestamp: currentTime.toISOString(),
                FactoryTimestamp: currentTime.toISOString(),
              };
              console.log(
                `📊 Updated last data point with current measurement: ${result.currentMeasurementValue} mg/dL`,
              );
            }
          }
        }

        // Store data
        await ChromeStorage.setGlucoseData(latestValue, processedData);

        // Update icon (data is fresh, so not stale)
        await IconGenerator.updateBrowserIcon(latestValue, false);

        // Update last fetch time
        this.lastUpdateTime = now;

        console.log(
          `✓ Updated glucose value: ${latestValue} mg/dL at ${new Date().toLocaleTimeString()}${result.currentMeasurementValue ? " (from current measurement)" : " (from graph data)"}`,
        );

        // Schedule next update based on the latest data timestamp
        const latestDataPoint = processedData[processedData.length - 1];
        this.scheduleNextUpdate(latestDataPoint.Timestamp);
      } else {
        console.log("No glucose data received from API");
      }
    } catch (error) {
      // Enhanced error logging with detailed context
      let errorMessage = "Unknown error";
      let errorDetails = "";

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const responseData = error.response?.data;
        const requestUrl = error.config?.url;
        const requestMethod = error.config?.method?.toUpperCase();

        errorMessage = `HTTP ${status || "N/A"}: ${statusText || error.message}`;
        errorDetails = `${requestMethod || "GET"} ${requestUrl || "unknown endpoint"}`;

        console.error(
          `❌ Failed to update glucose data:
  Error: ${errorMessage}
  Request: ${errorDetails}
  Response Data:`,
          responseData || "No response data",
        );

        // Log additional context for specific error codes
        if (status === 403) {
          console.error(
            "  ⚠️ 403 Forbidden: Authentication token may be invalid or expired. Will attempt re-authentication on next update.",
          );
        } else if (status === 401) {
          console.error(
            "  ⚠️ 401 Unauthorized: Credentials may be incorrect. Check email/password.",
          );
        } else if (status === 429) {
          console.error(
            "  ⚠️ 429 Too Many Requests: Rate limit exceeded. Will retry later.",
          );
        } else if (status === 500 || (status && status >= 500)) {
          console.error(
            "  ⚠️ Server Error: LibreView API is experiencing issues. Will retry later.",
          );
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        console.error(
          `❌ Failed to update glucose data: ${errorMessage}`,
          error,
        );
      } else {
        errorMessage = String(error);
        console.error(`❌ Failed to update glucose data: ${errorMessage}`);
      }

      // Store the error for display in popup
      const fullErrorMessage = errorDetails
        ? `${errorMessage} (${errorDetails})`
        : errorMessage;
      await ChromeStorage.setError(fullErrorMessage);

      // Check if we have existing glucose data to show with stale indicator
      const existingData = await ChromeStorage.getGlucoseData();
      if (existingData.value) {
        console.log(
          `ℹ️ Using cached glucose data: ${existingData.value} mg/dL (marked as stale)`,
        );

        // Update icon with stale indicator
        await IconGenerator.updateBrowserIcon(existingData.value, true);

        // If we have existing data with timestamps, schedule next update based on last timestamp
        if (existingData.data && existingData.data.length > 0) {
          const latestDataPoint =
            existingData.data[existingData.data.length - 1];
          this.scheduleNextUpdate(latestDataPoint.Timestamp);
          console.log(
            "  Next retry will be scheduled based on last data timestamp",
          );
        }
      } else {
        console.log("  ⚠️ No cached glucose data available");
      }

      // Update icon to show error state
      if (chrome.action && chrome.action.setTitle) {
        chrome.action.setTitle({
          title: `CGM Glucose Monitor - Error: ${errorMessage}`,
        });
      }
    }
  }

  async handleMessage(
    message: {
      type: string;
      credentials?: { email: string; password: string };
    },
    sendResponse: (response?: {
      success: boolean;
      data?: unknown;
      error?: string;
    }) => void,
  ) {
    switch (message.type) {
      case "GET_GLUCOSE_DATA":
        try {
          const data = await ChromeStorage.getGlucoseData();
          sendResponse({ success: true, data });
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message });
        }
        break;

      case "UPDATE_CREDENTIALS":
        try {
          if (!message.credentials) {
            throw new Error("No credentials provided");
          }
          // Validate credentials with the server before saving
          await this.api.validateCredentials(
            message.credentials.email,
            message.credentials.password,
          );
          await ChromeStorage.setCredentials(message.credentials);
          // Clear auth to force re-authentication with new credentials
          this.api = new LibreViewAPI();

          // Start periodic updates now that we have credentials
          this.startPeriodicUpdates();

          // Trigger immediate update
          await this.updateGlucoseData();
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message });
        }
        break;

      case "DELETE_CREDENTIALS":
        try {
          await ChromeStorage.setCredentials({});
          this.api = new LibreViewAPI();
          chrome.alarms.clear(this.ALARM_NAME);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message });
        }
        break;

      case "FORCE_UPDATE":
        try {
          console.log("Force update requested from popup");
          await this.updateGlucoseData();
          const data = await ChromeStorage.getGlucoseData();
          sendResponse({ success: true, data });
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message });
        }
        break;

      default:
        sendResponse({ success: false, error: "Unknown message type" });
    }
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Chrome extension event listeners
chrome.runtime.onInstalled.addListener(() => {
  backgroundService.initialize();
});

chrome.runtime.onStartup.addListener(() => {
  backgroundService.initialize();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  backgroundService.handleMessage(message, sendResponse);
  return true; // Keep message channel open for async response
});

// Handle chrome alarms for periodic glucose updates
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === backgroundService.ALARM_NAME) {
    console.log(
      "⏰ Glucose update alarm triggered at",
      new Date().toLocaleTimeString(),
    );
    try {
      await backgroundService.updateGlucoseData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const url = error.config?.url;
        console.error(
          `❌ Alarm-triggered update failed: HTTP ${status || "N/A"} (${url || "unknown endpoint"})`,
          error.response?.data || error.message,
        );
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("❌ Alarm-triggered update failed:", errorMessage);
      }
    }
  }
});

// Handle service worker lifecycle
self.addEventListener("activate", () => {
  console.log("CGM Extension Service Worker Activated");
  backgroundService.initialize();
});
