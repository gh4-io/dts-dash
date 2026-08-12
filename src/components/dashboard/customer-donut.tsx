"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useCustomers } from "@/lib/hooks/use-customers";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface CustomerDonutProps {
  workPackages: SerializedWorkPackage[];
  onCustomerClick?: (customer: string) => void;
}

export function CustomerDonut({ workPackages, onCustomerClick }: CustomerDonutProps) {
  const { getColor } = useCustomers();

  const chartData = useMemo(() => {
    const grouped = new Map<string, Set<string>>();
    workPackages.forEach((wp) => {
      if (!grouped.has(wp.customer)) grouped.set(wp.customer, new Set());
      grouped.get(wp.customer)!.add(wp.aircraftReg);
    });

    // Denominator is the sum of the slices, not the global unique-registration
    // count: a tail flown under two customers belongs to both slices, and
    // Recharts draws arcs proportional to that sum. Dividing by the global
    // count would print percentages that exceed 100% and disagree with the
    // geometry. (OI-133)
    const total = Array.from(grouped.values()).reduce((sum, regs) => sum + regs.size, 0);

    return Array.from(grouped.entries())
      .map(([name, regs]) => ({
        name,
        value: regs.size,
        pct: total > 0 ? ((regs.size / total) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.value - a.value);
  }, [workPackages]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[260px] text-muted-foreground">
        <div className="text-center">
          <i className="fa-solid fa-chart-pie text-3xl mb-2 block" />
          <p className="text-sm">No data</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260} minWidth={0}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="45%"
          innerRadius={50}
          outerRadius={85}
          dataKey="value"
          nameKey="name"
          paddingAngle={2}
          cursor="pointer"
          onClick={(entry) => onCustomerClick?.(entry.name)}
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.name}
              fill={getColor(entry.name)}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            color: "hsl(var(--popover-foreground))",
            fontSize: 12,
          }}
          itemStyle={{
            color: "hsl(var(--popover-foreground))",
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`${value} aircraft`, name]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "hsl(var(--foreground))" }}
          formatter={(value) => (
            <span style={{ color: "hsl(var(--foreground))", fontSize: 11 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
