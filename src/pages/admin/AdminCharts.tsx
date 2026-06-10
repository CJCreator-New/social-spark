import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface AdminChartsProps {
  platformDistribution: Record<string, number>;
}

export function AdminCharts({ platformDistribution }: AdminChartsProps) {
  if (Object.keys(platformDistribution).length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No platform data available</p>;
  }

  const data = Object.entries(platformDistribution).map(([name, value]) => ({
    name,
    value,
  }));

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name} (${value})`}
          outerRadius={80}
          fill="hsl(var(--chart-1))"
          dataKey="value"
        >
          {COLORS.map((color, index) => (
            <Cell key={`cell-${index}`} fill={color} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default AdminCharts;
