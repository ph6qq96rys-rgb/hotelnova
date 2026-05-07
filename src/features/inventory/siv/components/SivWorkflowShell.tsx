import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function SivWorkflowShell({
  title,
  subtitle,
  badge,
  actions,
  children,
}: Props) {
  return (
    <div className="lux-page min-h-screen">
      <style>{`
        .lux-page {
          background:
            radial-gradient(circle at top left, rgba(200, 169, 107, 0.08), transparent 26%),
            radial-gradient(circle at right, rgba(59, 130, 246, 0.08), transparent 20%),
            linear-gradient(180deg, #07101d 0%, #091523 100%);
          color: #e5edf8;
          padding: 24px;
          min-height: 100vh;
        }

        .lux-shell {
          max-width: 1480px;
          margin: 0 auto;
          display: grid;
          gap: 20px;
        }

        .lux-card {
          background: rgba(10, 19, 36, 0.88);
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 24px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(12px);
          padding: 20px;
        }

        .lux-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .lux-title {
          margin: 0;
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .lux-subtitle {
          margin-top: 8px;
          color: #94a3b8;
          font-size: 14px;
          line-height: 1.6;
        }

        .lux-badge {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(255,255,255,0.05);
        }

        .lux-section-title {
          margin: 0 0 14px;
          font-size: 16px;
          font-weight: 800;
        }

        .lux-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .lux-field {
          display: grid;
          gap: 6px;
        }

        .lux-label {
          font-size: 12px;
          color: #94a3b8;
        }

        .lux-value {
          font-size: 14px;
          font-weight: 600;
          word-break: break-word;
        }

        @media (max-width: 900px) {
          .lux-grid-2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="lux-shell">
        <section className="lux-card">
          <div className="lux-hero">
            <div>
              <h1 className="lux-title">{title}</h1>
              {subtitle ? <div className="lux-subtitle">{subtitle}</div> : null}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              {badge ? <div className="lux-badge">{badge}</div> : null}
              {actions}
            </div>
          </div>
        </section>

        {children}
      </div>
    </div>
  );
}