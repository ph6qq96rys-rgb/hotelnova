// src/features/inventory/siv/components/SivWorkflowShell.tsx
// Removed: dark-only lux-page background, hardcoded rgba colors, inline <style>
// Now uses global.css — wrap in .page so the content area tokens apply

import type { ReactNode } from "react";

type Props = {
  title:     string;
  subtitle?: string;
  badge?:    string;
  actions?:  ReactNode;
  children:  ReactNode;
};

export default function SivWorkflowShell({ title, subtitle, badge, actions, children }: Props) {
  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-kicker">Inventory · SIV</div>
          <div className="page-title">{title}</div>
          {subtitle && <div className="page-sub">{subtitle}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {badge && <span className="badge badge-neutral">{badge}</span>}
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
