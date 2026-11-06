import type { ComponentPropsWithRef } from "react";
export type SelectProps = ComponentPropsWithRef<"select"> & {
  variant?: "default" | "compact" | "badge";
  tone?: "neutral" | "accent" | "success";
};
export function Select({
  variant = "default",
  tone = "neutral",
  className = "",
  ...props
}: SelectProps) {
  return (
    <select
      {...props}
      className={`select select--${variant} select--${tone} ${className}`.trim()}
    />
  );
}
