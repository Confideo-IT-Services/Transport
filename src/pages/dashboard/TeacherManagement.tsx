import { useState } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Copy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { teachersApi, Teacher } from "@/lib/api";

// Mock data for demo
const mockTeachers: Teacher[] = [
  { id: "1", username: "priya.sharma", name: "Priya Sharma", email: "priya@school.edu", phone: "+91 98765 43210", subjects: ["Mathematics", "Science"], isActive: true },
  { id: "2", username: "amit.verma", name: "Amit Verma", email: "amit@school.edu", phone: "+91 98765 43211", subjects: ["English", "Hindi"], isActive: true },
  { id: "3", username: "sunita.singh", name: "Sunita Singh", email: "sunita@school.edu", phone: "+91 98765 43212", subjects: ["Social Studies"], isActive: true },
];

export default function TeacherManagement() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [teachers, setTeachers] = useState<Teacher[]>(mockTeachers);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [teacherName, setTeacherName] = useState("");
  const [teacherUsername, setTeacherUsername] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPhone, setTeacherPhone] = useState("");

  const filteredTeachers = teachers.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await teachersApi.create({
        username: teacherUsername,
        password: teacherPassword,
        name: teacherName,
        email: teacherEmail,
        phone: teacherPhone,
      });
      toast.success("Teacher created successfully!");
      setIsAddOpen(false);
    } catch (error) {
      // Demo mode
      const newTeacher: Teacher = {
        id: `${teachers.length + 1}`,
        username: teacherUsername,
        name: teacherName,
        email: teacherEmail,
        phone: teacherPhone,
        subjects: [],
        isActive: true,
      };
      setTeachers([...teachers, newTeacher]);
      toast.success("Teacher created! (Demo Mode)");
      setIsAddOpen(false);
    } finally {
      setIsSubmitting(false);
      setTeacherName("");
      setTeacherUsername("");
      setTeacherPassword("");
      setTeacherEmail("");
      setTeacherPhone("");
    }
  };

  const copyCredentials = (username: string) => {
    navigator.clipboard.writeText(username);
    toast.success("Username copied!");
  };

  if (user?.role !== "admin") {
    return (
      <UnifiedLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Access restricted to School Admins only.</p>
        </div>
      </UnifiedLayout>
    );
  }

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Teacher Management</h1>
            <p className="text-muted-foreground mt-1">Create teacher accounts with username & password login.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
                <DialogDescription>
                  Create a teacher account. Teachers will use username & password to login.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddTeacher} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="e.g., Priya Sharma" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Username *</Label>
                    <Input value={teacherUsername} onChange={(e) => setTeacherUsername(e.target.value)} placeholder="e.g., priya.sharma" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Password *</Label>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        value={teacherPassword} 
                        onChange={(e) => setTeacherPassword(e.target.value)} 
                        placeholder="Create password" 
                        required 
                        minLength={6}
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)} placeholder="Optional" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={teacherPhone} onChange={(e) => setTeacherPhone(e.target.value)} placeholder="+91 98765 43210" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Create Teacher
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search teachers..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Username</th>
                <th>Contact</th>
                <th>Subjects</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{teacher.name}</p>
                        <p className="text-xs text-muted-foreground">{teacher.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <button onClick={() => copyCredentials(teacher.username)} className="flex items-center gap-1 font-mono text-sm bg-muted px-2 py-1 rounded hover:bg-muted/80">
                      {teacher.username}
                      <Copy className="w-3 h-3" />
                    </button>
                  </td>
                  <td className="text-muted-foreground">{teacher.phone || "-"}</td>
                  <td>{teacher.subjects?.join(", ") || "-"}</td>
                  <td>
                    <span className={`badge ${teacher.isActive ? "badge-success" : "bg-muted text-muted-foreground"}`}>
                      {teacher.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Deactivate</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </UnifiedLayout>
  );
}
