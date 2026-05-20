"use client";

import { ExportButton } from "@/components/ExportButton";
import { exportDailyReport } from "@/lib/excel";

export function DailyExport({ orders, date }: { orders: any[]; date: string }) {
  return <ExportButton onExport={() => exportDailyReport(orders, date)} />;
}
