"use client";

import {
  StatusPieChart,
  RevenueBarChart,
  LinksLineChart,
} from "@/components/dashboard/charts";

interface DashboardChartsProps {
  statusData: {
    active: number;
    paid: number;
    expired: number;
    processing: number;
  };
  revenueData: Array<{
    date: string;
    amount: number;
  }>;
  linksData: Array<{
    date: string;
    count: number;
  }>;
}

export function DashboardCharts({
  statusData,
  revenueData,
  linksData,
}: DashboardChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatusPieChart data={statusData} />
      <RevenueBarChart data={revenueData} />
      <LinksLineChart data={linksData} />
    </div>
  );
}
