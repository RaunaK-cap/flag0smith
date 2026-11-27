"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { clock } from "@/lib/format";
import type { TrafficPoint } from "@/lib/run-view";

// Control is always grey; each other variant gets the next chart colour.
export function variantColor(variant: string, index: number) {
  if (variant === "control") return "var(--chart-1)";
  return `var(--chart-${(index % 4) + 2})`;
}

export function TrafficChart({ series, variants }: { series: TrafficPoint[]; variants: string[] }) {
  const ordered = orderVariants(variants);
  const config: ChartConfig = {};
  ordered.forEach((variant, index) => {
    config[variant] = { label: variant, color: variantColor(variant, index - 1) };
  });

  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <LineChart data={series} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="at" tickFormatter={clock} tickLine={false} axisLine={false} minTickGap={48} fontSize={11} />
        <YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={44} fontSize={11} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => clock(Number(payload?.[0]?.payload?.at))}
              formatter={(value, name) => `${name}: ${Number(value).toFixed(1)}%`}
            />
          }
        />
        {ordered.map((variant) => (
          <Line
            key={variant}
            dataKey={variant}
            type="monotone"
            dot={false}
            strokeWidth={1.75}
            stroke={`var(--color-${variant})`}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

export function orderVariants(variants: string[]) {
  return [...variants].sort((a, b) => (a === "control" ? -1 : b === "control" ? 1 : a.localeCompare(b)));
}
