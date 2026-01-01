import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  Search,
  Plus,
  MoreHorizontal,
  Users,
  GraduationCap,
  MapPin,
  Phone,
  Mail,
  Edit,
  Trash2,
  Eye,
  Copy,
  CheckCircle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const schools = [
  {
    id: 1,
    name: "Springfield Elementary",
    code: "SPE001",
    type: "Primary",
    location: "New York, NY",
    phone: "+1 234-567-8901",
    email: "admin@springfield.edu",
    students: 450,
    teachers: 32,
    admins: 2,
    status: "active",
    createdAt: "2024-01-15",
  },
  {
    id: 2,
    name: "Riverside High School",
    code: "RHS002",
    type: "High School",
    location: "Los Angeles, CA",
    phone: "+1 234-567-8902",
    email: "admin@riverside.edu",
    students: 1200,
    teachers: 85,
    admins: 3,
    status: "active",
    createdAt: "2024-02-20",
  },
  {
    id: 3,
    name: "Greenwood Academy",
    code: "GWA003",
    type: "K-12",
    location: "Houston, TX",
    phone: "+1 234-567-8903",
    email: "admin@greenwood.edu",
    students: 680,
    teachers: 48,
    admins: 2,
    status: "pending",
    createdAt: "2024-03-10",
  },
  {
    id: 4,
    name: "Lakeside Secondary",
    code: "LKS004",
    type: "Secondary",
    location: "Miami, FL",
    phone: "+1 234-567-8904",
    email: "admin@lakeside.edu",
    students: 890,
    teachers: 62,
    admins: 2,
    status: "active",
    createdAt: "2024-03-25",
  },
  {
    id: 5,
    name: "Mountain View School",
    code: "MVS005",
    type: "Primary",
    location: "Denver, CO",
    phone: "+1 234-567-8905",
    email: "admin@mountainview.edu",
    students: 320,
    teachers: 24,
    admins: 1,
    status: "inactive",
    createdAt: "2024-04-05",
  },
];

export default function SchoolManagement() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isAddSchoolOpen, setIsAddSchoolOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<typeof schools[0] | null>(null);

  // Form states
  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [schoolLocation, setSchoolLocation] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  const handleLogout = () => {
    navigate("/");
  };

  const filteredSchools = schools.filter((school) => {
    const matchesSearch =
      school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      school.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || school.type === filterType;
    const matchesStatus = filterStatus === "all" || school.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleAddSchool = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("School created successfully!");
    setIsAddSchoolOpen(false);
    // Reset form
    setSchoolName("");
    setSchoolType("");
    setSchoolLocation("");
    setSchoolPhone("");
    setSchoolEmail("");
    setSchoolAddress("");
    setAdminName("");
    setAdminEmail("");
  };

  const copySchoolCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("School code copied!");
  };

  return (
    <DashboardLayout role="superadmin" userName="Platform Admin" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">School Management</h1>
            <p className="text-muted-foreground mt-1">Create and manage schools on AllPulse.</p>
          </div>
          <Dialog open={isAddSchoolOpen} onOpenChange={setIsAddSchoolOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add School
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New School</DialogTitle>
                <DialogDescription>
                  Create a new school and set up the initial admin account.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSchool} className="space-y-6 pt-4">
                {/* School Details */}
                <div className="space-y-4">
                  <h4 className="font-medium text-foreground">School Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="schoolName">School Name *</Label>
                      <Input
                        id="schoolName"
                        placeholder="e.g., Springfield Elementary"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schoolType">School Type *</Label>
                      <Select value={schoolType} onValueChange={setSchoolType} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">Primary</SelectItem>
                          <SelectItem value="secondary">Secondary</SelectItem>
                          <SelectItem value="high-school">High School</SelectItem>
                          <SelectItem value="k-12">K-12</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="schoolPhone">Phone Number</Label>
                      <Input
                        id="schoolPhone"
                        placeholder="+1 234-567-8900"
                        value={schoolPhone}
                        onChange={(e) => setSchoolPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schoolEmail">School Email *</Label>
                      <Input
                        id="schoolEmail"
                        type="email"
                        placeholder="admin@school.edu"
                        value={schoolEmail}
                        onChange={(e) => setSchoolEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schoolLocation">City, State *</Label>
                    <Input
                      id="schoolLocation"
                      placeholder="e.g., New York, NY"
                      value={schoolLocation}
                      onChange={(e) => setSchoolLocation(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schoolAddress">Full Address</Label>
                    <Textarea
                      id="schoolAddress"
                      placeholder="Enter complete address..."
                      rows={2}
                      value={schoolAddress}
                      onChange={(e) => setSchoolAddress(e.target.value)}
                    />
                  </div>
                </div>

                {/* Admin Account */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="font-medium text-foreground">School Admin Account</h4>
                  <p className="text-sm text-muted-foreground">
                    Create an initial admin account for this school.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="adminName">Admin Name *</Label>
                      <Input
                        id="adminName"
                        placeholder="Full name"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminEmail">Admin Email *</Label>
                      <Input
                        id="adminEmail"
                        type="email"
                        placeholder="admin@school.edu"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A temporary password will be sent to the admin's email.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddSchoolOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Plus className="w-4 h-4 mr-2" />
                    Create School
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search schools by name or code..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Primary">Primary</SelectItem>
              <SelectItem value="Secondary">Secondary</SelectItem>
              <SelectItem value="High School">High School</SelectItem>
              <SelectItem value="K-12">K-12</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <p className="text-sm text-muted-foreground">Total Schools</p>
            <p className="text-2xl font-bold text-foreground mt-1">{schools.length}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-success mt-1">
              {schools.filter((s) => s.status === "active").length}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-warning mt-1">
              {schools.filter((s) => s.status === "pending").length}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <p className="text-sm text-muted-foreground">Inactive</p>
            <p className="text-2xl font-bold text-muted-foreground mt-1">
              {schools.filter((s) => s.status === "inactive").length}
            </p>
          </div>
        </div>

        {/* Schools Table */}
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>School</th>
                <th>Code</th>
                <th>Type</th>
                <th>Location</th>
                <th>Students</th>
                <th>Teachers</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchools.map((school) => (
                <tr key={school.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{school.name}</p>
                        <p className="text-xs text-muted-foreground">{school.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => copySchoolCode(school.code)}
                      className="flex items-center gap-1 text-sm font-mono bg-muted px-2 py-1 rounded hover:bg-muted/80 transition-colors"
                    >
                      {school.code}
                      <Copy className="w-3 h-3" />
                    </button>
                  </td>
                  <td>{school.type}</td>
                  <td>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {school.location}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <GraduationCap className="w-4 h-4 text-muted-foreground" />
                      {school.students}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      {school.teachers}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        school.status === "active"
                          ? "badge-success"
                          : school.status === "pending"
                          ? "badge-warning"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {school.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedSchool(school)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit School
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Users className="w-4 h-4 mr-2" />
                          Manage Admins
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
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

        {/* School Details Dialog */}
        <Dialog open={!!selectedSchool} onOpenChange={() => setSelectedSchool(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>School Details</DialogTitle>
            </DialogHeader>
            {selectedSchool && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedSchool.name}</h3>
                    <p className="text-sm text-muted-foreground font-mono">{selectedSchool.code}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="font-medium">{selectedSchool.type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <span
                      className={`badge ${
                        selectedSchool.status === "active" ? "badge-success" : "badge-warning"
                      }`}
                    >
                      {selectedSchool.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {selectedSchool.location}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {new Date(selectedSchool.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <GraduationCap className="w-5 h-5 text-primary mx-auto mb-1" />
                    <p className="text-lg font-bold">{selectedSchool.students}</p>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <Users className="w-5 h-5 text-secondary mx-auto mb-1" />
                    <p className="text-lg font-bold">{selectedSchool.teachers}</p>
                    <p className="text-xs text-muted-foreground">Teachers</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <Users className="w-5 h-5 text-accent mx-auto mb-1" />
                    <p className="text-lg font-bold">{selectedSchool.admins}</p>
                    <p className="text-xs text-muted-foreground">Admins</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {selectedSchool.phone}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {selectedSchool.email}
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
