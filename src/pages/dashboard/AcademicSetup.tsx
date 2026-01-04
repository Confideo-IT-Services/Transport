import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { teachersApi, classesApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
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
import { Plus, Edit, Users, BookOpen, Calendar, ChevronRight, GraduationCap, UserCheck } from "lucide-react";

const academicYears = [
  { id: 1, name: "2024-25", status: "active", startDate: "Apr 2024", endDate: "Mar 2025" },
  { id: 2, name: "2023-24", status: "completed", startDate: "Apr 2023", endDate: "Mar 2024" },
];

// Hardcoded data removed - will load from API

export default function AcademicSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classesData, setClassesData] = useState<any[]>([]);
  
  // New class form state
  const [newClass, setNewClass] = useState({
    name: "",
    section: "",
    classTeacherId: "",
  });
  
  // New teacher form state
  const [newTeacher, setNewTeacher] = useState({
    name: "",
    subjects: [] as string[],
  });

  // New subject state
  const [newSubject, setNewSubject] = useState("");

  // Class teacher assignment state
  const [selectedSectionForAssign, setSelectedSectionForAssign] = useState<{className: string, sectionName: string} | null>(null);
  const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState<string>("");

  // Function to load classes from API and transform to nested structure
  const loadClasses = async () => {
    try {
      const classesDataRaw = await classesApi.getAll();
      
      // Transform flat API response to nested structure
      // API returns: [{ id, name, section, classTeacherId, studentCount, ... }, ...]
      // Component expects: [{ name, sections: [{ name, students, classTeacher }, ...] }, ...]
      const classesMap = new Map<string, any>();
      
      if (Array.isArray(classesDataRaw)) {
        classesDataRaw.forEach((cls: any) => {
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

  // Fetch teachers and classes from API on component mount
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

  const handleAddTeacher = () => {
    if (!newTeacher.name.trim() || newTeacher.subjects.length === 0) {
      return;
    }
    const teacher = {
      id: teachers.length + 1,
      name: newTeacher.name.trim(),
      subjects: newTeacher.subjects,
    };
    setTeachers([...teachers, teacher]);
    setNewTeacher({ name: "", subjects: [] });
    setIsAddTeacherOpen(false);
  };

  const handleAddSubject = () => {
    const trimmed = newSubject.trim();
    if (!trimmed || subjects.includes(trimmed)) return;
    setSubjects([...subjects, trimmed]);
    setNewSubject("");
  };

  const toggleSubject = (subject: string) => {
    setNewTeacher(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }));
  };

  const handleAssignClassTeacher = () => {
    if (!selectedSectionForAssign || !selectedTeacherForAssign) return;
    
    setClassesData(prev => prev.map(cls => {
      if (cls.name === selectedSectionForAssign.className) {
        return {
          ...cls,
          sections: cls.sections.map(sec => {
            if (sec.name === selectedSectionForAssign.sectionName) {
              return { ...sec, classTeacher: selectedTeacherForAssign };
            }
            return sec;
          })
        };
      }
      return cls;
    }));
    
    setSelectedSectionForAssign(null);
    setSelectedTeacherForAssign("");
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
            <TabsTrigger value="teachers">Teacher Assignments</TabsTrigger>
          </TabsList>

          {/* Academic Years */}
          <TabsContent value="years" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">Academic Years</h2>
              {isAdmin && (
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Academic Year
                </Button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {academicYears.map((year) => (
                <Card key={year.id} className={year.status === "active" ? "border-primary" : ""}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold">{year.name}</h3>
                      <Badge variant={year.status === "active" ? "default" : "secondary"}>
                        {year.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{year.startDate} - {year.endDate}</span>
                    </div>
                    {isAdmin && (
                      <Button variant="outline" size="sm" className="w-full mt-4">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
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
                              <p className="text-sm text-muted-foreground">Class Teacher: {cls.sections[0]?.classTeacher}</p>
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
                              {cls.sections.map((section) => (
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
                                </div>
                              ))}
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
                <h2 className="text-lg font-medium">Teacher Assignments</h2>
                <p className="text-sm text-muted-foreground">Add teachers and assign subjects they teach</p>
              </div>
              {isAdmin && (
                <Dialog open={isAddTeacherOpen} onOpenChange={setIsAddTeacherOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Teacher
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Teacher</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Teacher Name *</Label>
                        <Input 
                          placeholder="e.g., Mr. John Doe" 
                          value={newTeacher.name}
                          onChange={(e) => setNewTeacher(prev => ({ ...prev, name: e.target.value }))}
                        />
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
                        disabled={!newTeacher.name.trim() || newTeacher.subjects.length === 0}
                      >
                        <GraduationCap className="w-4 h-4 mr-2" />
                        Add Teacher
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

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
                            <Button variant="ghost" size="icon">
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
    </UnifiedLayout>
  );
}
