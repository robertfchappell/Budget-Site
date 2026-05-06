"use client";

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
import { dollars } from "@/lib/money";
import type { ChartDatum, TrendDatum } from "@/lib/types";

const tooltipStyle = {
  background: "#0f172a",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  borderRadius: 8,
  color: "#f8fafc"
};

export function CategoryDonut({ data }: { data: ChartDatum[] }) {
  const mounted = useMounted();
  const chartData = asArray<ChartDatum>(data)
    .map((entry) => ({
      name: asString(entry?.name, "Uncategorized"),
      value: asNumber(entry?.value),
      color: asString(entry?.color, "#38bdf8")
    }))
    .filter((entry) => entry.value > 0);

  if (!mounted || !chartData.length) {
    return <EmptyChart label="No spending yet" />;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer height="100%" width="100%">
        <PieChart>
          <Pie
            cx="50%"
            cy="50%"
            data={chartData}
            dataKey="value"
            innerRadius={62}
            nameKey="name"
            outerRadius={96}
            paddingAngle={2}
          >
            {chartData.map((entry) => (
              <Cell fill={entry.color ?? "#38bdf8"} key={entry.name} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => dollars(asNumber(value))} />
          <Legend iconType="circle" />
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
    <div className="h-72">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={chartData}>
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
          <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
          <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} />
          <YAxis stroke="#94a3b8" tickFormatter={(value) => dollars(asNumber(value))} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => dollars(asNumber(value))} />
          <Area dataKey="income" fill="url(#incomeFill)" name="Income" stroke="#2dd4bf" strokeWidth={2} />
          <Area dataKey="expenses" fill="url(#expenseFill)" name="Expenses" stroke="#fb7185" strokeWidth={2} />
          <Area dataKey="bills" fill="transparent" name="Bills" stroke="#fbbf24" strokeWidth={2} />
          <Legend />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBarChart({ data }: { data: ChartDatum[] }) {
  const mounted = useMounted();
  const chartData = asArray<ChartDatum>(data)
    .map((entry) => ({
      name: asString(entry?.name, "Unknown"),
      value: asNumber(entry?.value)
    }))
    .filter((entry) => entry.value > 0);

  if (!mounted || !chartData.length) {
    return <EmptyChart label="No data" />;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={chartData}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
          <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} />
          <YAxis stroke="#94a3b8" tickFormatter={(value) => dollars(asNumber(value))} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => dollars(asNumber(value))} />
          <Bar dataKey="value" fill="#38bdf8" radius={[6, 6, 0, 0]} />
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
