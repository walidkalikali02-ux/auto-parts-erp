"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from "recharts";

const GOLD   = "#B5892A";
const BLUE   = "#2563EB";
const GREEN  = "#16A34A";
const RED    = "#DC2626";
const PURPLE = "#7C3AED";
const COLORS = [GOLD, BLUE, GREEN, RED, PURPLE, "#EA580C", "#0891B2"];

const fmt = (n: number) =>
  n >= 1000
    ? `${(n / 1000).toFixed(1)}k`
    : n.toLocaleString("ar-SA", { maximumFractionDigits: 0 });

const fmtFull = (n: number) =>
  n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5" style={{ minHeight: 280 }}>
      <h3 className="font-arabic font-semibold mb-4" style={{ color: "var(--color-ink)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Revenue Trend (Area) ──────────────────────────────────────────────────
export function RevenueTrendChart({ data }: { data: { date: string; revenue: number }[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("ar-SA", { month: "short", day: "numeric" }),
  }));

  return (
    <ChartCard title="مسار الإيرادات — آخر 30 يوم">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={formatted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={GOLD} stopOpacity={0.25} />
              <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ece0" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#999" }} interval={4} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#999" }} width={44} />
          <Tooltip
            formatter={(v: number) => [`${fmtFull(v)} ر.س`, "الإيراد"]}
            labelStyle={{ fontFamily: "Cairo, sans-serif", fontSize: 12 }}
            contentStyle={{ fontFamily: "monospace", fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={GOLD}
            strokeWidth={2}
            fill="url(#goldGrad)"
            dot={false}
            activeDot={{ r: 4, fill: GOLD }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Monthly Revenue (Bar) ────────────────────────────────────────────────
export function MonthlyRevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  return (
    <ChartCard title="الإيرادات الشهرية — آخر 6 أشهر">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ece0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#999" }} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#999" }} width={44} />
          <Tooltip
            formatter={(v: number) => [`${fmtFull(v)} ر.س`, "الإيراد"]}
            labelStyle={{ fontFamily: "Cairo, sans-serif", fontSize: 12 }}
            contentStyle={{ fontFamily: "monospace", fontSize: 12 }}
          />
          <Bar dataKey="revenue" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Top Parts (Horizontal Bar) ──────────────────────────────────────────
export function TopPartsChart({ data }: { data: { name: string; qty: number; revenue: number }[] }) {
  return (
    <ChartCard title="أكثر القطع مبيعاً (بالكمية)">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ece0" horizontal={false} />
          <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10, fill: "#999" }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: "#555", fontFamily: "Cairo, sans-serif" }}
            width={100}
          />
          <Tooltip
            formatter={(v: number, name: string) => [
              name === "qty" ? `${v} وحدة` : `${fmtFull(v)} ر.س`,
              name === "qty" ? "الكمية" : "الإيراد",
            ]}
            contentStyle={{ fontFamily: "monospace", fontSize: 12 }}
          />
          <Bar dataKey="qty" fill={BLUE} radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Top Customers (Pie) ─────────────────────────────────────────────────
export function TopCustomersChart({ data }: { data: { name: string; revenue: number }[] }) {
  const total = data.reduce((s, d) => s + d.revenue, 0);
  return (
    <ChartCard title="أعلى العملاء إنفاقاً">
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={72}
              innerRadius={40}
              strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [`${fmtFull(v)} ر.س`, "الإنفاق"]}
              contentStyle={{ fontFamily: "monospace", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {data.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="font-arabic text-xs truncate" style={{ color: "var(--color-ink-2)" }}>{d.name}</p>
                <p className="font-mono text-xs" style={{ color: "var(--color-ink-muted)" }}>
                  {fmtFull(d.revenue)} ر.س
                  <span style={{ color: "var(--color-ink-faint)", marginRight: 4 }}>
                    ({total > 0 ? ((d.revenue / total) * 100).toFixed(0) : 0}%)
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
