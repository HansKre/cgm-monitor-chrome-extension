import { useState, useEffect } from "react";

type Credentials = {
  email: string;
  password: string;
};

export const useCredentials = () => {
  const [credentials, setCredentials] = useState<Credentials>({
    email: "",
    password: "",
  });
  const [saveMessage, setSaveMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const sendMessage = (
    message: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> => {
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

  const loadCredentials = async () => {
    try {
      const result = await chrome.storage.sync.get(["credentials"]);
      const storedCredentials = (result.credentials ||
        {}) as Partial<Credentials>;
      setCredentials({ email: storedCredentials.email ?? "", password: "" });
    } catch (err) {
      console.error("Failed to load credentials:", err);
    }
  };

  const saveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.email || !credentials.password) {
      setSaveMessage({
        text: "Please fill in both email and password.",
        type: "error",
      });
      return;
    }

    try {
      const response = await sendMessage({
        type: "UPDATE_CREDENTIALS",
        credentials: credentials,
      });

      if (response.success) {
        setSaveMessage({
          text: "Credentials saved successfully! Glucose data will update automatically.",
          type: "success",
        });
        setCredentials({ ...credentials, password: "" });
      } else {
        setSaveMessage({
          text: `Failed to save credentials: ${response.error}`,
          type: "error",
        });
      }
    } catch {
      setSaveMessage({
        text: "Failed to save credentials. Please try again.",
        type: "error",
      });
    }

    setTimeout(() => setSaveMessage(null), 5000);
  };

  const deleteCredentials = async () => {
    try {
      const response = await sendMessage({ type: "DELETE_CREDENTIALS" });
      if (response.success) {
        setCredentials({ email: "", password: "" });
        setSaveMessage({ text: "Credentials deleted.", type: "success" });
      } else {
        setSaveMessage({
          text: `Failed to delete credentials: ${response.error}`,
          type: "error",
        });
      }
    } catch {
      setSaveMessage({
        text: "Failed to delete credentials. Please try again.",
        type: "error",
      });
    }
    setTimeout(() => setSaveMessage(null), 5000);
  };

  useEffect(() => {
    loadCredentials();
  }, []);

  return {
    credentials,
    setCredentials,
    saveCredentials,
    deleteCredentials,
    saveMessage,
  };
};
