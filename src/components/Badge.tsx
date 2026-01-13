import clsx from "clsx";

export function Badge({
  children,
  variant = "default"
}: {
  children: React.ReactNode;
  variant?: "default" | "blue" | "purple" | "danger";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-slate-100 text-slate-700": variant === "default",
          "bg-blue-100 text-blue-700": variant === "blue",
          "bg-purple-100 text-purple-700": variant === "purple",
          "bg-red-100 text-red-700": variant === "danger"
        }
      )}
    >
      {children}
    </span>
  );
}
