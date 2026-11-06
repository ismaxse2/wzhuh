import type { ComponentPropsWithRef } from "react";
import { useImperativeHandle, useLayoutEffect, useRef } from "react";
export type CheckboxProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
  indeterminate?: boolean;
};
export function Checkbox({
  indeterminate = false,
  ref,
  className = "",
  ...props
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current!, []);
  useLayoutEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate, props.checked]);
  return (
    <input
      {...props}
      ref={inputRef}
      type="checkbox"
      className={`checkbox ${className}`.trim()}
    />
  );
}
