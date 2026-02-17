import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickAction } from "@/components/dashboard/QuickAction";
import { Building2, Users, GraduationCap, UserCog, Plus, Settings, BarChart3, Shield } from "lucide-react";
import { schoolsApi, getToken } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
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

const LOADING_UI = (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [stats, setStats] = useState({
    totalSchools: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalAdmins: 0,
  });
  const [schools, setSchools] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const loadData = async () => {
    try {
      setIsLoadingData(true);
      const schoolsData = await schoolsApi.getAll();
      setSchools(schoolsData);

      const totalSchools = schoolsData.length;
      const totalStudents = schoolsData.reduce((sum, s) => sum + (s.students || 0), 0);
      const totalTeachers = schoolsData.reduce((sum, s) => sum + (s.teachers || 0), 0);
      const totalAdmins = schoolsData.reduce((sum, s) => sum + (s.admins || 0), 0);

      setStats({
        totalSchools,
        totalStudents,
        totalTeachers,
        totalAdmins,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const token = getToken();
  let storedSuperAdmin = false;
  try {
    const raw = localStorage.getItem("conventpulse_user");
    const parsed = raw ? JSON.parse(raw) : null;
    const role = parsed?.role != null ? String(parsed.role).toLowerCase().replace(/[\s_-]+/g, "") : "";
    storedSuperAdmin = role === "superadmin";
  } catch {
    // ignore
  }
  const hasStoredSuperAdmin = token && storedSuperAdmin;
  const isSuperAdmin = user?.role === "superadmin" || hasStoredSuperAdmin;

  if (!isLoading && !isSuperAdmin) {
    return <Navigate to="/superadmin/login" replace />;
  }

  if (isLoading || (hasStoredSuperAdmin && !user)) return LOADING_UI;

  const handleLogout = () => {
    logout(); // clears auth and redirects to /superadmin/login
  };

  // Generate chart data from real data
  const growthData = schools.length > 0 
    ? schools
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .reduce((acc, school, index) => {
          const month = new Date(school.createdAt).toLocaleDateString('en-US', { month: 'short' });
          acc.push({ month, schools: index + 1 });
          return acc;
        }, [])
    : [{ month: "No data", schools: 0 }];

  const schoolTypeData = schools.reduce((acc, school) => {
    const type = school.type || 'Unknown';
    const existing = acc.find(item => item.type === type);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ type, count: 1 });
    }
    return acc;
  }, [] as { type: string; count: number }[]);

  const recentSchools = schools
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4);

  return (
    <DashboardLayout role="superadmin" userName="Platform Admin" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="page-title">Platform Overview</h1>
          <p className="text-muted-foreground mt-1">
            Manage all schools and administrators on ConventPulse.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Schools"
            value={stats.totalSchools}
            icon={Building2}
            trend={schools.length > 0 ? undefined : "No data"}
            trendUp={schools.length > 0}
            iconColor="text-primary"
            iconBg="bg-primary/10"
          />
          <StatCard
            title="Total Students"
            value={stats.totalStudents.toLocaleString()}
            icon={GraduationCap}
            trend={stats.totalStudents > 0 ? undefined : "No data"}
            trendUp={stats.totalStudents > 0}
            iconColor="text-secondary"
            iconBg="bg-secondary/10"
          />
          <StatCard
            title="Total Teachers"
            value={stats.totalTeachers.toLocaleString()}
            icon={Users}
            trend={stats.totalTeachers > 0 ? undefined : "No data"}
            trendUp={stats.totalTeachers > 0}
            iconColor="text-accent"
            iconBg="bg-accent/10"
          />
          <StatCard
            title="School Admins"
            value={stats.totalAdmins}
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
              {schoolTypeData.length > 0 ? (
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
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data available
                </div>
              )}
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
            {recentSchools.length > 0 ? (
              recentSchools.map((school) => (
                <div
                  key={school.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{school.name}</h4>
                      <p className="text-sm text-muted-foreground">{school.location || 'No location'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium text-foreground">{school.students || 0}</p>
                      <p className="text-xs text-muted-foreground">students</p>
                    </div>
                    <span className={`badge ${school.status === "active" ? "badge-success" : school.status === "pending" ? "badge-warning" : "badge-danger"}`}>
                      {school.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No schools added yet. Click "Add School" to get started.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
