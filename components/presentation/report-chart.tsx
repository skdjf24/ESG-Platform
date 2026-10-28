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
import type { ReportChart } from "@/lib/types/presentation";

function formatValue(value: number, precision: number, unit: string) {
  return `${value.toLocaleString("zh-CN", { minimumFractionDigits: precision, maximumFractionDigits: precision })}${unit ? ` ${unit}` : ""}`;
}

export function ReportChartView({ chart, compact = false }: { chart: ReportChart; compact?: boolean }) {
  const height = compact ? 190 : 250;
  const data = chart.observationSnapshots.map((item) => ({
    name: item.reportingPeriod,
    metricName: item.metricName,
    value: item.value,
    unit: item.unit,
  }));
  const colors = chart.colors.length ? chart.colors : ["#176b52"];
  if (!data.length) return <div className="grid h-48 place-items-center rounded-xl border border-dashed border-[#bfcfc6] bg-[#f7faf8] text-xs text-[#778b7e]">暂无已确认指标数据</div>;

  if (chart.type === "kpi") {
    return (
      <div role="img" aria-label={`${chart.title} KPI 卡片`} className="grid gap-3 sm:grid-cols-2">
        {data.map((item, index) => (
          <div key={`${item.metricName}-${item.name}`} className="rounded-xl border border-black/5 p-4" style={{ backgroundColor: `${colors[index % colors.length]}12` }}>
            <p className="text-[10px] font-medium opacity-65">{item.metricName} · {item.name}</p>
            <p className="mt-2 text-2xl font-semibold" style={{ color: colors[index % colors.length] }}>{formatValue(item.value, chart.precision, chart.unit || item.unit)}</p>
          </div>
        ))}
      </div>
    );
  }

  if (chart.type === "pie") {
    return (
      <div role="img" aria-label={`${chart.title} 饼图`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="38%" outerRadius="72%" label={chart.showDataLabels ? ({ value }) => formatValue(Number(value), chart.precision, chart.unit) : false}>
              {data.map((item, index) => <Cell key={`${item.metricName}-${item.name}`} fill={colors[index % colors.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => formatValue(Number(value), chart.precision, chart.unit || data[0]?.unit || "")} />
            {chart.showLegend ? <Legend verticalAlign="bottom" /> : null}
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chart.type === "line") {
    return (
      <div role="img" aria-label={`${chart.title} 折线图`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 18, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dfe8e2" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={48} />
            <Tooltip formatter={(value) => formatValue(Number(value), chart.precision, chart.unit || data[0]?.unit || "")} />
            {chart.showLegend ? <Legend /> : null}
            <Line type="monotone" dataKey="value" name={data[0]?.metricName} stroke={colors[0]} strokeWidth={3} dot={{ r: 4 }} label={chart.showDataLabels ? { position: "top", fontSize: 10 } : false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div role="img" aria-label={`${chart.title} ${chart.type === "stacked-bar" ? "堆叠柱状图" : "柱状图"}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 18, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe8e2" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={48} />
          <Tooltip formatter={(value) => formatValue(Number(value), chart.precision, chart.unit || data[0]?.unit || "")} />
          {chart.showLegend ? <Legend /> : null}
          <Bar dataKey="value" name={data[0]?.metricName} stackId={chart.type === "stacked-bar" ? "metrics" : undefined} fill={colors[0]} radius={[5, 5, 0, 0]} label={chart.showDataLabels ? { position: "top", fontSize: 10 } : false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
