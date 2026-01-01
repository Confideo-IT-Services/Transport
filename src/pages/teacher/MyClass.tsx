import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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

const students = [
  { id: 1, name: "Alex Johnson", rollNo: "01", parentPhone: "+1 234 567 890", parentEmail: "parent1@email.com", attendance: 95, photo: "" },
  { id: 2, name: "Emma Williams", rollNo: "02", parentPhone: "+1 234 567 891", parentEmail: "parent2@email.com", attendance: 92, photo: "" },
  { id: 3, name: "Noah Brown", rollNo: "03", parentPhone: "+1 234 567 892", parentEmail: "parent3@email.com", attendance: 88, photo: "" },
  { id: 4, name: "Olivia Davis", rollNo: "04", parentPhone: "+1 234 567 893", parentEmail: "parent4@email.com", attendance: 97, photo: "" },
  { id: 5, name: "Liam Wilson", rollNo: "05", parentPhone: "+1 234 567 894", parentEmail: "parent5@email.com", attendance: 91, photo: "" },
  { id: 6, name: "Sophia Martinez", rollNo: "06", parentPhone: "+1 234 567 895", parentEmail: "parent6@email.com", attendance: 94, photo: "" },
  { id: 7, name: "Mason Anderson", rollNo: "07", parentPhone: "+1 234 567 896", parentEmail: "parent7@email.com", attendance: 89, photo: "" },
  { id: 8, name: "Isabella Taylor", rollNo: "08", parentPhone: "+1 234 567 897", parentEmail: "parent8@email.com", attendance: 96, photo: "" },
  { id: 9, name: "James Thomas", rollNo: "09", parentPhone: "+1 234 567 898", parentEmail: "parent9@email.com", attendance: 93, photo: "" },
  { id: 10, name: "Mia Garcia", rollNo: "10", parentPhone: "+1 234 567 899", parentEmail: "parent10@email.com", attendance: 90, photo: "" },
];

export default function MyClass() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<typeof students[0] | null>(null);

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
          <h1 className="page-title">My Class - 3A</h1>
          <p className="text-muted-foreground mt-1">Manage your students and view their profiles.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <p className="text-sm text-muted-foreground">Total Students</p>
            <p className="text-2xl font-bold text-foreground mt-1">45</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <p className="text-sm text-muted-foreground">Average Attendance</p>
            <p className="text-2xl font-bold text-success mt-1">92.5%</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <p className="text-sm text-muted-foreground">Class Teacher</p>
            <p className="text-2xl font-bold text-primary mt-1">Sarah J.</p>
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
                    <p className="text-muted-foreground">Class 3A</p>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground">Parent Contact</h4>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedStudent.parentPhone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedStudent.parentEmail}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-success/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-success">{selectedStudent.attendance}%</p>
                    <p className="text-sm text-muted-foreground">Attendance</p>
                  </div>
                  <div className="p-4 bg-primary/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary">92%</p>
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
