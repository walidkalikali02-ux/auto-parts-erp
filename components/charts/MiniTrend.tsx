"use client";

import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

const fmt = (n: number) =>
  n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function MiniTrendChart({ data }: { data: { date: string; revenue: number }[] }) {
  if (!data || data.length === 0) return null;
  const last7 = data.slice(-7);
  const total = last7.reduce((s, d) => s + d.revenue, 0);
  const hasData = total > 0;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-arabic text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
            إيرادات آخر 7 أيام
          </p>
          <p className="font-mono font-bold text-lg mt-0.5" style={{ color: "var(--color-gold)", direction: "ltr" }}>
            {fmt(total)} ر.س
          </p>
        </div>
        <span className="text-2xl">📈</span>
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={last7} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="miniGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#B5892A" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#B5892A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              formatter={(v: number) => [`${fmt(v)} ر.س`, "الإيراد"]}
              labelFormatter={(label: string) =>
                new Date(label).toLocaleDateString("ar-SA", { weekday: "short", month: "short", day: "numeric" })
              }
              contentStyle={{ fontSize: 11, fontFamily: "monospace" }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#B5892A"
              strokeWidth={2}
              fill="url(#miniGold)"
              dot={false}
              activeDot={{ r: 3, fill: "#B5892A" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="font-arabic text-xs text-center py-2" style={{ color: "var(--color-ink-faint)" }}>
          لا توجد مبيعات خلال هذه الفترة
        </p>
      )}
    </div>
  );
}
