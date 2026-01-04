import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Check, X, Eye, Filter, Link2, Copy, Plus, Settings, Camera } from "lucide-react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { studentsApi, classesApi, registrationLinksApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface FieldConfig {
  id: string;
  fieldName: string;
  label: string;
  fieldType: 'text' | 'textarea' | 'radio' | 'select' | 'tel' | 'email' | 'file' | 'checkbox' | 'date';
  mandatory: boolean;
  enabled: boolean;
  options?: string[]; // For select and radio fields
}

interface Student {
  id: number;
  name: string;
  class: string;
  section: string;
  parentPhone: string;
  parentName: string;
  parentEmail?: string;
  status: "pending" | "approved" | "rejected";
  avatar: string;
  photoUrl?: string;
  rollNo: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  submittedAt: string;
  fatherName: string;
  motherName: string;
  bloodGroup: string;
  admissionNumber?: string;
  registrationCode?: string | null;
  submittedData?: any;
}

// Component to display student profile with only submitted fields
function StudentProfileView({ 
  student, 
  fieldConfig, 
  onFieldConfigLoad,
  onApprove,
  onReject
}: { 
  student: Student; 
  fieldConfig: FieldConfig[]; 
  onFieldConfigLoad: (config: FieldConfig[]) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  useEffect(() => {
    // Fetch field config from registration link if available
    const fetchFieldConfig = async () => {
      if (student.registrationCode) {
        try {
          const linkData = await registrationLinksApi.getByCode(student.registrationCode);
          if (linkData.fieldConfig && Array.isArray(linkData.fieldConfig)) {
            onFieldConfigLoad(linkData.fieldConfig);
          }
        } catch (error) {
          console.error('Error fetching field config:', error);
        }
      }
    };
    
    fetchFieldConfig();
  }, [student.registrationCode, onFieldConfigLoad]);

  // Get submitted data
  const submittedData = student.submittedData || {};
  
  // Map field names to display values - check multiple sources
  const getFieldValue = (fieldName: string): string => {
    // First, try to get from submittedData with exact fieldName
    let value = submittedData[fieldName];
    
    // If not found, try common field name mappings
    if (value === null || value === undefined || value === '') {
      const fieldMap: Record<string, string> = {
        'studentName': 'name',
        'name': 'name',
        'rollNo': 'rollNo',
        'dateOfBirth': 'dateOfBirth',
        'gender': 'gender',
        'bloodGroup': 'bloodGroup',
        'address': 'address',
        'fatherName': 'fatherName',
        'fatherPhone': 'fatherPhone',
        'fatherEmail': 'fatherEmail',
        'fatherOccupation': 'fatherOccupation',
        'motherName': 'motherName',
        'motherPhone': 'motherPhone',
        'motherOccupation': 'motherOccupation',
        'emergencyContact': 'emergencyContact',
        'previousSchool': 'previousSchool',
        'medicalConditions': 'medicalConditions',
        'photo': 'photoUrl',
        // Parent/Guardian fields
        'parentPhone': 'parentPhone',
        'parentEmail': 'parentEmail',
        'parentName': 'parentName',
        'contactNumber': 'parentPhone',
        'phone': 'parentPhone',
        'email': 'parentEmail',
      };
      
      const mappedName = fieldMap[fieldName] || fieldName;
      value = submittedData[mappedName];
      
      // If still not found, try student object
      if (value === null || value === undefined || value === '') {
        value = (student as any)[mappedName] || (student as any)[fieldName];
      }
    }
    
    // Handle photo separately
    if (fieldName === 'photo' || fieldName === 'photoUrl') {
      return student.photoUrl || student.avatar || '';
    }
    
    // Return formatted value or placeholder
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    
    return String(value);
  };

  // Filter fields to only show those that were in the registration form
  const visibleFields = fieldConfig.length > 0 
    ? fieldConfig.filter(f => f.enabled)
    : []; // If no field config, show nothing (or show basic info)

  return (
    <div className="space-y-4 py-4">
      {/* Always show basic info */}
      <div className="flex items-center gap-4">
        <Avatar className="w-20 h-20">
          <AvatarImage src={student.avatar || student.photoUrl} />
          <AvatarFallback className="bg-primary/10 text-primary text-xl">
            {student.name.split(" ").map(n => n[0]).join("")}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold text-lg">{student.name}</h3>
          <p className="text-muted-foreground">
            {student.class}{student.section ? ` - Section ${student.section}` : ''}
          </p>
          <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
            student.status === "approved" 
              ? "bg-success/10 text-success" 
              : student.status === "pending"
              ? "bg-warning/10 text-warning"
              : "bg-destructive/10 text-destructive"
          }`}>
            {student.status}
          </span>
        </div>
      </div>
      
      {/* Show submitted fields only */}
      {visibleFields.length > 0 ? (
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4">
            {visibleFields.map((field) => {
              // Skip photo field - already shown in header
              if (field.fieldType === 'file' && field.fieldName === 'photo') {
                return null;
              }
              
              const value = getFieldValue(field.fieldName);
              
              // Skip empty fields
              if (value === '—' || !value) {
                return null;
              }
              
              return (
                <div key={field.id}>
                  <p className="text-sm text-muted-foreground">{field.label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="pt-4 border-t border-border">
          {/* Fallback: show all submitted data if no field config */}
          {Object.keys(submittedData).length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(submittedData).map(([key, value]) => {
                // Skip null/empty values, photo fields (already shown in header), and internal fields
                if (!value || value === '' || key === 'photoUrl' || key === 'photo') {
                  return null;
                }
                
                // Format field name for display
                const displayName = key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())
                  .trim();
                
                return (
                  <div key={key}>
                    <p className="text-sm text-muted-foreground">{displayName}</p>
                    <p className="font-medium">{String(value)}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            // Ultimate fallback: show basic student fields
            <div className="grid grid-cols-2 gap-4">
              {student.name && (
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{student.name}</p>
                </div>
              )}
              {student.rollNo && (
                <div>
                  <p className="text-sm text-muted-foreground">Roll Number</p>
                  <p className="font-medium">{student.rollNo}</p>
                </div>
              )}
              {student.parentPhone && (
                <div>
                  <p className="text-sm text-muted-foreground">Contact Number</p>
                  <p className="font-medium">{student.parentPhone}</p>
                </div>
              )}
              {student.parentEmail && (
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{student.parentEmail}</p>
                </div>
              )}
              {student.address && (
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{student.address}</p>
                </div>
              )}
              {student.dateOfBirth && (
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">{student.dateOfBirth}</p>
                </div>
              )}
              {student.gender && (
                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium">{student.gender}</p>
                </div>
              )}
              {student.bloodGroup && (
                <div>
                  <p className="text-sm text-muted-foreground">Blood Group</p>
                  <p className="font-medium">{student.bloodGroup}</p>
                </div>
              )}
              {student.fatherName && (
                <div>
                  <p className="text-sm text-muted-foreground">Father's Name</p>
                  <p className="font-medium">{student.fatherName}</p>
                </div>
              )}
              {student.motherName && (
                <div>
                  <p className="text-sm text-muted-foreground">Mother's Name</p>
                  <p className="font-medium">{student.motherName}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {student.status === "pending" && (
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button 
            className="flex-1" 
            variant="outline"
            onClick={() => {
              onReject(student.id);
            }}
          >
            <X className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button 
            className="flex-1"
            onClick={() => {
              onApprove(student.id);
            }}
          >
            <Check className="w-4 h-4 mr-2" />
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}

const defaultFields: FieldConfig[] = [
  { id: "studentName", fieldName: "studentName", label: "Student Name", fieldType: "text", mandatory: true, enabled: true },
  { id: "photo", fieldName: "photo", label: "Student Photo", fieldType: "file", mandatory: true, enabled: true },
  { id: "dateOfBirth", fieldName: "dateOfBirth", label: "Date of Birth", fieldType: "date", mandatory: true, enabled: true },
  { id: "gender", fieldName: "gender", label: "Gender", fieldType: "select", mandatory: true, enabled: true, options: ["Male", "Female", "Other"] },
  { id: "bloodGroup", fieldName: "bloodGroup", label: "Blood Group", fieldType: "select", mandatory: false, enabled: true, options: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] },
  { id: "address", fieldName: "address", label: "Address", fieldType: "textarea", mandatory: true, enabled: true },
  { id: "fatherName", fieldName: "fatherName", label: "Father's Name", fieldType: "text", mandatory: true, enabled: true },
  { id: "fatherPhone", fieldName: "fatherPhone", label: "Father's Phone", fieldType: "tel", mandatory: true, enabled: true },
  { id: "fatherEmail", fieldName: "fatherEmail", label: "Father's Email", fieldType: "email", mandatory: false, enabled: true },
  { id: "fatherOccupation", fieldName: "fatherOccupation", label: "Father's Occupation", fieldType: "text", mandatory: false, enabled: true },
  { id: "motherName", fieldName: "motherName", label: "Mother's Name", fieldType: "text", mandatory: false, enabled: true },
  { id: "motherPhone", fieldName: "motherPhone", label: "Mother's Phone", fieldType: "tel", mandatory: false, enabled: true },
  { id: "motherOccupation", fieldName: "motherOccupation", label: "Mother's Occupation", fieldType: "text", mandatory: false, enabled: true },
  { id: "emergencyContact", fieldName: "emergencyContact", label: "Emergency Contact", fieldType: "tel", mandatory: true, enabled: true },
  { id: "previousSchool", fieldName: "previousSchool", label: "Previous School", fieldType: "text", mandatory: false, enabled: false },
  { id: "medicalConditions", fieldName: "medicalConditions", label: "Medical Conditions", fieldType: "textarea", mandatory: false, enabled: true },
];

export default function StudentManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [linksCount, setLinksCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [studentsData, classesData, linksData] = await Promise.all([
        studentsApi.getAll().catch(() => []),
        classesApi.getAll().catch(() => []),
        registrationLinksApi.getAll().catch(() => [])
      ]);
      setStudents(studentsData);
      setClasses(classesData);
      setLinksCount(linksData.length || 0);
    } catch (error) {
      console.error('Failed to load data:', error);
      setStudents([]);
      setClasses([]);
      setLinksCount(0);
    } finally {
      setIsLoading(false);
    }
  };
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentFieldConfig, setStudentFieldConfig] = useState<FieldConfig[]>([]);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showFieldConfigDialog, setShowFieldConfigDialog] = useState(false);
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false);
  const [selectedClassForLink, setSelectedClassForLink] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>(defaultFields);
  
  // Add Field form state
  const [newField, setNewField] = useState({
    fieldName: "",
    label: "",
    fieldType: "text" as FieldConfig['fieldType'],
    mandatory: false,
    options: "" as string | string[], // For select/radio - stored as comma-separated string in form
  });

  const handleGenerateLink = async () => {
    if (!selectedClassForLink) {
      toast.error("Please select class");
      return;
    }

    if (!user?.schoolId) {
      toast.error("School ID not found. Please log in again.");
      return;
    }

    // Find the selected class to get its section
    const selectedClass = classes.find(c => c.id === selectedClassForLink);
    if (!selectedClass) {
      toast.error("Selected class not found");
      return;
    }

    try {
      // Get enabled fields with full configuration
      const enabledFields = fieldConfigs
        .filter(f => f.enabled)
        .map(f => ({
          id: f.id,
          fieldName: f.fieldName,
          label: f.label,
          fieldType: f.fieldType,
          mandatory: f.mandatory,
          options: f.options || undefined,
        }));

      // Save to database via API - use class ID directly (it already includes section)
      const response = await registrationLinksApi.create({
        classId: selectedClassForLink, // This is the full class ID (includes section)
        section: selectedClass.section || '', // Just for reference/display
        fieldConfig: enabledFields,
      });

      // Set the generated link from API response
      setGeneratedLink(response.link);
      toast.success("Registration link generated and saved!");
      
      // Refresh the links count to update the card
      // Fetch links separately to ensure count updates
      try {
        const linksData = await registrationLinksApi.getAll().catch(() => []);
        setLinksCount(linksData.length || 0);
      } catch (error) {
        console.error('Error refreshing links count:', error);
      }
      
      // Also reload all data
      await loadData();
    } catch (error: any) {
      console.error('Error generating link:', error);
      toast.error(error?.message || "Failed to generate registration link");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast.success("Link copied to clipboard!");
  };

  const handleApprove = async (studentId: number) => {
    try {
      await studentsApi.approve(studentId);
      
      // Update local state
      setStudents(prev => prev.map(s => 
        s.id === studentId 
          ? { ...s, status: "approved" as const, admissionNumber: `ADM${new Date().getFullYear()}${String(studentId).padStart(4, "0")}` }
          : s
      ));
      
      toast.success("Student approved and added to class!");
      
      // Reload data to ensure consistency
      await loadData();
    } catch (error: any) {
      console.error('Error approving student:', error);
      toast.error(error?.message || "Failed to approve student");
    }
  };

  const handleReject = async (studentId: number) => {
    try {
      await studentsApi.reject(studentId);
      
      // Update local state
      setStudents(prev => prev.map(s => 
        s.id === studentId ? { ...s, status: "rejected" as const } : s
      ));
      
      toast.error("Student registration rejected");
      
      // Reload data to ensure consistency
      await loadData();
    } catch (error: any) {
      console.error('Error rejecting student:', error);
      toast.error(error?.message || "Failed to reject student");
    }
  };

  const toggleFieldMandatory = (fieldId: string) => {
    setFieldConfigs(prev => prev.map(f => 
      f.id === fieldId ? { ...f, mandatory: !f.mandatory } : f
    ));
  };

  const toggleFieldEnabled = (fieldId: string) => {
    setFieldConfigs(prev => prev.map(f => 
      f.id === fieldId ? { ...f, enabled: !f.enabled, mandatory: !f.enabled ? f.mandatory : false } : f
    ));
  };

  const handleAddField = () => {
    if (!newField.fieldName.trim() || !newField.label.trim()) {
      toast.error("Please fill in field name and label");
      return;
    }

    // Check if field name already exists
    if (fieldConfigs.some(f => f.fieldName === newField.fieldName.trim())) {
      toast.error("A field with this name already exists");
      return;
    }

    // For select and radio, parse options from comma-separated string
    let options: string[] | undefined = undefined;
    if ((newField.fieldType === 'select' || newField.fieldType === 'radio') && typeof newField.options === 'string' && newField.options.trim()) {
      options = newField.options.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
      if (options.length === 0) {
        toast.error("Please provide at least one option for select/radio fields");
        return;
      }
    }

    const fieldToAdd: FieldConfig = {
      id: `custom_${Date.now()}_${newField.fieldName.trim()}`,
      fieldName: newField.fieldName.trim(),
      label: newField.label.trim(),
      fieldType: newField.fieldType,
      mandatory: newField.mandatory,
      enabled: true,
      options: options,
    };

    setFieldConfigs(prev => [...prev, fieldToAdd]);
    setNewField({
      fieldName: "",
      label: "",
      fieldType: "text",
      mandatory: false,
      options: "",
    });
    setShowAddFieldDialog(false);
    toast.success("Field added successfully");
  };

  const handleDeleteField = (fieldId: string) => {
    // Don't allow deleting default fields
    const field = fieldConfigs.find(f => f.id === fieldId);
    if (field && !field.id.startsWith('custom_')) {
      toast.error("Cannot delete default fields");
      return;
    }
    setFieldConfigs(prev => prev.filter(f => f.id !== fieldId));
    toast.success("Field removed");
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNo.includes(searchTerm);
    const matchesClass = filterClass === "all" || student.class === filterClass;
    const matchesStatus = filterStatus === "all" || student.status === filterStatus;
    return matchesSearch && matchesClass && matchesStatus;
  });

  const pendingCount = students.filter(s => s.status === "pending").length;
  const approvedCount = students.filter(s => s.status === "approved").length;

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Student Management</h1>
            <p className="text-muted-foreground mt-1">Manage student registrations and approvals.</p>
          </div>
          <Button onClick={() => setShowLinkDialog(true)}>
            <Link2 className="w-4 h-4 mr-2" />
            Generate Registration Link
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/dashboard/students/registration-links")}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{linksCount}</div>
              <p className="text-sm text-muted-foreground">Registration Links</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-warning">{pendingCount}</div>
              <p className="text-sm text-muted-foreground">Pending Approvals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-success">{approvedCount}</div>
              <p className="text-sm text-muted-foreground">Approved Students</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{students.length}</div>
              <p className="text-sm text-muted-foreground">Total Registrations</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="submissions" className="w-full">
          <TabsList>
            <TabsTrigger value="submissions">
              Pending Submissions
              {pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-warning/20 text-warning">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved Students</TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="space-y-4 mt-4">
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
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.section ? ` - ${c.section}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Students Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Student</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Class</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Parent Info</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Submitted</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.filter(s => s.status === "pending").map((student) => (
                    <tr key={student.id} className="border-t border-border">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={student.avatar} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {student.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium block">{student.name}</span>
                            <span className="text-xs text-muted-foreground">{student.gender} • {student.dateOfBirth}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                          {student.class}{student.section ? ` - Section ${student.section}` : ''}
                        </span>
                      </td>
                      <td className="p-4">
                        <div>
                          <span className="block text-sm">{student.fatherName}</span>
                          <span className="text-xs text-muted-foreground">{student.parentPhone}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">{student.submittedAt}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedStudent(student)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-success hover:text-success hover:bg-success/10"
                            onClick={() => handleApprove(student.id)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleReject(student.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredStudents.filter(s => s.status === "pending").length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No pending submissions
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="approved" className="space-y-4 mt-4">
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Student</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Admission No</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Class</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Parent Contact</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.filter(s => s.status === "approved").map((student) => (
                    <tr key={student.id} className="border-t border-border">
                      <td className="p-4">
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
                      <td className="p-4 text-muted-foreground">{student.admissionNumber || "-"}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                          {student.class}{student.section ? ` - Section ${student.section}` : ''}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">{student.parentPhone}</td>
                      <td className="p-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedStudent(student)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Generate Link Dialog */}
        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Generate Registration Link</DialogTitle>
              <DialogDescription>
                Create a customized registration link for students. Configure which fields are required.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Class</Label>
                <Select value={selectedClassForLink} onValueChange={setSelectedClassForLink}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class and section" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}{cls.section ? ` - Section ${cls.section}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedClassForLink && (() => {
                  const selectedClass = classes.find(c => c.id === selectedClassForLink);
                  if (selectedClass) {
                    return (
                      <p className="text-xs text-muted-foreground">
                        Selected: {selectedClass.name}{selectedClass.section ? ` - Section ${selectedClass.section}` : ''}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Form Fields Configuration</Label>
                  <Button variant="ghost" size="sm" onClick={() => setShowFieldConfigDialog(true)}>
                    <Settings className="w-4 h-4 mr-1" />
                    Configure
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {fieldConfigs.filter(f => f.enabled && f.mandatory).length} mandatory fields, 
                  {" "}{fieldConfigs.filter(f => f.enabled && !f.mandatory).length} optional fields
                </div>
              </div>
              
              {generatedLink && (
                <div className="space-y-2">
                  <Label>Registration Link</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={generatedLink} 
                      readOnly 
                      className="text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={handleCopyLink}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with parents. Students will see a form with camera access for photo capture.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
                Close
              </Button>
              <Button onClick={handleGenerateLink}>
                <Plus className="w-4 h-4 mr-2" />
                Generate Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Field Configuration Dialog */}
        <Dialog open={showFieldConfigDialog} onOpenChange={setShowFieldConfigDialog}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configure Form Fields</DialogTitle>
              <DialogDescription>
                Select which fields to include and mark them as mandatory or optional.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowAddFieldDialog(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Field
                </Button>
              </div>
              {fieldConfigs.map((field) => (
                <div key={field.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox 
                      checked={field.enabled}
                      onCheckedChange={() => toggleFieldEnabled(field.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={field.enabled ? "text-foreground font-medium" : "text-muted-foreground"}>
                          {field.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {field.fieldType}
                        </span>
                      </div>
                      {field.options && field.options.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Options: {field.options.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {field.enabled && (
                      <Button
                        variant={field.mandatory ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleFieldMandatory(field.id)}
                      >
                        {field.mandatory ? "Required" : "Optional"}
                      </Button>
                    )}
                    {field.id.startsWith('custom_') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteField(field.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowFieldConfigDialog(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Field Dialog */}
        <Dialog open={showAddFieldDialog} onOpenChange={setShowAddFieldDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Custom Field</DialogTitle>
              <DialogDescription>
                Create a new custom field for the registration form.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fieldName">Field Name *</Label>
                <Input
                  id="fieldName"
                  placeholder="e.g., guardianName"
                  value={newField.fieldName}
                  onChange={(e) => setNewField(prev => ({ ...prev, fieldName: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Internal identifier (lowercase, no spaces)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="label">Label *</Label>
                <Input
                  id="label"
                  placeholder="e.g., Guardian Name"
                  value={newField.label}
                  onChange={(e) => setNewField(prev => ({ ...prev, label: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Display name shown on the form
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fieldType">Field Type *</Label>
                <Select 
                  value={newField.fieldType} 
                  onValueChange={(value) => setNewField(prev => ({ ...prev, fieldType: value as FieldConfig['fieldType'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="textarea">Text Area</SelectItem>
                    <SelectItem value="tel">Telephone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="select">Select (Dropdown)</SelectItem>
                    <SelectItem value="radio">Radio Buttons</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                    <SelectItem value="file">File Upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(newField.fieldType === 'select' || newField.fieldType === 'radio') && (
                <div className="space-y-2">
                  <Label htmlFor="options">Options *</Label>
                  <Input
                    id="options"
                    placeholder="e.g., Option 1, Option 2, Option 3"
                    value={typeof newField.options === 'string' ? newField.options : newField.options.join(', ')}
                    onChange={(e) => setNewField(prev => ({ ...prev, options: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated list of options
                  </p>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mandatory"
                  checked={newField.mandatory}
                  onCheckedChange={(checked) => setNewField(prev => ({ ...prev, mandatory: !!checked }))}
                />
                <Label htmlFor="mandatory" className="cursor-pointer">
                  Required field
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddFieldDialog(false);
                setNewField({
                  fieldName: "",
                  label: "",
                  fieldType: "text",
                  mandatory: false,
                  options: "",
                });
              }}>
                Cancel
              </Button>
              <Button onClick={handleAddField}>
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Student Profile Dialog */}
        <Dialog open={!!selectedStudent} onOpenChange={() => {
          setSelectedStudent(null);
          setStudentFieldConfig([]);
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Student Profile</DialogTitle>
              <DialogDescription>Submitted registration details.</DialogDescription>
            </DialogHeader>
            {selectedStudent && (
              <StudentProfileView 
                student={selectedStudent}
                fieldConfig={studentFieldConfig}
                onFieldConfigLoad={setStudentFieldConfig}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            )}
          </DialogContent>
        </Dialog>

      </div>
    </UnifiedLayout>
  );
}
