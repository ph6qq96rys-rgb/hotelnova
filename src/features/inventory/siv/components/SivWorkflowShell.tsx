// src/features/inventory/siv/components/SivWorkflowShell.tsx
// Removed: dark-only lux-page background, hardcoded rgba colors, inline <style>
// Now uses global.css - wrap in .page so the content area tokens apply

import type { ReactNode } from "react";
import { useI18n } from "../../../../i18n";

type Props = {
  title:     string;
  subtitle?: string;
  badge?:    string;
  actions?:  ReactNode;
  children:  ReactNode;
};

export default function SivWorkflowShell({ title, subtitle, badge, actions, children }: Props) {
  const { tx } = useI18n();
  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-kicker">{tx("Inventory")} - {tx("SIV")}</div>
          <div className="page-title">{tx(title)}</div>
          {subtitle && <div className="page-sub">{tx(subtitle)}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {badge && <span className="badge badge-neutral">{tx(badge)}</span>}
          {actions}
        </div>
      </div>

      {/* Content */}
      <div style={{ display: "grid", gap: 16 }}>
        {children}
      </div>
    </div>
  );
}
