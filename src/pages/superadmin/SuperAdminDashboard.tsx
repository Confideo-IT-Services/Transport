import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickAction } from "@/components/dashboard/QuickAction";
import { Building2, Users, GraduationCap, UserCog, Plus, Settings, BarChart3, Shield } from "lucide-react";
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
} from "recharts";

const growthData = [
  { month: "Jul", schools: 12 },
  { month: "Aug", schools: 15 },
  { month: "Sep", schools: 18 },
  { month: "Oct", schools: 22 },
  { month: "Nov", schools: 28 },
  { month: "Dec", schools: 35 },
];

const schoolTypeData = [
  { type: "Primary", count: 18 },
  { type: "Secondary", count: 12 },
  { type: "High School", count: 8 },
  { type: "K-12", count: 5 },
];

export default function SuperAdminDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <DashboardLayout role="superadmin" userName="Platform Admin" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="page-title">Platform Overview</h1>
          <p className="text-muted-foreground mt-1">
            Manage all schools and administrators on AllPulse.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Schools"
            value={35}
            icon={Building2}
            trend="+25% growth"
            trendUp={true}
            iconColor="text-primary"
            iconBg="bg-primary/10"
          />
          <StatCard
            title="Total Students"
            value="12,450"
            icon={GraduationCap}
            trend="+12% growth"
            trendUp={true}
            iconColor="text-secondary"
            iconBg="bg-secondary/10"
          />
          <StatCard
            title="Total Teachers"
            value="856"
            icon={Users}
            trend="+8% growth"
            trendUp={true}
            iconColor="text-accent"
            iconBg="bg-accent/10"
          />
          <StatCard
            title="School Admins"
            value={42}
            icon={UserCog}
            iconColor="text-primary"
            iconBg="bg-primary/10"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Growth Chart */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title">School Growth</h3>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData}>
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
                    dataKey="schools"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* School Types Chart */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title">Schools by Type</h3>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={schoolTypeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="type" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="section-title mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <QuickAction
              icon={Plus}
              label="Add School"
              onClick={() => navigate("/superadmin/schools")}
            />
            <QuickAction
              icon={Building2}
              label="Manage Schools"
              onClick={() => navigate("/superadmin/schools")}
            />
            <QuickAction
              icon={BarChart3}
              label="View Reports"
              onClick={() => navigate("/superadmin/reports")}
            />
            <QuickAction
              icon={Settings}
              label="Platform Settings"
              onClick={() => navigate("/superadmin/settings")}
            />
          </div>
        </div>

        {/* Recent Schools */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="section-title">Recently Added Schools</h3>
          <div className="mt-4 space-y-3">
            {[
              { name: "Springfield Elementary", location: "New York", students: 450, status: "active" },
              { name: "Riverside High School", location: "California", students: 1200, status: "active" },
              { name: "Greenwood Academy", location: "Texas", students: 680, status: "pending" },
              { name: "Lakeside K-12", location: "Florida", students: 890, status: "active" },
            ].map((school, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{school.name}</h4>
                    <p className="text-sm text-muted-foreground">{school.location}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium text-foreground">{school.students}</p>
                    <p className="text-xs text-muted-foreground">students</p>
                  </div>
                  <span className={`badge ${school.status === "active" ? "badge-success" : "badge-warning"}`}>
                    {school.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
