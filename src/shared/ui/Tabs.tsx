import type { ComponentPropsWithRef, HTMLAttributes } from "react";
export type TabsProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "nav";
  variant?: "filters" | "navigation";
};
export function Tabs({
  as: Tag = "div",
  variant = "filters",
  className = "",
  ...props
}: TabsProps) {
  return (
    <Tag
      {...props}
      className={`${variant === "navigation" ? "tabs-navigation" : "tabs"} ${className}`.trim()}
    />
  );
}
export type TabButtonProps = ComponentPropsWithRef<"button"> & {
  selected: boolean;
};
export function TabButton({
  selected,
  className = "",
  type = "button",
  ...props
}: TabButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={selected}
      className={`${selected ? "selected" : ""} ${className}`.trim()}
    />
  );
}
