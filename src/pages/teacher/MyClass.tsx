import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Eye, Phone, Mail } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { classesApi, studentsApi, attendanceApi } from "@/lib/api";
import { format, subDays, startOfMonth } from "date-fns";

interface Student {
  id: string | number;
  name: string;
  rollNo: string;
  parentPhone?: string;
  parentEmail?: string;
  attendance?: number;
  photo?: string;
}

export default function MyClass() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [teacherClass, setTeacherClass] = useState<any>(null);
  const [averageAttendance, setAverageAttendance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Load teacher's class and students
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load teacher's assigned class
        const classesData = await classesApi.getAll();
        if (classesData && classesData.length > 0) {
          const assignedClass = classesData[0];
          setTeacherClass(assignedClass);

          // Load students for the class
          let studentsData: any[] = [];
          try {
            studentsData = await studentsApi.getByClass(assignedClass.id);
          } catch (error) {
            // Fallback: get all students and filter
            const allStudents = await studentsApi.getAll();
            studentsData = (allStudents || []).filter((s: any) => s.classId === assignedClass.id);
          }

          // Transform students data
          const transformedStudents: Student[] = studentsData.map((s: any, index: number) => ({
            id: s.id || index + 1,
            name: s.name || s.fullName || "Unknown",
            rollNo: s.rollNo || s.roll_number || String(index + 1).padStart(2, '0'),
            parentPhone: s.parentPhone || s.parent_phone || s.guardianPhone || "",
            parentEmail: s.parentEmail || s.parent_email || s.guardianEmail || "",
            photo: s.photo || s.photo_url || "",
            attendance: 0 // Will be calculated below
          }));

          // Calculate attendance percentage for each student
          const today = new Date();
          const monthStart = startOfMonth(today);
          const monthStartStr = format(monthStart, "yyyy-MM-dd");
          const todayStr = format(today, "yyyy-MM-dd");

          try {
            const attendanceHistory = await attendanceApi.getStudentAttendanceHistory(
              assignedClass.id,
              monthStartStr,
              todayStr
            );

            // Calculate attendance for each student
            const studentsWithAttendance = transformedStudents.map(student => {
              const studentAttendance = attendanceHistory.filter((a: any) => 
                a.studentId === student.id.toString() || a.studentId === student.id
              );
              
              if (studentAttendance.length === 0) {
                return { ...student, attendance: 0 };
              }

              const presentCount = studentAttendance.filter((a: any) => a.status === 'present').length;
              const totalCount = studentAttendance.length;
              const attendancePercentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

              return { ...student, attendance: attendancePercentage };
            });

            setStudents(studentsWithAttendance);

            // Calculate average attendance
            const totalAttendance = studentsWithAttendance.reduce((sum, s) => sum + (s.attendance || 0), 0);
            const avg = studentsWithAttendance.length > 0 
              ? Math.round(totalAttendance / studentsWithAttendance.length) 
              : 0;
            setAverageAttendance(avg);
          } catch (error) {
            console.error('Error loading attendance:', error);
            // Set students without attendance data
            setStudents(transformedStudents);
            setAverageAttendance(0);
          }
        }
      } catch (error) {
        console.error('Error loading class data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleLogout = () => {
    navigate("/");
  };

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNo.includes(searchTerm)
  );

  return (
    <DashboardLayout role="teacher" userName="Sarah Johnson" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="page-title">
            My Class - {teacherClass ? `${teacherClass.name}${teacherClass.section ? ` - Section ${teacherClass.section}` : ''}` : (user?.className || "Loading...")}
          </h1>
          <p className="text-muted-foreground mt-1">Manage your students and view their profiles.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <p className="text-sm text-muted-foreground">Total Students</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {isLoading ? "..." : students.length}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <p className="text-sm text-muted-foreground">Average Attendance</p>
            <p className="text-2xl font-bold text-success mt-1">
              {isLoading ? "..." : `${averageAttendance}%`}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <p className="text-sm text-muted-foreground">Class Teacher</p>
            <p className="text-2xl font-bold text-primary mt-1">
              {user?.name?.split(" ").map(n => n[0]).join("") || "T"}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or roll number..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Students Table */}
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Roll No</th>
                <th>Parent Contact</th>
                <th>Attendance %</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={student.photo} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {student.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                  </td>
                  <td className="font-medium">{student.name}</td>
                  <td>
                    <span className="badge badge-info">{student.rollNo}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      {student.parentPhone}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${student.attendance >= 90 ? "badge-success" : student.attendance >= 80 ? "badge-warning" : "badge-danger"}`}>
                      {student.attendance}%
                    </span>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Profile
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Student Profile Dialog */}
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="bg-card max-w-lg">
            <DialogHeader>
              <DialogTitle>Student Profile</DialogTitle>
              <DialogDescription>View student details and history.</DialogDescription>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-6 py-4">
                {/* Student Info */}
                <div className="flex items-center gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={selectedStudent.photo} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {selectedStudent.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-xl">{selectedStudent.name}</h3>
                    <p className="text-muted-foreground">Roll No: {selectedStudent.rollNo}</p>
                    <p className="text-muted-foreground">
                      {teacherClass ? `${teacherClass.name}${teacherClass.section ? ` - Section ${teacherClass.section}` : ''}` : (user?.className || "")}
                    </p>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground">Parent Contact</h4>
                  {selectedStudent.parentPhone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedStudent.parentPhone}</span>
                    </div>
                  )}
                  {selectedStudent.parentEmail && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedStudent.parentEmail}</span>
                    </div>
                  )}
                  {!selectedStudent.parentPhone && !selectedStudent.parentEmail && (
                    <p className="text-sm text-muted-foreground">No contact information available</p>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-success/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-success">{selectedStudent.attendance || 0}%</p>
                    <p className="text-sm text-muted-foreground">Attendance</p>
                  </div>
                  <div className="p-4 bg-primary/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary">-</p>
                    <p className="text-sm text-muted-foreground">Homework Completion</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
