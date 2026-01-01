import { useState } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

const initialClassesData = [
  { 
    id: 1, 
    name: "Class 1", 
    sections: [
      { name: "A", students: 42, classTeacher: "Mrs. Sharma" },
      { name: "B", students: 43, classTeacher: "Mrs. Verma" },
    ]
  },
  { 
    id: 2, 
    name: "Class 2", 
    sections: [
      { name: "A", students: 40, classTeacher: "Mr. Singh" },
      { name: "B", students: 44, classTeacher: "Mrs. Rao" },
      { name: "C", students: 42, classTeacher: "Mr. Das" },
    ]
  },
  { 
    id: 3, 
    name: "Class 3", 
    sections: [
      { name: "A", students: 45, classTeacher: "Mrs. Gupta" },
      { name: "B", students: 45, classTeacher: "Mr. Joshi" },
    ]
  },
  { 
    id: 4, 
    name: "Class 4", 
    sections: [
      { name: "A", students: 44, classTeacher: "Mr. Kumar" },
      { name: "B", students: 44, classTeacher: "Mrs. Nair" },
    ]
  },
  { 
    id: 5, 
    name: "Class 5", 
    sections: [
      { name: "A", students: 46, classTeacher: "Mrs. Patel" },
      { name: "B", students: 46, classTeacher: "Mr. Reddy" },
    ]
  },
];

const availableSubjects = [
  "Mathematics", "English", "Hindi", "Science", "Social Studies", "Computer", "Art", "Physical Education", "Music"
];

const initialTeachers = [
  { id: 1, name: "Mrs. Sharma", email: "sharma@school.com", phone: "9876543210", subjects: ["Mathematics"], classes: ["1A", "1B", "2A"] },
  { id: 2, name: "Mr. Singh", email: "singh@school.com", phone: "9876543211", subjects: ["English", "Hindi"], classes: ["2A", "2B", "2C"] },
  { id: 3, name: "Mrs. Gupta", email: "gupta@school.com", phone: "9876543212", subjects: ["Science"], classes: ["3A", "3B", "4A"] },
  { id: 4, name: "Mr. Kumar", email: "kumar@school.com", phone: "9876543213", subjects: ["Social Studies"], classes: ["4A", "4B", "5A"] },
  { id: 5, name: "Mrs. Patel", email: "patel@school.com", phone: "9876543214", subjects: ["Computer", "Art"], classes: ["5A", "5B"] },
];

const allClassesList = initialClassesData.flatMap(cls => 
  cls.sections.map(sec => `${cls.name.replace("Class ", "")}${sec.name}`)
);

export default function AcademicSetup() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [teachers, setTeachers] = useState(initialTeachers);
  const [classesData, setClassesData] = useState(initialClassesData);
  
  // New teacher form state
  const [newTeacher, setNewTeacher] = useState({
    name: "",
    email: "",
    phone: "",
    subjects: [] as string[],
    classes: [] as string[],
  });

  // Class teacher assignment state
  const [selectedSectionForAssign, setSelectedSectionForAssign] = useState<{className: string, sectionName: string} | null>(null);
  const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState<string>("");

  const handleAddTeacher = () => {
    if (!newTeacher.name || newTeacher.subjects.length === 0 || newTeacher.classes.length === 0) {
      return;
    }
    const teacher = {
      id: teachers.length + 1,
      ...newTeacher,
    };
    setTeachers([...teachers, teacher]);
    setNewTeacher({ name: "", email: "", phone: "", subjects: [], classes: [] });
    setIsAddTeacherOpen(false);
  };

  const toggleSubject = (subject: string) => {
    setNewTeacher(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }));
  };

  const toggleClass = (cls: string) => {
    setNewTeacher(prev => ({
      ...prev,
      classes: prev.classes.includes(cls)
        ? prev.classes.filter(c => c !== cls)
        : [...prev.classes, cls]
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
                        <Input placeholder="e.g., Class 6" />
                      </div>
                      <div className="space-y-2">
                        <Label>Sections</Label>
                        <Input placeholder="e.g., A, B, C" />
                      </div>
                      <div className="space-y-2">
                        <Label>Class Teacher</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            {teachers.map((t) => (
                              <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button className="w-full">Create Class</Button>
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
          <TabsContent value="teachers" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">Teacher Assignments</h2>
              {isAdmin && (
                <Dialog open={isAddTeacherOpen} onOpenChange={setIsAddTeacherOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Teacher
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                        <Label>Email</Label>
                        <Input 
                          type="email"
                          placeholder="e.g., john@school.com" 
                          value={newTeacher.email}
                          onChange={(e) => setNewTeacher(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input 
                          placeholder="e.g., 9876543210" 
                          value={newTeacher.phone}
                          onChange={(e) => setNewTeacher(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Subjects Teaching *</Label>
                        <div className="flex gap-2 flex-wrap p-3 border rounded-lg bg-muted/30">
                          {availableSubjects.map((subject) => (
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
                      <div className="space-y-2">
                        <Label>Classes Assigned *</Label>
                        <div className="flex gap-2 flex-wrap p-3 border rounded-lg bg-muted/30 max-h-32 overflow-y-auto">
                          {allClassesList.map((cls) => (
                            <Badge 
                              key={cls}
                              variant={newTeacher.classes.includes(cls) ? "default" : "outline"}
                              className="cursor-pointer transition-colors"
                              onClick={() => toggleClass(cls)}
                            >
                              {cls}
                            </Badge>
                          ))}
                        </div>
                        {newTeacher.classes.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Selected: {newTeacher.classes.join(", ")}
                          </p>
                        )}
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={handleAddTeacher}
                        disabled={!newTeacher.name || newTeacher.subjects.length === 0 || newTeacher.classes.length === 0}
                      >
                        <GraduationCap className="w-4 h-4 mr-2" />
                        Add Teacher
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Teacher Cards with Subject & Class Info */}
            <div className="grid gap-4 md:grid-cols-2">
              {teachers.map((teacher) => (
                <Card key={teacher.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <GraduationCap className="w-7 h-7 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{teacher.name}</h3>
                        {teacher.email && (
                          <p className="text-xs text-muted-foreground">{teacher.email}</p>
                        )}
                        <div className="mt-3 space-y-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                              <BookOpen className="w-3 h-3" /> Subjects Teaching
                            </p>
                            <div className="flex gap-1.5 flex-wrap">
                              {teacher.subjects.map((sub) => (
                                <Badge key={sub} variant="secondary" className="text-xs">
                                  {sub}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                              <Users className="w-3 h-3" /> Classes Assigned
                            </p>
                            <div className="flex gap-1.5 flex-wrap">
                              {teacher.classes.map((cls) => (
                                <Badge key={cls} className="text-xs bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                                  Class {cls}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="icon">
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </UnifiedLayout>
  );
}
