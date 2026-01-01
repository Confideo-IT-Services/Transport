import { useState } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Download, 
  TrendingUp, 
  Users, 
  IndianRupee, 
  ClipboardCheck,
  FileText,
  Send,
  Eye,
  Plus,
  GraduationCap,
  BookOpen,
  Calendar,
  Upload,
  MessageSquare,
  CheckCircle2,
  Clock,
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

// Student data
interface Student {
  id: number;
  name: string;
  rollNo: string;
  parentPhone: string;
  class: string;
}

interface ProgressReport {
  id: number;
  studentId: number;
  term: string;
  uploadDate: string;
  remarks: string;
  sentToParent: boolean;
}

interface Exam {
  id: number;
  name: string;
  type: "unit" | "quarterly" | "half-yearly" | "annual";
  date: string;
  subject: string;
  maxMarks: number;
  results: ExamResult[];
}

interface ExamResult {
  studentId: number;
  marks: number;
  grade: string;
  sentToParent: boolean;
}

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

const initialProgressReports: ProgressReport[] = [
  { id: 1, studentId: 1, term: "Term 1", uploadDate: "2024-04-15", remarks: "Excellent progress in all subjects", sentToParent: true },
  { id: 2, studentId: 2, term: "Term 1", uploadDate: "2024-04-15", remarks: "Good improvement in Mathematics", sentToParent: true },
  { id: 3, studentId: 3, term: "Term 1", uploadDate: "2024-04-16", remarks: "Needs focus on Science concepts", sentToParent: false },
];

const initialExams: Exam[] = [
  {
    id: 1,
    name: "Unit Test 1",
    type: "unit",
    date: "2024-02-15",
    subject: "Mathematics",
    maxMarks: 25,
    results: [
      { studentId: 1, marks: 23, grade: "A+", sentToParent: true },
      { studentId: 2, marks: 20, grade: "A", sentToParent: true },
      { studentId: 3, marks: 18, grade: "B+", sentToParent: false },
      { studentId: 4, marks: 22, grade: "A", sentToParent: false },
    ],
  },
  {
    id: 2,
    name: "Unit Test 2",
    type: "unit",
    date: "2024-03-10",
    subject: "Science",
    maxMarks: 25,
    results: [
      { studentId: 1, marks: 24, grade: "A+", sentToParent: true },
      { studentId: 2, marks: 21, grade: "A", sentToParent: false },
      { studentId: 3, marks: 19, grade: "B+", sentToParent: false },
    ],
  },
  {
    id: 3,
    name: "Half Yearly Exam",
    type: "half-yearly",
    date: "2024-03-25",
    subject: "All Subjects",
    maxMarks: 100,
    results: [
      { studentId: 1, marks: 92, grade: "A+", sentToParent: true },
      { studentId: 2, marks: 85, grade: "A", sentToParent: true },
    ],
  },
  {
    id: 4,
    name: "Annual Exam",
    type: "annual",
    date: "2024-04-20",
    subject: "All Subjects",
    maxMarks: 100,
    results: [],
  },
];

export default function ReportsModule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [activeTab, setActiveTab] = useState("analytics");
  const [selectedClass, setSelectedClass] = useState("Class 5A");
  
  // Progress Reports State
  const [progressReports, setProgressReports] = useState<ProgressReport[]>(initialProgressReports);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState("");
  const [reportTerm, setReportTerm] = useState("");
  const [reportRemarks, setReportRemarks] = useState("");
  const [showAddReport, setShowAddReport] = useState(false);
  
  // Exams State
  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [showAddExam, setShowAddExam] = useState(false);
  const [showAddMarks, setShowAddMarks] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [newExam, setNewExam] = useState({
    name: "",
    type: "unit" as Exam["type"],
    date: "",
    subject: "",
    maxMarks: 25,
  });
  const [studentMarks, setStudentMarks] = useState<{ [key: number]: number }>({});

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

  // Send Progress Report to Parent via WhatsApp
  const sendProgressReportToParent = (report: ProgressReport) => {
    const student = getStudentById(report.studentId);
    if (!student) return;

    const message = encodeURIComponent(
      `📊 *Progress Report - ${report.term}*\n\n` +
      `Student: ${student.name}\n` +
      `Class: ${student.class}\n` +
      `Roll No: ${student.rollNo}\n\n` +
      `📝 *Teacher's Remarks:*\n${report.remarks}\n\n` +
      `Report Date: ${new Date(report.uploadDate).toLocaleDateString()}\n\n` +
      `For detailed report, please visit the school portal.`
    );

    window.open(`https://wa.me/91${student.parentPhone}?text=${message}`, "_blank");
    
    setProgressReports(prev => prev.map(r => 
      r.id === report.id ? { ...r, sentToParent: true } : r
    ));
    
    toast({
      title: "Report Sent",
      description: `Progress report sent to ${student.name}'s parent.`,
    });
  };

  // Send Exam Results to Parent via WhatsApp
  const sendExamResultToParent = (exam: Exam, studentId: number) => {
    const student = getStudentById(studentId);
    const result = exam.results.find(r => r.studentId === studentId);
    if (!student || !result) return;

    const percentage = ((result.marks / exam.maxMarks) * 100).toFixed(1);
    const message = encodeURIComponent(
      `📝 *Exam Result Notification*\n\n` +
      `Exam: ${exam.name}\n` +
      `Subject: ${exam.subject}\n` +
      `Date: ${new Date(exam.date).toLocaleDateString()}\n\n` +
      `Student: ${student.name}\n` +
      `Class: ${student.class}\n\n` +
      `📊 *Result:*\n` +
      `Marks: ${result.marks}/${exam.maxMarks}\n` +
      `Percentage: ${percentage}%\n` +
      `Grade: ${result.grade}\n\n` +
      `Keep encouraging your child! 🌟`
    );

    window.open(`https://wa.me/91${student.parentPhone}?text=${message}`, "_blank");
    
    setExams(prev => prev.map(e => {
      if (e.id === exam.id) {
        return {
          ...e,
          results: e.results.map(r => 
            r.studentId === studentId ? { ...r, sentToParent: true } : r
          )
        };
      }
      return e;
    }));
    
    toast({
      title: "Result Sent",
      description: `Exam result sent to ${student.name}'s parent.`,
    });
  };

  // Send all results for an exam
  const sendAllResultsForExam = (exam: Exam) => {
    exam.results.forEach(result => {
      if (!result.sentToParent) {
        const student = getStudentById(result.studentId);
        if (student) {
          const percentage = ((result.marks / exam.maxMarks) * 100).toFixed(1);
          const message = encodeURIComponent(
            `📝 *Exam Result - ${exam.name}*\n\n` +
            `Student: ${student.name}\n` +
            `Marks: ${result.marks}/${exam.maxMarks} (${percentage}%)\n` +
            `Grade: ${result.grade}`
          );
          // In production, this would be a bulk SMS/WhatsApp API
          console.log(`Sending to ${student.parentPhone}: ${message}`);
        }
      }
    });
    
    setExams(prev => prev.map(e => {
      if (e.id === exam.id) {
        return {
          ...e,
          results: e.results.map(r => ({ ...r, sentToParent: true }))
        };
      }
      return e;
    }));
    
    toast({
      title: "All Results Sent",
      description: `Sent ${exam.name} results to all parents.`,
    });
  };

  // Add new progress report
  const handleAddProgressReport = () => {
    if (!selectedStudentForReport || !reportTerm || !reportRemarks) {
      toast({
        title: "Missing Information",
        description: "Please fill all required fields.",
        variant: "destructive",
      });
      return;
    }

    const newReport: ProgressReport = {
      id: progressReports.length + 1,
      studentId: parseInt(selectedStudentForReport),
      term: reportTerm,
      uploadDate: new Date().toISOString().split("T")[0],
      remarks: reportRemarks,
      sentToParent: false,
    };

    setProgressReports([...progressReports, newReport]);
    setShowAddReport(false);
    setSelectedStudentForReport("");
    setReportTerm("");
    setReportRemarks("");
    
    toast({
      title: "Report Added",
      description: "Progress report has been added successfully.",
    });
  };

  // Add new exam
  const handleAddExam = () => {
    if (!newExam.name || !newExam.date || !newExam.subject) {
      toast({
        title: "Missing Information",
        description: "Please fill all required fields.",
        variant: "destructive",
      });
      return;
    }

    const exam: Exam = {
      id: exams.length + 1,
      ...newExam,
      results: [],
    };

    setExams([...exams, exam]);
    setShowAddExam(false);
    setNewExam({ name: "", type: "unit", date: "", subject: "", maxMarks: 25 });
    
    toast({
      title: "Exam Added",
      description: "New exam has been created successfully.",
    });
  };

  // Add marks for exam
  const handleSaveMarks = () => {
    if (!selectedExam) return;

    const newResults: ExamResult[] = Object.entries(studentMarks).map(([studentId, marks]) => ({
      studentId: parseInt(studentId),
      marks,
      grade: calculateGrade(marks, selectedExam.maxMarks),
      sentToParent: false,
    }));

    setExams(prev => prev.map(e => {
      if (e.id === selectedExam.id) {
        return { ...e, results: [...e.results, ...newResults] };
      }
      return e;
    }));

    setShowAddMarks(false);
    setSelectedExam(null);
    setStudentMarks({});
    
    toast({
      title: "Marks Saved",
      description: "Student marks have been recorded successfully.",
    });
  };

  const getExamTypeColor = (type: Exam["type"]) => {
    switch (type) {
      case "unit": return "bg-blue-100 text-blue-700";
      case "quarterly": return "bg-purple-100 text-purple-700";
      case "half-yearly": return "bg-orange-100 text-orange-700";
      case "annual": return "bg-green-100 text-green-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Manage student reports, exam results, and analytics
            </p>
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
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Progress Reports
            </TabsTrigger>
            <TabsTrigger value="unit-tests" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Unit Tests
            </TabsTrigger>
            <TabsTrigger value="exams" className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Annual Exams
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Summary Stats */}
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

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Attendance Trend</CardTitle>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={attendanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[80, 100]} />
                      <Tooltip 
                        contentStyle={{ 
                          background: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="attendance" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Homework Activity</CardTitle>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={homeworkData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          background: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }} 
                      />
                      <Bar dataKey="assigned" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-muted" />
                      <span className="text-sm text-muted-foreground">Assigned</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-secondary" />
                      <span className="text-sm text-muted-foreground">Completed</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {isAdmin && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Fee Collection</CardTitle>
                      <Button variant="ghost" size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={feeCollectionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            background: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }} 
                          formatter={(value: number) => [`₹${(value/1000).toFixed(0)}K`]}
                        />
                        <Bar dataKey="collected" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="pending" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-secondary" />
                        <span className="text-sm text-muted-foreground">Collected</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-destructive" />
                        <span className="text-sm text-muted-foreground">Pending</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {isAdmin ? "Class-wise Performance" : "Subject Performance"}
                    </CardTitle>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={classPerformance}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {classPerformance.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {classPerformance.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {item.name} ({item.value}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Progress Reports Tab */}
          <TabsContent value="progress" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Student Progress Reports</h2>
                <p className="text-sm text-muted-foreground">Upload and share term-wise progress reports with parents</p>
              </div>
              <Dialog open={showAddReport} onOpenChange={setShowAddReport}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Progress Report
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Progress Report</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Select Student</Label>
                      <Select value={selectedStudentForReport} onValueChange={setSelectedStudentForReport}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a student" />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map((student) => (
                            <SelectItem key={student.id} value={student.id.toString()}>
                              {student.rollNo}. {student.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Term</Label>
                      <Select value={reportTerm} onValueChange={setReportTerm}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select term" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Term 1">Term 1</SelectItem>
                          <SelectItem value="Term 2">Term 2</SelectItem>
                          <SelectItem value="Term 3">Term 3</SelectItem>
                          <SelectItem value="Annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Upload Report (PDF)</Label>
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm font-medium">Click to upload</p>
                        <p className="text-xs text-muted-foreground">PDF files only</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Teacher Remarks</Label>
                      <Textarea 
                        placeholder="Add remarks about student's progress..."
                        value={reportRemarks}
                        onChange={(e) => setReportRemarks(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <Button onClick={handleAddProgressReport} className="w-full">
                      Save Report
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Progress Reports List */}
            <div className="grid gap-4">
              {students.map((student) => {
                const studentReports = progressReports.filter(r => r.studentId === student.id);
                return (
                  <Card key={student.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {student.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-muted-foreground">Roll: {student.rollNo} • {student.class}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {studentReports.length > 0 ? (
                            studentReports.map(report => (
                              <div key={report.id} className="flex items-center gap-2">
                                <Badge variant="outline">{report.term}</Badge>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => sendProgressReportToParent(report)}
                                >
                                  {report.sentToParent ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No reports uploaded</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Unit Tests Tab */}
          <TabsContent value="unit-tests" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Unit Tests</h2>
                <p className="text-sm text-muted-foreground">Manage unit test results and share with parents</p>
              </div>
              <Dialog open={showAddExam} onOpenChange={setShowAddExam}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Unit Test
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Unit Test</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Test Name</Label>
                      <Input 
                        placeholder="e.g., Unit Test 3"
                        value={newExam.name}
                        onChange={(e) => setNewExam({ ...newExam, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Input 
                        placeholder="e.g., Mathematics"
                        value={newExam.subject}
                        onChange={(e) => setNewExam({ ...newExam, subject: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input 
                          type="date"
                          value={newExam.date}
                          onChange={(e) => setNewExam({ ...newExam, date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Marks</Label>
                        <Input 
                          type="number"
                          value={newExam.maxMarks}
                          onChange={(e) => setNewExam({ ...newExam, maxMarks: parseInt(e.target.value) || 25 })}
                        />
                      </div>
                    </div>
                    <Button onClick={() => { setNewExam({ ...newExam, type: "unit" }); handleAddExam(); }} className="w-full">
                      Create Unit Test
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Unit Tests List */}
            <div className="grid gap-4">
              {exams.filter(e => e.type === "unit").map((exam) => (
                <Card key={exam.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{exam.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {exam.subject} • {new Date(exam.date).toLocaleDateString()} • Max: {exam.maxMarks}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{exam.results.length} results</Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => { setSelectedExam(exam); setShowAddMarks(true); }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Marks
                        </Button>
                        {exam.results.length > 0 && (
                          <Button 
                            size="sm"
                            onClick={() => sendAllResultsForExam(exam)}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Send All
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {exam.results.length > 0 && (
                    <CardContent>
                      <div className="space-y-2">
                        {exam.results.map((result) => {
                          const student = getStudentById(result.studentId);
                          if (!student) return null;
                          return (
                            <div key={result.studentId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium">{student.name}</span>
                                <Badge variant="outline">{result.marks}/{exam.maxMarks}</Badge>
                                <Badge className={result.grade.startsWith("A") ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                                  {result.grade}
                                </Badge>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => sendExamResultToParent(exam, result.studentId)}
                              >
                                {result.sentToParent ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Annual Exams Tab */}
          <TabsContent value="exams" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Annual & Term Exams</h2>
                <p className="text-sm text-muted-foreground">Manage quarterly, half-yearly, and annual exam results</p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Exam
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Exam</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Exam Name</Label>
                      <Input 
                        placeholder="e.g., Quarterly Exam 1"
                        value={newExam.name}
                        onChange={(e) => setNewExam({ ...newExam, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Exam Type</Label>
                      <Select 
                        value={newExam.type} 
                        onValueChange={(value: Exam["type"]) => setNewExam({ ...newExam, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="half-yearly">Half Yearly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Input 
                        placeholder="e.g., All Subjects"
                        value={newExam.subject}
                        onChange={(e) => setNewExam({ ...newExam, subject: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input 
                          type="date"
                          value={newExam.date}
                          onChange={(e) => setNewExam({ ...newExam, date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Marks</Label>
                        <Input 
                          type="number"
                          value={newExam.maxMarks}
                          onChange={(e) => setNewExam({ ...newExam, maxMarks: parseInt(e.target.value) || 100 })}
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddExam} className="w-full">
                      Create Exam
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Annual Exams List */}
            <div className="grid gap-4">
              {exams.filter(e => e.type !== "unit").map((exam) => (
                <Card key={exam.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <GraduationCap className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{exam.name}</CardTitle>
                            <Badge className={getExamTypeColor(exam.type)}>
                              {exam.type.replace("-", " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {exam.subject} • {new Date(exam.date).toLocaleDateString()} • Max: {exam.maxMarks}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {exam.results.length === 0 ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        ) : (
                          <Badge variant="outline">{exam.results.length} results</Badge>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => { setSelectedExam(exam); setShowAddMarks(true); }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Marks
                        </Button>
                        {exam.results.length > 0 && (
                          <Button 
                            size="sm"
                            onClick={() => sendAllResultsForExam(exam)}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Send All
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {exam.results.length > 0 && (
                    <CardContent>
                      <div className="space-y-2">
                        {exam.results.map((result) => {
                          const student = getStudentById(result.studentId);
                          if (!student) return null;
                          const percentage = ((result.marks / exam.maxMarks) * 100).toFixed(1);
                          return (
                            <div key={result.studentId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium">{student.name}</span>
                                <Badge variant="outline">{result.marks}/{exam.maxMarks} ({percentage}%)</Badge>
                                <Badge className={result.grade.startsWith("A") ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                                  {result.grade}
                                </Badge>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => sendExamResultToParent(exam, result.studentId)}
                              >
                                {result.sentToParent ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Marks Dialog */}
        <Dialog open={showAddMarks} onOpenChange={setShowAddMarks}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Marks - {selectedExam?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4 max-h-96 overflow-y-auto">
              {students.map((student) => {
                const existingResult = selectedExam?.results.find(r => r.studentId === student.id);
                if (existingResult) return null;
                return (
                  <div key={student.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {student.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{student.name}</p>
                        <p className="text-xs text-muted-foreground">Roll: {student.rollNo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number"
                        placeholder="Marks"
                        className="w-24"
                        max={selectedExam?.maxMarks}
                        min={0}
                        value={studentMarks[student.id] || ""}
                        onChange={(e) => setStudentMarks({ 
                          ...studentMarks, 
                          [student.id]: parseInt(e.target.value) || 0 
                        })}
                      />
                      <span className="text-sm text-muted-foreground">/ {selectedExam?.maxMarks}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button onClick={handleSaveMarks} className="w-full">
              Save Marks
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </UnifiedLayout>
  );
}
