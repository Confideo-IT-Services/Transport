import { useState } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  LogOut
} from "lucide-react";

const students = [
  { id: 1, name: "Aarav Sharma", rollNo: 1, status: "present" },
  { id: 2, name: "Ananya Patel", rollNo: 2, status: "present" },
  { id: 3, name: "Arjun Kumar", rollNo: 3, status: "absent" },
  { id: 4, name: "Diya Singh", rollNo: 4, status: "present" },
  { id: 5, name: "Ishaan Gupta", rollNo: 5, status: "leave" },
  { id: 6, name: "Kavya Reddy", rollNo: 6, status: "present" },
  { id: 7, name: "Lakshmi Nair", rollNo: 7, status: "present" },
  { id: 8, name: "Manav Joshi", rollNo: 8, status: "present" },
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

export default function AttendanceModule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedClass, setSelectedClass] = useState("5A");
  const [studentAttendance, setStudentAttendance] = useState(students);
  const [isSelfCheckedIn, setIsSelfCheckedIn] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");

  const updateStudentStatus = (id: number, status: string) => {
    setStudentAttendance(prev => 
      prev.map(s => s.id === id ? { ...s, status } : s)
    );
  };

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
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Calendar & Stats */}
              <div className="lg:w-80 space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      className="rounded-md"
                    />
                  </CardContent>
                </Card>
                
                {(isAdmin || true) && (
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Present</span>
                        <span className="font-semibold text-secondary">{presentCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Absent</span>
                        <span className="font-semibold text-destructive">{absentCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">On Leave</span>
                        <span className="font-semibold text-accent">{leaveCount}</span>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Total</span>
                          <span className="font-bold">{studentAttendance.length}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Student List */}
              <Card className="flex-1">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {isAdmin ? "Class Attendance" : "My Class Attendance"}
                    </CardTitle>
                    {isAdmin && (
                      <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5A">Class 5A</SelectItem>
                          <SelectItem value="5B">Class 5B</SelectItem>
                          <SelectItem value="4A">Class 4A</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roll No</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentAttendance.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>{student.rollNo}</TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              className={
                                student.status === "present" ? "bg-secondary" : 
                                student.status === "absent" ? "bg-destructive" : "bg-accent"
                              }
                            >
                              {student.status}
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
                  <div className="mt-4 flex justify-end">
                    <Button>Save Attendance</Button>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Attendance History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a date from the calendar to view historical attendance records</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </UnifiedLayout>
  );
}
