"use client";

import type { CSSProperties } from "react";
import { useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { asArray, asNumber, asString } from "@/lib/coerce";
import { displayLabel } from "@/lib/display-labels";
import { dollars } from "@/lib/money";
import type { ChartDatum, TrendDatum } from "@/lib/types";

const tooltipContentStyle: CSSProperties = {
  background: "rgba(15, 23, 42, 0.98)",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  borderRadius: 8,
  boxShadow: "0 20px 45px rgba(0, 0, 0, 0.32)",
  color: "#f8fafc",
  padding: "0.55rem 0.7rem"
};
const tooltipItemStyle: CSSProperties = {
  color: "#e2e8f0",
  fontWeight: 700
};
const tooltipLabelStyle: CSSProperties = {
  color: "#cbd5e1",
  fontWeight: 800,
  marginBottom: 4
};
const tooltipWrapperStyle: CSSProperties = {
  outline: "none"
};
const axisTick = {
  fill: "#94a3b8",
  fontSize: 12,
  fontWeight: 600
};
const axisLine = {
  stroke: "rgba(148, 163, 184, 0.24)"
};
const chartMargin = { top: 12, right: 14, bottom: 4, left: 0 };

export function CategoryDonut({ data }: { data: ChartDatum[] }) {
  const mounted = useMounted();
  const chartData = asArray<ChartDatum>(data)
    .map((entry) => ({
      name: displayLabel(entry?.name, "Uncategorized"),
      value: asNumber(entry?.value),
      color: asString(entry?.color, "#38bdf8")
    }))
    .filter((entry) => entry.value > 0);

  if (!mounted || !chartData.length) {
    return <EmptyChart label="No spending yet" />;
  }

  return (
    <div className="h-72 overflow-hidden rounded-md bg-transparent">
      <ResponsiveContainer height="100%" width="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            cx="50%"
            cy="50%"
            data={chartData}
            dataKey="value"
            innerRadius={62}
            nameKey="name"
            outerRadius={96}
            paddingAngle={2}
            stroke="transparent"
            strokeWidth={0}
          >
            {chartData.map((entry) => (
              <Cell fill={entry.color ?? "#38bdf8"} key={entry.name} stroke="transparent" strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipContentStyle}
            cursor={false}
            formatter={(value, name) => [dollars(asNumber(value)), displayLabel(name, "Amount")]}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
            wrapperStyle={tooltipWrapperStyle}
          />
          <Legend
            formatter={(value) => <span style={{ color: "#cbd5e1", fontWeight: 700 }}>{displayLabel(value, "Category")}</span>}
            iconType="circle"
            wrapperStyle={{ paddingTop: 10 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BudgetTrendChart({ data }: { data: TrendDatum[] }) {
  const mounted = useMounted();
  const chartData = asArray<TrendDatum>(data).map((entry) => ({
    month: asString(entry?.month, "N/A"),
    income: asNumber(entry?.income),
    expenses: asNumber(entry?.expenses),
    bills: asNumber(entry?.bills)
  }));

  if (!mounted) {
    return <EmptyChart label="Loading chart" />;
  }

  return (
    <div className="h-72 overflow-hidden rounded-md bg-transparent">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={chartData} margin={chartMargin}>
          <defs>
            <linearGradient id="incomeFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="expenseFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#fb7185" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#fb7185" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.11)" strokeDasharray="4 6" vertical={false} />
          <XAxis axisLine={axisLine} dataKey="month" tick={axisTick} tickLine={false} />
          <YAxis
            axisLine={axisLine}
            tick={axisTick}
            tickFormatter={(value) => dollars(asNumber(value))}
            tickLine={false}
            width={88}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            cursor={{ stroke: "rgba(45, 212, 191, 0.28)", strokeWidth: 1 }}
            formatter={(value, name) => [dollars(asNumber(value)), displayLabel(name, "Amount")]}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
            wrapperStyle={tooltipWrapperStyle}
          />
          <Area
            activeDot={{ r: 4, stroke: "#0f172a", strokeWidth: 2 }}
            dataKey="income"
            dot={false}
            fill="url(#incomeFill)"
            name="Income"
            stroke="#2dd4bf"
            strokeWidth={2}
          />
          <Area
            activeDot={{ r: 4, stroke: "#0f172a", strokeWidth: 2 }}
            dataKey="expenses"
            dot={false}
            fill="url(#expenseFill)"
            name="Expenses"
            stroke="#fb7185"
            strokeWidth={2}
          />
          <Area
            activeDot={{ r: 4, stroke: "#0f172a", strokeWidth: 2 }}
            dataKey="bills"
            dot={false}
            fill="transparent"
            name="Bills"
            stroke="#fbbf24"
            strokeWidth={2}
          />
          <Legend
            formatter={(value) => <span style={{ color: "#cbd5e1", fontWeight: 700 }}>{displayLabel(value, "Series")}</span>}
            wrapperStyle={{ paddingTop: 8 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBarChart({ data }: { data: ChartDatum[] }) {
  const mounted = useMounted();
  const chartData = asArray<ChartDatum>(data)
    .map((entry) => ({
      name: displayLabel(entry?.name, "Unknown"),
      value: asNumber(entry?.value)
    }))
    .filter((entry) => entry.value > 0);

  if (!mounted || !chartData.length) {
    return <EmptyChart label="No data" />;
  }

  return (
    <div className="h-72 overflow-hidden rounded-md bg-transparent">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={chartData} margin={chartMargin}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.11)" strokeDasharray="4 6" vertical={false} />
          <XAxis axisLine={axisLine} dataKey="name" tick={axisTick} tickLine={false} tickMargin={10} />
          <YAxis
            axisLine={axisLine}
            tick={axisTick}
            tickFormatter={(value) => dollars(asNumber(value))}
            tickLine={false}
            width={88}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            cursor={{ fill: "rgba(45, 212, 191, 0.08)" }}
            formatter={(value, name) => [dollars(asNumber(value)), displayLabel(name, "Amount")]}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
            wrapperStyle={tooltipWrapperStyle}
          />
          <Bar dataKey="value" fill="#38bdf8" maxBarSize={42} name="Amount" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-72 place-items-center rounded-md border border-dashed border-slate-700 text-sm font-semibold text-slate-500">
      {label}
    </div>
  );
}

function useMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
}
