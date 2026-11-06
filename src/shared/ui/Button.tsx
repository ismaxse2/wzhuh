import type { ComponentPropsWithRef } from "react";
export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "danger-outline" | "text";
};
export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const base = variant === "text" ? "text-button" : `button ${variant}`;
  return (
    <button {...props} type={type} className={`${base} ${className}`.trim()} />
  );
}
