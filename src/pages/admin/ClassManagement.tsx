import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit2, Users, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const classes = [
  { id: 1, name: "Class 1", section: "A", teacher: "Sarah Johnson", students: 45, attendance: 92 },
  { id: 2, name: "Class 1", section: "B", teacher: "Michael Brown", students: 42, attendance: 88 },
  { id: 3, name: "Class 2", section: "A", teacher: "Emily Davis", students: 48, attendance: 95 },
  { id: 4, name: "Class 2", section: "B", teacher: "James Wilson", students: 40, attendance: 90 },
  { id: 5, name: "Class 3", section: "A", teacher: "Lisa Anderson", students: 52, attendance: 87 },
  { id: 6, name: "Class 3", section: "B", teacher: "Robert Taylor", students: 38, attendance: 94 },
  { id: 7, name: "Class 4", section: "A", teacher: "Jennifer Martinez", students: 44, attendance: 91 },
  { id: 8, name: "Class 4", section: "B", teacher: "David Thompson", students: 50, attendance: 89 },
];

const teachers = [
  "Sarah Johnson",
  "Michael Brown",
  "Emily Davis",
  "James Wilson",
  "Lisa Anderson",
  "Robert Taylor",
  "Jennifer Martinez",
  "David Thompson",
  "Amanda White",
  "Christopher Lee",
];

export default function ClassManagement() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleLogout = () => {
    navigate("/");
  };

  const filteredClasses = classes.filter(
    (cls) =>
      cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.teacher.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="admin" userName="Admin User" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Class Management</h1>
            <p className="text-muted-foreground mt-1">Manage all classes and assign teachers.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>Add New Class</DialogTitle>
                <DialogDescription>Create a new class and assign a teacher.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="class-name">Class Name</Label>
                  <Input id="class-name" placeholder="e.g., Class 5" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section">Section</Label>
                  <Input id="section" placeholder="e.g., A" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher">Class Teacher</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher} value={teacher}>
                          {teacher}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => setIsDialogOpen(false)}>
                  Create Class
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search classes or teachers..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Classes Table */}
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>Class</th>
                <th>Section</th>
                <th>Class Teacher</th>
                <th>Students</th>
                <th>Attendance %</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.map((cls) => (
                <tr key={cls.id}>
                  <td className="font-medium">{cls.name}</td>
                  <td>
                    <span className="badge badge-info">{cls.section}</span>
                  </td>
                  <td>{cls.teacher}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      {cls.students}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${cls.attendance >= 90 ? "badge-success" : cls.attendance >= 80 ? "badge-warning" : "badge-danger"}`}>
                      {cls.attendance}%
                    </span>
                  </td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit Class
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Users className="w-4 h-4 mr-2" />
                          View Students
                        </DropdownMenuItem>
                        <DropdownMenuItem>Change Teacher</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
