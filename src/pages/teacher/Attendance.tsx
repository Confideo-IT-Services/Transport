import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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

const initialStudents: Student[] = [
  { id: 1, name: "Alex Johnson", rollNo: "01", status: "present" },
  { id: 2, name: "Emma Williams", rollNo: "02", status: "present" },
  { id: 3, name: "Noah Brown", rollNo: "03", status: "absent" },
  { id: 4, name: "Olivia Davis", rollNo: "04", status: "present" },
  { id: 5, name: "Liam Wilson", rollNo: "05", status: "present" },
  { id: 6, name: "Sophia Martinez", rollNo: "06", status: "leave" },
  { id: 7, name: "Mason Anderson", rollNo: "07", status: "present" },
  { id: 8, name: "Isabella Taylor", rollNo: "08", status: "present" },
  { id: 9, name: "James Thomas", rollNo: "09", status: "absent" },
  { id: 10, name: "Mia Garcia", rollNo: "10", status: "present" },
];

const attendanceHistory = [
  { date: "Week 1", present: 42, absent: 3 },
  { date: "Week 2", present: 40, absent: 5 },
  { date: "Week 3", present: 44, absent: 1 },
  { date: "Week 4", present: 41, absent: 4 },
];

// Historical attendance data by date
const historicalData: Record<string, { id: number; name: string; rollNo: string; status: AttendanceStatus }[]> = {
  "2024-01-15": [
    { id: 1, name: "Alex Johnson", rollNo: "01", status: "present" },
    { id: 2, name: "Emma Williams", rollNo: "02", status: "absent" },
    { id: 3, name: "Noah Brown", rollNo: "03", status: "present" },
    { id: 4, name: "Olivia Davis", rollNo: "04", status: "present" },
    { id: 5, name: "Liam Wilson", rollNo: "05", status: "leave" },
  ],
  "2024-01-16": [
    { id: 1, name: "Alex Johnson", rollNo: "01", status: "present" },
    { id: 2, name: "Emma Williams", rollNo: "02", status: "present" },
    { id: 3, name: "Noah Brown", rollNo: "03", status: "absent" },
    { id: 4, name: "Olivia Davis", rollNo: "04", status: "present" },
    { id: 5, name: "Liam Wilson", rollNo: "05", status: "present" },
  ],
};

export default function Attendance() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [historyPeriod, setHistoryPeriod] = useState("1month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [historyStudents, setHistoryStudents] = useState<typeof initialStudents | null>(null);

  const handleLogout = () => {
    navigate("/");
  };

  const updateStatus = (studentId: number, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status } : s))
    );
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const dateKey = format(date, "yyyy-MM-dd");
      // In real app, fetch from backend
      const data = historicalData[dateKey];
      if (data) {
        setHistoryStudents(data);
      } else {
        // Generate sample data for demo
        setHistoryStudents(
          initialStudents.map(s => ({
            ...s,
            status: ["present", "absent", "leave"][Math.floor(Math.random() * 3)] as AttendanceStatus
          }))
        );
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
            <p className="text-muted-foreground mt-1">Mark and view attendance for Class 3A.</p>
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

            <Button className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              Save Attendance
            </Button>
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
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
