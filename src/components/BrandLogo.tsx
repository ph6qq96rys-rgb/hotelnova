import logo from "../assets/process360-logo.png";
import "./brand-logo.css";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={compact ? "process360-logo process360-logo--compact" : "process360-logo"}
      viewBox={compact ? "172 164 384 376" : "172 164 1820 376"}
      role="img"
      aria-label="Process360"
    >
      <image href={logo} width="2172" height="724" />
    </svg>
  );
}
