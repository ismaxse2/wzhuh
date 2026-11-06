import type { ComponentPropsWithRef } from "react";
export type IconButtonProps = ComponentPropsWithRef<"button"> & {
  "aria-label": string;
  variant?: "default" | "plain";
};
export function IconButton({
  variant = "default",
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`${variant === "default" ? "icon-button" : ""} ${className}`.trim()}
    />
  );
}
