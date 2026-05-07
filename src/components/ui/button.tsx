import * as React from "react";

type ButtonVariant = "default" | "secondary" | "outline" | "destructive" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const base =
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:pointer-events-none ring-offset-background";

const variants: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
  outline: "border border-input bg-background hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
  ghost: "hover:bg-muted",
  link: "underline-offset-4 hover:underline text-primary",
};

const sizes: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3",
  lg: "h-11 px-8",
  icon: "h-10 w-10",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild, ...props }, ref) => {
    // If you want true shadcn behavior, add @radix-ui/react-slot and use <Slot /> here.
    // This lightweight version supports normal <button> usage (and most projects are fine with it).
    if (asChild) {
      // Best-effort: render a span wrapper for styling when using asChild.
      // Prefer adding Radix Slot if you need real "asChild" semantics.
      return (
        <span className={cn(base, variants[variant], sizes[size], className)}>
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <button ref={ref} {...props} className="contents" />
        </span>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
