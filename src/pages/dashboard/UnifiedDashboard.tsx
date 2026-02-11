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
import { classesApi, studentsApi, teachersApi, homeworkApi, attendanceApi, testsApi } from "@/lib/api";
import { format, isSameDay, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  
  // Admin-specific state for attendance overview
  const [attendanceData, setAttendanceData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [allActivities, setAllActivities] = useState<any[]>([]); // Store all activities for filtering
  const [activityFilterDate, setActivityFilterDate] = useState<string>(""); // Date filter for activities
  const [activityFilterClass, setActivityFilterClass] = useState<string>("all"); // Class filter for activities
  const [activityFilterSection, setActivityFilterSection] = useState<string>("all"); // Section filter for activities
  const [openDropdown, setOpenDropdown] = useState<string | null>(null); // Track which dropdown is open
  
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
          
          // Fetch today's attendance overview for all classes
          const todayStr = format(new Date(), "yyyy-MM-dd");
          try {
            const attendancePromises = classesData.map((cls: any) =>
              attendanceApi.getStudentAttendance(cls.id, todayStr).catch(() => null)
            );
            const attendanceResults = await Promise.all(attendancePromises);
            
            // Aggregate attendance data
            let totalPresent = 0;
            let totalAbsent = 0;
            let totalLeave = 0;
            let totalStudents = 0;
            
            attendanceResults.forEach((attendance: any) => {
              if (attendance && attendance.students) {
                attendance.students.forEach((student: any) => {
                  totalStudents++;
                  if (student.status === 'present') totalPresent++;
                  else if (student.status === 'absent') totalAbsent++;
                  else if (student.status === 'leave') totalLeave++;
                });
              }
            });
            
            // Calculate percentages and format for pie chart
            const attendanceChartData = [];
            if (totalStudents > 0) {
              if (totalPresent > 0) {
                attendanceChartData.push({
                  name: 'Present',
                  value: Math.round((totalPresent / totalStudents) * 100),
                  color: '#22c55e' // green
                });
              }
              if (totalAbsent > 0) {
                attendanceChartData.push({
                  name: 'Absent',
                  value: Math.round((totalAbsent / totalStudents) * 100),
                  color: '#ef4444' // red
                });
              }
              if (totalLeave > 0) {
                attendanceChartData.push({
                  name: 'Leave',
                  value: Math.round((totalLeave / totalStudents) * 100),
                  color: '#f59e0b' // amber
                });
              }
            }
            setAttendanceData(attendanceChartData);
          } catch (error) {
            console.error('Error loading attendance overview:', error);
            setAttendanceData([]);
          }
          
          // Fetch recent activities
          try {
            const [homeworkData, testsData] = await Promise.all([
              homeworkApi.getAll().catch(() => []),
              testsApi?.getAll?.().catch(() => [])
            ]);
            
            // Helper function to get class info from classId
            const getClassInfo = (classId: string) => {
              if (!classId || !classesData || !Array.isArray(classesData)) {
                return { className: '', section: '' };
              }
              try {
                const cls = classesData.find((c: any) => c && c.id === classId);
                if (cls) {
                  return { className: cls.name || '', section: cls.section || '' };
                }
              } catch (err) {
                console.error('Error in getClassInfo:', err);
              }
              return { className: '', section: '' };
            };
            
            const activities: any[] = [];
            
            // Add recent homework
            if (homeworkData && Array.isArray(homeworkData)) {
              homeworkData.forEach((hw: any) => {
                try {
                  if (!hw || !hw.id) return;
                  const classInfo = getClassInfo(hw.classId || hw.class_id || '');
                  const createdAt = hw.createdAt || hw.created_at;
                  if (!createdAt) return;
                  
                  activities.push({
                    id: `hw-${hw.id}`,
                    action: `Homework "${hw.title || 'Untitled'}" assigned to ${hw.className || 'class'}`,
                    time: format(new Date(createdAt), 'MMM dd, yyyy HH:mm'),
                    timestamp: new Date(createdAt).getTime(),
                    type: 'homework',
                    icon: BookOpen,
                    className: classInfo.className,
                    section: classInfo.section
                  });
                } catch (err) {
                  console.error('Error processing homework activity:', err, hw);
                }
              });
            }
            
            // Add recent tests
            if (testsData && Array.isArray(testsData)) {
              testsData.forEach((test: any) => {
                try {
                  if (!test || !test.id) return;
                  const classInfo = getClassInfo(test.classId || test.class_id || '');
                  const createdAt = test.createdAt || test.created_at;
                  if (!createdAt) return;
                  
                  activities.push({
                    id: `test-${test.id}`,
                    action: `Test "${test.name || 'Untitled'}" created for ${test.className || 'class'}`,
                    time: format(new Date(createdAt), 'MMM dd, yyyy HH:mm'),
                    timestamp: new Date(createdAt).getTime(),
                    type: 'test',
                    icon: ClipboardCheck,
                    className: classInfo.className,
                    section: classInfo.section
                  });
                } catch (err) {
                  console.error('Error processing test activity:', err, test);
                }
              });
            }
            
            // Add recent student registrations
            if (studentsData && Array.isArray(studentsData)) {
              studentsData
                .filter((s: any) => s && s.status === 'approved')
                .forEach((student: any) => {
                  try {
                    if (!student || !student.id) return;
                    const classInfo = getClassInfo(student.classId || student.class_id || '');
                    const createdAt = student.createdAt || student.created_at;
                    if (!createdAt) return;
                    
                    activities.push({
                      id: `student-${student.id}`,
                      action: `Student "${student.name || 'Unknown'}" registered in ${student.className || 'class'}`,
                      time: format(new Date(createdAt), 'MMM dd, yyyy HH:mm'),
                      timestamp: new Date(createdAt).getTime(),
                      type: 'student',
                      icon: GraduationCap,
                      className: classInfo.className,
                      section: classInfo.section
                    });
                  } catch (err) {
                    console.error('Error processing student activity:', err, student);
                  }
                });
            }
            
            // Sort by timestamp (most recent first)
            activities.sort((a, b) => b.timestamp - a.timestamp);
            setAllActivities(activities); // Store all activities
            setRecentActivities(activities.slice(0, 10)); // Show top 10 by default
          } catch (error) {
            console.error('Error loading recent activities:', error);
            setAllActivities([]);
            setRecentActivities([]);
          }
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
  const totalClasses = (classes && Array.isArray(classes)) ? classes.length : 0;
  const totalStudents = (students && Array.isArray(students)) ? students.filter(s => s && s.status === 'approved').length : 0;
  const totalTeachers = (teachers && Array.isArray(teachers)) ? teachers.filter(t => t && t.isActive).length : 0;
  const pendingApprovals = (pendingStudents && Array.isArray(pendingStudents)) ? pendingStudents.length : 0;
  
  // Prepare class data for chart
  const adminClassData = (classes && Array.isArray(classes)) 
    ? classes.map(cls => ({
        name: cls.section ? `${cls.name} ${cls.section}` : cls.name,
        students: cls.studentCount || 0
      }))
    : [];

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
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Class Filter */}
                <div className="flex items-center gap-2">
                  <Label htmlFor="activity-class-filter" className="text-sm text-muted-foreground whitespace-nowrap">
                    Class:
                  </Label>
                  <Select
                    value={activityFilterClass}
                    onValueChange={(value) => {
                      setActivityFilterClass(value);
                      setActivityFilterSection("all"); // Reset section when class changes
                      setOpenDropdown(null); // Close after selection
                    }}
                    open={openDropdown === "class"}
                    onOpenChange={(open) => {
                      if (open) {
                        setOpenDropdown("class"); // Open this dropdown, close others
                      } else {
                        setOpenDropdown(null); // Close this dropdown
                      }
                    }}
                  >
                    <SelectTrigger id="activity-class-filter" className="w-32">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes && Array.isArray(classes) && classes.map((cls: any) => (
                        <SelectItem key={cls.id} value={cls.name}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Section Filter */}
                {activityFilterClass && activityFilterClass !== "all" && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="activity-section-filter" className="text-sm text-muted-foreground whitespace-nowrap">
                      Section:
                    </Label>
                    <Select
                      value={activityFilterSection}
                      onValueChange={(value) => {
                        setActivityFilterSection(value);
                        setOpenDropdown(null); // Close after selection
                      }}
                      open={openDropdown === "section"}
                      onOpenChange={(open) => {
                        if (open) {
                          setOpenDropdown("section"); // Open this dropdown, close others
                        } else {
                          setOpenDropdown(null); // Close this dropdown
                        }
                      }}
                    >
                      <SelectTrigger id="activity-section-filter" className="w-28">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        {classes && Array.isArray(classes) && (() => {
                          const sections = new Set<string>();
                          classes
                            .filter((cls: any) => cls && cls.name === activityFilterClass)
                            .forEach((cls: any) => {
                              if (cls.section) {
                                sections.add(cls.section);
                              } else {
                                sections.add("__no_section__");
                              }
                            });
                          return Array.from(sections).map((section: string) => (
                            <SelectItem key={section} value={section}>
                              {section === "__no_section__" ? "No Section" : section}
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Date Filter */}
                <div className="flex items-center gap-2">
                  <Label htmlFor="activity-date-filter" className="text-sm text-muted-foreground whitespace-nowrap">
                    Date:
                  </Label>
                  <Input
                    id="activity-date-filter"
                    type="date"
                    value={activityFilterDate}
                    onChange={(e) => {
                      setActivityFilterDate(e.target.value);
                    }}
                    className="w-40"
                  />
                </div>
                
                {/* Clear Button */}
                {(activityFilterClass !== "all" || activityFilterSection !== "all" || activityFilterDate) && (
                  <button
                    onClick={() => {
                      setActivityFilterClass("all");
                      setActivityFilterSection("all");
                      setActivityFilterDate("");
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground px-2"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              // Filter activities by class, section, and date
              let filteredActivities = allActivities;
              
              // Filter by class
              if (activityFilterClass && activityFilterClass !== "all") {
                filteredActivities = filteredActivities.filter((activity) => {
                  const activityClass = (activity.className || '').toLowerCase().trim();
                  const filterClass = (activityFilterClass || '').toLowerCase().trim();
                  return activityClass === filterClass;
                });
              }
              
              // Filter by section
              if (activityFilterSection && activityFilterSection !== "all") {
                filteredActivities = filteredActivities.filter((activity) => {
                  const activitySection = (activity.section || '').toUpperCase().trim();
                  const filterSection = activityFilterSection === "__no_section__" 
                    ? "" 
                    : (activityFilterSection || '').toUpperCase().trim();
                  const activitySectionNormalized = activitySection || "";
                  return activitySectionNormalized === filterSection;
                });
              }
              
              // Filter by date
              if (activityFilterDate) {
                const filterDate = parseISO(activityFilterDate);
                filteredActivities = filteredActivities.filter((activity) => {
                  try {
                    const activityDate = new Date(activity.timestamp);
                    return isSameDay(activityDate, filterDate);
                  } catch (e) {
                    return false;
                  }
                });
              }
              
              // If no filters, show top 10
              if (activityFilterClass === "all" && activityFilterSection === "all" && !activityFilterDate) {
                filteredActivities = filteredActivities.slice(0, 10);
              }

              return filteredActivities.length > 0 ? (
                <div className="space-y-4">
                  {filteredActivities.map((activity) => {
                    const IconComponent = activity.icon || Bell;
                    return (
                      <div key={activity.id} className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <IconComponent className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{activity.action}</p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">
                    {(activityFilterClass !== "all" || activityFilterSection !== "all" || activityFilterDate)
                      ? "No activity found for selected filters" 
                      : "No recent activity"}
                  </p>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </UnifiedLayout>
  );
}
