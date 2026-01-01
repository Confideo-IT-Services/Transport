import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, Building2, Users, GraduationCap, TrendingUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const monthlyGrowth = [
  { month: "Jan", schools: 8, students: 2400, teachers: 180 },
  { month: "Feb", schools: 12, students: 3600, teachers: 260 },
  { month: "Mar", schools: 18, students: 5400, teachers: 380 },
  { month: "Apr", schools: 22, students: 6800, teachers: 480 },
  { month: "May", schools: 28, students: 8800, teachers: 610 },
  { month: "Jun", schools: 35, students: 12450, teachers: 856 },
];

const schoolsByRegion = [
  { region: "Northeast", count: 12 },
  { region: "Southeast", count: 8 },
  { region: "Midwest", count: 6 },
  { region: "Southwest", count: 5 },
  { region: "West", count: 4 },
];

const schoolTypeDistribution = [
  { name: "Primary", value: 18, color: "hsl(var(--primary))" },
  { name: "Secondary", value: 12, color: "hsl(var(--secondary))" },
  { name: "High School", value: 8, color: "hsl(var(--accent))" },
  { name: "K-12", value: 5, color: "hsl(var(--muted-foreground))" },
];

export default function PlatformReports() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("6months");

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <DashboardLayout role="superadmin" userName="Platform Admin" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Platform Reports</h1>
            <p className="text-muted-foreground mt-1">Analytics and insights across all schools.</p>
          </div>
          <div className="flex gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1month">Last Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="1year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Schools</p>
                <p className="text-2xl font-bold text-foreground mt-1">35</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-success">
              <TrendingUp className="w-3 h-3" />
              +25% this period
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold text-foreground mt-1">12,450</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-secondary" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-success">
              <TrendingUp className="w-3 h-3" />
              +41% this period
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Teachers</p>
                <p className="text-2xl font-bold text-foreground mt-1">856</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-accent" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-success">
              <TrendingUp className="w-3 h-3" />
              +38% this period
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Students/School</p>
                <p className="text-2xl font-bold text-foreground mt-1">356</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-success">
              <TrendingUp className="w-3 h-3" />
              +12% this period
            </div>
          </div>
        </div>

        {/* Growth Chart */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="section-title">Platform Growth</h3>
          <div className="h-80 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="students"
                  stackId="1"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.3)"
                  name="Students"
                />
                <Area
                  type="monotone"
                  dataKey="teachers"
                  stackId="2"
                  stroke="hsl(var(--secondary))"
                  fill="hsl(var(--secondary) / 0.3)"
                  name="Teachers"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Schools by Region */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title">Schools by Region</h3>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={schoolsByRegion} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    dataKey="region"
                    type="category"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* School Type Distribution */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title">School Type Distribution</h3>
            <div className="h-64 mt-4 flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie
                    data={schoolTypeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {schoolTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {schoolTypeDistribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top Schools Table */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="section-title">Top Performing Schools</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">School</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Students</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Teachers</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Avg Attendance</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Growth</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { rank: 1, name: "Riverside High School", students: 1200, teachers: 85, attendance: "96%", growth: "+18%" },
                  { rank: 2, name: "Lakeside Secondary", students: 890, teachers: 62, attendance: "94%", growth: "+15%" },
                  { rank: 3, name: "Greenwood Academy", students: 680, teachers: 48, attendance: "93%", growth: "+12%" },
                  { rank: 4, name: "Springfield Elementary", students: 450, teachers: 32, attendance: "95%", growth: "+10%" },
                  { rank: 5, name: "Mountain View School", students: 320, teachers: 24, attendance: "92%", growth: "+8%" },
                ].map((school) => (
                  <tr key={school.rank} className="border-b border-border last:border-0">
                    <td className="py-3 px-4">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                        {school.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">{school.name}</td>
                    <td className="py-3 px-4">{school.students}</td>
                    <td className="py-3 px-4">{school.teachers}</td>
                    <td className="py-3 px-4">{school.attendance}</td>
                    <td className="py-3 px-4 text-success font-medium">{school.growth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
