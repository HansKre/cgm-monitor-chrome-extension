import React from "react";
import { useTheme } from "../contexts/ThemeContext";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  credentials: { email: string; password: string };
  setCredentials: (credentials: { email: string; password: string }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: () => void;
  saveMessage: { text: string; type: "success" | "error" } | null;
};

export const SettingsForm: React.FC<Props> = ({
  credentials,
  setCredentials,
  onSubmit,
  onDelete,
  saveMessage,
}) => {
  const { themeColors } = useTheme();

  return (
    <div data-testid="settings-form" className="tab-pane active">
      <div
        style={{
          color: themeColors.text.secondary,
          padding: "12px 0",
          marginBottom: "12px",
          fontSize: "13px",
          lineHeight: "1.5",
          borderTop: `1px solid ${themeColors.border}`,
          borderBottom: `1px solid ${themeColors.border}`,
        }}
      >
        <div style={{ marginBottom: "12px" }}>
          <strong>⚠️ Important Disclaimer:</strong> This project is not
          affiliated with Abbott Laboratories or the official FreeStyle Libre
          product line. Use at your own risk. Data accuracy may vary. Always
          follow guidance from your healthcare provider. This extension is for
          informational purposes only and should not replace professional
          medical advice, diagnosis, or treatment.
        </div>
        <div>
          <strong>Note:</strong> FreeStyle Libre 3 CGM readings occur every
          minute, but LibreView cloud sync updates only every 5 minutes. This is
          a technical limitation of LibreView, not this extension.
        </div>
      </div>

      <div className="settings-info">
        Enter your LibreView credentials to enable automatic glucose monitoring.
        Your credentials are stored securely in Chrome's local storage.
      </div>

      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={credentials.email}
            onChange={(e) =>
              setCredentials({ ...credentials, email: e.target.value })
            }
            placeholder="your@email.com"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={credentials.password}
            onChange={(e) =>
              setCredentials({ ...credentials, password: e.target.value })
            }
            placeholder="Your password"
            required
          />
        </div>

        <button type="submit" className="btn">
          Save Credentials
        </button>

        <button
          type="button"
          className="btn"
          style={{ marginTop: "8px", background: "#c0392b" }}
          onClick={onDelete}
        >
          Delete Credentials
        </button>

        {saveMessage && (
          <div
            className={
              saveMessage.type === "success" ? "success-message" : "error"
            }
          >
            {saveMessage.text}
          </div>
        )}
      </form>

      <ThemeToggle />
    </div>
  );
};
