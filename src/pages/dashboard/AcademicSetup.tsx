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
import { Plus, Edit, Users, BookOpen, Calendar, ChevronRight } from "lucide-react";

const academicYears = [
  { id: 1, name: "2024-25", status: "active", startDate: "Apr 2024", endDate: "Mar 2025" },
  { id: 2, name: "2023-24", status: "completed", startDate: "Apr 2023", endDate: "Mar 2024" },
];

const classes = [
  { id: 1, name: "Class 1", sections: ["A", "B"], students: 85, classTeacher: "Mrs. Sharma" },
  { id: 2, name: "Class 2", sections: ["A", "B", "C"], students: 126, classTeacher: "Mr. Singh" },
  { id: 3, name: "Class 3", sections: ["A", "B"], students: 90, classTeacher: "Mrs. Gupta" },
  { id: 4, name: "Class 4", sections: ["A", "B"], students: 88, classTeacher: "Mr. Kumar" },
  { id: 5, name: "Class 5", sections: ["A", "B"], students: 92, classTeacher: "Mrs. Patel" },
];

const subjects = [
  { id: 1, name: "Mathematics", code: "MATH", classes: "1-5", type: "Core" },
  { id: 2, name: "English", code: "ENG", classes: "1-5", type: "Core" },
  { id: 3, name: "Hindi", code: "HIN", classes: "1-5", type: "Core" },
  { id: 4, name: "Science", code: "SCI", classes: "3-5", type: "Core" },
  { id: 5, name: "Social Studies", code: "SST", classes: "3-5", type: "Core" },
  { id: 6, name: "Computer", code: "COMP", classes: "1-5", type: "Elective" },
  { id: 7, name: "Art", code: "ART", classes: "1-5", type: "Elective" },
];

const teachers = [
  { id: 1, name: "Mrs. Sharma", subjects: ["Mathematics"], classes: ["1A", "1B", "2A"] },
  { id: 2, name: "Mr. Singh", subjects: ["English", "Hindi"], classes: ["2A", "2B", "2C"] },
  { id: 3, name: "Mrs. Gupta", subjects: ["Science"], classes: ["3A", "3B", "4A"] },
  { id: 4, name: "Mr. Kumar", subjects: ["Social Studies"], classes: ["4A", "4B", "5A"] },
  { id: 5, name: "Mrs. Patel", subjects: ["Computer", "Art"], classes: ["5A", "5B"] },
];

export default function AcademicSetup() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);

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
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
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
            
            <div className="grid gap-4">
              {classes.map((cls) => (
                <Card key={cls.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <BookOpen className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{cls.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Class Teacher: {cls.classTeacher}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-semibold">{cls.sections.length}</p>
                          <p className="text-xs text-muted-foreground">Sections</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-semibold">{cls.students}</p>
                          <p className="text-xs text-muted-foreground">Students</p>
                        </div>
                        <div className="flex gap-2">
                          {cls.sections.map((sec) => (
                            <Badge key={sec} variant="outline">{sec}</Badge>
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
              ))}
            </div>
          </TabsContent>

          {/* Subjects */}
          <TabsContent value="subjects" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">Subjects</h2>
              {isAdmin && (
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subject
                </Button>
              )}
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Classes</TableHead>
                    <TableHead>Type</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>{subject.code}</TableCell>
                      <TableCell>{subject.classes}</TableCell>
                      <TableCell>
                        <Badge variant={subject.type === "Core" ? "default" : "secondary"}>
                          {subject.type}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">Edit</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Teacher Assignments */}
          <TabsContent value="teachers" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">Teacher Assignments</h2>
              {isAdmin && (
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Assign Teacher
                </Button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {teachers.map((teacher) => (
                <Card key={teacher.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-secondary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{teacher.name}</h3>
                        <div className="mt-2 space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Subjects</p>
                            <div className="flex gap-1 flex-wrap">
                              {teacher.subjects.map((sub) => (
                                <Badge key={sub} variant="outline" className="text-xs">{sub}</Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Classes</p>
                            <div className="flex gap-1 flex-wrap">
                              {teacher.classes.map((cls) => (
                                <Badge key={cls} className="text-xs bg-primary/10 text-primary hover:bg-primary/20">{cls}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="sm">
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
