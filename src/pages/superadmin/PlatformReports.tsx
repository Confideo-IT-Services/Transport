import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, Building2, Users, GraduationCap, TrendingUp } from "lucide-react";
import { schoolsApi } from "@/lib/api";
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

export default function PlatformReports() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [period, setPeriod] = useState("6months");
  const [stats, setStats] = useState({
    totalSchools: 0,
    totalStudents: 0,
    totalTeachers: 0,
    avgStudentsPerSchool: 0,
  });
  const [schools, setSchools] = useState<any[]>([]);
  const [monthlyGrowth, setMonthlyGrowth] = useState<any[]>([]);
  const [schoolsByRegion, setSchoolsByRegion] = useState<any[]>([]);
  const [schoolTypeDistribution, setSchoolTypeDistribution] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [period]);

  const loadReportData = async () => {
    try {
      setIsLoading(true);
      const schoolsData = await schoolsApi.getAll();
      
      // Calculate stats
      const totalSchools = schoolsData.length;
      const totalStudents = schoolsData.reduce((sum, s) => sum + (s.students || 0), 0);
      const totalTeachers = schoolsData.reduce((sum, s) => sum + (s.teachers || 0), 0);
      const avgStudentsPerSchool = totalSchools > 0 ? Math.round(totalStudents / totalSchools) : 0;

      setStats({
        totalSchools,
        totalStudents,
        totalTeachers,
        avgStudentsPerSchool,
      });

      setSchools(schoolsData);

      // Generate monthly growth data from real data
      // For now, show empty until we have time-based data
      setMonthlyGrowth([]);
      setSchoolsByRegion([]);
      
      // Generate school type distribution from real data
      const typeDist = schoolsData.reduce((acc, school) => {
        const type = school.type || 'Unknown';
        const existing = acc.find(item => item.name === type);
        if (existing) {
          existing.value++;
        } else {
          acc.push({ 
            name: type, 
            value: 1, 
            color: type === 'Primary' ? "hsl(var(--primary))" :
                   type === 'Secondary' ? "hsl(var(--secondary))" :
                   type === 'High School' ? "hsl(var(--accent))" :
                   "hsl(var(--muted-foreground))"
          });
        }
        return acc;
      }, [] as any[]);
      setSchoolTypeDistribution(typeDist);
    } catch (error) {
      console.error('Failed to load report data:', error);
      setStats({ totalSchools: 0, totalStudents: 0, totalTeachers: 0, avgStudentsPerSchool: 0 });
      setMonthlyGrowth([]);
      setSchoolsByRegion([]);
      setSchoolTypeDistribution([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => logout();

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
                <p className="text-2xl font-bold text-foreground mt-1">{stats.totalSchools}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.totalStudents.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-secondary" />
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Teachers</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.totalTeachers.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-accent" />
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Students/School</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.avgStudentsPerSchool}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Growth Chart */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="section-title">Platform Growth</h3>
          <div className="h-80 mt-4">
            {monthlyGrowth.length > 0 ? (
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
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No growth data available
              </div>
            )}
          </div>
        </div>

        {/* Distribution Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Schools by Region */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title">Schools by Region</h3>
            <div className="h-64 mt-4">
              {schoolsByRegion.length > 0 ? (
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
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No region data available
                </div>
              )}
            </div>
          </div>

          {/* School Type Distribution */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title">School Type Distribution</h3>
            <div className="h-64 mt-4">
              {schoolTypeDistribution.length > 0 ? (
                <div className="flex items-center h-full">
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
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data available
                </div>
              )}
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
                {schools.length > 0 ? (
                  schools
                    .sort((a, b) => (b.students || 0) - (a.students || 0))
                    .slice(0, 5)
                    .map((school, index) => (
                      <tr key={school.id} className="border-b border-border last:border-0">
                        <td className="py-3 px-4">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium">{school.name}</td>
                        <td className="py-3 px-4">{school.students || 0}</td>
                        <td className="py-3 px-4">{school.teachers || 0}</td>
                        <td className="py-3 px-4">-</td>
                        <td className="py-3 px-4 text-muted-foreground">-</td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No schools data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
