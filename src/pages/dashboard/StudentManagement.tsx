import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Check, X, Eye, Filter, Link2, Copy, Plus, Settings, Camera, Upload, ArrowRight, ArrowLeft, Download } from "lucide-react";
import * as XLSX from "xlsx";
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
import { studentsApi, classesApi, registrationLinksApi, teachersApi, academicYearsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { QuickEntryDialog } from "@/components/students/QuickEntryDialog";
import { ApproveStudentDialog } from "@/components/students/ApproveStudentDialog";
import { BulkApproveDialog } from "@/components/students/BulkApproveDialog";

interface FieldConfig {
  id: string;
  fieldName: string;
  label: string;
  fieldType: 'text' | 'textarea' | 'radio' | 'select' | 'tel' | 'email' | 'file' | 'checkbox' | 'date';
  mandatory: boolean;
  enabled: boolean;
  options?: string[]; // For select and radio fields
  requires_otp?: boolean; // For tel fields - require OTP verification
  is_primary_identity?: boolean; // For tel fields - mark as primary identity field
}

interface Student {
  id: string | number; // Can be UUID string or number
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
  classId?: string;
  extra_fields?: Record<string, any>; // NEW: ID card extra fields
  tcStatus?: 'none' | 'applied' | 'issued';
}

const BULK_IMPORT_SKIP = "__skip__";
const BULK_IMPORT_SYSTEM_FIELDS = [
  { value: BULK_IMPORT_SKIP, label: "Don't map / Skip" },
  { value: "name", label: "Student Name" },
  { value: "rollNo", label: "Roll No" },
  { value: "class", label: "Class" },
  { value: "section", label: "Section" },
  { value: "parentName", label: "Parent Name" },
  { value: "parentPhone", label: "Parent Phone" },
  { value: "parentEmail", label: "Parent Email" },
  { value: "dateOfBirth", label: "Date of Birth" },
  { value: "gender", label: "Gender" },
  { value: "address", label: "Address" },
  { value: "fatherName", label: "Father Name" },
  { value: "motherName", label: "Mother Name" },
  { value: "bloodGroup", label: "Blood Group" },
  { value: "admissionNumber", label: "Admission Number" },
];

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
  onApprove: (id: string | number) => void;
  onReject: (id: string | number) => void;
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
  { id: "studentName", fieldName: "studentName", label: "Name", fieldType: "text", mandatory: true, enabled: true },
  { id: "admissionNumber", fieldName: "admissionNumber", label: "Admission Number", fieldType: "text", mandatory: true, enabled: true },
  { id: "rollNo", fieldName: "rollNo", label: "Roll Number", fieldType: "text", mandatory: false, enabled: true },
  { id: "photo", fieldName: "photo", label: "Photo", fieldType: "file", mandatory: true, enabled: true },
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
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | null>(null);
  const [activeYearId, setActiveYearId] = useState<string | null>(null);

  useEffect(() => {
    const loadYears = async () => {
      try {
        const [years, active] = await Promise.all([
          academicYearsApi.getAll().catch(() => []),
          academicYearsApi.getActive().catch(() => null)
        ]);
        setAcademicYears(years || []);
        if (active?.id) {
          setActiveYearId(active.id);
          setSelectedAcademicYearId((prev) => prev ?? active.id);
        } else if ((years || []).length > 0) setSelectedAcademicYearId((prev) => prev ?? (years || [])[0].id);
      } catch {
        setAcademicYears([]);
      }
    };
    loadYears();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedAcademicYearId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [studentsData, classesData, linksData] = await Promise.all([
        studentsApi.getAll(selectedAcademicYearId || undefined).catch(() => []),
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
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [studentFieldConfig, setStudentFieldConfig] = useState<FieldConfig[]>([]);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [showFieldConfigDialog, setShowFieldConfigDialog] = useState(false);
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false);
  // Bulk import state
  const [bulkStep, setBulkStep] = useState(1);
  const [bulkExcelHeaders, setBulkExcelHeaders] = useState<string[]>([]);
  const [bulkExcelRows, setBulkExcelRows] = useState<any[]>([]);
  const [bulkColumnMapping, setBulkColumnMapping] = useState<Record<string, string>>({});
  const [bulkImportType, setBulkImportType] = useState<'all_classes' | 'particular_class'>('all_classes');
  const [bulkSelectedClassId, setBulkSelectedClassId] = useState("");
  const [bulkImportResult, setBulkImportResult] = useState<{ created: number; failed: number; errors: Array<{ row: number; message: string }> } | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkType, setLinkType] = useState<'class' | 'all_classes' | 'teacher' | 'others'>('class');
  // Quick entry and approval dialogs
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvingStudent, setApprovingStudent] = useState<Student | null>(null);
  const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
  const [selectedStudentsForBulk, setSelectedStudentsForBulk] = useState<Student[]>([]);
  const [selectedClassForLink, setSelectedClassForLink] = useState("");
  const [selectedTeacherForLink, setSelectedTeacherForLink] = useState("");
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [generatedLink, setGeneratedLink] = useState("");
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>(defaultFields);

  const selectedYear = selectedAcademicYearId ? academicYears.find((y) => y.id === selectedAcademicYearId) : null;
  const isReadOnlyYear = !!selectedYear && selectedYear.status !== "active";

  useEffect(() => {
    if (showLinkDialog) {
      teachersApi.getAll().then((data: any[]) => {
        setTeachers(data?.map((t: any) => ({ id: t.id, name: t.name || t.username })) || []);
      }).catch(() => setTeachers([]));
    }
  }, [showLinkDialog]);

  // Add Field form state
  const [newField, setNewField] = useState({
    fieldName: "",
    label: "",
    fieldType: "text" as FieldConfig['fieldType'],
    mandatory: false,
    options: "" as string | string[], // For select/radio - stored as comma-separated string in form
    requires_otp: false, // For tel fields
    is_primary_identity: false, // For tel fields
  });

  const handleGenerateLink = async () => {
    if (!user?.schoolId) {
      toast.error("School ID not found. Please log in again.");
      return;
    }

    if (linkType === 'class' && !selectedClassForLink) {
      toast.error("Please select class and section");
      return;
    }
    const selectedClass = linkType === 'class' ? classes.find(c => c.id === selectedClassForLink) : null;

    try {
      const enabledFields = fieldConfigs
        .filter(f => f.enabled)
        .map(f => ({
          id: f.id,
          fieldName: f.fieldName,
          label: f.label,
          fieldType: f.fieldType,
          mandatory: f.mandatory,
          options: f.options || undefined,
          requires_otp: f.requires_otp,
          is_primary_identity: f.is_primary_identity,
        }));

      const payload: Parameters<typeof registrationLinksApi.create>[0] = {
        name: linkName.trim(),
        linkType,
        fieldConfig: enabledFields,
      };
      if (linkType === 'class') {
        payload.classId = selectedClassForLink;
        payload.section = selectedClass?.section || '';
      }
      if (linkType === 'teacher' && selectedTeacherForLink) {
        payload.teacherId = selectedTeacherForLink;
      }

      const response = await registrationLinksApi.create(payload);

      setGeneratedLink(response.link);
      toast.success("Registration link generated and saved!");

      try {
        const linksData = await registrationLinksApi.getAll().catch(() => []);
        setLinksCount(linksData.length || 0);
      } catch (error) {
        console.error('Error refreshing links count:', error);
      }
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

  const handleApprove = async (studentId: string | number) => {
    // Find student and show approval dialog
    const student = students.find(s => s.id === studentId);
    if (student) {
      setApprovingStudent(student);
      setShowApproveDialog(true);
    }
  };

  const handleApproveSuccess = async () => {
    // Reload data after approval
    await loadData();
    setShowApproveDialog(false);
    setApprovingStudent(null);
  };

  const handleBulkApprove = () => {
    const pendingStudents = students.filter(s => s.status === 'pending');
    if (pendingStudents.length === 0) {
      toast.error('No pending students to approve');
      return;
    }
    setSelectedStudentsForBulk(pendingStudents);
    setShowBulkApproveDialog(true);
  };

  const handleBulkApproveSuccess = async () => {
    await loadData();
    setShowBulkApproveDialog(false);
    setSelectedStudentsForBulk([]);
  };

  const handleReject = async (studentId: string | number) => {
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
      const errorMessage = error?.response?.data?.error || error?.message || "Failed to reject student";
      toast.error(errorMessage);
    }
  };

  const handleUpdateTcStatus = async (studentId: string | number, tcStatus: 'none' | 'applied' | 'issued') => {
    try {
      await studentsApi.updateTcStatus(studentId, tcStatus);
      toast.success(`TC status updated to ${tcStatus}`);
      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('Error updating TC status:', error);
      const errorMessage = error?.response?.data?.error || error?.message || "Failed to update TC status";
      toast.error(errorMessage);
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent({ ...student });
    setShowEditDialog(true);
  };

  const handleSaveStudent = async () => {
    if (!editingStudent) return;

    try {
      setIsLoading(true);
      
      // Extract extra_fields if they exist
      const { extra_fields, ...updateData } = editingStudent;
      
      // Prepare update payload
      const payload: any = { ...updateData };
      if (extra_fields) {
        payload.extra_fields = extra_fields;
      }

      await studentsApi.update(editingStudent.id, payload);
      
      // Update local state
      setStudents(prev => prev.map(s => 
        s.id === editingStudent.id ? { ...s, ...editingStudent } : s
      ));
      
      toast.success("Student updated successfully");
      setShowEditDialog(false);
      setEditingStudent(null);
    } catch (error: any) {
      console.error('Error updating student:', error);
      const errorMessage = error?.response?.data?.error || error?.message || "Failed to update student";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
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
      requires_otp: newField.fieldType === 'tel' ? newField.requires_otp : undefined,
      is_primary_identity: newField.fieldType === 'tel' ? newField.is_primary_identity : undefined,
    };

    setFieldConfigs(prev => [...prev, fieldToAdd]);
    setNewField({
      fieldName: "",
      label: "",
      fieldType: "text",
      mandatory: false,
      options: "",
      requires_otp: false,
      is_primary_identity: false,
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
      (student.rollNo && student.rollNo.toLowerCase().includes(searchTerm.toLowerCase()));
    // Fix: Compare classId instead of class name
    const matchesClass = filterClass === "all" || student.classId === filterClass;
    const matchesStatus = filterStatus === "all" || student.status === filterStatus;
    return matchesSearch && matchesClass && matchesStatus;
  });

  const pendingCount = students.filter(s => s.status === "pending").length;
  const approvedCount = students.filter(s => s.status === "approved").length;

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Academic year filter */}
        {academicYears.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-muted-foreground">Academic year</Label>
            <Select
              value={selectedAcademicYearId ?? ""}
              onValueChange={(v) => setSelectedAcademicYearId(v || null)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.name}{y.status === "active" ? " (Current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAcademicYearId && academicYears.find((y) => y.id === selectedAcademicYearId)?.status !== "active" && (
              <span className="text-sm text-amber-600 font-medium">Read-only — viewing previous year data</span>
            )}
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Student Management</h1>
            <p className="text-muted-foreground mt-1">Manage student registrations and approvals.</p>
          </div>
          {(!selectedAcademicYearId || academicYears.find((y) => y.id === selectedAcademicYearId)?.status === "active") && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowQuickEntry(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Quick Entry
              </Button>
              <Button variant="outline" onClick={() => setShowBulkImportDialog(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Import
              </Button>
              <Button onClick={() => setShowLinkDialog(true)}>
                <Link2 className="w-4 h-4 mr-2" />
                Generate Registration Link
              </Button>
            </div>
          )}
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
            {/* Bulk Actions */}
            {pendingCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {pendingCount} pending submission(s)
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleBulkApprove}
                  disabled={pendingCount === 0}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Bulk Approve
                </Button>
              </div>
            )}
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
                          {!isReadOnlyYear && (
                            <>
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
                            </>
                          )}
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
                    <th className="text-left p-4 font-medium text-muted-foreground">Admission No</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Class</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Parent Contact</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">TC Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.filter(s => s.status === "approved").map((student) => (
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
                        <span className="text-sm text-muted-foreground">
                          {student.tcStatus === 'applied' ? 'TC Applied' : 
                           student.tcStatus === 'issued' ? 'TC Issued' : 'NA'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedStudent(student)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {user?.role === 'admin' && !isReadOnlyYear && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditStudent(student)}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredStudents.filter(s => s.status === "approved").length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No approved students found
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Generate Link Dialog */}
        <Dialog open={showLinkDialog} onOpenChange={(open) => {
          setShowLinkDialog(open);
          if (!open) {
            setLinkName("");
            setLinkType("class");
            setSelectedClassForLink("");
            setSelectedTeacherForLink("");
            setGeneratedLink("");
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Generate Registration Link</DialogTitle>
              <DialogDescription>
                Create a customized registration link. Configure which fields are required.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Link Name <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g., Class 1A - 2026"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This name will appear as the form title when students open the registration link.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Link for</Label>
                <Select value={linkType} onValueChange={(v: 'class' | 'all_classes' | 'teacher' | 'others') => {
                  setLinkType(v);
                  setSelectedClassForLink("");
                  setSelectedTeacherForLink("");
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">Specific class</SelectItem>
                    <SelectItem value="all_classes">All classes</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {linkType === 'class' && (
                <div className="space-y-2">
                  <Label>Select class and section</Label>
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
                    const sel = classes.find(c => c.id === selectedClassForLink);
                    return sel ? (
                      <p className="text-xs text-muted-foreground">
                        Selected: {sel.name}{sel.section ? ` - Section ${sel.section}` : ''}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}


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
                    <Input value={generatedLink} readOnly className="text-sm" />
                    <Button variant="outline" size="icon" onClick={handleCopyLink}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link. Recipients will see a form with the configured fields.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Close</Button>
              <Button
                onClick={handleGenerateLink}
                disabled={!linkName?.trim() || (linkType === 'class' ? !selectedClassForLink : false)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Generate Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Import Dialog */}
        <Dialog open={showBulkImportDialog} onOpenChange={(open) => {
          setShowBulkImportDialog(open);
          if (!open) {
            setBulkStep(1);
            setBulkExcelHeaders([]);
            setBulkExcelRows([]);
            setBulkColumnMapping({});
            setBulkImportType('all_classes');
            setBulkSelectedClassId("");
            setBulkImportResult(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Bulk Import Students</DialogTitle>
              <DialogDescription>
                {bulkStep === 1 && "Upload an Excel file (.xlsx). First row should be column headers."}
                {bulkStep === 2 && "Is this data for all school students (class/section from file) or one particular class and section?"}
                {bulkStep === 3 && "Map each Excel column to a system field."}
                {bulkStep === 4 && "Preview mapped data and import."}
                {bulkStep === 5 && "Import complete."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              {/* Step 1: Upload */}
              {bulkStep === 1 && (
                <div className="space-y-4">
                  <Label>Select file (.xlsx or .csv)</Label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          let wb: XLSX.WorkBook;
                          if (isCsv) {
                            const text = ev.target?.result as string;
                            wb = XLSX.read(text, { type: "string" });
                          } else {
                            const data = new Uint8Array(ev.target?.result as ArrayBuffer);
                            wb = XLSX.read(data, { type: "array" });
                          }
                          const ws = wb.Sheets[wb.SheetNames[0]];
                          const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                          const headers = (json[0] || []).map((h: any) => String(h ?? "").trim() || `Col${(json[0] || []).indexOf(h) + 1}`);
                          const rows = json.slice(1).filter(r => r.some((c: any) => c != null && String(c).trim() !== "")).map(row => {
                            const obj: any = {};
                            headers.forEach((h, i) => { obj[h] = row[i] != null ? row[i] : ""; });
                            return obj;
                          });
                          setBulkExcelHeaders(headers);
                          setBulkExcelRows(rows);
                          setBulkColumnMapping({});
                          toast.success(`Loaded ${rows.length} rows`);
                        } catch (err: any) {
                          toast.error(err?.message || "Failed to parse file");
                        }
                      };
                      if (isCsv) reader.readAsText(file); else reader.readAsArrayBuffer(file);
                    }}
                  />
                  {bulkExcelRows.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {bulkExcelHeaders.length} columns, {bulkExcelRows.length} rows. Click Next to choose import type.
                    </p>
                  )}
                </div>
              )}

              {/* Step 2: Import type */}
              {bulkStep === 2 && (
                <div className="space-y-4">
                  <Label>Import type</Label>
                  <Select value={bulkImportType} onValueChange={(v: 'all_classes' | 'particular_class') => setBulkImportType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_classes">All school students (all classes form)</SelectItem>
                      <SelectItem value="particular_class">Particular class and section form</SelectItem>
                    </SelectContent>
                  </Select>
                  {bulkImportType === "particular_class" && (
                    <>
                      <Label>Select class and section</Label>
                      <Select value={bulkSelectedClassId} onValueChange={setBulkSelectedClassId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select class and section" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}{c.section ? ` - ${c.section}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
              )}

              {/* Step 3: Mapping */}
              {bulkStep === 3 && (
                <div className="space-y-3">
                  <Label>Map Excel columns to system fields</Label>
                  <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {bulkExcelHeaders.map((h) => (
                      <div key={h} className="flex items-center gap-4 p-3">
                        <span className="font-medium text-sm w-40 truncate" title={h}>{h}</span>
                        <span className="text-muted-foreground">→</span>
                        <Select
                          value={bulkColumnMapping[h] ?? ""}
                          onValueChange={(v) => setBulkColumnMapping(prev => ({ ...prev, [h]: v }))}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {BULK_IMPORT_SYSTEM_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Preview & Import */}
              {bulkStep === 4 && (() => {
                const mappedRows = bulkExcelRows.map(row => {
                  const out: Record<string, any> = {};
                  Object.entries(bulkColumnMapping).forEach(([excelCol, sysField]) => {
                    if (sysField && sysField !== BULK_IMPORT_SKIP && row[excelCol] != null) out[sysField] = row[excelCol];
                  });
                  return out;
                });
                return (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">First 10 rows (mapped):</p>
                    <div className="border rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            {(mappedRows[0] ? Object.keys(mappedRows[0]) : ["name"]).map(k => (
                              <th key={k} className="p-2 text-left">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {mappedRows.slice(0, 10).map((row, i) => (
                            <tr key={i} className="border-t">
                              {(mappedRows[0] ? Object.keys(mappedRows[0]) : []).map(k => (
                                <td key={k} className="p-2">{String((row as Record<string, unknown>)[k] ?? "")}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground">Total rows to import: {mappedRows.length}</p>
                  </div>
                );
              })()}

              {/* Step 5: Result */}
              {bulkStep === 5 && bulkImportResult && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="px-4 py-2 rounded-lg bg-secondary/20 text-secondary font-semibold">{bulkImportResult.created} created</div>
                    <div className="px-4 py-2 rounded-lg bg-destructive/20 text-destructive font-semibold">{bulkImportResult.failed} failed</div>
                  </div>
                  {bulkImportResult.errors.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Failed rows (details below)</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const escapeCsv = (v: unknown) => {
                              const s = v != null ? String(v) : "";
                              if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
                              return s;
                            };
                            const headers = bulkExcelHeaders.length > 0 ? bulkExcelHeaders : (bulkExcelRows[0] ? Object.keys(bulkExcelRows[0]) : []);
                            const failedRowIndices = bulkImportResult!.errors.map((e) => e.row - 2);
                            const rows = failedRowIndices
                              .filter((i) => i >= 0 && i < bulkExcelRows.length)
                              .map((i) => bulkExcelRows[i]);
                            const headerLine = headers.map(escapeCsv).join(",");
                            const dataLines = rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(","));
                            const csv = [headerLine, ...dataLines].join("\r\n");
                            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `failed-import-rows-${new Date().toISOString().slice(0, 10)}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success("Failed rows downloaded as CSV");
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download failed rows as CSV
                        </Button>
                      </div>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {bulkImportResult.errors.map((e, i) => (
                          <li key={i}>Row {e.row}: {e.message}</li>
                        ))}
                      </ul>
                      <div className="border rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 sticky top-0">
                            <tr>
                              <th className="p-2 text-left font-medium w-12">Row</th>
                              <th className="p-2 text-left font-medium w-32">Error</th>
                              {bulkExcelHeaders.map((h) => (
                                <th key={h} className="p-2 text-left font-medium">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {bulkImportResult.errors.map((e, i) => {
                              const rowIndex = e.row - 2;
                              const row = rowIndex >= 0 && rowIndex < bulkExcelRows.length ? bulkExcelRows[rowIndex] : {};
                              return (
                                <tr key={i} className="border-t">
                                  <td className="p-2">{e.row}</td>
                                  <td className="p-2 text-destructive text-xs">{e.message}</td>
                                  {bulkExcelHeaders.map((h) => (
                                    <td key={h} className="p-2">{String(row[h] ?? "")}</td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="border-t pt-4">
              {bulkStep < 5 && (
                <>
                  {bulkStep > 1 && (
                    <Button variant="outline" onClick={() => setBulkStep(s => s - 1)}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button
                    disabled={
                      bulkStep === 1 && bulkExcelRows.length === 0 ||
                      bulkStep === 2 && bulkImportType === "particular_class" && !bulkSelectedClassId
                    }
                    onClick={async () => {
                      if (bulkStep === 4) {
                        const mappedRows = bulkExcelRows.map(row => {
                          const out: Record<string, any> = {};
                          Object.entries(bulkColumnMapping).forEach(([excelCol, sysField]) => {
                            if (sysField && sysField !== BULK_IMPORT_SKIP && row[excelCol] != null) out[sysField] = row[excelCol];
                          });
                          return out;
                        });
                        setBulkImporting(true);
                        try {
                          const res = await studentsApi.bulkImport({
                            importType: bulkImportType,
                            selectedClassId: bulkImportType === "particular_class" ? bulkSelectedClassId || undefined : undefined,
                            rows: mappedRows,
                          });
                          setBulkImportResult({ created: res.created, failed: res.failed, errors: res.errors });
                          setBulkStep(5);
                          toast.success(`Import complete: ${res.created} created, ${res.failed} failed`);
                          await loadData();
                        } catch (err: any) {
                          toast.error(err?.message || "Import failed");
                        } finally {
                          setBulkImporting(false);
                        }
                      } else {
                        setBulkStep(s => s + 1);
                      }
                    }}
                  >
                    {bulkImporting ? "Importing..." : bulkStep === 4 ? "Import" : "Next"}
                    {bulkStep < 4 && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                </>
              )}
              {bulkStep === 5 && (
                <Button onClick={() => { setShowBulkImportDialog(false); setBulkStep(1); setBulkImportResult(null); }}>
                  Close
                </Button>
              )}
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

              {/* OTP Configuration - Only for tel fields */}
              {newField.fieldType === 'tel' && (
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <p className="text-sm font-medium">OTP Verification Settings</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="requires_otp"
                        checked={newField.requires_otp}
                        onCheckedChange={(checked) => setNewField(prev => ({ ...prev, requires_otp: !!checked }))}
                      />
                      <Label htmlFor="requires_otp" className="cursor-pointer text-sm">
                        Require OTP verification
                      </Label>
                    </div>
                    {newField.requires_otp && (
                      <div className="flex items-center space-x-2 ml-6">
                        <Checkbox
                          id="is_primary_identity"
                          checked={newField.is_primary_identity}
                          onCheckedChange={(checked) => setNewField(prev => ({ ...prev, is_primary_identity: !!checked }))}
                        />
                        <Label htmlFor="is_primary_identity" className="cursor-pointer text-sm">
                          Mark as primary identity field
                        </Label>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground ml-6">
                      OTP verification will be required for this phone number before form submission
                    </p>
                  </div>
                </div>
              )}
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
                  requires_otp: false,
                  is_primary_identity: false,
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

        {/* Edit Student Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
              <DialogDescription>Update student information and ID card fields.</DialogDescription>
            </DialogHeader>
            {editingStudent && (
              <div className="space-y-6">
                {/* Class and Section (change section) */}
                {classes.length > 0 && (
                  <div className="space-y-2">
                    <Label>Class and Section</Label>
                    <Select
                      value={editingStudent.classId ?? ''}
                      onValueChange={(value) => setEditingStudent({ ...editingStudent, classId: value })}
                    >
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
                    <p className="text-xs text-muted-foreground">Change the student&apos;s class/section here</p>
                  </div>
                )}
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input 
                        value={editingStudent.name}
                        onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Roll Number</Label>
                      <Input 
                        value={editingStudent.rollNo}
                        onChange={(e) => setEditingStudent({ ...editingStudent, rollNo: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Date of Birth</Label>
                      <Input 
                        type="date"
                        value={editingStudent.dateOfBirth}
                        onChange={(e) => setEditingStudent({ ...editingStudent, dateOfBirth: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Gender</Label>
                      <Select 
                        value={editingStudent.gender}
                        onValueChange={(value) => setEditingStudent({ ...editingStudent, gender: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Blood Group</Label>
                      <Input 
                        value={editingStudent.bloodGroup || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, bloodGroup: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input 
                        value={editingStudent.address || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, address: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* ID Card Information */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4">ID Card Information</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    These fields are used for ID card generation. Only School Admins can edit these fields.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Blood Group (ID Card)</Label>
                      <Input 
                        value={editingStudent.extra_fields?.blood_group || ''}
                        onChange={(e) => setEditingStudent({ 
                          ...editingStudent, 
                          extra_fields: { 
                            ...(editingStudent.extra_fields || {}), 
                            blood_group: e.target.value 
                          } 
                        })}
                        placeholder="e.g., A+, B-, O+"
                      />
                    </div>
                    <div>
                      <Label>House</Label>
                      <Input 
                        value={editingStudent.extra_fields?.house || ''}
                        onChange={(e) => setEditingStudent({ 
                          ...editingStudent, 
                          extra_fields: { 
                            ...(editingStudent.extra_fields || {}), 
                            house: e.target.value 
                          } 
                        })}
                        placeholder="e.g., Red House, Blue House"
                      />
                    </div>
                    <div>
                      <Label>ID Valid Until</Label>
                      <Input 
                        type="date"
                        value={editingStudent.extra_fields?.id_valid_upto || ''}
                        onChange={(e) => setEditingStudent({ 
                          ...editingStudent, 
                          extra_fields: { 
                            ...(editingStudent.extra_fields || {}), 
                            id_valid_upto: e.target.value 
                          } 
                        })}
                      />
                    </div>
                    <div>
                      <Label>Additional Field 1</Label>
                      <Input 
                        value={editingStudent.extra_fields?.additional_field_1 || ''}
                        onChange={(e) => setEditingStudent({ 
                          ...editingStudent, 
                          extra_fields: { 
                            ...(editingStudent.extra_fields || {}), 
                            additional_field_1: e.target.value 
                          } 
                        })}
                        placeholder="Custom field"
                      />
                    </div>
                    <div>
                      <Label>Additional Field 2</Label>
                      <Input 
                        value={editingStudent.extra_fields?.additional_field_2 || ''}
                        onChange={(e) => setEditingStudent({ 
                          ...editingStudent, 
                          extra_fields: { 
                            ...(editingStudent.extra_fields || {}), 
                            additional_field_2: e.target.value 
                          } 
                        })}
                        placeholder="Custom field"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveStudent} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick Entry Dialog */}
        <QuickEntryDialog
          open={showQuickEntry}
          onClose={() => setShowQuickEntry(false)}
          onSuccess={handleApproveSuccess}
        />

        {/* Approve Student Dialog */}
        {approvingStudent && (
          <ApproveStudentDialog
            student={approvingStudent}
            open={showApproveDialog}
            onClose={() => {
              setShowApproveDialog(false);
              setApprovingStudent(null);
            }}
            onSuccess={handleApproveSuccess}
          />
        )}

        {/* Bulk Approve Dialog */}
        <BulkApproveDialog
          students={selectedStudentsForBulk}
          open={showBulkApproveDialog}
          onClose={() => {
            setShowBulkApproveDialog(false);
            setSelectedStudentsForBulk([]);
          }}
          onSuccess={handleBulkApproveSuccess}
        />

      </div>
    </UnifiedLayout>
  );
}
