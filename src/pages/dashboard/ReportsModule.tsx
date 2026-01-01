import { useState } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Download, 
  TrendingUp, 
  Users, 
  IndianRupee, 
  ClipboardCheck,
  Send,
  Plus,
  BookOpen,
  CheckCircle2,
  Pencil,
  X,
  Save,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Analytics data
const attendanceData = [
  { month: "Jan", attendance: 92 },
  { month: "Feb", attendance: 88 },
  { month: "Mar", attendance: 95 },
  { month: "Apr", attendance: 91 },
  { month: "May", attendance: 87 },
  { month: "Jun", attendance: 93 },
];

const feeCollectionData = [
  { month: "Jan", collected: 450000, pending: 50000 },
  { month: "Feb", collected: 420000, pending: 80000 },
  { month: "Mar", collected: 480000, pending: 20000 },
  { month: "Apr", collected: 460000, pending: 40000 },
];

const homeworkData = [
  { week: "Week 1", assigned: 25, completed: 22 },
  { week: "Week 2", assigned: 28, completed: 25 },
  { week: "Week 3", assigned: 30, completed: 27 },
  { week: "Week 4", assigned: 24, completed: 23 },
];

const classPerformance = [
  { name: "Class 1", value: 85, color: "hsl(217 91% 60%)" },
  { name: "Class 2", value: 78, color: "hsl(142 71% 45%)" },
  { name: "Class 3", value: 92, color: "hsl(38 92% 50%)" },
  { name: "Class 4", value: 88, color: "hsl(280 70% 50%)" },
  { name: "Class 5", value: 82, color: "hsl(0 84% 60%)" },
];

// Interfaces
interface Student {
  id: number;
  name: string;
  rollNo: string;
  parentPhone: string;
  class: string;
}

interface Subject {
  id: number;
  name: string;
  maxMarks: number;
}

interface SubjectResult {
  subjectId: number;
  subjectName: string;
  marks: number;
  maxMarks: number;
  grade: string;
}

interface UnitTestResult {
  studentId: number;
  subjects: SubjectResult[];
  totalMarks: number;
  totalMaxMarks: number;
  percentage: number;
  overallGrade: string;
  sentToParent: boolean;
}

interface UnitTest {
  id: number;
  name: string;
  date: string;
  subjects: Subject[];
  results: UnitTestResult[];
}

// Initial Data
const initialStudents: Student[] = [
  { id: 1, name: "Alex Johnson", rollNo: "01", parentPhone: "9876543210", class: "Class 5A" },
  { id: 2, name: "Emma Williams", rollNo: "02", parentPhone: "9876543211", class: "Class 5A" },
  { id: 3, name: "Noah Brown", rollNo: "03", parentPhone: "9876543212", class: "Class 5A" },
  { id: 4, name: "Olivia Davis", rollNo: "04", parentPhone: "9876543213", class: "Class 5A" },
  { id: 5, name: "Liam Wilson", rollNo: "05", parentPhone: "9876543214", class: "Class 5A" },
  { id: 6, name: "Sophia Martinez", rollNo: "06", parentPhone: "9876543215", class: "Class 5A" },
  { id: 7, name: "Mason Anderson", rollNo: "07", parentPhone: "9876543216", class: "Class 5A" },
  { id: 8, name: "Isabella Taylor", rollNo: "08", parentPhone: "9876543217", class: "Class 5A" },
];

const defaultSubjects: Subject[] = [
  { id: 1, name: "Mathematics", maxMarks: 25 },
  { id: 2, name: "Science", maxMarks: 25 },
  { id: 3, name: "English", maxMarks: 25 },
  { id: 4, name: "Hindi", maxMarks: 25 },
  { id: 5, name: "Social Studies", maxMarks: 25 },
];

const initialUnitTests: UnitTest[] = [
  {
    id: 1,
    name: "Unit Test 1",
    date: "2024-02-15",
    subjects: [
      { id: 1, name: "Mathematics", maxMarks: 25 },
      { id: 2, name: "Science", maxMarks: 25 },
      { id: 3, name: "English", maxMarks: 25 },
    ],
    results: [
      {
        studentId: 1,
        subjects: [
          { subjectId: 1, subjectName: "Mathematics", marks: 23, maxMarks: 25, grade: "A+" },
          { subjectId: 2, subjectName: "Science", marks: 22, maxMarks: 25, grade: "A" },
          { subjectId: 3, subjectName: "English", marks: 24, maxMarks: 25, grade: "A+" },
        ],
        totalMarks: 69,
        totalMaxMarks: 75,
        percentage: 92,
        overallGrade: "A+",
        sentToParent: true,
      },
      {
        studentId: 2,
        subjects: [
          { subjectId: 1, subjectName: "Mathematics", marks: 20, maxMarks: 25, grade: "A" },
          { subjectId: 2, subjectName: "Science", marks: 18, maxMarks: 25, grade: "B+" },
          { subjectId: 3, subjectName: "English", marks: 21, maxMarks: 25, grade: "A" },
        ],
        totalMarks: 59,
        totalMaxMarks: 75,
        percentage: 78.7,
        overallGrade: "B+",
        sentToParent: false,
      },
    ],
  },
];

export default function ReportsModule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState("analytics");
  const [selectedClass, setSelectedClass] = useState("Class 5A");
  
  // Available Subjects
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>(defaultSubjects);
  const [newSubjectName, setNewSubjectName] = useState("");
  
  // Unit Tests State
  const [unitTests, setUnitTests] = useState<UnitTest[]>(initialUnitTests);
  const [showAddUnitTest, setShowAddUnitTest] = useState(false);
  const [showAddMarks, setShowAddMarks] = useState(false);
  const [selectedUnitTest, setSelectedUnitTest] = useState<UnitTest | null>(null);
  const [editingTestId, setEditingTestId] = useState<number | null>(null);
  const [editingTestName, setEditingTestName] = useState("");
  const [newUnitTest, setNewUnitTest] = useState({
    name: "",
    date: "",
    selectedSubjects: [] as number[],
  });
  const [studentSubjectMarks, setStudentSubjectMarks] = useState<{ [studentId: number]: { [subjectId: number]: number } }>({});

  const students = initialStudents;

  const getStudentById = (id: number) => students.find(s => s.id === id);

  const calculateGrade = (marks: number, maxMarks: number): string => {
    const percentage = (marks / maxMarks) * 100;
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B+";
    if (percentage >= 60) return "B";
    if (percentage >= 50) return "C";
    if (percentage >= 40) return "D";
    return "F";
  };

  // Add new subject to available subjects
  const handleAddSubject = () => {
    if (!newSubjectName.trim()) return;
    const newSubject: Subject = {
      id: availableSubjects.length + 1,
      name: newSubjectName.trim(),
      maxMarks: 25,
    };
    setAvailableSubjects([...availableSubjects, newSubject]);
    setNewSubjectName("");
    toast({ title: "Subject Added", description: `${newSubjectName} has been added.` });
  };

  // Toggle subject selection for unit test
  const toggleSubjectSelection = (subjectId: number) => {
    setNewUnitTest(prev => ({
      ...prev,
      selectedSubjects: prev.selectedSubjects.includes(subjectId)
        ? prev.selectedSubjects.filter(id => id !== subjectId)
        : [...prev.selectedSubjects, subjectId]
    }));
  };

  // Create new unit test
  const handleCreateUnitTest = () => {
    if (!newUnitTest.name || !newUnitTest.date || newUnitTest.selectedSubjects.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill name, date and select at least one subject.",
        variant: "destructive",
      });
      return;
    }

    const selectedSubjectDetails = availableSubjects.filter(s => 
      newUnitTest.selectedSubjects.includes(s.id)
    );

    const unitTest: UnitTest = {
      id: unitTests.length + 1,
      name: newUnitTest.name,
      date: newUnitTest.date,
      subjects: selectedSubjectDetails,
      results: [],
    };

    setUnitTests([...unitTests, unitTest]);
    setShowAddUnitTest(false);
    setNewUnitTest({ name: "", date: "", selectedSubjects: [] });
    toast({ title: "Unit Test Created", description: `${unitTest.name} has been created.` });
  };

  // Rename unit test
  const handleRenameUnitTest = (testId: number) => {
    if (!editingTestName.trim()) return;
    setUnitTests(prev => prev.map(t => 
      t.id === testId ? { ...t, name: editingTestName.trim() } : t
    ));
    setEditingTestId(null);
    setEditingTestName("");
    toast({ title: "Renamed", description: "Unit test has been renamed." });
  };

  // Add subject to existing unit test
  const handleAddSubjectToTest = (testId: number, subjectId: number) => {
    const subject = availableSubjects.find(s => s.id === subjectId);
    if (!subject) return;

    setUnitTests(prev => prev.map(t => {
      if (t.id === testId && !t.subjects.find(s => s.id === subjectId)) {
        return { ...t, subjects: [...t.subjects, subject] };
      }
      return t;
    }));
    toast({ title: "Subject Added", description: `${subject.name} added to the test.` });
  };

  // Save marks for unit test
  const handleSaveUnitTestMarks = () => {
    if (!selectedUnitTest) return;

    const newResults: UnitTestResult[] = Object.entries(studentSubjectMarks).map(([studentIdStr, subjectMarks]) => {
      const studentId = parseInt(studentIdStr);
      const subjectResults: SubjectResult[] = selectedUnitTest.subjects.map(subject => {
        const marks = subjectMarks[subject.id] || 0;
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          marks,
          maxMarks: subject.maxMarks,
          grade: calculateGrade(marks, subject.maxMarks),
        };
      });

      const totalMarks = subjectResults.reduce((sum, s) => sum + s.marks, 0);
      const totalMaxMarks = subjectResults.reduce((sum, s) => sum + s.maxMarks, 0);
      const percentage = (totalMarks / totalMaxMarks) * 100;

      return {
        studentId,
        subjects: subjectResults,
        totalMarks,
        totalMaxMarks,
        percentage,
        overallGrade: calculateGrade(totalMarks, totalMaxMarks),
        sentToParent: false,
      };
    });

    setUnitTests(prev => prev.map(t => {
      if (t.id === selectedUnitTest.id) {
        const existingStudentIds = t.results.map(r => r.studentId);
        const filteredNewResults = newResults.filter(r => !existingStudentIds.includes(r.studentId));
        return { ...t, results: [...t.results, ...filteredNewResults] };
      }
      return t;
    }));

    setShowAddMarks(false);
    setSelectedUnitTest(null);
    setStudentSubjectMarks({});
    toast({ title: "Marks Saved", description: "Student marks have been recorded." });
  };

  // Send Unit Test result to parent
  const sendUnitTestResultToParent = (test: UnitTest, studentId: number) => {
    const student = getStudentById(studentId);
    const result = test.results.find(r => r.studentId === studentId);
    if (!student || !result) return;

    const subjectDetails = result.subjects.map(s => 
      `${s.subjectName}: ${s.marks}/${s.maxMarks} (${s.grade})`
    ).join("\n");

    const message = encodeURIComponent(
      `📝 *${test.name} Results*\n\n` +
      `Student: ${student.name}\n` +
      `Class: ${student.class}\n` +
      `Date: ${new Date(test.date).toLocaleDateString()}\n\n` +
      `📊 *Subject-wise Results:*\n${subjectDetails}\n\n` +
      `*Total: ${result.totalMarks}/${result.totalMaxMarks} (${result.percentage.toFixed(1)}%)*\n` +
      `*Overall Grade: ${result.overallGrade}*\n\n` +
      `Keep encouraging your child! 🌟`
    );

    window.open(`https://wa.me/91${student.parentPhone}?text=${message}`, "_blank");
    
    setUnitTests(prev => prev.map(t => {
      if (t.id === test.id) {
        return {
          ...t,
          results: t.results.map(r => 
            r.studentId === studentId ? { ...r, sentToParent: true } : r
          )
        };
      }
      return t;
    }));
    
    toast({ title: "Result Sent", description: `Result sent to ${student.name}'s parent.` });
  };

  // Send all unit test results
  const sendAllUnitTestResults = (test: UnitTest) => {
    test.results.forEach(result => {
      if (!result.sentToParent) {
        sendUnitTestResultToParent(test, result.studentId);
      }
    });
    toast({ title: "All Results Sent", description: `Sent ${test.name} results to all parents.` });
  };

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-1">Manage student reports, exam results, and analytics</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Class 5A">Class 5A</SelectItem>
                <SelectItem value="Class 5B">Class 5B</SelectItem>
                <SelectItem value="Class 6A">Class 6A</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export All
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="unit-tests" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Unit Tests
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ClipboardCheck className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">91.2%</p>
                      <p className="text-sm text-muted-foreground">Avg Attendance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {isAdmin && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                        <IndianRupee className="w-6 h-6 text-secondary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">₹18.1L</p>
                        <p className="text-sm text-muted-foreground">Fee Collected</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">87%</p>
                      <p className="text-sm text-muted-foreground">HW Completion</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{isAdmin ? "524" : "42"}</p>
                      <p className="text-sm text-muted-foreground">{isAdmin ? "Total Students" : "My Students"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Attendance Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={attendanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[80, 100]} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Line type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Homework Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={homeworkData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Bar dataKey="assigned" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Fee Collection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={feeCollectionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(value: number) => [`₹${(value/1000).toFixed(0)}K`]} />
                        <Bar dataKey="collected" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="pending" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{isAdmin ? "Class-wise Performance" : "Subject Performance"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={classPerformance} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {classPerformance.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {classPerformance.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-muted-foreground">{item.name} ({item.value}%)</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Unit Tests Tab */}
          <TabsContent value="unit-tests" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Unit Tests</h2>
                <p className="text-sm text-muted-foreground">Create unit tests with multiple subjects, add marks, and send to parents</p>
              </div>
              <Dialog open={showAddUnitTest} onOpenChange={setShowAddUnitTest}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" />Create Unit Test</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create New Unit Test</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Test Name</Label>
                      <Input placeholder="e.g., Unit Test 2" value={newUnitTest.name} onChange={(e) => setNewUnitTest({ ...newUnitTest, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={newUnitTest.date} onChange={(e) => setNewUnitTest({ ...newUnitTest, date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Select Subjects</Label>
                      <div className="flex flex-wrap gap-2">
                        {availableSubjects.map(subject => (
                          <Badge
                            key={subject.id}
                            variant={newUnitTest.selectedSubjects.includes(subject.id) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleSubjectSelection(subject.id)}
                          >
                            {subject.name}
                            {newUnitTest.selectedSubjects.includes(subject.id) && <CheckCircle2 className="w-3 h-3 ml-1" />}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Add New Subject</Label>
                      <div className="flex gap-2">
                        <Input placeholder="Subject name" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} />
                        <Button variant="outline" onClick={handleAddSubject}><Plus className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <Button onClick={handleCreateUnitTest} className="w-full">Create Unit Test</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Unit Tests List */}
            <div className="grid gap-4">
              {unitTests.map((test) => (
                <Card key={test.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          {editingTestId === test.id ? (
                            <div className="flex items-center gap-2">
                              <Input value={editingTestName} onChange={(e) => setEditingTestName(e.target.value)} className="h-8 w-40" />
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRenameUnitTest(test.id)}><Save className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingTestId(null)}><X className="w-4 h-4" /></Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base">{test.name}</CardTitle>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingTestId(test.id); setEditingTestName(test.name); }}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground">{new Date(test.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{test.results.length} students</Badge>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedUnitTest(test); setShowAddMarks(true); }}>
                          <Plus className="w-4 h-4 mr-1" />Add Marks
                        </Button>
                        {test.results.length > 0 && (
                          <Button size="sm" onClick={() => sendAllUnitTestResults(test)}><Send className="w-4 h-4 mr-1" />Send All</Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Subjects */}
                    <div className="mb-4">
                      <Label className="text-sm text-muted-foreground mb-2 block">Subjects:</Label>
                      <div className="flex flex-wrap gap-2">
                        {test.subjects.map(subject => (
                          <Badge key={subject.id} variant="secondary">{subject.name} ({subject.maxMarks})</Badge>
                        ))}
                        <Select onValueChange={(value) => handleAddSubjectToTest(test.id, parseInt(value))}>
                          <SelectTrigger className="w-32 h-7"><SelectValue placeholder="+ Add" /></SelectTrigger>
                          <SelectContent>
                            {availableSubjects.filter(s => !test.subjects.find(ts => ts.id === s.id)).map(subject => (
                              <SelectItem key={subject.id} value={subject.id.toString()}>{subject.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Results Table */}
                    {test.results.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              {test.subjects.map(s => (<TableHead key={s.id} className="text-center">{s.name}</TableHead>))}
                              <TableHead className="text-center">Total</TableHead>
                              <TableHead className="text-center">Grade</TableHead>
                              <TableHead className="text-center">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {test.results.map(result => {
                              const student = getStudentById(result.studentId);
                              if (!student) return null;
                              return (
                                <TableRow key={result.studentId}>
                                  <TableCell className="font-medium">{student.name}</TableCell>
                                  {test.subjects.map(s => {
                                    const subRes = result.subjects.find(sr => sr.subjectId === s.id);
                                    return (<TableCell key={s.id} className="text-center">{subRes ? `${subRes.marks}/${subRes.maxMarks}` : "-"}</TableCell>);
                                  })}
                                  <TableCell className="text-center font-medium">{result.totalMarks}/{result.totalMaxMarks} ({result.percentage.toFixed(1)}%)</TableCell>
                                  <TableCell className="text-center">
                                    <Badge className={result.overallGrade.startsWith("A") ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>{result.overallGrade}</Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Button variant="ghost" size="sm" onClick={() => sendUnitTestResultToParent(test, result.studentId)}>
                                      {result.sentToParent ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Send className="w-4 h-4" />}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Marks Dialog for Unit Tests */}
        <Dialog open={showAddMarks} onOpenChange={setShowAddMarks}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Marks - {selectedUnitTest?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      {selectedUnitTest?.subjects.map(s => (
                        <TableHead key={s.id} className="text-center">{s.name} (Max: {s.maxMarks})</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.filter(s => !selectedUnitTest?.results.find(r => r.studentId === s.id)).map(student => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.rollNo}. {student.name}</TableCell>
                        {selectedUnitTest?.subjects.map(subject => (
                          <TableCell key={subject.id} className="text-center">
                            <Input
                              type="number"
                              className="w-16 mx-auto text-center"
                              min={0}
                              max={subject.maxMarks}
                              value={studentSubjectMarks[student.id]?.[subject.id] || ""}
                              onChange={(e) => {
                                const marks = parseInt(e.target.value) || 0;
                                setStudentSubjectMarks(prev => ({
                                  ...prev,
                                  [student.id]: { ...(prev[student.id] || {}), [subject.id]: marks }
                                }));
                              }}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button onClick={handleSaveUnitTestMarks} className="w-full">Save Marks</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </UnifiedLayout>
  );
}
