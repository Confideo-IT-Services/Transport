import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ChevronDown,
  FileText,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { attendanceApi, homeworkApi, studentsApi, classesApi, testsApi, timetableApi } from "@/lib/api";

// Interfaces
interface Student {
  id: string | number;
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

// Default subjects for unit tests (can be customized by teachers)
const defaultSubjects: Subject[] = [
  { id: 1, name: "Mathematics", maxMarks: 25 },
  { id: 2, name: "Science", maxMarks: 25 },
  { id: 3, name: "English", maxMarks: 25 },
  { id: 4, name: "Hindi", maxMarks: 25 },
  { id: 5, name: "Social Studies", maxMarks: 25 },
];

export default function ReportsModule() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const lastPathnameRef = useRef<string>("");
  const [activeTab, setActiveTab] = useState(isAdmin ? "analytics" : "tests");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  
  // Analytics state
  const [avgAttendance, setAvgAttendance] = useState<number>(0);
  const [hwCompletion, setHwCompletion] = useState<number>(0);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [feeCollected, setFeeCollected] = useState<number>(0);
  const [attendanceTrend, setAttendanceTrend] = useState<any[]>([]);
  const [homeworkActivity, setHomeworkActivity] = useState<any[]>([]);
  const [classPerformance, setClassPerformance] = useState<any[]>([]);
  const [feeCollectionData, setFeeCollectionData] = useState<any[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  
  // Classes and students
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Available Subjects (from database)
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);
  const [newSubjectName, setNewSubjectName] = useState("");

  // Tests State (from database)
  const [tests, setTests] = useState<any[]>([]);
  const [selectedTest, setSelectedTest] = useState<any | null>(null);
  const [testDetails, setTestDetails] = useState<any | null>(null);
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [showAddMarks, setShowAddMarks] = useState(false);
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  
  // Create Test Form State
  const [newTest, setNewTest] = useState({
    name: "",
    testTime: "",
    subjects: [] as Array<{ subjectId: string; maxMarks: number; syllabus: string }>,
  });
  
  // Add Marks State
  const [studentSubjectMarks, setStudentSubjectMarks] = useState<{ [studentId: string]: { [subjectId: string]: number } }>({});
  const [testResults, setTestResults] = useState<any[]>([]);

  const getStudentById = (id: string | number) => students.find(s => s.id === id || String(s.id) === String(id));

  // Load classes
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const classesData = await classesApi.getAll();
        setClasses(classesData || []);
        if (classesData && classesData.length > 0) {
          if (!isAdmin) {
            // For teachers, find their assigned class
            const assignedClass = classesData.find((c: any) => 
              c.class_teacher_id === user?.id
            );
            if (assignedClass) {
              setSelectedClass(`${assignedClass.name}${assignedClass.section ? ` - Section ${assignedClass.section}` : ''}`);
              setSelectedClassId(assignedClass.id);
            }
          } else {
            setSelectedClass(`${classesData[0].name}${classesData[0].section ? ` - Section ${classesData[0].section}` : ''}`);
            setSelectedClassId(classesData[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading classes:', error);
        toast({
          title: "Error",
          description: "Failed to load classes",
          variant: "destructive"
        });
      }
    };
    loadClasses();
  }, [isAdmin, user, location.pathname]);

  // Load students
  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedClassId) {
        setStudents([]);
        return;
      }
      try {
        const studentsData = await studentsApi.getByClass(selectedClassId);
        const transformed = (studentsData || []).map((s: any, index: number) => ({
          id: s.id, // Keep UUID as string
          name: s.name,
          rollNo: s.rollNo || s.roll_no || String(index + 1).padStart(2, '0'),
          parentPhone: s.parentPhone || s.parent_phone || '',
          class: selectedClass
        }));
        setStudents(transformed);
        setTotalStudents(transformed.length);
      } catch (error) {
        console.error('Error loading students:', error);
        setStudents([]);
      }
    };
    loadStudents();
  }, [selectedClassId, selectedClass]);

  // Load subjects from database
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const subjectsData = await timetableApi.getSubjects();
        setAvailableSubjects(subjectsData || []);
      } catch (error) {
        console.error('Error loading subjects:', error);
        setAvailableSubjects([]);
      }
    };
    loadSubjects();
  }, []);

  // Load tests from database
  useEffect(() => {
    const loadTests = async () => {
      if (!selectedClassId) {
        setTests([]);
        return;
      }
      setIsLoadingTests(true);
      try {
        const testsData = await testsApi.getAll();
        // Filter tests for selected class
        const filteredTests = testsData.filter((t: any) => t.classId === selectedClassId);
        setTests(filteredTests);
      } catch (error) {
        console.error('Error loading tests:', error);
        setTests([]);
        toast({
          title: "Error",
          description: "Failed to load tests",
          variant: "destructive"
        });
      } finally {
        setIsLoadingTests(false);
      }
    };
    loadTests();
  }, [selectedClassId, location.pathname]);

  // Load analytics data
  useEffect(() => {
    // Track navigation to force reload when coming to this page
    const isNavigatingToPage = lastPathnameRef.current !== location.pathname;
    if (isNavigatingToPage) {
      lastPathnameRef.current = location.pathname;
    }
    
    const loadAnalytics = async () => {
      // Wait for classes to load if admin, or wait for selectedClassId if teacher
      if (isAdmin && classes.length === 0) {
        // For admin, wait for classes to load - will retry when classes are set
        return;
      }
      if (!isAdmin && !selectedClassId) {
        // For teacher, need selectedClassId - will retry when selectedClassId is set
        return;
      }
      
      setIsLoadingAnalytics(true);
      try {
        // Load attendance statistics
        if (selectedClassId) {
          // First, try to get today's attendance for average calculation
          // Formula: (present students / total students) * 100
          try {
            const today = new Date().toISOString().split('T')[0];
            const todayAttendance = await attendanceApi.getStudentAttendance(selectedClassId, today);
            
            if (todayAttendance && todayAttendance.students) {
              const totalStudents = todayAttendance.students.length;
              const presentStudents = todayAttendance.students.filter((s: any) => s.status === 'present').length;
              
              if (totalStudents > 0) {
                const avgPct = (presentStudents / totalStudents) * 100;
                setAvgAttendance(avgPct);
              } else {
                setAvgAttendance(0);
              }
            } else {
              // If no today's attendance, try monthly stats
              const currentDate = new Date();
              const currentYear = currentDate.getFullYear().toString();
              const monthlyStats = await attendanceApi.getMonthlyStats(
                selectedClassId,
                undefined,
                currentYear
              );
              
              if (monthlyStats && monthlyStats.length > 0) {
                // Calculate average attendance from monthly stats
                const attendancePercentages = monthlyStats.map((stat: any) => {
                  const total = (stat.present || 0) + (stat.absent || 0) + (stat.leave || 0);
                  return total > 0 ? ((stat.present || 0) / total) * 100 : 0;
                });
                
                const totalAttendance = attendancePercentages.reduce((sum: number, pct: number) => sum + pct, 0);
                const avg = attendancePercentages.length > 0 ? totalAttendance / attendancePercentages.length : 0;
                setAvgAttendance(avg);
              } else {
                setAvgAttendance(0);
              }
            }
          } catch (todayError) {
            console.error('Error loading today\'s attendance:', todayError);
            // Fallback to monthly stats
            try {
              const currentDate = new Date();
              const currentYear = currentDate.getFullYear().toString();
              const monthlyStats = await attendanceApi.getMonthlyStats(
                selectedClassId,
                undefined,
                currentYear
              );
              
              if (monthlyStats && monthlyStats.length > 0) {
                const attendancePercentages = monthlyStats.map((stat: any) => {
                  const total = (stat.present || 0) + (stat.absent || 0) + (stat.leave || 0);
                  return total > 0 ? ((stat.present || 0) / total) * 100 : 0;
                });
                
                const totalAttendance = attendancePercentages.reduce((sum: number, pct: number) => sum + pct, 0);
                const avg = attendancePercentages.length > 0 ? totalAttendance / attendancePercentages.length : 0;
                setAvgAttendance(avg);
              } else {
                setAvgAttendance(0);
              }
            } catch (statsError) {
              console.error('Error loading monthly stats:', statsError);
              setAvgAttendance(0);
            }
          }
          
          // Load attendance trend data (for chart)
          try {
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear().toString();
            const monthlyStats = await attendanceApi.getMonthlyStats(
              selectedClassId,
              undefined,
              currentYear
            );
            
            if (monthlyStats && monthlyStats.length > 0) {
              // Format attendance trend data (last 6 months)
              const trendData = monthlyStats.slice(-6).map((stat: any) => {
                const total = (stat.present || 0) + (stat.absent || 0) + (stat.leave || 0);
                const attendancePct = total > 0 ? ((stat.present || 0) / total) * 100 : 0;
                
                // Parse month string "2024-01" to Date
                const monthDate = new Date(stat.month + '-01');
                return {
                  month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
                  attendance: attendancePct
                };
              });
              setAttendanceTrend(trendData.length > 0 ? trendData : []);
            } else {
              // If no monthly stats, try to calculate from attendance history
              try {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                const attendanceHistory = await attendanceApi.getStudentAttendanceHistory(
                  selectedClassId,
                  sixMonthsAgo.toISOString().split('T')[0],
                  new Date().toISOString().split('T')[0]
                );
                
                if (attendanceHistory && attendanceHistory.length > 0) {
                  // Group by month and calculate percentages
                  const monthlyMap = new Map<string, { present: number; total: number }>();
                  attendanceHistory.forEach((record: any) => {
                    const date = new Date(record.date);
                    const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    if (!monthlyMap.has(monthKey)) {
                      monthlyMap.set(monthKey, { present: 0, total: 0 });
                    }
                    const monthData = monthlyMap.get(monthKey)!;
                    const students = record.students || [];
                    monthData.total += students.length;
                    monthData.present += students.filter((s: any) => s.status === 'present').length;
                  });
                  
                  const trendData = Array.from(monthlyMap.entries()).map(([month, data]) => ({
                    month,
                    attendance: data.total > 0 ? (data.present / data.total) * 100 : 0
                  }));
                  setAttendanceTrend(trendData);
                } else {
                  setAttendanceTrend([]);
                }
              } catch (historyError) {
                console.error('Error loading attendance history:', historyError);
                setAttendanceTrend([]);
              }
            }
          } catch (trendError) {
            console.error('Error loading attendance trend:', trendError);
            setAttendanceTrend([]);
          }
        }
        
        // Load homework data
        try {
          const homeworkData = await homeworkApi.getAll();
          const filteredHomework = selectedClassId 
            ? homeworkData.filter((h: any) => h.classId === selectedClassId)
            : homeworkData;
          
          // Calculate homework completion based on student completions
          let totalCompletions = 0;
          let totalPossible = 0;
          
          for (const hw of filteredHomework) {
            try {
              const completions = await homeworkApi.getCompletions(hw.id);
              const students = await studentsApi.getByClass(hw.classId);
              const studentCount = students.length;
              
              totalPossible += studentCount;
              totalCompletions += completions.filter((c: any) => c.completed).length;
            } catch (error) {
              console.error(`Error loading completions for homework ${hw.id}:`, error);
              // If we can't load completions, skip this homework in the calculation
            }
          }
          
          const completionRate = totalPossible > 0 ? (totalCompletions / totalPossible) * 100 : 0;
          setHwCompletion(completionRate);
          
          // Calculate weekly homework activity (last 4 weeks)
          const fourWeeksAgo = new Date();
          fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
          
          const weeklyData = [];
          for (let i = 0; i < 4; i++) {
            const weekStart = new Date(fourWeeksAgo);
            weekStart.setDate(weekStart.getDate() + (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            const weekHomework = filteredHomework.filter((h: any) => {
              const createdDate = new Date(h.createdAt || h.created_at);
              return createdDate >= weekStart && createdDate <= weekEnd;
            });
            
            // Calculate actual student completions for this week
            let weekCompletions = 0;
            let weekTotal = 0;
            for (const hw of weekHomework) {
              try {
                const completions = await homeworkApi.getCompletions(hw.id);
                const students = await studentsApi.getByClass(hw.classId);
                weekTotal += students.length;
                weekCompletions += completions.filter((c: any) => c.completed).length;
              } catch (error) {
                console.error(`Error loading completions for homework ${hw.id}:`, error);
              }
            }
            
            weeklyData.push({
              week: `Week ${i + 1}`,
              assigned: weekHomework.length,
              completed: weekCompletions
            });
          }
          setHomeworkActivity(weeklyData);
          
          // Calculate class/subject performance (for pie chart)
          if (isAdmin && classes.length > 0) {
            const performanceData = await Promise.all(
              classes.map(async (cls: any) => {
                const classHomework = homeworkData.filter((h: any) => h.classId === cls.id);
                let classTotalCompletions = 0;
                let classTotalPossible = 0;
                
                for (const hw of classHomework) {
                  try {
                    const completions = await homeworkApi.getCompletions(hw.id);
                    const students = await studentsApi.getByClass(cls.id);
                    classTotalPossible += students.length;
                    classTotalCompletions += completions.filter((c: any) => c.completed).length;
                  } catch (error) {
                    console.error(`Error loading completions for homework ${hw.id}:`, error);
                  }
                }
                
                const performance = classTotalPossible > 0 
                  ? (classTotalCompletions / classTotalPossible) * 100 
                  : 0;
                
                const colors = [
                  "hsl(217 91% 60%)",
                  "hsl(142 71% 45%)",
                  "hsl(38 92% 50%)",
                  "hsl(280 70% 50%)",
                  "hsl(0 84% 60%)"
                ];
                
                return {
                  name: `${cls.name}${cls.section ? ` ${cls.section}` : ''}`,
                  value: Math.round(performance),
                  color: colors[classes.indexOf(cls) % colors.length]
                };
              })
            );
            setClassPerformance(performanceData);
          } else if (!isAdmin && selectedClassId) {
            // For teachers, show subject performance
            const subjectStats: Record<string, { total: number; completed: number }> = {};
            filteredHomework.forEach((h: any) => {
              const subject = h.subject || 'Other';
              if (!subjectStats[subject]) {
                subjectStats[subject] = { total: 0, completed: 0 };
              }
              subjectStats[subject].total++;
              if (h.status === 'completed') {
                subjectStats[subject].completed++;
              }
            });
            
            const colors = [
              "hsl(217 91% 60%)",
              "hsl(142 71% 45%)",
              "hsl(38 92% 50%)",
              "hsl(280 70% 50%)",
              "hsl(0 84% 60%)"
            ];
            
            const performanceData = Object.entries(subjectStats).map(([name, stats], index) => ({
              name,
              value: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
              color: colors[index % colors.length]
            }));
            setClassPerformance(performanceData);
          }
        } catch (homeworkError) {
          console.error('Error loading homework data:', homeworkError);
          setHwCompletion(0);
          setHomeworkActivity([]);
          setClassPerformance([]);
        }
        
        // Load total students count
        if (isAdmin) {
          try {
            const allStudents = await studentsApi.getAll();
            setTotalStudents(allStudents.filter((s: any) => s.status === 'approved').length);
          } catch (error) {
            console.error('Error loading students count:', error);
          }
        }
        
      } catch (error) {
        console.error('Error loading analytics:', error);
        toast({
          title: "Error",
          description: "Failed to load analytics data",
          variant: "destructive"
        });
      } finally {
        setIsLoadingAnalytics(false);
      }
    };
    
    // Always try to load analytics when component mounts or pathname changes
    // The function will return early if conditions aren't met, but it will try
    loadAnalytics();
    
    // If conditions aren't met, set up a small retry after classes/selectedClassId are set
    if ((isAdmin && classes.length === 0) || (!isAdmin && !selectedClassId)) {
      // Retry after a short delay to allow classes/selectedClassId to load
      const retryTimer = setTimeout(() => {
        loadAnalytics();
      }, 500);
      return () => clearTimeout(retryTimer);
    }
  }, [selectedClassId, isAdmin, classes, location.pathname]);

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

  // Component to display test results in Student Reports tab
  const TestResultsView = ({ testId, testName }: { testId: string; testName: string }) => {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [testDetails, setTestDetails] = useState<any>(null);

    useEffect(() => {
      const loadResults = async () => {
        setLoading(true);
        try {
          const [detailsData, resultsData] = await Promise.all([
            testsApi.getById(testId),
            testsApi.getResults(testId)
          ]);
          setTestDetails(detailsData);
          setResults(resultsData);
        } catch (error) {
          console.error('Error loading test results:', error);
        } finally {
          setLoading(false);
        }
      };
      loadResults();
    }, [testId]);

    if (loading) {
      return <div className="text-center py-4 text-muted-foreground text-sm">Loading results...</div>;
    }

    if (results.length === 0) {
      return <div className="text-center py-4 text-muted-foreground text-sm">No marks added yet.</div>;
    }

    return (
      <div className="mt-4">
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                {testDetails?.subjects?.map((s: any) => (
                  <TableHead key={s.subjectId} className="text-center">{s.subjectName}</TableHead>
                ))}
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Grade</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result: any) => {
                const totalMarks = result.subjects.reduce((sum: number, s: any) => sum + s.marksObtained, 0);
                const totalMaxMarks = result.subjects.reduce((sum: number, s: any) => sum + s.maxMarks, 0);
                const percentage = (totalMarks / totalMaxMarks) * 100;
                const overallGrade = calculateGrade(totalMarks, totalMaxMarks);

                return (
                  <TableRow key={result.studentId}>
                    <TableCell className="font-medium">{result.rollNo}. {result.studentName}</TableCell>
                    {testDetails?.subjects?.map((subject: any) => {
                      const subjectResult = result.subjects.find((s: any) => s.subjectId === subject.subjectId);
                      return (
                        <TableCell key={subject.subjectId} className="text-center">
                          {subjectResult ? `${subjectResult.marksObtained}/${subjectResult.maxMarks}` : "-"}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-medium">
                      {totalMarks}/{totalMaxMarks} ({percentage.toFixed(1)}%)
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={overallGrade.startsWith("A") ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                        {overallGrade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          const test = { ...testDetails, name: testName };
                          sendTestResultToParent(test, result);
                        }}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // Load test details
  const loadTestDetails = async (testId: string) => {
    try {
      const details = await testsApi.getById(testId);
      setTestDetails(details);
      setSelectedTest(details);
    } catch (error) {
      console.error('Error loading test details:', error);
      toast({
        title: "Error",
        description: "Failed to load test details",
        variant: "destructive"
      });
    }
  };

  // Create new test
  const handleCreateTest = async () => {
    if (!newTest.name || !newTest.testTime || !selectedClassId || newTest.subjects.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill test name, test time, and add at least one subject.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await testsApi.create({
        name: newTest.name,
        testTime: newTest.testTime,
        classId: selectedClassId,
        subjects: newTest.subjects
      });

      toast({ title: "Test Created", description: `${newTest.name} has been created successfully.` });
      setShowCreateTest(false);
      setNewTest({ name: "", testTime: "", subjects: [] });
      
      // Reload tests
      const testsData = await testsApi.getAll();
      const filteredTests = testsData.filter((t: any) => t.classId === selectedClassId);
      setTests(filteredTests);
    } catch (error: any) {
      console.error('Error creating test:', error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to create test",
        variant: "destructive"
      });
    }
  };

  // Add subject to new test form
  const handleAddSubjectToNewTest = (subjectId: string) => {
    const subject = availableSubjects.find((s: any) => s.id === subjectId);
    if (!subject) return;

    setNewTest(prev => ({
      ...prev,
      subjects: [...prev.subjects, { subjectId, maxMarks: 100, syllabus: "" }]
    }));
  };

  // Update subject in new test form
  const handleUpdateSubjectInNewTest = (index: number, field: string, value: any) => {
    setNewTest(prev => ({
      ...prev,
      subjects: prev.subjects.map((s, i) => 
        i === index ? { ...s, [field]: value } : s
      )
    }));
  };

  // Remove subject from new test form
  const handleRemoveSubjectFromNewTest = (index: number) => {
    setNewTest(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index)
    }));
  };

  // Save marks for test
  const handleSaveTestMarks = async () => {
    if (!selectedTest) return;

    const results = [];
    for (const [studentId, subjectMarks] of Object.entries(studentSubjectMarks)) {
      for (const [subjectId, marks] of Object.entries(subjectMarks)) {
        if (marks > 0) { // Only include marks that are entered
          results.push({
            studentId,
            subjectId,
            marksObtained: marks
          });
        }
      }
    }

    if (results.length === 0) {
      toast({
        title: "No Marks",
        description: "Please enter marks for at least one student.",
        variant: "destructive"
      });
      return;
    }

    try {
      await testsApi.saveResults(selectedTest.id, results);
      toast({ title: "Marks Saved", description: "Student marks have been recorded successfully." });
      setShowAddMarks(false);
      setSelectedTest(null);
      setStudentSubjectMarks({});
      setTestResults([]);
      
      // Reload tests list to refresh
      const testsData = await testsApi.getAll();
      const filteredTests = testsData.filter((t: any) => t.classId === selectedClassId);
      setTests(filteredTests);
    } catch (error: any) {
      console.error('Error saving marks:', error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to save marks",
        variant: "destructive"
      });
    }
  };

  // Send test details to all parents
  const sendTestDetailsToParents = async (test: any) => {
    if (!test || !test.subjects || test.subjects.length === 0) {
      toast({
        title: "Error",
        description: "Test details not available",
        variant: "destructive"
      });
      return;
    }

    try {
      const studentsData = await studentsApi.getByClass(test.classId);
      if (!studentsData || studentsData.length === 0) {
        toast({
          title: "No Students",
          description: "No students found in this class",
          variant: "destructive"
        });
        return;
      }

      const subjectDetails = test.subjects.map((s: any) => 
        `${s.subjectName} (${s.maxMarks} marks)${s.syllabus ? `\nSyllabus: ${s.syllabus}` : ''}`
      ).join("\n\n");

      studentsData.forEach((student: any) => {
        if (student.parentPhone || student.parent_phone) {
          const phone = student.parentPhone || student.parent_phone;
          const message = encodeURIComponent(
            `📝 *${test.name}*\n\n` +
            `Test Time: ${test.testTime}\n` +
            `Class: ${test.className}\n\n` +
            `📚 *Subjects:*\n${subjectDetails}\n\n` +
            `Please ensure your child is prepared! 📖`
          );
          window.open(`https://wa.me/91${phone}?text=${message}`, "_blank");
        }
      });

      toast({ title: "Test Details Sent", description: `Test details sent to all parents.` });
    } catch (error) {
      console.error('Error sending test details:', error);
      toast({
        title: "Error",
        description: "Failed to send test details",
        variant: "destructive"
      });
    }
  };

  // Send test result to parent
  const sendTestResultToParent = (test: any, studentResult: any) => {
    if (!studentResult || !studentResult.subjects || studentResult.subjects.length === 0) {
      toast({
        title: "Error",
        description: "No results available for this student",
        variant: "destructive"
      });
      return;
    }

    const subjectDetails = studentResult.subjects.map((s: any) => {
      const percentage = (s.marksObtained / s.maxMarks) * 100;
      const grade = calculateGrade(s.marksObtained, s.maxMarks);
      return `${s.subjectName}: ${s.marksObtained}/${s.maxMarks} (${percentage.toFixed(1)}% - ${grade})`;
    }).join("\n");

    const totalMarks = studentResult.subjects.reduce((sum: number, s: any) => sum + s.marksObtained, 0);
    const totalMaxMarks = studentResult.subjects.reduce((sum: number, s: any) => sum + s.maxMarks, 0);
    const totalPercentage = (totalMarks / totalMaxMarks) * 100;
    const overallGrade = calculateGrade(totalMarks, totalMaxMarks);

    const message = encodeURIComponent(
      `📝 *${test.name} Results*\n\n` +
      `Student: ${studentResult.studentName}\n` +
      `Class: ${test.className}\n\n` +
      `📊 *Subject-wise Results:*\n${subjectDetails}\n\n` +
      `*Total: ${totalMarks}/${totalMaxMarks} (${totalPercentage.toFixed(1)}%)*\n` +
      `*Overall Grade: ${overallGrade}*\n\n` +
      `Keep encouraging your child! 🌟`
    );

    if (studentResult.parentPhone) {
      window.open(`https://wa.me/91${studentResult.parentPhone}?text=${message}`, "_blank");
      toast({ title: "Result Sent", description: `Result sent to ${studentResult.studentName}'s parent.` });
    } else {
      toast({
        title: "Error",
        description: "Parent phone number not available",
        variant: "destructive"
      });
    }
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
            <Select value={selectedClassId} onValueChange={(value) => {
              setSelectedClassId(value);
              const cls = classes.find(c => c.id === value);
              if (cls) {
                setSelectedClass(`${cls.name}${cls.section ? ` - Section ${cls.section}` : ''}`);
              }
            }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}{cls.section ? ` - Section ${cls.section}` : ''}
                  </SelectItem>
                ))}
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
          <TabsList className={`grid w-full max-w-md ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {isAdmin && (
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Analytics
              </TabsTrigger>
            )}
            <TabsTrigger value="tests" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Tests
            </TabsTrigger>
            <TabsTrigger value="student-reports" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Student Reports
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab - Only for Admins */}
          {isAdmin && (
            <TabsContent value="analytics" className="space-y-6">
            {isLoadingAnalytics ? (
              <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <ClipboardCheck className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{avgAttendance.toFixed(1)}%</p>
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
                            <p className="text-2xl font-bold">₹{(feeCollected / 100000).toFixed(1)}L</p>
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
                          <p className="text-2xl font-bold">{hwCompletion.toFixed(0)}%</p>
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
                          <p className="text-2xl font-bold">{totalStudents}</p>
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
                  {attendanceTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={attendanceTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                        <Line type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      No attendance data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Homework Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {homeworkActivity.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={homeworkActivity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                        <Bar dataKey="assigned" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="completed" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      No homework data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {isAdmin && feeCollectionData.length > 0 && (
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
                  {classPerformance.length > 0 ? (
                    <>
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
                    </>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      No performance data available
                    </div>
                  )}
                </CardContent>
              </Card>
                </div>
              </>
            )}
          </TabsContent>
          )}

          {/* Tests Tab */}
          <TabsContent value="tests" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Create tests, view details, and send to parents</p>
              </div>
              <Dialog open={showCreateTest} onOpenChange={setShowCreateTest}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" />Create Test</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Test</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Test Name *</Label>
                      <Input 
                        placeholder="e.g., Unit Test 1" 
                        value={newTest.name} 
                        onChange={(e) => setNewTest({ ...newTest, name: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Test Time *</Label>
                      <Input 
                        placeholder="e.g., 2 hours, 90 minutes" 
                        value={newTest.testTime} 
                        onChange={(e) => setNewTest({ ...newTest, testTime: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Select Subjects *</Label>
                      <Select onValueChange={handleAddSubjectToNewTest}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSubjects
                            .filter((s: any) => !newTest.subjects.find((ts: any) => ts.subjectId === s.id))
                            .map((subject: any) => (
                              <SelectItem key={subject.id} value={subject.id}>
                                {subject.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {newTest.subjects.length > 0 && (
                      <div className="space-y-2">
                        <Label>Test Subjects</Label>
                        <div className="space-y-3 border rounded-lg p-4">
                          {newTest.subjects.map((subject, index) => {
                            const subjectData = availableSubjects.find((s: any) => s.id === subject.subjectId);
                            return (
                              <div key={index} className="space-y-2 p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{subjectData?.name || 'Unknown'}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleRemoveSubjectFromNewTest(index)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Max Marks</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={subject.maxMarks}
                                      onChange={(e) => handleUpdateSubjectInNewTest(index, 'maxMarks', parseInt(e.target.value) || 100)}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Syllabus</Label>
                                  <textarea
                                    className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md resize-none"
                                    placeholder="Enter syllabus for this subject..."
                                    value={subject.syllabus}
                                    onChange={(e) => handleUpdateSubjectInNewTest(index, 'syllabus', e.target.value)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <Button onClick={handleCreateTest} className="w-full" disabled={!selectedClassId}>
                      Create Test
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Tests List */}
            {isLoadingTests ? (
              <div className="text-center py-12 text-muted-foreground">Loading tests...</div>
            ) : tests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg">
                <p>No tests created yet. Click "Create Test" to get started.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {tests.map((test) => (
                  <Card key={test.id} className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => loadTestDetails(test.id)}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{test.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {test.className} • {test.testTime} • {test.subjectCount} {test.subjectCount === 1 ? 'subject' : 'subjects'}
                            </p>
                          </div>
                        </div>
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}

            {/* Test Details View */}
            {testDetails && (
              <Card className="mt-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{testDetails.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {testDetails.className} • Test Time: {testDetails.testTime}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setTestDetails(null)}>
                      <X className="w-4 h-4 mr-2" />Close
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Subjects & Syllabus</Label>
                    <div className="space-y-3">
                      {testDetails.subjects.map((subject: any) => (
                        <div key={subject.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{subject.subjectName}</span>
                            <Badge variant="secondary">{subject.maxMarks} marks</Badge>
                          </div>
                          {subject.syllabus && (
                            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                              {subject.syllabus}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => sendTestDetailsToParents(testDetails)}
                  >
                    <Send className="w-4 h-4 mr-2" />Send Test Details to All Parents
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Student Reports Tab */}
          <TabsContent value="student-reports" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Add marks for tests and send results to parents</p>
              </div>
            </div>

            {/* Tests List with Add Marks */}
            {isLoadingTests ? (
              <div className="text-center py-12 text-muted-foreground">Loading tests...</div>
            ) : tests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg">
                <p>No tests available. Create a test in the "Tests" tab first.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {tests.map((test) => (
                  <Card key={test.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{test.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {test.className} • {test.testTime} • {test.subjectCount} {test.subjectCount === 1 ? 'subject' : 'subjects'}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={async () => {
                            try {
                              const details = await testsApi.getById(test.id);
                              setSelectedTest(details);
                              
                              // Ensure students are loaded for the test's class
                              if (details.classId) {
                                try {
                                  const studentsData = await studentsApi.getByClass(details.classId);
                                  const transformed = (studentsData || []).map((s: any, index: number) => ({
                                    id: s.id,
                                    name: s.name,
                                    rollNo: s.rollNo || s.roll_no || String(index + 1).padStart(2, '0'),
                                    parentPhone: s.parentPhone || s.parent_phone || '',
                                    class: details.className || ''
                                  }));
                                  setStudents(transformed);
                                  
                                  if (transformed.length === 0) {
                                    toast({
                                      title: "No Students",
                                      description: "No students found in this class",
                                      variant: "destructive"
                                    });
                                    return;
                                  }
                                } catch (err) {
                                  console.error('Error loading students for test class:', err);
                                  toast({
                                    title: "Error",
                                    description: "Failed to load students",
                                    variant: "destructive"
                                  });
                                  return;
                                }
                              }
                              
                              // Load existing results
                              const results = await testsApi.getResults(test.id);
                              setTestResults(results);
                              setStudentSubjectMarks({}); // Reset marks
                              setShowAddMarks(true);
                            } catch (error) {
                              console.error('Error loading test details:', error);
                              toast({
                                title: "Error",
                                description: "Failed to load test details",
                                variant: "destructive"
                              });
                            }
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />Add Marks
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <TestResultsView testId={test.id} testName={test.name} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Add Marks Dialog */}
        <Dialog open={showAddMarks} onOpenChange={(open) => {
          setShowAddMarks(open);
          if (!open) {
            // Reset state when dialog closes
            setSelectedTest(null);
            setStudentSubjectMarks({});
            setTestResults([]);
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Marks - {selectedTest?.name || 'Test'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {!selectedTest ? (
                <div className="text-center py-8 text-muted-foreground">Loading test details...</div>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">
                    <p>Test Time: {selectedTest.testTime}</p>
                    <p>Class: {selectedTest.className}</p>
                  </div>
                  {!selectedTest.subjects || selectedTest.subjects.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      No subjects found for this test.
                    </div>
                  ) : (
                    <>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              {selectedTest.subjects?.map((s: any) => (
                                <TableHead key={s.subjectId} className="text-center">{s.subjectName} (Max: {s.maxMarks})</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {students.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={(selectedTest.subjects?.length || 0) + 1} className="text-center py-8 text-muted-foreground">
                                  No students found in this class. Please ensure students are added to the class.
                                </TableCell>
                              </TableRow>
                            ) : (
                              students.map((student) => {
                                const studentId = String(student.id);
                                // Check if student already has marks (from testResults)
                                const existingResult = testResults.find((r: any) => r.studentId === studentId);
                                
                                return (
                                  <TableRow key={student.id}>
                                    <TableCell className="font-medium">{student.rollNo}. {student.name}</TableCell>
                                    {selectedTest.subjects?.map((subject: any) => {
                                      const subjectResult = existingResult?.subjects?.find((s: any) => s.subjectId === subject.subjectId);
                                      const currentValue = studentSubjectMarks[studentId]?.[subject.subjectId] ?? (subjectResult ? subjectResult.marksObtained : "");
                                      return (
                                        <TableCell key={subject.subjectId} className="text-center">
                                          <Input
                                            type="number"
                                            className="w-16 mx-auto text-center"
                                            min={0}
                                            max={subject.maxMarks}
                                            step="0.01"
                                            value={currentValue}
                                            onChange={(e) => {
                                              const marks = parseFloat(e.target.value) || 0;
                                              setStudentSubjectMarks(prev => ({
                                                ...prev,
                                                [studentId]: { ...(prev[studentId] || {}), [subject.subjectId]: marks }
                                              }));
                                            }}
                                          />
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <Button 
                        onClick={(e) => {
                          e.preventDefault();
                          handleSaveTestMarks();
                        }} 
                        className="w-full"
                        type="button"
                      >
                        Save Marks
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </UnifiedLayout>
  );
}
