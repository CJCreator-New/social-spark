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

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7c7c", "#8dd1e1"];

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
          fill="#8884d8"
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
