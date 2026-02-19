import { useState, useEffect } from "react";
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
  Loader2,
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
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { schoolsApi, schoolAdminsApi, School } from "@/lib/api";

export default function SchoolManagement() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isAddSchoolOpen, setIsAddSchoolOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [schoolLocation, setSchoolLocation] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Edit/Manage states
  const [isEditSchoolOpen, setIsEditSchoolOpen] = useState(false);
  const [isManageAdminsOpen, setIsManageAdminsOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [managingSchool, setManagingSchool] = useState<School | null>(null);
  const [schoolAdmins, setSchoolAdmins] = useState<any[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");

  // Load schools on mount
  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    setIsLoading(true);
    try {
      const data = await schoolsApi.getAll();
      setSchools(data);
    } catch (error) {
      console.error("Failed to load schools:", error);
      setSchools([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
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

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await schoolsApi.create({
        name: schoolName,
        type: schoolType,
        location: schoolLocation,
        address: schoolAddress,
        phone: schoolPhone,
        email: schoolEmail,
        adminName,
        adminEmail,
        adminPassword,
      });
      
      toast.success("School created successfully!");
      setIsAddSchoolOpen(false);
      loadSchools();
    } catch (error) {
      // Demo mode - add locally
      const newSchool: School = {
        id: `${schools.length + 1}`,
        name: schoolName,
        code: `SCH${String(schools.length + 1).padStart(3, '0')}`,
        type: schoolType,
        location: schoolLocation,
        phone: schoolPhone,
        email: schoolEmail,
        students: 0,
        teachers: 0,
        admins: 1,
        status: "active",
        createdAt: new Date().toISOString().split('T')[0],
      };
      setSchools([...schools, newSchool]);
      toast.success("School created successfully! (Demo Mode)");
      setIsAddSchoolOpen(false);
    } finally {
      setIsSubmitting(false);
      // Reset form
      setSchoolName("");
      setSchoolType("");
      setSchoolLocation("");
      setSchoolPhone("");
      setSchoolEmail("");
      setSchoolAddress("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
    }
  };

  const handleDeactivateSchool = async (schoolId: string) => {
    try {
      await schoolsApi.deactivate(schoolId);
      toast.success("School deactivated!");
      loadSchools();
    } catch (error) {
      // Demo mode
      setSchools(schools.map(s => 
        s.id === schoolId ? { ...s, status: "inactive" as const } : s
      ));
      toast.success("School deactivated! (Demo Mode)");
    }
  };

  const copySchoolCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("School code copied!");
  };

  const handleEditSchool = async (school: School) => {
    setEditingSchool(school);
    setSchoolName(school.name);
    setSchoolType(school.type);
    setSchoolLocation(school.location || "");
    setSchoolPhone(school.phone || "");
    setSchoolEmail(school.email);
    setSchoolAddress(school.address || "");
    
    // Load admins for this school
    try {
      const admins = await schoolAdminsApi.getBySchool(school.id);
      setSchoolAdmins(admins);
      if (admins.length > 0) {
        setSelectedAdminId(admins[0].id);
        setAdminEmail(admins[0].email);
        setAdminName(admins[0].name);
      }
    } catch (error) {
      console.error("Failed to load admins:", error);
      setSchoolAdmins([]);
    }
    
    setNewAdminPassword("");
    setIsEditSchoolOpen(true);
  };

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool) return;

    setIsSubmitting(true);
    try {
      // Update school details
      await schoolsApi.update(editingSchool.id, {
        name: schoolName,
        type: schoolType,
        location: schoolLocation,
        address: schoolAddress,
        phone: schoolPhone,
        email: schoolEmail,
      });

      // If password is provided, reset it
      if (newAdminPassword && selectedAdminId) {
        try {
          await schoolsApi.resetAdminPassword(editingSchool.id, {
            adminId: selectedAdminId,
            newPassword: newAdminPassword,
          });
        } catch (error) {
          console.error("Failed to reset password:", error);
          // Continue even if password reset fails
        }
      }

      toast.success("School updated successfully!");
      setIsEditSchoolOpen(false);
      setEditingSchool(null);
      loadSchools();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update school");
    } finally {
      setIsSubmitting(false);
      // Reset form
      setSchoolName("");
      setSchoolType("");
      setSchoolLocation("");
      setSchoolPhone("");
      setSchoolEmail("");
      setSchoolAddress("");
      setNewAdminPassword("");
      setSelectedAdminId("");
    }
  };

  const handleManageAdmins = async (school: School) => {
    setManagingSchool(school);
    try {
      const admins = await schoolAdminsApi.getBySchool(school.id);
      setSchoolAdmins(admins);
      if (admins.length > 0) {
        setSelectedAdminId(admins[0].id);
      }
    } catch (error) {
      console.error("Failed to load admins:", error);
      setSchoolAdmins([]);
    }
    setNewAdminPassword("");
    setIsManageAdminsOpen(true);
  };

  const handleResetAdminPassword = async () => {
    if (!managingSchool || !selectedAdminId || !newAdminPassword) {
      toast.error("Please select an admin and enter a new password");
      return;
    }

    if (newAdminPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      await schoolsApi.resetAdminPassword(managingSchool.id, {
        adminId: selectedAdminId,
        newPassword: newAdminPassword,
      });
      toast.success("Admin password reset successfully!");
      setNewAdminPassword("");
      // Reload admins
      const admins = await schoolAdminsApi.getBySchool(managingSchool.id);
      setSchoolAdmins(admins);
    } catch (error: any) {
      toast.error(error?.message || "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout role="superadmin" userName={user?.name || "Platform Admin"} onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">School Management</h1>
            <p className="text-muted-foreground mt-1">Create and manage schools on ConventPulse.</p>
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
                          <SelectItem value="Primary">Primary</SelectItem>
                          <SelectItem value="Secondary">Secondary</SelectItem>
                          <SelectItem value="High School">High School</SelectItem>
                          <SelectItem value="K-12">K-12</SelectItem>
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
                    Create an initial admin account for this school. The admin will use email & password to login.
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
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Initial Password *</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      placeholder="Create a secure password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum 6 characters. Admin can change this after first login.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddSchoolOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create School
                      </>
                    )}
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
        <div className="data-table overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="min-w-full">
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
                          <DropdownMenuItem onClick={() => handleEditSchool(school)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit School
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleManageAdmins(school)}>
                            <Users className="w-4 h-4 mr-2" />
                            Manage Admins
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDeactivateSchool(school.id)}
                          >
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
          )}
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

        {/* Edit School Dialog */}
        <Dialog open={isEditSchoolOpen} onOpenChange={setIsEditSchoolOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit School</DialogTitle>
              <DialogDescription>
                Update school details and reset admin password if needed.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateSchool} className="space-y-6 pt-4">
              {/* School Details */}
              <div className="space-y-4">
                <h4 className="font-medium text-foreground">School Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editSchoolName">School Name *</Label>
                    <Input
                      id="editSchoolName"
                      placeholder="e.g., Springfield Elementary"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editSchoolType">School Type *</Label>
                    <Select value={schoolType} onValueChange={setSchoolType} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Primary">Primary</SelectItem>
                        <SelectItem value="Secondary">Secondary</SelectItem>
                        <SelectItem value="High School">High School</SelectItem>
                        <SelectItem value="K-12">K-12</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editSchoolPhone">Phone Number</Label>
                    <Input
                      id="editSchoolPhone"
                      placeholder="+1 234-567-8900"
                      value={schoolPhone}
                      onChange={(e) => setSchoolPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editSchoolEmail">School Email *</Label>
                    <Input
                      id="editSchoolEmail"
                      type="email"
                      placeholder="admin@school.edu"
                      value={schoolEmail}
                      onChange={(e) => setSchoolEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editSchoolLocation">City, State *</Label>
                  <Input
                    id="editSchoolLocation"
                    placeholder="e.g., New York, NY"
                    value={schoolLocation}
                    onChange={(e) => setSchoolLocation(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editSchoolAddress">Full Address</Label>
                  <Textarea
                    id="editSchoolAddress"
                    placeholder="Enter complete address..."
                    rows={2}
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Admin Password Reset */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h4 className="font-medium text-foreground">Reset Admin Password</h4>
                <p className="text-sm text-muted-foreground">
                  Select an admin and set a new password. Leave empty if you don't want to change the password.
                </p>
                {schoolAdmins.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="selectAdmin">Select Admin</Label>
                      <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select admin" />
                        </SelectTrigger>
                        <SelectContent>
                          {schoolAdmins.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>
                              {admin.name} ({admin.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newAdminPassword">New Password</Label>
                      <Input
                        id="newAdminPassword"
                        type="password"
                        placeholder="Leave empty to keep current password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        minLength={6}
                      />
                      <p className="text-xs text-muted-foreground">
                        Minimum 6 characters. Leave empty if you don't want to change the password.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No admins found for this school.</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditSchoolOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Update School
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Manage Admins Dialog */}
        <Dialog open={isManageAdminsOpen} onOpenChange={setIsManageAdminsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage School Admins</DialogTitle>
              <DialogDescription>
                View and reset passwords for school administrators.
              </DialogDescription>
            </DialogHeader>
            {managingSchool && (
              <div className="space-y-4 pt-4">
                <div>
                  <h4 className="font-medium mb-2">{managingSchool.name}</h4>
                  <p className="text-sm text-muted-foreground">Code: {managingSchool.code}</p>
                </div>
                
                {schoolAdmins.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="selectAdminForReset">Select Admin</Label>
                      <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select admin" />
                        </SelectTrigger>
                        <SelectContent>
                          {schoolAdmins.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>
                              {admin.name} ({admin.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="resetPassword">New Password</Label>
                      <Input
                        id="resetPassword"
                        type="password"
                        placeholder="Enter new password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        minLength={6}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Minimum 6 characters. This will reset the admin's password.
                      </p>
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsManageAdminsOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleResetAdminPassword} disabled={isSubmitting || !newAdminPassword}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Resetting...
                          </>
                        ) : (
                          <>
                            <Edit className="w-4 h-4 mr-2" />
                            Reset Password
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No admins found for this school.
                  </p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
