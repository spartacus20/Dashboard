import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface DashboardMetricsCardProps {
  title: string;
  value: string | number | React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  valueClassName?: string;
}

export function DashboardMetricsCard({
  title,
  value,
  description,
  icon,
  valueClassName = "",
}: DashboardMetricsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-center">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center text-center">
        <div className={`text-xl font-bold text-center ${valueClassName}`}>
          {value}
        </div>
        {description && (
          <div className="text-xs text-slate-600 text-center">
            {description}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
