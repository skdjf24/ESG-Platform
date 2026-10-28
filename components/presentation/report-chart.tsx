"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartObservationSnapshot, ReportChart } from "@/lib/types/presentation";

type ChartRow = { category: string } & Record<string, string | number>;

function formatValue(value: number, precision: number, unit: string) {
  return `${value.toLocaleString("zh-CN", { minimumFractionDigits: precision, maximumFractionDigits: precision })}${unit ? ` ${unit}` : ""}`;
}

function sortPeriods(left: ChartObservationSnapshot, right: ChartObservationSnapshot) {
  return left.reportingPeriod.localeCompare(right.reportingPeriod, "zh-CN", { numeric: true });
}

function rowsByCategory(snapshots: ChartObservationSnapshot[], category: (item: ChartObservationSnapshot) => string): { rows: ChartRow[]; series: string[] } {
  const series = [...new Set(snapshots.map((item) => item.seriesName))];
  const rows = new Map<string, ChartRow>();
  snapshots.forEach((item) => {
    const key = category(item);
    const row = rows.get(key) ?? { category: key };
    row[item.seriesName] = item.value;
    rows.set(key, row);
  });
  return { rows: [...rows.values()], series };
}

export function ReportChartView({ chart, compact = false }: { chart: ReportChart; compact?: boolean }) {
  const height = compact ? 190 : 250;
  const snapshots = chart.observationSnapshots;
  const colors = chart.colors.length ? chart.colors : ["#176b52"];
  const displayUnit = chart.unit || snapshots[0]?.unit || "";
  if (!snapshots.length) return <div className="grid h-48 place-items-center rounded-xl border border-dashed border-[#bfcfc6] bg-[#f7faf8] text-xs text-[#778b7e]">暂无已确认指标数据</div>;

  if (chart.type === "kpi") {
    return (
      <div role="img" aria-label={`${chart.title} KPI 卡片`} data-chart-type="kpi" className="grid gap-3 sm:grid-cols-2">
        {snapshots.map((item, index) => (
          <div key={item.observationId} className="rounded-xl border border-black/5 p-4" style={{ backgroundColor: `${colors[index % colors.length]}12` }}>
            <p className="text-[10px] font-medium opacity-65">{item.metricName}</p>
            <p className="mt-1 text-[9px] opacity-60">{item.reportingPeriod} · {item.categoryLabel}</p>
            <p className="mt-2 text-2xl font-semibold" style={{ color: colors[index % colors.length] }}>{formatValue(item.value, chart.precision, chart.unit || item.unit)}</p>
          </div>
        ))}
      </div>
    );
  }

  if (chart.type === "pie") {
    const data = snapshots.map((item) => ({ name: item.categoryLabel, value: item.value, unit: item.unit }));
    return (
      <div role="img" aria-label={`${chart.title} 饼图`} data-chart-type="pie" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="38%" outerRadius="72%" label={chart.showDataLabels ? ({ name, value }) => `${name} ${formatValue(Number(value), chart.precision, displayUnit)}` : false}>
              {data.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => formatValue(Number(value), chart.precision, displayUnit)} />
            {chart.showLegend ? <Legend verticalAlign="bottom" /> : null}
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chart.type === "line") {
    const ordered = snapshots.slice().sort(sortPeriods);
    const data = ordered.map((item) => ({ category: item.reportingPeriod, value: item.value }));
    return (
      <div role="img" aria-label={`${chart.title} 折线图`} data-chart-type="line" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 18, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dfe8e2" />
            <XAxis dataKey="category" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={48} />
            <Tooltip formatter={(value) => formatValue(Number(value), chart.precision, displayUnit)} />
            {chart.showLegend ? <Legend /> : null}
            <Line type="monotone" dataKey="value" name={ordered[0]?.metricName} stroke={colors[0]} strokeWidth={3} dot={{ r: 4 }} label={chart.showDataLabels ? { position: "top", fontSize: 10 } : false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const samePeriod = new Set(snapshots.map((item) => item.reportingPeriod)).size === 1;
  const grouped = rowsByCategory(
    snapshots,
    chart.type === "stacked-bar" ? (item) => item.reportingPeriod : (item) => samePeriod ? item.categoryLabel : item.reportingPeriod,
  );
  return (
    <div role="img" aria-label={`${chart.title} ${chart.type === "stacked-bar" ? "堆叠柱状图" : "柱状图"}`} data-chart-type={chart.type} data-series-count={grouped.series.length} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={grouped.rows} margin={{ top: 16, right: 18, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe8e2" />
          <XAxis dataKey="category" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={48} />
          <Tooltip formatter={(value) => formatValue(Number(value), chart.precision, displayUnit)} />
          {chart.showLegend ? <Legend /> : null}
          {grouped.series.map((seriesName, index) => (
            <Bar
              key={seriesName}
              dataKey={seriesName}
              name={seriesName}
              stackId={chart.type === "stacked-bar" ? "metrics" : undefined}
              fill={colors[index % colors.length]}
              radius={chart.type === "stacked-bar" ? 0 : [5, 5, 0, 0]}
              label={chart.showDataLabels ? { position: "top", fontSize: 10 } : false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
