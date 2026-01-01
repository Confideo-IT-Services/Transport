import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit2, UserX, MoreVertical } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const teachers = [
  { id: 1, name: "Sarah Johnson", email: "sarah.j@school.edu", phone: "+1 234 567 890", role: "Class Teacher", classes: ["Class 1A"], status: "active" },
  { id: 2, name: "Michael Brown", email: "michael.b@school.edu", phone: "+1 234 567 891", role: "Class Teacher", classes: ["Class 1B"], status: "active" },
  { id: 3, name: "Emily Davis", email: "emily.d@school.edu", phone: "+1 234 567 892", role: "Subject Teacher", classes: ["Class 2A", "Class 3A"], status: "active" },
  { id: 4, name: "James Wilson", email: "james.w@school.edu", phone: "+1 234 567 893", role: "Class Teacher", classes: ["Class 2B"], status: "inactive" },
  { id: 5, name: "Lisa Anderson", email: "lisa.a@school.edu", phone: "+1 234 567 894", role: "Class Teacher", classes: ["Class 3A"], status: "active" },
  { id: 6, name: "Robert Taylor", email: "robert.t@school.edu", phone: "+1 234 567 895", role: "Subject Teacher", classes: ["Class 3B", "Class 4A"], status: "active" },
  { id: 7, name: "Jennifer Martinez", email: "jennifer.m@school.edu", phone: "+1 234 567 896", role: "Class Teacher", classes: ["Class 4A"], status: "active" },
  { id: 8, name: "David Thompson", email: "david.t@school.edu", phone: "+1 234 567 897", role: "Class Teacher", classes: ["Class 4B"], status: "active" },
];

export default function TeacherManagement() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleLogout = () => {
    navigate("/");
  };

  const filteredTeachers = teachers.filter(
    (teacher) =>
      teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="admin" userName="Admin User" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Teacher Management</h1>
            <p className="text-muted-foreground mt-1">Add, edit, and manage teacher accounts.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
                <DialogDescription>Create a new teacher account.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input id="first-name" placeholder="John" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input id="last-name" placeholder="Doe" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="john.doe@school.edu" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+1 234 567 890" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="class-teacher">Class Teacher</SelectItem>
                      <SelectItem value="subject-teacher">Subject Teacher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => setIsDialogOpen(false)}>
                  Add Teacher
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search teachers..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Teachers Table */}
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Classes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {teacher.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{teacher.name}</span>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{teacher.email}</td>
                  <td className="text-muted-foreground">{teacher.phone}</td>
                  <td>
                    <span className="badge badge-info">{teacher.role}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {teacher.classes.map((cls) => (
                        <span key={cls} className="text-xs px-2 py-1 bg-muted rounded-md">
                          {cls}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${teacher.status === "active" ? "badge-success" : "badge-danger"}`}>
                      {teacher.status}
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
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>Assign Classes</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <UserX className="w-4 h-4 mr-2" />
                          Deactivate
                        </DropdownMenuItem>
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
