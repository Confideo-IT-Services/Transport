import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Check, X, Eye, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const students = [
  { id: 1, name: "Alex Johnson", class: "Class 3A", parentPhone: "+1 234 567 890", status: "pending", avatar: "", rollNo: "2024001" },
  { id: 2, name: "Emma Williams", class: "Class 4B", parentPhone: "+1 234 567 891", status: "approved", avatar: "", rollNo: "2024002" },
  { id: 3, name: "Noah Brown", class: "Class 2A", parentPhone: "+1 234 567 892", status: "pending", avatar: "", rollNo: "2024003" },
  { id: 4, name: "Olivia Davis", class: "Class 5A", parentPhone: "+1 234 567 893", status: "approved", avatar: "", rollNo: "2024004" },
  { id: 5, name: "Liam Wilson", class: "Class 3B", parentPhone: "+1 234 567 894", status: "pending", avatar: "", rollNo: "2024005" },
  { id: 6, name: "Sophia Martinez", class: "Class 1A", parentPhone: "+1 234 567 895", status: "approved", avatar: "", rollNo: "2024006" },
  { id: 7, name: "Mason Anderson", class: "Class 4A", parentPhone: "+1 234 567 896", status: "pending", avatar: "", rollNo: "2024007" },
  { id: 8, name: "Isabella Taylor", class: "Class 2B", parentPhone: "+1 234 567 897", status: "approved", avatar: "", rollNo: "2024008" },
];

export default function StudentManagement() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<typeof students[0] | null>(null);

  const handleLogout = () => {
    navigate("/");
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNo.includes(searchTerm);
    const matchesClass = filterClass === "all" || student.class.includes(filterClass);
    const matchesStatus = filterStatus === "all" || student.status === filterStatus;
    return matchesSearch && matchesClass && matchesStatus;
  });

  return (
    <DashboardLayout role="admin" userName="Admin User" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="page-title">Student Management</h1>
          <p className="text-muted-foreground mt-1">View and manage student submissions and approvals.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or roll number..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              <SelectItem value="Class 1">Class 1</SelectItem>
              <SelectItem value="Class 2">Class 2</SelectItem>
              <SelectItem value="Class 3">Class 3</SelectItem>
              <SelectItem value="Class 4">Class 4</SelectItem>
              <SelectItem value="Class 5">Class 5</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Students Table */}
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Class</th>
                <th>Parent Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={student.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {student.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{student.name}</span>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{student.rollNo}</td>
                  <td>
                    <span className="badge badge-info">{student.class}</span>
                  </td>
                  <td className="text-muted-foreground">{student.parentPhone}</td>
                  <td>
                    <span className={`badge ${student.status === "approved" ? "badge-success" : "badge-warning"}`}>
                      {student.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedStudent(student)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {student.status === "pending" && (
                        <>
                          <Button variant="ghost" size="icon" className="text-success hover:text-success hover:bg-success/10">
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Student Profile Dialog */}
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="bg-card max-w-md">
            <DialogHeader>
              <DialogTitle>Student Profile</DialogTitle>
              <DialogDescription>View student details and history.</DialogDescription>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={selectedStudent.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {selectedStudent.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedStudent.name}</h3>
                    <p className="text-muted-foreground">{selectedStudent.class}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-sm text-muted-foreground">Roll Number</p>
                    <p className="font-medium">{selectedStudent.rollNo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Parent Contact</p>
                    <p className="font-medium">{selectedStudent.parentPhone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <span className={`badge ${selectedStudent.status === "approved" ? "badge-success" : "badge-warning"}`}>
                      {selectedStudent.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Attendance</p>
                    <p className="font-medium">92%</p>
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
