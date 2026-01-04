import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { studentsApi, attendanceApi, classesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Check, X, Clock, Save, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type AttendanceStatus = "present" | "absent" | "leave";

interface Student {
  id: number;
  name: string;
  rollNo: string;
  status: AttendanceStatus;
}

// Removed all hardcoded data - will be fetched from API

export default function Attendance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [historyPeriod, setHistoryPeriod] = useState("1month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [historyStudents, setHistoryStudents] = useState<Student[] | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [classId, setClassId] = useState<string>("");

  // Load students on mount
  useEffect(() => {
    const loadStudents = async () => {
      setIsLoading(true);
      try {
        // First, get teacher's assigned class from classes API
        let teacherClass: any = null;
        let foundClassId = "";
        
        try {
          const classesData = await classesApi.getAll();
          if (classesData && classesData.length > 0) {
            // Teacher should have at least one assigned class
            teacherClass = classesData[0];
            foundClassId = teacherClass.id;
            setClassId(foundClassId);
          }
        } catch (error) {
          console.error('Error loading classes:', error);
        }
        
        // Get students for the assigned class
        let filteredStudents: any[] = [];
        
        if (foundClassId) {
          // Use getByClass API if available
          try {
            filteredStudents = await studentsApi.getByClass(foundClassId);
          } catch (error) {
            // Fallback to getAll and filter
            const studentsData = await studentsApi.getAll();
            filteredStudents = (studentsData || []).filter((s: any) => s.classId === foundClassId);
          }
        } else if (user?.className) {
          // Fallback: try to match by className from user data
          const studentsData = await studentsApi.getAll();
          filteredStudents = (studentsData || []).filter((s: any) => {
            const studentClass = `${s.class}${s.section ? ` - Section ${s.section}` : ''}`.trim();
            const userClass = user.className?.trim();
            
            // Try exact match
            if (studentClass === userClass) {
              if (!foundClassId && s.classId) {
                foundClassId = s.classId;
                setClassId(foundClassId);
              }
              return true;
            }
            
            // Try without "Section" prefix
            const studentClassSimple = `${s.class}${s.section ? ` ${s.section}` : ''}`.trim();
            const userClassSimple = userClass.replace(/Section\s*/i, '').trim();
            if (studentClassSimple === userClassSimple && !foundClassId && s.classId) {
              foundClassId = s.classId;
              setClassId(foundClassId);
              return true;
            }
            
            return false;
          });
        } else {
          // No class assigned
          setStudents([]);
          setIsLoading(false);
          return;
        }

        setStudents(filteredStudents.map((s: any, index: number) => ({
          id: parseInt(s.id) || index + 1,
          name: s.name,
          rollNo: s.rollNo || String(index + 1).padStart(2, '0'),
          status: "present" as AttendanceStatus // Default status
        })));

        // Load today's attendance if classId is available
        const currentClassId = foundClassId || classId;
        if (currentClassId && filteredStudents.length > 0) {
          const todayStr = format(new Date(), "yyyy-MM-dd");
          try {
            const attendanceData = await attendanceApi.getStudentAttendance(currentClassId, todayStr);
            if (attendanceData && attendanceData.students) {
              setStudents(prev => prev.map(student => {
                const savedStatus = attendanceData.students.find((s: any) => 
                  s.id === student.id.toString() || s.id === student.id
                );
                return {
                  ...student,
                  status: (savedStatus?.status as AttendanceStatus) || student.status
                };
              }));
            }
          } catch (error) {
            // No attendance for today, that's okay
            console.log('No attendance data for today');
          }
        }
      } catch (error) {
        console.error('Error loading students:', error);
        setStudents([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadStudents();
  }, [user]); // Removed classId from dependencies to avoid infinite loop

  // Load attendance history chart data
  useEffect(() => {
    const loadAttendanceHistory = async () => {
      if (!classId) return;
      try {
        // Calculate date range based on historyPeriod
        const endDate = new Date();
        const startDate = new Date();
        if (historyPeriod === "1month") {
          startDate.setMonth(startDate.getMonth() - 1);
        } else if (historyPeriod === "2months") {
          startDate.setMonth(startDate.getMonth() - 2);
        } else if (historyPeriod === "3months") {
          startDate.setMonth(startDate.getMonth() - 3);
        }

        const historyData = await attendanceApi.getStudentAttendanceHistory(
          classId,
          format(startDate, "yyyy-MM-dd"),
          format(endDate, "yyyy-MM-dd")
        );

        // Transform data for chart (group by week)
        if (historyData && Array.isArray(historyData)) {
          // Group by week and calculate stats
          const weeklyData: Record<string, { present: number; absent: number }> = {};
          historyData.forEach((record: any) => {
            const weekKey = format(new Date(record.date), "yyyy-'Week' w");
            if (!weeklyData[weekKey]) {
              weeklyData[weekKey] = { present: 0, absent: 0 };
            }
            if (record.students) {
              record.students.forEach((s: any) => {
                if (s.status === "present") weeklyData[weekKey].present++;
                else if (s.status === "absent") weeklyData[weekKey].absent++;
              });
            }
          });

          setAttendanceHistory(Object.entries(weeklyData).map(([date, stats]) => ({
            date,
            ...stats
          })));
        }
      } catch (error) {
        console.error('Error loading attendance history:', error);
        setAttendanceHistory([]);
      }
    };
    loadAttendanceHistory();
  }, [classId, historyPeriod]);

  const handleLogout = () => {
    navigate("/");
  };

  const updateStatus = (studentId: number, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status } : s))
    );
  };

  const handleDateSelect = async (date: Date | undefined) => {
    setSelectedDate(date);
    if (date && classId) {
      const dateKey = format(date, "yyyy-MM-dd");
      try {
        const attendanceData = await attendanceApi.getStudentAttendance(classId, dateKey);
        if (attendanceData && attendanceData.students) {
          setHistoryStudents(attendanceData.students.map((s: any) => {
            const student = students.find(st => st.id === s.id || st.id.toString() === s.id.toString());
            return {
              id: student?.id || parseInt(s.id) || 0,
              name: student?.name || `Student ${s.id}`,
              rollNo: student?.rollNo || String(s.id).padStart(2, '0'),
              status: (s.status as AttendanceStatus) || "present"
            };
          }));
        } else {
          setHistoryStudents(null);
        }
      } catch (error) {
        console.error('Error loading attendance for date:', error);
        setHistoryStudents(null);
      }
    } else {
      setHistoryStudents(null);
    }
  };

  const stats = {
    present: students.filter((s) => s.status === "present").length,
    absent: students.filter((s) => s.status === "absent").length,
    leave: students.filter((s) => s.status === "leave").length,
  };

  const historyStats = historyStudents ? {
    present: historyStudents.filter((s) => s.status === "present").length,
    absent: historyStudents.filter((s) => s.status === "absent").length,
    leave: historyStudents.filter((s) => s.status === "leave").length,
  } : null;

  return (
    <DashboardLayout role="teacher" userName="Sarah Johnson" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Attendance</h1>
            <p className="text-muted-foreground mt-1">
              Mark and view attendance for your assigned class.
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarIcon className="w-5 h-5" />
            <span className="font-medium">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
        </div>

        <Tabs defaultValue="mark" className="w-full">
          <TabsList>
            <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
            <TabsTrigger value="history">Attendance History</TabsTrigger>
          </TabsList>

          <TabsContent value="mark" className="mt-6 space-y-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Loading students...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No students found for your assigned class.</p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-success/10 rounded-xl p-4 text-center border border-success/20">
                    <Check className="w-6 h-6 text-success mx-auto mb-2" />
                    <p className="text-2xl font-bold text-success">{stats.present}</p>
                    <p className="text-sm text-muted-foreground">Present</p>
                  </div>
                  <div className="bg-destructive/10 rounded-xl p-4 text-center border border-destructive/20">
                    <X className="w-6 h-6 text-destructive mx-auto mb-2" />
                    <p className="text-2xl font-bold text-destructive">{stats.absent}</p>
                    <p className="text-sm text-muted-foreground">Absent</p>
                  </div>
                  <div className="bg-warning/10 rounded-xl p-4 text-center border border-warning/20">
                    <Clock className="w-6 h-6 text-warning mx-auto mb-2" />
                    <p className="text-2xl font-bold text-warning">{stats.leave}</p>
                    <p className="text-sm text-muted-foreground">Leave</p>
                  </div>
                </div>

                {/* Attendance Table */}
                <div className="data-table">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>Roll No</th>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <span className="badge badge-info">{student.rollNo}</span>
                          </td>
                          <td>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {student.name.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{student.name}</span>
                            </div>
                          </td>
                          <td>
                            <Select
                              value={student.status}
                              onValueChange={(value: AttendanceStatus) => updateStatus(student.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present">Present</SelectItem>
                                <SelectItem value="absent">Absent</SelectItem>
                                <SelectItem value="leave">Leave</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className={student.status === "present" ? "bg-success/20 text-success" : ""}
                                onClick={() => updateStatus(student.id, "present")}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={student.status === "absent" ? "bg-destructive/20 text-destructive" : ""}
                                onClick={() => updateStatus(student.id, "absent")}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={student.status === "leave" ? "bg-warning/20 text-warning" : ""}
                                onClick={() => updateStatus(student.id, "leave")}
                              >
                                <Clock className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Button 
                  className="w-full sm:w-auto"
                  onClick={async () => {
                    if (!classId) {
                      alert("No class assigned. Cannot save attendance.");
                      return;
                    }
                    try {
                      const todayStr = format(new Date(), "yyyy-MM-dd");
                      await attendanceApi.saveStudentAttendance({
                        classId: classId,
                        date: todayStr,
                        students: students.map(s => ({ id: s.id.toString(), status: s.status }))
                      });
                      alert("Attendance saved successfully!");
                    } catch (error: any) {
                      console.error('Error saving attendance:', error);
                      alert(error?.message || "Failed to save attendance");
                    }
                  }}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Attendance
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6 space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <Select value={historyPeriod} onValueChange={setHistoryPeriod}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1month">Last 1 Month</SelectItem>
                  <SelectItem value="2months">Last 2 Months</SelectItem>
                  <SelectItem value="3months">Last 3 Months</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Search by date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              {selectedDate && (
                <Button variant="ghost" size="sm" onClick={() => { setSelectedDate(undefined); setHistoryStudents(null); }}>
                  Clear Date
                </Button>
              )}
            </div>

            {/* Date-specific Attendance */}
            {selectedDate && historyStudents && (
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <h3 className="section-title flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  Attendance for {format(selectedDate, "MMMM d, yyyy")}
                </h3>

                {/* Stats for selected date */}
                <div className="grid grid-cols-3 gap-4 mt-4 mb-6">
                  <div className="bg-success/10 rounded-lg p-3 text-center border border-success/20">
                    <p className="text-xl font-bold text-success">{historyStats?.present || 0}</p>
                    <p className="text-xs text-muted-foreground">Present</p>
                  </div>
                  <div className="bg-destructive/10 rounded-lg p-3 text-center border border-destructive/20">
                    <p className="text-xl font-bold text-destructive">{historyStats?.absent || 0}</p>
                    <p className="text-xs text-muted-foreground">Absent</p>
                  </div>
                  <div className="bg-warning/10 rounded-lg p-3 text-center border border-warning/20">
                    <p className="text-xl font-bold text-warning">{historyStats?.leave || 0}</p>
                    <p className="text-xs text-muted-foreground">Leave</p>
                  </div>
                </div>

                {/* Student list for selected date */}
                <div className="data-table">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>Roll No</th>
                        <th>Student</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyStudents.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <span className="badge badge-info">{student.rollNo}</span>
                          </td>
                          <td>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {student.name.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{student.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${
                              student.status === "present" ? "badge-success" : 
                              student.status === "absent" ? "badge-destructive" : 
                              "badge-warning"
                            }`}>
                              {student.status === "present" && <Check className="w-3 h-3 mr-1" />}
                              {student.status === "absent" && <X className="w-3 h-3 mr-1" />}
                              {student.status === "leave" && <Clock className="w-3 h-3 mr-1" />}
                              {student.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <h3 className="section-title">Attendance Trend</h3>
              {attendanceHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No attendance history data available</p>
                </div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="present" name="Present" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="absent" name="Absent" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
