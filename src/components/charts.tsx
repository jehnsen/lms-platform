"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export interface TrendPoint {
  id: string;
  title: string;
  dateLabel: string;
  percent: number;
}

const TREND_HEIGHT = 220;
const MARGIN = { top: 14, right: 44, bottom: 28, left: 36 };

/** Single-series line of quiz scores in the order they were submitted. */
export function ScoreTrendChart({ points, passMark }: { points: TrendPoint[]; passMark: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) return null;

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = TREND_HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (index: number) =>
    MARGIN.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const y = (percent: number) => MARGIN.top + (1 - percent / 100) * innerHeight;

  const gap = points.length > 1 ? innerWidth / (points.length - 1) : innerWidth;
  const labelEvery = Math.max(1, Math.ceil(52 / Math.max(gap, 1)));
  const last = points.length - 1;
  const hovered = hover !== null ? points[hover] : undefined;

  const nearest = (clientX: number, element: Element) => {
    const offset = clientX - element.getBoundingClientRect().left;
    let best = 0;
    for (let index = 1; index < points.length; index += 1) {
      if (Math.abs(x(index) - offset) < Math.abs(x(best) - offset)) best = index;
    }
    return best;
  };

  return (
    <div ref={ref} className="relative" style={{ height: TREND_HEIGHT }}>
      {width > 0 ? (
        <svg
          width={width}
          height={TREND_HEIGHT}
          role="group"
          aria-label={`Quiz scores over time. Latest score ${points[last].percent} percent.`}
          onPointerMove={(event) => setHover(nearest(event.clientX, event.currentTarget))}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 50, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? "var(--chart-axis)" : "var(--chart-grid)"}
              />
              <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular-nums">
                {tick}%
              </text>
            </g>
          ))}

          <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(passMark)} y2={y(passMark)} stroke="var(--chart-axis)" />
          <text
            x={MARGIN.left + 4}
            // Sit on whichever side of the line the first score isn't.
            y={y(passMark) + (points[0].percent >= passMark ? 14 : -5)}
            className="fill-ink-3 text-[11px]"
          >
            Pass mark {passMark}%
          </text>

          {hover !== null ? (
            <line x1={x(hover)} x2={x(hover)} y1={MARGIN.top} y2={y(0)} stroke="var(--chart-axis)" />
          ) : null}

          <polyline
            fill="none"
            stroke="var(--chart)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={points.map((point, index) => `${x(index)},${y(point.percent)}`).join(" ")}
          />

          {points.map((point, index) => (
            <g key={point.id}>
              <circle
                cx={x(index)}
                cy={y(point.percent)}
                r={hover === index ? 6 : 5}
                fill="var(--chart)"
                stroke="var(--surface)"
                strokeWidth={2}
                tabIndex={0}
                role="img"
                aria-label={`${point.title}, ${point.dateLabel}: ${point.percent}%`}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
              />
              {index % labelEvery === 0 || index === last ? (
                <text
                  x={x(index)}
                  y={TREND_HEIGHT - 8}
                  textAnchor={points.length === 1 ? "middle" : index === 0 ? "start" : index === last ? "end" : "middle"}
                  className={cn(
                    "fill-ink-3 text-[11px]",
                    // The last label always shows, so drop a neighbour that would collide with it.
                    index !== last && last - index < labelEvery && "hidden",
                  )}
                >
                  {point.dateLabel}
                </text>
              ) : null}
            </g>
          ))}

          <text
            x={x(last) + 10}
            y={y(points[last].percent)}
            dy="0.32em"
            className="fill-ink text-xs font-semibold tabular-nums"
          >
            {points[last].percent}%
          </text>
        </svg>
      ) : null}

      {hovered && hover !== null ? (
        <div
          role="status"
          className={cn(
            "pointer-events-none absolute z-10 w-max max-w-56 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md",
            x(hover) < 120 ? "translate-x-0" : x(hover) > width - 120 ? "-translate-x-full" : "-translate-x-1/2",
          )}
          style={{ left: x(hover), top: Math.max(0, y(hovered.percent) - 64) }}
        >
          <div className="font-semibold tabular-nums">{hovered.percent}%</div>
          <div className="text-ink-2">{hovered.title}</div>
          <div className="text-ink-3">{hovered.dateLabel}</div>
        </div>
      ) : null}
    </div>
  );
}

export interface Column {
  label: string;
  value: number;
  /** How the value reads in the tooltip, e.g. "45 min". */
  valueLabel: string;
  detail?: string;
}

/** Single-series column chart with a tooltip on hover or keyboard focus. */
export function ColumnChart({
  columns,
  ariaLabel,
  showValues = true,
  className = "h-40",
}: {
  columns: Column[];
  ariaLabel: string;
  /** Print each value on its column. Leave off when the tooltip is enough. */
  showValues?: boolean;
  className?: string;
}) {
  const max = Math.max(1, ...columns.map((column) => column.value));
  return (
    <div
      role="img"
      aria-label={`${ariaLabel}: ${columns.map((column) => `${column.label} ${column.valueLabel}`).join(", ")}`}
    >
      <div className={cn("flex items-end gap-2 border-b border-chart-axis", className)}>
        {columns.map((column) => (
          <div
            key={column.label}
            tabIndex={0}
            className="group relative flex h-full flex-1 flex-col items-center justify-end rounded-sm"
          >
            {showValues ? (
              <span className="mb-1 text-xs font-medium tabular-nums">{column.value}</span>
            ) : null}
            <div
              className="w-full max-w-6 rounded-t bg-chart transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
              style={{
                height: `${(column.value / max) * (showValues ? 78 : 100)}%`,
                minHeight: column.value > 0 ? 2 : 0,
              }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden w-max max-w-48 -translate-x-1/2 translate-y-6 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md group-hover:block group-focus-visible:block">
              <div className="font-semibold">
                {column.valueLabel} · {column.label}
              </div>
              {column.detail ? <div className="mt-0.5 text-ink-2">{column.detail}</div> : null}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {columns.map((column) => (
          <div key={column.label} className="flex-1 text-center text-[11px] text-ink-3 tabular-nums">
            {column.label}
          </div>
        ))}
      </div>
    </div>
  );
}
