"use client";

import { ExportButton } from "@/components/ExportButton";
import { exportInventory } from "@/lib/excel";

export function InventoryExport({ rows }: { rows: any[] }) {
  return <ExportButton onExport={() => exportInventory(rows)} />;
}
