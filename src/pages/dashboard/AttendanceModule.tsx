import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ClipboardCheck, 
  Calendar as CalendarIcon, 
  Clock, 
  Download, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Users,
  LogIn,
  LogOut,
  Info
} from "lucide-react";
import { format, isSameDay } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface Student {
  id: number;
  name: string;
  rollNo: number;
  status: "present" | "absent" | "leave" | "not-marked";
}

interface AttendanceRecord {
  date: Date;
  classId: string;
  students: { id: number; status: string }[];
  markedAt: Date;
}

const allStudents: Student[] = [
  { id: 1, name: "Aarav Sharma", rollNo: 1, status: "not-marked" },
  { id: 2, name: "Ananya Patel", rollNo: 2, status: "not-marked" },
  { id: 3, name: "Arjun Kumar", rollNo: 3, status: "not-marked" },
  { id: 4, name: "Diya Singh", rollNo: 4, status: "not-marked" },
  { id: 5, name: "Ishaan Gupta", rollNo: 5, status: "not-marked" },
  { id: 6, name: "Kavya Reddy", rollNo: 6, status: "not-marked" },
  { id: 7, name: "Lakshmi Nair", rollNo: 7, status: "not-marked" },
  { id: 8, name: "Manav Joshi", rollNo: 8, status: "not-marked" },
  { id: 9, name: "Neha Verma", rollNo: 9, status: "not-marked" },
  { id: 10, name: "Omkar Desai", rollNo: 10, status: "not-marked" },
  { id: 11, name: "Priya Menon", rollNo: 11, status: "not-marked" },
  { id: 12, name: "Rahul Iyer", rollNo: 12, status: "not-marked" },
];

const teacherAttendance = [
  { id: 1, name: "Mrs. Sharma", checkIn: "07:45", checkOut: "14:30", status: "present" },
  { id: 2, name: "Mr. Singh", checkIn: "07:50", checkOut: "14:25", status: "present" },
  { id: 3, name: "Mrs. Gupta", checkIn: "-", checkOut: "-", status: "leave" },
  { id: 4, name: "Mr. Kumar", checkIn: "08:15", checkOut: "-", status: "late" },
  { id: 5, name: "Mrs. Patel", checkIn: "07:55", checkOut: "14:30", status: "present" },
];

const monthlyStats = [
  { month: "Jan", present: 22, absent: 2, leave: 1 },
  { month: "Feb", present: 20, absent: 1, leave: 2 },
  { month: "Mar", present: 21, absent: 2, leave: 2 },
  { month: "Apr", present: 18, absent: 3, leave: 1 },
];

// Simulated saved attendance records
const savedAttendanceRecords: AttendanceRecord[] = [
  {
    date: new Date(new Date().setDate(new Date().getDate() - 1)),
    classId: "5A",
    students: [
      { id: 1, status: "present" },
      { id: 2, status: "present" },
      { id: 3, status: "absent" },
      { id: 4, status: "present" },
      { id: 5, status: "leave" },
      { id: 6, status: "present" },
      { id: 7, status: "present" },
      { id: 8, status: "absent" },
      { id: 9, status: "present" },
      { id: 10, status: "present" },
      { id: 11, status: "present" },
      { id: 12, status: "leave" },
    ],
    markedAt: new Date(new Date().setDate(new Date().getDate() - 1)),
  },
  {
    date: new Date(new Date().setDate(new Date().getDate() - 2)),
    classId: "5A",
    students: [
      { id: 1, status: "present" },
      { id: 2, status: "absent" },
      { id: 3, status: "present" },
      { id: 4, status: "present" },
      { id: 5, status: "present" },
      { id: 6, status: "present" },
      { id: 7, status: "leave" },
      { id: 8, status: "present" },
      { id: 9, status: "present" },
      { id: 10, status: "absent" },
      { id: 11, status: "present" },
      { id: 12, status: "present" },
    ],
    markedAt: new Date(new Date().setDate(new Date().getDate() - 2)),
  },
];

export default function AttendanceModule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [historyDate, setHistoryDate] = useState<Date | undefined>(undefined);
  const [selectedClass, setSelectedClass] = useState("5A");
  const [studentAttendance, setStudentAttendance] = useState<Student[]>(allStudents);
  const [isSelfCheckedIn, setIsSelfCheckedIn] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(savedAttendanceRecords);
  const [todayAttendanceTaken, setTodayAttendanceTaken] = useState(false);

  const today = new Date();

  // Check if today's attendance is already taken
  useEffect(() => {
    const todayRecord = attendanceRecords.find(
      r => isSameDay(r.date, today) && r.classId === selectedClass
    );
    
    if (todayRecord) {
      setTodayAttendanceTaken(true);
      // Load saved attendance
      const loadedStudents = allStudents.map(student => {
        const savedStatus = todayRecord.students.find(s => s.id === student.id);
        return {
          ...student,
          status: (savedStatus?.status as Student["status"]) || "not-marked"
        };
      });
      setStudentAttendance(loadedStudents);
    } else {
      setTodayAttendanceTaken(false);
      // Reset to not-marked for new day
      setStudentAttendance(allStudents.map(s => ({ ...s, status: "not-marked" })));
    }
  }, [selectedClass]);

  const updateStudentStatus = (id: number, status: Student["status"]) => {
    setStudentAttendance(prev => 
      prev.map(s => s.id === id ? { ...s, status } : s)
    );
  };

  const markAllPresent = () => {
    setStudentAttendance(prev => prev.map(s => ({ ...s, status: "present" })));
  };

  const saveAttendance = () => {
    const unmarked = studentAttendance.filter(s => s.status === "not-marked");
    if (unmarked.length > 0) {
      toast({
        title: "Incomplete Attendance",
        description: `${unmarked.length} student(s) have not been marked. Please mark all students.`,
        variant: "destructive"
      });
      return;
    }

    const newRecord: AttendanceRecord = {
      date: today,
      classId: selectedClass,
      students: studentAttendance.map(s => ({ id: s.id, status: s.status })),
      markedAt: new Date(),
    };

    // Update or add record
    const existingIndex = attendanceRecords.findIndex(
      r => isSameDay(r.date, today) && r.classId === selectedClass
    );

    if (existingIndex >= 0) {
      const updated = [...attendanceRecords];
      updated[existingIndex] = newRecord;
      setAttendanceRecords(updated);
      toast({ title: "Attendance Updated", description: `Attendance for Class ${selectedClass} has been updated.` });
    } else {
      setAttendanceRecords([...attendanceRecords, newRecord]);
      toast({ title: "Attendance Saved", description: `Attendance for Class ${selectedClass} has been saved.` });
    }
    
    setTodayAttendanceTaken(true);
  };

  // Get history for selected date
  const getHistoryForDate = (d: Date) => {
    return attendanceRecords.find(r => isSameDay(r.date, d) && r.classId === selectedClass);
  };

  // Dates with attendance records (for calendar highlighting)
  const attendanceDates = attendanceRecords
    .filter(r => r.classId === selectedClass)
    .map(r => r.date);

  const presentCount = studentAttendance.filter(s => s.status === "present").length;
  const absentCount = studentAttendance.filter(s => s.status === "absent").length;
  const leaveCount = studentAttendance.filter(s => s.status === "leave").length;

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? "View and manage attendance for all teachers and classes"
                : "Mark student attendance and track your own attendance"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        <Tabs defaultValue={isAdmin ? "teachers" : "students"} className="space-y-6">
          <TabsList>
            {isAdmin && <TabsTrigger value="teachers">Teacher Attendance</TabsTrigger>}
            <TabsTrigger value="students">Student Attendance</TabsTrigger>
            {!isAdmin && <TabsTrigger value="self">My Attendance</TabsTrigger>}
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Teacher Attendance (Admin Only) */}
          {isAdmin && (
            <TabsContent value="teachers" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-secondary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">24</p>
                        <p className="text-sm text-muted-foreground">Present</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <XCircle className="w-6 h-6 text-destructive" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">1</p>
                        <p className="text-sm text-muted-foreground">Absent</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">2</p>
                        <p className="text-sm text-muted-foreground">On Leave</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">1</p>
                        <p className="text-sm text-muted-foreground">Late</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Today's Teacher Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher Name</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teacherAttendance.map((teacher) => (
                        <TableRow key={teacher.id}>
                          <TableCell className="font-medium">{teacher.name}</TableCell>
                          <TableCell>{teacher.checkIn}</TableCell>
                          <TableCell>{teacher.checkOut}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                teacher.status === "present" ? "default" :
                                teacher.status === "late" ? "secondary" :
                                teacher.status === "leave" ? "outline" : "destructive"
                              }
                              className={
                                teacher.status === "present" ? "bg-secondary" : 
                                teacher.status === "late" ? "bg-accent text-accent-foreground" : ""
                              }
                            >
                              {teacher.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">View History</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Student Attendance */}
          <TabsContent value="students" className="space-y-4">
            {/* Today's Attendance Notification */}
            {todayAttendanceTaken && (
              <Alert className="border-secondary bg-secondary/10">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                <AlertTitle className="text-secondary">Attendance Already Taken</AlertTitle>
                <AlertDescription>
                  Today's attendance for Class {selectedClass} has already been marked. You can update it if needed.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Stats & Quick Actions */}
              <div className="lg:w-80 space-y-4">
                {/* Date Display */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <CalendarIcon className="w-8 h-8 mx-auto text-primary mb-2" />
                      <p className="text-lg font-semibold">{format(today, "EEEE")}</p>
                      <p className="text-2xl font-bold text-primary">{format(today, "dd MMM yyyy")}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" onClick={markAllPresent}>
                      <CheckCircle2 className="w-4 h-4 mr-2 text-secondary" />
                      Mark All Present
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setStudentAttendance(allStudents.map(s => ({ ...s, status: "not-marked" })))}
                    >
                      <XCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                      Reset All
                    </Button>
                  </CardContent>
                </Card>
                
                {/* Stats Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Today's Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-secondary" />
                        <span className="text-sm">Present</span>
                      </div>
                      <span className="font-semibold text-secondary">{presentCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-destructive" />
                        <span className="text-sm">Absent</span>
                      </div>
                      <span className="font-semibold text-destructive">{absentCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-accent" />
                        <span className="text-sm">On Leave</span>
                      </div>
                      <span className="font-semibold text-accent">{leaveCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                        <span className="text-sm">Not Marked</span>
                      </div>
                      <span className="font-semibold">{studentAttendance.filter(s => s.status === "not-marked").length}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Total Students</span>
                        <span className="font-bold">{studentAttendance.length}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Student List */}
              <Card className="flex-1">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      {isAdmin ? "Class Attendance" : "My Class Attendance"} - {format(today, "dd/MM/yyyy")}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card">
                            <SelectItem value="5A">Class 5A</SelectItem>
                            <SelectItem value="5B">Class 5B</SelectItem>
                            <SelectItem value="4A">Class 4A</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Roll</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Mark Attendance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentAttendance.map((student) => (
                        <TableRow key={student.id} className={student.status === "not-marked" ? "bg-muted/30" : ""}>
                          <TableCell className="font-medium">{student.rollNo}</TableCell>
                          <TableCell>{student.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={student.status === "not-marked" ? "outline" : "default"}
                              className={
                                student.status === "present" ? "bg-secondary" : 
                                student.status === "absent" ? "bg-destructive" : 
                                student.status === "leave" ? "bg-accent" : 
                                "bg-muted text-muted-foreground"
                              }
                            >
                              {student.status === "not-marked" ? "Not Marked" : student.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                size="sm" 
                                variant={student.status === "present" ? "default" : "outline"}
                                className={student.status === "present" ? "bg-secondary hover:bg-secondary/90" : ""}
                                onClick={() => updateStudentStatus(student.id, "present")}
                              >
                                P
                              </Button>
                              <Button 
                                size="sm" 
                                variant={student.status === "absent" ? "default" : "outline"}
                                className={student.status === "absent" ? "bg-destructive hover:bg-destructive/90" : ""}
                                onClick={() => updateStudentStatus(student.id, "absent")}
                              >
                                A
                              </Button>
                              <Button 
                                size="sm" 
                                variant={student.status === "leave" ? "default" : "outline"}
                                className={student.status === "leave" ? "bg-accent hover:bg-accent/90" : ""}
                                onClick={() => updateStudentStatus(student.id, "leave")}
                              >
                                L
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      {studentAttendance.filter(s => s.status === "not-marked").length > 0 
                        ? `${studentAttendance.filter(s => s.status === "not-marked").length} students not marked`
                        : "All students marked ✓"
                      }
                    </p>
                    <Button onClick={saveAttendance}>
                      <ClipboardCheck className="w-4 h-4 mr-2" />
                      {todayAttendanceTaken ? "Update Attendance" : "Save Attendance"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Self Attendance (Teacher Only) */}
          {!isAdmin && (
            <TabsContent value="self" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Today's Check-in</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center py-6">
                      <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${
                        isSelfCheckedIn ? "bg-secondary/10" : "bg-muted"
                      }`}>
                        {isSelfCheckedIn ? (
                          <CheckCircle2 className="w-12 h-12 text-secondary" />
                        ) : (
                          <Clock className="w-12 h-12 text-muted-foreground" />
                        )}
                      </div>
                      <p className="mt-4 text-lg font-semibold">
                        {isSelfCheckedIn ? "Checked In" : "Not Checked In"}
                      </p>
                      {isSelfCheckedIn && (
                        <p className="text-sm text-muted-foreground">Check-in time: 07:55 AM</p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        className="flex-1" 
                        disabled={isSelfCheckedIn}
                        onClick={() => setIsSelfCheckedIn(true)}
                      >
                        <LogIn className="w-4 h-4 mr-2" />
                        Check In
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        disabled={!isSelfCheckedIn}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Check Out
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Apply for Leave</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">From Date</label>
                        <Input type="date" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">To Date</label>
                        <Input type="date" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Leave Type</label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="casual">Casual Leave</SelectItem>
                          <SelectItem value="sick">Sick Leave</SelectItem>
                          <SelectItem value="earned">Earned Leave</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reason</label>
                      <Textarea 
                        placeholder="Enter reason for leave"
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                      />
                    </div>
                    <Button className="w-full">Submit Leave Request</Button>
                  </CardContent>
                </Card>
              </div>

              {/* Personal Attendance History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">My Attendance History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    {monthlyStats.map((stat) => (
                      <div key={stat.month} className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="font-semibold text-lg">{stat.month}</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <p className="text-secondary">Present: {stat.present}</p>
                          <p className="text-destructive">Absent: {stat.absent}</p>
                          <p className="text-accent">Leave: {stat.leave}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* History */}
          <TabsContent value="history" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Calendar for History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    Select Date
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={historyDate}
                    onSelect={setHistoryDate}
                    className="rounded-md border pointer-events-auto"
                    modifiers={{
                      hasAttendance: attendanceDates
                    }}
                    modifiersStyles={{
                      hasAttendance: { backgroundColor: "hsl(var(--secondary))", color: "white", fontWeight: "bold" }
                    }}
                  />
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 rounded bg-secondary" />
                    <span>Dates with attendance records</span>
                  </div>
                </CardContent>
              </Card>

              {/* History Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {historyDate 
                      ? `Attendance - ${format(historyDate, "dd MMM yyyy")}`
                      : "Attendance Records"
                    }
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!historyDate ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select a date from the calendar to view attendance records</p>
                    </div>
                  ) : (() => {
                    const record = getHistoryForDate(historyDate);
                    if (!record) {
                      return (
                        <div className="text-center py-12 text-muted-foreground">
                          <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No attendance record for this date</p>
                          <p className="text-sm mt-2">Class {selectedClass}</p>
                        </div>
                      );
                    }

                    const historyPresent = record.students.filter(s => s.status === "present").length;
                    const historyAbsent = record.students.filter(s => s.status === "absent").length;
                    const historyLeave = record.students.filter(s => s.status === "leave").length;

                    return (
                      <div className="space-y-4">
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 rounded-lg bg-secondary/10">
                            <p className="text-2xl font-bold text-secondary">{historyPresent}</p>
                            <p className="text-xs text-muted-foreground">Present</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-destructive/10">
                            <p className="text-2xl font-bold text-destructive">{historyAbsent}</p>
                            <p className="text-xs text-muted-foreground">Absent</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-accent/10">
                            <p className="text-2xl font-bold text-accent">{historyLeave}</p>
                            <p className="text-xs text-muted-foreground">Leave</p>
                          </div>
                        </div>

                        {/* Student List */}
                        <div className="max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Roll</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {record.students.map((s) => {
                                const student = allStudents.find(st => st.id === s.id);
                                return (
                                  <TableRow key={s.id}>
                                    <TableCell>{student?.rollNo}</TableCell>
                                    <TableCell>{student?.name}</TableCell>
                                    <TableCell className="text-right">
                                      <Badge 
                                        className={
                                          s.status === "present" ? "bg-secondary" : 
                                          s.status === "absent" ? "bg-destructive" : "bg-accent"
                                        }
                                      >
                                        {s.status}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                          Marked at: {format(record.markedAt, "hh:mm a")}
                        </p>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </UnifiedLayout>
  );
}
