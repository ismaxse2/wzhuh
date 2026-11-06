import type { ReactNode } from "react";
export function RingProgress({
  value,
  label,
  valueText,
  children,
  className = "ring-progress",
}: {
  value: number;
  label: string;
  valueText?: string;
  children?: ReactNode;
  className?: string;
}) {
  const percent = Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;
  return (
    <div
      className={className}
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle
          cx="9"
          cy="9"
          r="7"
          fill="none"
          stroke="var(--border)"
          strokeWidth="2.2"
        />
        {percent > 0 && (
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.2"
            pathLength="100"
            strokeDasharray={`${percent} 100`}
            strokeLinecap="round"
            transform="rotate(-90 9 9)"
          />
        )}
      </svg>
      <span aria-hidden="true">{children ?? `${percent}%`}</span>
    </div>
  );
}
