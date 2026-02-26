import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { teachersApi, classesApi, timetableApi, academicYearsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, Edit, Users, BookOpen, Calendar, ChevronRight, GraduationCap, UserCheck, Check, ChevronsUpDown, ArrowRight, ChevronDown } from "lucide-react";
import { getTodayIST } from "@/lib/date-ist";
import { PromoteStudentsModal } from "@/components/promotion/PromoteStudentsModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export default function AcademicSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { dialog, confirm, close } = useConfirmDialog();
  const isAdmin = user?.role === "admin";
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isAddAcademicYearOpen, setIsAddAcademicYearOpen] = useState(false);
  const [isEditTeacherOpen, setIsEditTeacherOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [editTeacherSubjects, setEditTeacherSubjects] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classesData, setClassesData] = useState<any[]>([]);
  const [classesDataRaw, setClassesDataRaw] = useState<any[]>([]); // Store raw data for section IDs
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  
  // Promotion modal state
  const [promotionModalOpen, setPromotionModalOpen] = useState(false);
  const [promotionClassId, setPromotionClassId] = useState<string>("");
  const [promotionClassName, setPromotionClassName] = useState<string>("");
  const [promotionFromYearId, setPromotionFromYearId] = useState<string>("");
  const [promotionToYearId, setPromotionToYearId] = useState<string>("");
  
  // New class form state
  const [newClass, setNewClass] = useState({
    name: "",
    section: "",
    classTeacherId: "",
  });
  
  // New teacher form state
  const [newTeacher, setNewTeacher] = useState({
    teacherId: "",
    subjects: [] as string[],
  });

  // Teacher search state
  const [teacherSearchOpen, setTeacherSearchOpen] = useState(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState("");

  // New subject state
  const [newSubject, setNewSubject] = useState("");

  // New academic year form state
  const [newAcademicYear, setNewAcademicYear] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });


  // Edit academic year state
  const [isEditAcademicYearOpen, setIsEditAcademicYearOpen] = useState(false);
  const [editingAcademicYear, setEditingAcademicYear] = useState<any>(null);
  const [editAcademicYearForm, setEditAcademicYearForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });

  // Class teacher assignment state
  const [selectedSectionForAssign, setSelectedSectionForAssign] = useState<{className: string, sectionName: string} | null>(null);
  const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState<string>("");

  // Function to calculate current academic year
  const getCurrentAcademicYear = () => {
    const now = getTodayIST();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    // Academic year runs from April to March
    // If Jan-Mar, current AY is (year-1)-(year)
    // If Apr-Dec, current AY is (year)-(year+1)
    let startYear, endYear;
    if (currentMonth >= 4) {
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      startYear = currentYear - 1;
      endYear = currentYear;
    }
    
    return {
      name: `${startYear}-${String(endYear).slice(-2)}`,
      startYear,
      endYear,
      startDate: `Apr ${startYear}`,
      endDate: `Mar ${endYear}`,
    };
  };

  // Function to load classes from API and transform to nested structure
  const loadClasses = async () => {
    try {
      const rawData = await classesApi.getAll();
      setClassesDataRaw(rawData); // Store raw data for accessing section IDs
      
      // Transform flat API response to nested structure
      // API returns: [{ id, name, section, classTeacherId, studentCount, ... }, ...]
      // Component expects: [{ name, sections: [{ name, students, classTeacher }, ...] }, ...]
      const classesMap = new Map<string, any>();
      
      if (Array.isArray(rawData)) {
        rawData.forEach((cls: any) => {
          if (!cls || !cls.name) return; // Skip invalid entries
          
          const key = cls.name;
          if (!classesMap.has(key)) {
            classesMap.set(key, {
              id: cls.id || `temp-${key}`,
              name: cls.name,
              sections: []
            });
          }
          
          const classData = classesMap.get(key);
          if (classData) {
            classData.sections.push({
              id: cls.id, // Store section class ID
              name: cls.section || '',
              students: cls.studentCount || 0,
              classTeacher: cls.classTeacherName || cls.classTeacherId || 'Not Assigned'
            });
          }
        });
      }
      
      setClassesData(Array.from(classesMap.values()));
    } catch (error) {
      console.error('Error loading classes:', error);
      // Keep classesData as empty array on error
    }
  };

  // Load academic years from API
  const loadAcademicYears = async () => {
    try {
      const yearsData = await academicYearsApi.getAll();
      // Format dates for display
      const formattedYears = yearsData.map((y: any) => {
        const startDate = new Date(y.startDate);
        const endDate = new Date(y.endDate);
        const formatDate = (date: Date) => {
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          return `${months[date.getMonth()]} ${date.getFullYear()}`;
        };
        const startRaw = typeof y.startDate === "string" ? y.startDate.slice(0, 10) : y.startDate;
        const endRaw = typeof y.endDate === "string" ? y.endDate.slice(0, 10) : y.endDate;
        return {
          id: y.id,
          name: y.name,
          status: y.status,
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          startDateRaw: startRaw,
          endDateRaw: endRaw,
          startYear: startDate.getFullYear(),
          endYear: endDate.getFullYear(),
        };
      });
      setAcademicYears(formattedYears);
    } catch (error) {
      console.error('Error loading academic years:', error);
      // If no academic years exist, initialize with current year
      const currentAY = getCurrentAcademicYear();
      const initialYears = [
        {
          id: 'temp-1',
          name: currentAY.name,
          status: "active",
          startDate: currentAY.startDate,
          endDate: currentAY.endDate,
          startYear: currentAY.startYear,
          endYear: currentAY.endYear,
        },
      ];
      setAcademicYears(initialYears);
    }
  };

  // Initialize academic years on mount
  useEffect(() => {
    if (isAdmin) {
      loadAcademicYears();
    }
  }, [isAdmin]);

  // Load subjects from API
  const loadSubjects = async () => {
    try {
      const subjectsData = await timetableApi.getSubjects();
      const subjectNames = subjectsData.map((s: any) => s.name || s.code);
      setSubjects(subjectNames);
    } catch (error) {
      console.error('Error loading subjects:', error);
      // Keep subjects as empty array on error
    }
  };

  // Fetch teachers, classes, and subjects from API on component mount
  useEffect(() => {
    const loadTeachers = async () => {
      try {
        const teachersData = await teachersApi.getAll();
        setTeachers(teachersData || []);
      } catch (error) {
        console.error('Error loading teachers:', error);
        // Keep teachers as empty array on error
      }
    };
    
    if (isAdmin) {
      loadTeachers();
      loadClasses(); // Load classes on mount
      loadSubjects(); // Load subjects from API
    }
  }, [isAdmin]);

  // Handle create class with proper error handling
  const handleCreateClass = async () => {
    try {
      // Validate inputs
      if (!newClass.name || !newClass.name.trim()) {
        toast({
          title: "Validation Error",
          description: "Please enter a class name",
          variant: "destructive",
        });
        return;
      }

      if (!newClass.section || !newClass.section.trim()) {
        toast({
          title: "Validation Error",
          description: "Please enter a section",
          variant: "destructive",
        });
        return;
      }

      // Call API to create class
      await classesApi.create({
        name: newClass.name.trim(),
        section: newClass.section.trim(),
        classTeacherId: newClass.classTeacherId && newClass.classTeacherId.trim() ? newClass.classTeacherId : undefined,
      });
      
      // Show success message
      toast({
        title: "Success",
        description: "Class created successfully",
      });
      
      // Reset form and close dialog
      setNewClass({ name: "", section: "", classTeacherId: "" });
      setIsAddClassOpen(false);
      
      // Reload classes to show the new class
      await loadClasses();
      
    } catch (error: any) {
      // Handle errors gracefully
      console.error('Error creating class:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create class. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddTeacher = async () => {
    if (!newTeacher.teacherId || newTeacher.subjects.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select a teacher and at least one subject",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get the selected teacher to merge existing subjects
      const selectedTeacher = teachers.find(t => t.id === newTeacher.teacherId);
      if (!selectedTeacher) {
        toast({
          title: "Error",
          description: "Selected teacher not found",
          variant: "destructive",
        });
        return;
      }

      // Merge existing subjects with new ones (avoid duplicates)
      const existingSubjects = selectedTeacher.subjects || [];
      const allSubjects = [...new Set([...existingSubjects, ...newTeacher.subjects])];

      // Update teacher with new subjects
      await teachersApi.update(newTeacher.teacherId, {
        subjects: allSubjects,
      });

      toast({
        title: "Success",
        description: `Subjects assigned to ${selectedTeacher.name} successfully`,
      });

      // Reset form and close dialog
      setNewTeacher({ teacherId: "", subjects: [] });
      setTeacherSearchQuery("");
      setTeacherSearchOpen(false);
      setIsAddTeacherOpen(false);

      // Reload teachers to show updated data
      try {
        const teachersData = await teachersApi.getAll();
        setTeachers(teachersData || []);
      } catch (reloadError) {
        console.error('Error reloading teachers:', reloadError);
      }
    } catch (error: any) {
      console.error('Error updating teacher:', error);
      
      toast({
        title: "Error",
        description: error?.message || "Failed to assign subjects. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddSubject = async () => {
    const trimmed = newSubject.trim();
    if (!trimmed) {
      toast({
        title: "Validation Error",
        description: "Please enter a subject name",
        variant: "destructive",
      });
      return;
    }

    if (subjects.includes(trimmed)) {
      toast({
        title: "Validation Error",
        description: "Subject already exists",
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate code from name (uppercase, first 3-4 letters)
      const code = trimmed.toUpperCase().replace(/\s+/g, '').substring(0, 4);
      
      // Call API to create subject
      await timetableApi.createSubject({
        code: code,
        name: trimmed,
      });

      toast({
        title: "Success",
        description: "Subject created successfully",
      });

      // Reload subjects from API
      await loadSubjects();
      setNewSubject("");
    } catch (error: any) {
      console.error('Error creating subject:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create subject. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle create academic year
  const handleCreateAcademicYear = async () => {
    if (!newAcademicYear.name.trim() || !newAcademicYear.startDate || !newAcademicYear.endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    // Validate date format
    const startDate = new Date(newAcademicYear.startDate);
    const endDate = new Date(newAcademicYear.endDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      toast({
        title: "Validation Error",
        description: "Please enter valid dates",
        variant: "destructive",
      });
      return;
    }

    if (endDate <= startDate) {
      toast({
        title: "Validation Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    try {
      // Call API to create academic year
      await academicYearsApi.create({
        name: newAcademicYear.name.trim(),
        startDate: newAcademicYear.startDate,
        endDate: newAcademicYear.endDate,
      });
      
      toast({
        title: "Success",
        description: "Academic year created successfully",
      });

      // Reset form and close dialog
      setNewAcademicYear({ name: "", startDate: "", endDate: "" });
      setIsAddAcademicYearOpen(false);

      // Reload academic years to show the new year
      await loadAcademicYears();
    } catch (error: any) {
      console.error('Error creating academic year:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create academic year. Please try again.",
        variant: "destructive",
      });
    }
  };


  const handleOpenEditAcademicYear = (year: any) => {
    setEditingAcademicYear(year);
    setEditAcademicYearForm({
      name: year.name,
      startDate: year.startDateRaw ?? "",
      endDate: year.endDateRaw ?? "",
    });
    setIsEditAcademicYearOpen(true);
  };

  const handleUpdateAcademicYear = async () => {
    if (!editingAcademicYear || !editAcademicYearForm.name.trim() || !editAcademicYearForm.startDate || !editAcademicYearForm.endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    const start = new Date(editAcademicYearForm.startDate);
    const end = new Date(editAcademicYearForm.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      toast({
        title: "Validation Error",
        description: "Please enter valid dates (end date must be after start date).",
        variant: "destructive",
      });
      return;
    }
    try {
      await academicYearsApi.update(editingAcademicYear.id, {
        name: editAcademicYearForm.name.trim(),
        startDate: editAcademicYearForm.startDate,
        endDate: editAcademicYearForm.endDate,
      });
      toast({
        title: "Success",
        description: "Academic year updated successfully.",
      });
      setIsEditAcademicYearOpen(false);
      setEditingAcademicYear(null);
      setEditAcademicYearForm({ name: "", startDate: "", endDate: "" });
      await loadAcademicYears();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message ?? "Failed to update academic year. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleSubject = (subject: string) => {
    setNewTeacher(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }));
  };

  // Handle opening edit teacher dialog
  const handleOpenEditTeacher = (teacher: any) => {
    setEditingTeacher(teacher);
    setEditTeacherSubjects(teacher.subjects || []);
    setIsEditTeacherOpen(true);
  };

  // Handle updating teacher
  const handleUpdateTeacher = async () => {
    if (!editingTeacher || editTeacherSubjects.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one subject",
        variant: "destructive",
      });
      return;
    }

    try {
      // Call API to update teacher
      await teachersApi.update(editingTeacher.id, {
        subjects: editTeacherSubjects,
      });

      toast({
        title: "Success",
        description: "Teacher updated successfully",
      });

      // Reset form and close dialog
      setEditingTeacher(null);
      setEditTeacherSubjects([]);
      setIsEditTeacherOpen(false);

      // Reload teachers to show updated data
      const teachersData = await teachersApi.getAll();
      setTeachers(teachersData || []);
    } catch (error: any) {
      console.error('Error updating teacher:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update teacher. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Toggle subject in edit mode
  const toggleEditSubject = (subject: string) => {
    setEditTeacherSubjects(prev =>
      prev.includes(subject)
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  };

  const handleAssignClassTeacher = async () => {
    if (!selectedSectionForAssign || !selectedTeacherForAssign) {
      toast({
        title: "Validation Error",
        description: "Please select a class-section and teacher",
        variant: "destructive",
      });
      return;
    }

    try {
      // Find the class ID and teacher ID
      const classData = classesData.find(c => c.name === selectedSectionForAssign.className);
      if (!classData) {
        throw new Error("Class not found");
      }

      // Find the section's class ID (each section is a separate class in DB)
      const classesDataRaw = await classesApi.getAll();
      const sectionClass = classesDataRaw.find((c: any) => 
        c.name === selectedSectionForAssign.className && 
        c.section === selectedSectionForAssign.sectionName
      );

      if (!sectionClass) {
        throw new Error("Class section not found");
      }

      // Find teacher ID from name
      const teacher = teachers.find(t => t.name === selectedTeacherForAssign);
      if (!teacher) {
        throw new Error("Teacher not found");
      }

      // Call API to update class teacher
      await classesApi.updateClassTeacher(sectionClass.id, teacher.id);

      toast({
        title: "Success",
        description: "Class teacher assigned successfully",
      });

      // Reload classes to show updated assignment
      await loadClasses();
      
      setSelectedSectionForAssign(null);
      setSelectedTeacherForAssign("");
    } catch (error: any) {
      console.error('Error assigning class teacher:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to assign class teacher. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Generate all class-section combinations for assignment
  const allSections = classesData.flatMap(cls => 
    cls.sections.map(sec => ({
      className: cls.name,
      sectionName: sec.name,
      fullName: `${cls.name} - Section ${sec.name}`,
      currentTeacher: sec.classTeacher
    }))
  );

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Academic Setup</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? "Manage academic years, classes, subjects, and teacher assignments"
                : "View academic structure and assignments (Read-only)"}
            </p>
          </div>
          {!isAdmin && (
            <Badge variant="secondary" className="text-xs">
              View Only
            </Badge>
          )}
        </div>

        <Tabs defaultValue="classes" className="space-y-6">
          <TabsList>
            <TabsTrigger value="years">Academic Years</TabsTrigger>
            <TabsTrigger value="classes">Classes & Sections</TabsTrigger>
            <TabsTrigger value="class-teachers">Class Teacher Assignment</TabsTrigger>
            <TabsTrigger value="teachers">Teacher-Subject Assignments</TabsTrigger>
          </TabsList>

          {/* Academic Years */}
          <TabsContent value="years" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">Academic Years</h2>
              {isAdmin && (
                <Dialog open={isAddAcademicYearOpen} onOpenChange={setIsAddAcademicYearOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Academic Year
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Academic Year</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Academic Year Name *</Label>
                        <Input 
                          placeholder="e.g., 2025-26" 
                          value={newAcademicYear.name}
                          onChange={(e) => setNewAcademicYear(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Format: YYYY-YY (e.g., 2025-26)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Start Date *</Label>
                        <Input 
                          type="date"
                          value={newAcademicYear.startDate}
                          onChange={(e) => setNewAcademicYear(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date *</Label>
                        <Input 
                          type="date"
                          value={newAcademicYear.endDate}
                          onChange={(e) => setNewAcademicYear(prev => ({ ...prev, endDate: e.target.value }))}
                        />
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={handleCreateAcademicYear}
                        disabled={!newAcademicYear.name.trim() || !newAcademicYear.startDate || !newAcademicYear.endDate}
                      >
                        Create Academic Year
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {/* Edit Academic Year Dialog */}
              {isAdmin && (
                <Dialog open={isEditAcademicYearOpen} onOpenChange={(open) => {
                  setIsEditAcademicYearOpen(open);
                  if (!open) {
                    setEditingAcademicYear(null);
                    setEditAcademicYearForm({ name: "", startDate: "", endDate: "" });
                  }
                }}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Academic Year</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Academic Year Name *</Label>
                        <Input
                          placeholder="e.g., 2025-26"
                          value={editAcademicYearForm.name}
                          onChange={(e) => setEditAcademicYearForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Start Date *</Label>
                        <Input
                          type="date"
                          value={editAcademicYearForm.startDate}
                          onChange={(e) => setEditAcademicYearForm(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date *</Label>
                        <Input
                          type="date"
                          value={editAcademicYearForm.endDate}
                          onChange={(e) => setEditAcademicYearForm(prev => ({ ...prev, endDate: e.target.value }))}
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleUpdateAcademicYear}
                        disabled={!editAcademicYearForm.name.trim() || !editAcademicYearForm.startDate || !editAcademicYearForm.endDate}
                      >
                        Save Changes
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {/* Current academic year - only active, editable */}
            {(() => {
              const activeYears = academicYears.filter((y) => y.status === "active");
              const completedYears = academicYears
                .filter((y) => y.status === "completed")
                .sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
              return (
                <>
                  <h3 className="text-sm font-medium text-muted-foreground mt-6 mb-2">Current academic year</h3>
                  {activeYears.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active academic year.</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {activeYears.map((year) => (
                        <Card key={year.id} className="border-primary">
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-xl font-semibold">{year.name}</h3>
                              <Badge variant="default">active</Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span>{year.startDate} - {year.endDate}</span>
                            </div>
                            {isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-2"
                                onClick={() => handleOpenEditAcademicYear(year)}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  {/* Past academic years - collapsible, no edit */}
                  {completedYears.length > 0 && (
                    <Collapsible className="mt-6">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex items-center gap-2 -ml-2">
                          <ChevronDown className="h-4 w-4" />
                          Past academic years ({completedYears.length})
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-2">
                          {completedYears.map((year) => (
                            <Card key={year.id}>
                              <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-4">
                                  <h3 className="text-xl font-semibold">{year.name}</h3>
                                  <Badge variant="secondary">completed</Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="w-4 h-4" />
                                  <span>{year.startDate} - {year.endDate}</span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </>
              );
            })()}
          </TabsContent>

          {/* Classes & Sections */}
          <TabsContent value="classes" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">Classes & Sections</h2>
              {isAdmin && (
                <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Class
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Class</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Class Name</Label>
                        <Input 
                          placeholder="e.g., Class 6" 
                          value={newClass.name}
                          onChange={(e) => setNewClass(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Section</Label>
                        <Input 
                          placeholder="e.g., A" 
                          value={newClass.section}
                          onChange={(e) => setNewClass(prev => ({ ...prev, section: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Class Teacher (Optional)</Label>
                        <Select 
                          value={newClass.classTeacherId || undefined} 
                          onValueChange={(value) => {
                            // Handle clearing selection - if value is empty, set to empty string
                            setNewClass(prev => ({ ...prev, classTeacherId: value || "" }))
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            {teachers.length === 0 ? (
                              <SelectItem value="no-teachers" disabled>No teachers available</SelectItem>
                            ) : (
                              teachers.map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={handleCreateClass}
                        disabled={!newClass.name?.trim() || !newClass.section?.trim()}
                      >
                        Create Class
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Class Selector with Section Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">View Class Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Class</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="w-full md:w-64">
                      <SelectValue placeholder="Choose a class to view details" />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      {classesData.map((cls) => (
                        <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedClass && (
                  <div className="mt-4 animate-fade-in">
                    {(() => {
                      const cls = classesData.find(c => c.name === selectedClass);
                      if (!cls) return null;
                      const totalStudents = cls.sections.reduce((sum, s) => sum + s.students, 0);
                      
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <BookOpen className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{cls.name}</h3>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">{cls.sections.length}</p>
                              <p className="text-xs text-muted-foreground">Sections</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-secondary">{totalStudents}</p>
                              <p className="text-xs text-muted-foreground">Total Students</p>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-3">Section-wise Details</h4>
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                              {cls.sections.map((section) => {
                                // Find the active and next academic years
                                const activeYear = academicYears.find((y) => y.status === "active");
                                const completedYears = academicYears.filter((y) => y.status === "completed").sort((a, b) => {
                                  const aEnd = new Date(a.endDateRaw || a.endDate);
                                  const bEnd = new Date(b.endDateRaw || b.endDate);
                                  return bEnd.getTime() - aEnd.getTime();
                                });
                                const lastCompletedYear = completedYears[0];
                                
                                return (
                                  <div 
                                    key={section.name}
                                    className="p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <Badge variant="outline" className="text-base px-3 py-1">
                                        Section {section.name}
                                      </Badge>
                                      <span className="text-2xl font-bold text-foreground">{section.students}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Students</p>
                                    <div className="mt-3 pt-3 border-t border-border">
                                      <p className="text-xs text-muted-foreground">Section Teacher</p>
                                      <p className="text-sm font-medium">{section.classTeacher}</p>
                                    </div>
                                    {isAdmin && lastCompletedYear && activeYear && section.id && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full mt-3"
                                        onClick={() => {
                                          setPromotionClassId(section.id);
                                          setPromotionClassName(`${cls.name}${section.name ? ` - Section ${section.name}` : ''}`);
                                          setPromotionFromYearId(lastCompletedYear.id);
                                          setPromotionToYearId(activeYear.id);
                                          setPromotionModalOpen(true);
                                        }}
                                      >
                                        <ArrowRight className="w-4 h-4 mr-2" />
                                        Promote Students
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* All Classes List */}
            <div className="space-y-4">
              <h3 className="font-medium">All Classes</h3>
              <div className="grid gap-4">
                {classesData.map((cls) => {
                  const totalStudents = cls.sections.reduce((sum, s) => sum + s.students, 0);
                  return (
                    <Card key={cls.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedClass(cls.name)}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <BookOpen className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{cls.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {cls.sections.length} Section{cls.sections.length > 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="text-2xl font-semibold">{cls.sections.length}</p>
                              <p className="text-xs text-muted-foreground">Sections</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-semibold">{totalStudents}</p>
                              <p className="text-xs text-muted-foreground">Students</p>
                            </div>
                            <div className="flex gap-2">
                              {cls.sections.map((sec) => (
                                <Badge key={sec.name} variant="outline">{sec.name}</Badge>
                              ))}
                            </div>
                            {isAdmin && (
                              <Button variant="ghost" size="icon">
                                <ChevronRight className="w-5 h-5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Class Teacher Assignment */}
          <TabsContent value="class-teachers" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium">Class Teacher Assignment</h2>
                <p className="text-sm text-muted-foreground">Assign class teachers to each section</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" />
                  Assign Class Teacher
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Select Class & Section</Label>
                    <Select 
                      value={selectedSectionForAssign ? `${selectedSectionForAssign.className}|${selectedSectionForAssign.sectionName}` : ""}
                      onValueChange={(val) => {
                        const [className, sectionName] = val.split("|");
                        setSelectedSectionForAssign({ className, sectionName });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose class & section" />
                      </SelectTrigger>
                      <SelectContent className="bg-card">
                        {allSections.map((sec) => (
                          <SelectItem key={sec.fullName} value={`${sec.className}|${sec.sectionName}`}>
                            {sec.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Select Teacher</Label>
                    <Select value={selectedTeacherForAssign} onValueChange={setSelectedTeacherForAssign}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose teacher" />
                      </SelectTrigger>
                      <SelectContent className="bg-card">
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {selectedSectionForAssign && (
                  <div className="p-3 bg-muted/30 rounded-lg border">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Current Class Teacher: </span>
                      <span className="font-medium">
                        {allSections.find(s => s.className === selectedSectionForAssign.className && s.sectionName === selectedSectionForAssign.sectionName)?.currentTeacher || "Not Assigned"}
                      </span>
                    </p>
                  </div>
                )}
                {isAdmin && (
                  <Button 
                    onClick={handleAssignClassTeacher}
                    disabled={!selectedSectionForAssign || !selectedTeacherForAssign}
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Assign Class Teacher
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Current Assignments Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Class Teacher Assignments</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Class Teacher</TableHead>
                      <TableHead>Students</TableHead>
                      {isAdmin && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSections.map((section) => (
                      <TableRow key={section.fullName}>
                        <TableCell className="font-medium">{section.className}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Section {section.sectionName}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <GraduationCap className="w-4 h-4 text-primary" />
                            </div>
                            <span>{section.currentTeacher}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {classesData.find(c => c.name === section.className)?.sections.find(s => s.name === section.sectionName)?.students || 0}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedSectionForAssign({ className: section.className, sectionName: section.sectionName });
                              }}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Change
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          {/* Teacher Assignments */}
          <TabsContent value="teachers" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium">Teacher-Subject Assignments</h2>
                <p className="text-sm text-muted-foreground">Add teachers and assign subjects they teach</p>
              </div>
              {isAdmin && (
                <Dialog open={isAddTeacherOpen} onOpenChange={(open) => {
                  setIsAddTeacherOpen(open);
                  if (!open) {
                    setNewTeacher({ teacherId: "", subjects: [] });
                    setTeacherSearchQuery("");
                    setTeacherSearchOpen(false);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Assign Subjects
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Teacher</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Teacher Name *</Label>
                        <Popover open={teacherSearchOpen} onOpenChange={setTeacherSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={teacherSearchOpen}
                              className="w-full justify-between"
                            >
                              {newTeacher.teacherId
                                ? (() => {
                                    const selectedTeacher = teachers.find((t) => t.id === newTeacher.teacherId);
                                    return selectedTeacher ? selectedTeacher.name : "Select teacher...";
                                  })()
                                : "Select teacher..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search teachers by name..." 
                                value={teacherSearchQuery}
                                onValueChange={setTeacherSearchQuery}
                              />
                              <CommandList>
                                <CommandEmpty>No teacher found.</CommandEmpty>
                                <CommandGroup>
                                  {teachers
                                    .filter((teacher) =>
                                      teacher.name.toLowerCase().includes(teacherSearchQuery.toLowerCase())
                                    )
                                    .map((teacher) => (
                                      <CommandItem
                                        key={teacher.id}
                                        value={teacher.name}
                                        onSelect={() => {
                                          setNewTeacher(prev => ({ ...prev, teacherId: teacher.id }));
                                          setTeacherSearchOpen(false);
                                          setTeacherSearchQuery("");
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            newTeacher.teacherId === teacher.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <span className="font-medium">{teacher.name}</span>
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Subjects Teaching *</Label>
                        <div className="flex gap-2 flex-wrap p-3 border rounded-lg bg-muted/30 max-h-40 overflow-y-auto">
                          {subjects.map((subject) => (
                            <Badge 
                              key={subject}
                              variant={newTeacher.subjects.includes(subject) ? "default" : "outline"}
                              className="cursor-pointer transition-colors"
                              onClick={() => toggleSubject(subject)}
                            >
                              {subject}
                            </Badge>
                          ))}
                        </div>
                        {newTeacher.subjects.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Selected: {newTeacher.subjects.join(", ")}
                          </p>
                        )}
                      </div>
                      {/* Add new subject inline */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Subject not listed? Add it:</Label>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="New subject name" 
                            value={newSubject}
                            onChange={(e) => setNewSubject(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={handleAddSubject}
                            disabled={!newSubject.trim()}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={handleAddTeacher}
                        disabled={!newTeacher.teacherId || newTeacher.subjects.length === 0}
                      >
                        <GraduationCap className="w-4 h-4 mr-2" />
                        Add Teacher
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Edit Teacher Dialog */}
            <Dialog open={isEditTeacherOpen} onOpenChange={(open) => {
              setIsEditTeacherOpen(open);
              if (!open) {
                setEditingTeacher(null);
                setEditTeacherSubjects([]);
              }
            }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Teacher Subjects</DialogTitle>
                  <DialogDescription>
                    Update subjects for {editingTeacher?.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Teacher Name</Label>
                    <Input 
                      value={editingTeacher?.name || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subjects Teaching *</Label>
                    <div className="flex gap-2 flex-wrap p-3 border rounded-lg bg-muted/30 max-h-40 overflow-y-auto">
                      {subjects.map((subject) => (
                        <Badge 
                          key={subject}
                          variant={editTeacherSubjects.includes(subject) ? "default" : "outline"}
                          className="cursor-pointer transition-colors"
                          onClick={() => toggleEditSubject(subject)}
                        >
                          {subject}
                        </Badge>
                      ))}
                    </div>
                    {editTeacherSubjects.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {editTeacherSubjects.join(", ")}
                      </p>
                    )}
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleUpdateTeacher}
                    disabled={!editingTeacher || editTeacherSubjects.length === 0}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Update Teacher
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Teacher Table */}
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher Name</TableHead>
                      <TableHead>Subjects</TableHead>
                      {isAdmin && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                              <GraduationCap className="w-5 h-5 text-primary" />
                            </div>
                            <span className="font-medium">{teacher.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5 flex-wrap">
                            {teacher.subjects.map((sub) => (
                              <Badge key={sub} variant="secondary" className="text-xs">
                                {sub}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleOpenEditTeacher(teacher)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Available Subjects */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Available Subjects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {subjects.map((subject) => (
                    <Badge key={subject} variant="outline" className="text-sm py-1.5 px-3">
                      {subject}
                    </Badge>
                  ))}
                </div>
                {isAdmin && (
                  <div className="mt-4 pt-4 border-t">
                    <Label className="text-sm text-muted-foreground mb-2 block">Add New Subject</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Enter subject name" 
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
                        className="max-w-xs"
                      />
                      <Button 
                        variant="outline" 
                        onClick={handleAddSubject}
                        disabled={!newSubject.trim() || subjects.includes(newSubject.trim())}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={dialog.open}
        onOpenChange={(open) => !open && close()}
        title={dialog.title}
        description={dialog.description}
        onConfirm={dialog.onConfirm}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        variant={dialog.variant}
      />

      {/* Promotion Modal */}
      {promotionClassId && promotionFromYearId && promotionToYearId && (
        <PromoteStudentsModal
          open={promotionModalOpen}
          onOpenChange={setPromotionModalOpen}
          fromAcademicYearId={promotionFromYearId}
          fromAcademicYearName={academicYears.find((y) => y.id === promotionFromYearId)?.name || ""}
          toAcademicYearId={promotionToYearId}
          toAcademicYearName={academicYears.find((y) => y.id === promotionToYearId)?.name || ""}
          classId={promotionClassId}
          className={promotionClassName}
          onSuccess={() => {
            loadClasses();
            loadAcademicYears();
          }}
        />
      )}
    </UnifiedLayout>
  );
}
