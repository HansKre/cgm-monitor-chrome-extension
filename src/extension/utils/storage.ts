import type { GlucoseData } from "../../types";

export type StoredCredentials = {
  email?: string;
  password?: string;
};

export type StoredData = {
  credentials?: StoredCredentials;
  lastGlucoseValue?: number;
  lastUpdate?: number;
  glucoseData?: GlucoseData[];
  theme?: "light" | "dark" | "system";
  lastError?: string;
  lastErrorTime?: number;
  apiMinimumVersion?: string;
};

export class ChromeStorage {
  static async get<T extends keyof StoredData>(
    keys: T[],
  ): Promise<Pick<StoredData, T>> {
    return new Promise((resolve) => {
      // Use local storage instead of sync to avoid quota issues
      chrome.storage.local.get(keys, (result) => {
        resolve(result as Pick<StoredData, T>);
      });
    });
  }

  static async set(data: Partial<StoredData>): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use local storage for large data, sync only for credentials
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          console.error("Storage error:", chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  static async getCredentials(): Promise<StoredCredentials> {
    // Get credentials from sync storage
    return new Promise((resolve) => {
      chrome.storage.sync.get(["credentials"], (result) => {
        resolve(result.credentials || {});
      });
    });
  }

  static async setCredentials(credentials: StoredCredentials): Promise<void> {
    // Store credentials in sync storage for cross-device sync
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ credentials }, () => {
        if (chrome.runtime.lastError) {
          console.error("Credential storage error:", chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  static async getGlucoseData(): Promise<{
    value?: number;
    data?: GlucoseData[];
    lastUpdate?: number;
    lastError?: string;
    lastErrorTime?: number;
    isStale: boolean;
  }> {
    const result = await this.get([
      "lastGlucoseValue",
      "glucoseData",
      "lastUpdate",
      "lastError",
      "lastErrorTime",
    ]);
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000; // 5 minutes in milliseconds
    const isStale = !result.lastUpdate || result.lastUpdate < fiveMinutesAgo;

    return {
      value: result.lastGlucoseValue,
      data: result.glucoseData,
      lastUpdate: result.lastUpdate,
      lastError: result.lastError,
      lastErrorTime: result.lastErrorTime,
      isStale,
    };
  }

  static async setGlucoseData(
    value: number,
    data: GlucoseData[],
  ): Promise<void> {
    // Limit stored data to last 200 readings to avoid quota issues
    // At ~5 minute intervals, this provides ~16 hours of historical data
    const limitedData = data.slice(-200);
    await this.set({
      lastGlucoseValue: value,
      glucoseData: limitedData,
      lastUpdate: Date.now(),
      // Clear any previous error when data is successfully updated
      lastError: undefined,
      lastErrorTime: undefined,
    });
  }

  static async setError(errorMessage: string): Promise<void> {
    await this.set({
      lastError: errorMessage,
      lastErrorTime: Date.now(),
    });
  }

  static async getApiMinimumVersion(): Promise<string | undefined> {
    const result = await this.get(["apiMinimumVersion"]);
    return result.apiMinimumVersion;
  }

  static async setApiMinimumVersion(version: string): Promise<void> {
    await this.set({
      apiMinimumVersion: version,
    });
  }
}
