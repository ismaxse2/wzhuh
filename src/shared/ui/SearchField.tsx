import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
export type SearchFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  "aria-label": string;
  wrapperClassName?: string;
};
export function SearchField({
  wrapperClassName = "",
  ...props
}: SearchFieldProps) {
  return (
    <label className={`search-field ${wrapperClassName}`.trim()}>
      <Search size={17} aria-hidden="true" />
      <input {...props} />
    </label>
  );
}
