import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  ClipboardCheck,
  Clock,
  TrendingUp,
  Calendar,
  Bell
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { classesApi, studentsApi, teachersApi, homeworkApi, attendanceApi } from "@/lib/api";
import { format } from "date-fns";

export default function UnifiedDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  
  // Teacher-specific state
  const [teacherClass, setTeacherClass] = useState<any>(null);
  const [teacherStudents, setTeacherStudents] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [homeworkCount, setHomeworkCount] = useState(0);
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        if (isAdmin) {
          const [classesData, studentsData, teachersData, pendingData] = await Promise.all([
            classesApi.getAll(),
            studentsApi.getAll(),
            teachersApi.getAll(),
            studentsApi.getPending().catch(() => [])
          ]);
          setClasses(classesData);
          setStudents(studentsData);
          setTeachers(teachersData);
          setPendingStudents(pendingData);
        } else {
          // Load teacher data
          try {
            // Load teacher's assigned class
            const classesData = await classesApi.getAll();
            if (classesData && classesData.length > 0) {
              const assignedClass = classesData[0];
              setTeacherClass(assignedClass);

              // Load students for the class
              try {
                const studentsData = await studentsApi.getByClass(assignedClass.id);
                setTeacherStudents(studentsData || []);
              } catch (error) {
                // Fallback: get all students and filter
                const allStudents = await studentsApi.getAll();
                const filtered = (allStudents || []).filter((s: any) => s.classId === assignedClass.id);
                setTeacherStudents(filtered);
              }

              // Load today's attendance
              const todayStr = format(new Date(), "yyyy-MM-dd");
              try {
                const attendanceData = await attendanceApi.getStudentAttendance(assignedClass.id, todayStr);
                setTodayAttendance(attendanceData);
              } catch (error) {
                console.error('Error loading attendance:', error);
                setTodayAttendance(null);
              }

              // Load homework count
              const homeworkData = await homeworkApi.getAll();
              setHomeworkCount(homeworkData?.length || 0);
            }
          } catch (error) {
            console.error('Error loading teacher data:', error);
          }
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [isAdmin]);
  
  // Calculate stats for admin
  const totalClasses = classes.length;
  const totalStudents = students.filter(s => s.status === 'approved').length;
  const totalTeachers = teachers.filter(t => t.isActive).length;
  const pendingApprovals = pendingStudents.length;
  
  // Prepare class data for chart
  const adminClassData = classes.map(cls => ({
    name: cls.section ? `${cls.name} ${cls.section}` : cls.name,
    students: cls.studentCount || 0
  }));
  
  // For attendance data, we'll show empty state since there's no attendance API yet
  const attendanceData: { name: string; value: number; color: string }[] = [];
  
  // Recent activities - empty for now
  const recentActivities: any[] = [];

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Good Morning, {user?.name?.split(" ")[0]}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? "Here's what's happening at your school today."
                : `Here's what's happening in ${user?.className} today.`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-lg font-medium text-foreground">
              {new Date().toLocaleDateString("en-IN", { 
                weekday: "long", 
                day: "numeric", 
                month: "short", 
                year: "numeric" 
              })}
            </p>
          </div>
        </div>

        {/* Stats Grid - Different for each role */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isAdmin ? (
            <>
              <StatCard
                title="Total Classes"
                value={loading ? "..." : totalClasses.toString()}
                icon={BookOpen}
                trend=""
                trendUp={true}
                iconColor="text-primary"
                iconBg="bg-primary/10"
              />
              <StatCard
                title="Total Students"
                value={loading ? "..." : totalStudents.toString()}
                icon={GraduationCap}
                trend=""
                trendUp={true}
                iconColor="text-secondary"
                iconBg="bg-secondary/10"
              />
              <StatCard
                title="Total Teachers"
                value={loading ? "..." : totalTeachers.toString()}
                icon={Users}
                trend=""
                trendUp={true}
                iconColor="text-accent"
                iconBg="bg-accent/10"
              />
              <StatCard
                title="Pending Approvals"
                value={loading ? "..." : pendingApprovals.toString()}
                icon={Clock}
                trend=""
                trendUp={false}
                iconColor="text-destructive"
                iconBg="bg-destructive/10"
              />
            </>
          ) : (
            <>
              <StatCard
                title="My Class Students"
                value={loading ? "..." : teacherStudents.length.toString()}
                icon={Users}
                trend={teacherClass ? `${teacherClass.name}${teacherClass.section ? ` - ${teacherClass.section}` : ''}` : (user?.className || "")}
                trendUp={true}
                iconColor="text-primary"
                iconBg="bg-primary/10"
              />
              <StatCard
                title="Present Today"
                value={loading ? "..." : todayAttendance?.students?.filter((s: any) => s.status === 'present').length?.toString() || "0"}
                icon={ClipboardCheck}
                trend=""
                trendUp={true}
                iconColor="text-secondary"
                iconBg="bg-secondary/10"
              />
              <StatCard
                title="Absent Today"
                value={loading ? "..." : todayAttendance?.students?.filter((s: any) => s.status === 'absent').length?.toString() || "0"}
                icon={TrendingUp}
                trend=""
                trendUp={false}
                iconColor="text-destructive"
                iconBg="bg-destructive/10"
              />
              <StatCard
                title="Homework This Week"
                value={loading ? "..." : homeworkCount.toString()}
                icon={BookOpen}
                trend=""
                trendUp={true}
                iconColor="text-accent"
                iconBg="bg-accent/10"
              />
            </>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Class Distribution / Today's Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isAdmin ? "Students per Class" : "Today's Schedule"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAdmin ? (
                loading ? (
                  <div className="flex items-center justify-center h-[250px]">
                    <p className="text-muted-foreground">Loading...</p>
                  </div>
                ) : adminClassData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={adminClassData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          background: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }} 
                      />
                      <Bar dataKey="students" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px]">
                    <p className="text-muted-foreground">No class data available</p>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-[250px]">
                  <p className="text-muted-foreground">Schedule data will be available here</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isAdmin ? "Today's Attendance Overview" : "My Class Attendance"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceData.length > 0 ? (
                <>
                  <div className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={250}>
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
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6 mt-4">
                    {attendanceData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {item.name} ({item.value}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[250px]">
                  <p className="text-muted-foreground">Attendance data will be available here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivities.length > 0 ? (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <activity.icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </UnifiedLayout>
  );
}
