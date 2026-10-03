import * as React from "react";

export const Checkbox = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  (props, ref) => <input {...props} ref={ref} type="checkbox" />
);
Checkbox.displayName = "Checkbox";
