import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickAction } from "@/components/dashboard/QuickAction";
import { School, GraduationCap, Users, UserCheck, ClipboardCheck, BarChart3, Bell } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const classData = [
  { name: "Class 1", students: 45 },
  { name: "Class 2", students: 42 },
  { name: "Class 3", students: 48 },
  { name: "Class 4", students: 40 },
  { name: "Class 5", students: 52 },
  { name: "Class 6", students: 38 },
  { name: "Class 7", students: 44 },
  { name: "Class 8", students: 50 },
];

const attendanceData = [
  { name: "Present", value: 85, color: "hsl(142 71% 45%)" },
  { name: "Absent", value: 10, color: "hsl(0 84% 60%)" },
  { name: "Leave", value: 5, color: "hsl(38 92% 50%)" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <DashboardLayout role="admin" userName="Admin User" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's an overview of your school.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Classes"
            value={24}
            icon={School}
            variant="primary"
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard
            title="Total Students"
            value={1248}
            icon={GraduationCap}
            variant="success"
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Total Teachers"
            value={86}
            icon={Users}
            variant="info"
            trend={{ value: 5, isPositive: true }}
          />
          <StatCard
            title="Pending Approvals"
            value={12}
            icon={UserCheck}
            variant="warning"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Class-wise Student Count */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title">Class-wise Student Count</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="students" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title">Attendance Summary</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {attendanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="section-title">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickAction
              title="Approve Students"
              description="12 pending approvals"
              icon={UserCheck}
              onClick={() => navigate("/admin/students")}
            />
            <QuickAction
              title="Manage Classes"
              description="View all classes"
              icon={School}
              onClick={() => navigate("/admin/classes")}
            />
            <QuickAction
              title="Manage Teachers"
              description="86 active teachers"
              icon={Users}
              onClick={() => navigate("/admin/teachers")}
            />
            <QuickAction
              title="View Reports"
              description="Analytics & insights"
              icon={BarChart3}
              onClick={() => navigate("/admin/reports")}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
