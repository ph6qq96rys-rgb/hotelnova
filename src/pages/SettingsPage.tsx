// src/pages/security/SettingsPage.tsx

import { useState } from "react";
import "./security.css";

type SettingsSection = "general" | "api" | "appearance" | "security";

const NAV_ITEMS: { key: SettingsSection; label: string }[] = [
  { key: "general",    label: "General" },
  { key: "api",        label: "API & Integrations" },
  { key: "appearance", label: "Appearance" },
  { key: "security",   label: "Security" },
];

function SectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case "general":
      return (
        <div className="sec-card__body">
          <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
            Environment, company name, locale, and system toggles. Wire up the settings API to populate these fields.
          </p>
        </div>
      );
    case "api":
      return (
        <div className="sec-card__body">
          <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
            API base URL configuration, token management, and third-party integration credentials.
          </p>
        </div>
      );
    case "appearance":
      return (
        <div className="sec-card__body">
          <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
            Theme, color scheme, logo, and UI density preferences.
          </p>
        </div>
      );
    case "security":
      return (
        <div className="sec-card__body">
          <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
            Session timeout, password policy, MFA enforcement, and audit log access.
          </p>
        </div>
      );
  }
}

export default function SettingsPage() {
  const [active, setActive] = useState<SettingsSection>("general");
  const current = NAV_ITEMS.find((n) => n.key === active)!;

  return (
    <div className="sec-page">
      <div className="sec-page-header">
        <div>
          <p className="sec-kicker">System</p>
          <h1 className="sec-page-title">Settings</h1>
          <p className="sec-page-subtitle">Environment, integrations, appearance, and security controls.</p>
        </div>
      </div>

      <div className="sec-settings-grid">
        {/* Sidebar nav */}
        <nav className="sec-settings-nav" aria-label="Settings sections">
          <div className="sec-settings-nav__section">Configuration</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sec-settings-nav__item${active === item.key ? " is-active" : ""}`}
              onClick={() => setActive(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="sec-card">
          <div className="sec-card__head">
            <div>
              <p className="sec-card__title">{current.label}</p>
              <p className="sec-card__subtitle">Configure {current.label.toLowerCase()} settings.</p>
            </div>
          </div>
          <SectionContent section={active} />
        </div>
      </div>
    </div>
  );
}