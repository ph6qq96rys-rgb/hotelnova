import type { ReactNode } from "react";

export function Select({ label, options }: { label: string; options: string[] }) {
  return <label className="cem-field"><span>{label}</span><select defaultValue={options[0]}>{options.map((item) => <option key={item}>{item}</option>)}</select></label>;
}

export function Input({ label, value, type = "text" }: { label: string; value: string; type?: string }) {
  return <label className="cem-field"><span>{label}</span><input type={type} defaultValue={value} /></label>;
}

export function PrototypeAction({
  children,
  onRun,
  variant = "secondary",
}: {
  children: ReactNode;
  onRun: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      className={`cem-button cem-button--${variant} cem-button--prototype`}
      onClick={onRun}
      title="Prototype action: records local feedback without posting to the ERP."
      type="button"
    >
      {children}
    </button>
  );
}

export function Impact({ label, value }: { label: string; value: string }) {
  return <div className="cem-impact-row"><span>{label}</span><strong>{value}</strong></div>;
}
