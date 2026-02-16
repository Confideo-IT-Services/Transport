import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { classesApi, studentsApi, attendanceApi, timetableApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  ClipboardCheck, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Users,
  LogIn,
  LogOut,
  Info,
  TrendingUp,
  Send
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfMonth } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Student {
  id: number;
  name: string;
  rollNo: number;
  status: "present" | "absent" | "leave" | "not-marked";
}

interface AttendanceRecord {
  date: Date;
  classId: string;
  students: { id: number; status: string }[];
  markedAt: Date;
}

// Removed all hardcoded data - will be fetched from API

export default function AttendanceModule() {
  const { user } = useAuth();
  const { dialog, confirm, close } = useConfirmDialog();
  const isAdmin = user?.role === "admin";
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [historyDate, setHistoryDate] = useState<Date | undefined>(undefined);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [hasMultipleClasses, setHasMultipleClasses] = useState(false);
  const [studentAttendance, setStudentAttendance] = useState<Student[]>([]);
  const [isSelfCheckedIn, setIsSelfCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
  const [leaveFromDate, setLeaveFromDate] = useState("");
  const [leaveToDate, setLeaveToDate] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [todayAttendanceTaken, setTodayAttendanceTaken] = useState(false);
  const [teacherAttendance, setTeacherAttendance] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
  // Student attendance percentage state
  const [attendanceStartDate, setAttendanceStartDate] = useState<Date>(() => startOfMonth(new Date()));
  const [attendanceEndDate, setAttendanceEndDate] = useState<Date>(() => new Date());
  const [studentAttendancePercentages, setStudentAttendancePercentages] = useState<any[]>([]);
  const [isLoadingPercentages, setIsLoadingPercentages] = useState(false);
  const [isSendingAttendance, setIsSendingAttendance] = useState(false);
  const [percentageFilter, setPercentageFilter] = useState<string>("");
  const [markingTeacherId, setMarkingTeacherId] = useState<string | null>(null);
  const [teacherStatus, setTeacherStatus] = useState<'present' | 'absent' | 'late' | 'leave'>('present');
  const [teacherRemarks, setTeacherRemarks] = useState('');
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [lateCutoffTime, setLateCutoffTime] = useState<string | null>(null);
  const [isViewHistoryOpen, setIsViewHistoryOpen] = useState(false);
  const [selectedTeacherForHistory, setSelectedTeacherForHistory] = useState<{ id: string; name: string } | null>(null);
  const [teacherHistory, setTeacherHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState<Date | undefined>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Default to 30 days ago
    return date;
  });
  const [historyEndDate, setHistoryEndDate] = useState<Date | undefined>(new Date());
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<any | null>(null);
  const [isLoadingHistoryDate, setIsLoadingHistoryDate] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "present" | "absent" | "leave">("all");
  const [searchParams, setSearchParams] = useSearchParams();

  // Memoize today's date string to prevent infinite loops
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // Mark teacher attendance
  const markTeacherAttendance = async (teacherId: string) => {
    try {
      await attendanceApi.markTeacherAttendance({
        teacherId,
        date: todayStr,
        status: teacherStatus,
        remarks: teacherRemarks || undefined
      });

      // Refresh teacher attendance list
      const data = await attendanceApi.getTeacherAttendance(todayStr);
      setTeacherAttendance(data || []);

      toast({
        title: "Success",
        description: "Teacher attendance marked successfully",
      });

      setMarkingTeacherId(null);
      setTeacherRemarks('');
    } catch (error: any) {
      console.error('Error marking teacher attendance:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to mark teacher attendance",
        variant: "destructive"
      });
    }
  };

  // Helper function to check if teacher is late based on check-in time
  const isTeacherLateByTime = (checkInTime: string | null, cutoffTime: string | null): boolean => {
    if (!checkInTime || !cutoffTime) return false;
    
    try {
      // Parse times (format: "HH:MM")
      const [checkInHours, checkInMinutes] = checkInTime.split(':').map(Number);
      const [cutoffHours, cutoffMinutes] = cutoffTime.split(':').map(Number);
      
      const checkInTotal = checkInHours * 60 + checkInMinutes;
      const cutoffTotal = cutoffHours * 60 + cutoffMinutes;
      
      // If check-in is after cutoff time, teacher is late
      return checkInTotal > cutoffTotal;
    } catch (error) {
      console.error('Error parsing time:', error);
      return false;
    }
  };

  // Load classes on mount
  useEffect(() => {
    const loadClasses = async () => {
      if (!isAdmin) return;
      try {
        const classesData = await classesApi.getAll();
        setClasses(classesData || []);
        
        // Check URL params for class first
        const classIdFromUrl = searchParams.get('classId');
        if (classIdFromUrl && classesData) {
          const urlClass = classesData.find((c: any) => c.id === classIdFromUrl);
          if (urlClass) {
            setSelectedClass(`${urlClass.name}${urlClass.section ? ` - Section ${urlClass.section}` : ''}`);
            setSelectedClassId(urlClass.id);
            return;
          }
        }
        
        if (classesData && classesData.length > 0) {
          const firstClass = classesData[0];
          setSelectedClass(`${firstClass.name}${firstClass.section ? ` - Section ${firstClass.section}` : ''}`);
          setSelectedClassId(firstClass.id);
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
  }, [isAdmin, searchParams]);

  // Load teacher's assigned class (for non-admin teachers)
  useEffect(() => {
    const loadTeacherClass = async () => {
      if (isAdmin) return; // Skip for admins
      
      try {
        // Load teacher's assigned class
        const classesData = await classesApi.getAll();
        console.log('Teacher classes loaded:', classesData);
        if (classesData && classesData.length > 0) {
          // Teacher's assigned class should be in the list (filtered by backend)
          const assignedClass = classesData[0];
          console.log('Selected class:', assignedClass);
          setClasses(classesData);
          setSelectedClass(`${assignedClass.name}${assignedClass.section ? ` - Section ${assignedClass.section}` : ''}`);
          setSelectedClassId(assignedClass.id);
          setHasMultipleClasses(classesData.length > 1); // Track if multiple classes
        } else {
          // Try fallback: check user.className
          if (user?.className) {
            // Try to find class by name from all classes
            try {
              const allClasses = await classesApi.getAll();
              const matchedClass = allClasses.find((c: any) => {
                const classStr = `${c.name}${c.section ? ` - Section ${c.section}` : ''}`.trim();
                return classStr === user.className?.trim() || 
                       classStr.replace(/Section\s*/i, '').trim() === user.className?.replace(/Section\s*/i, '').trim();
              });
              
              if (matchedClass) {
                setSelectedClass(`${matchedClass.name}${matchedClass.section ? ` - Section ${matchedClass.section}` : ''}`);
                setSelectedClassId(matchedClass.id);
                setClasses([matchedClass]);
              }
            } catch (error) {
              console.error('Error in fallback class loading:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error loading teacher class:', error);
        toast({
          title: "Error",
          description: "Failed to load your assigned class. Please contact admin.",
          variant: "destructive"
        });
      }
    };
    loadTeacherClass();
  }, [isAdmin, user]);

  // Load teacher attendance
  useEffect(() => {
    const loadTeacherAttendance = async () => {
      if (!isAdmin) return;
      setIsLoadingTeachers(true);
      try {
        const data = await attendanceApi.getTeacherAttendance(todayStr);
        setTeacherAttendance(data || []);
      } catch (error) {
        console.error('Error loading teacher attendance:', error);
        setTeacherAttendance([]);
      } finally {
        setIsLoadingTeachers(false);
      }
    };
    loadTeacherAttendance();
  }, [isAdmin, todayStr]);

  // Load time slots and calculate late cutoff time
  useEffect(() => {
    const loadTimeSlots = async () => {
      if (!isAdmin) return;
      try {
        const slots = await timetableApi.getTimeSlots();
        setTimeSlots(slots || []);
        
        // Find first class time slot (earliest start time)
        const classSlots = (slots || []).filter((s: any) => s.type === 'class');
        if (classSlots.length > 0) {
          // Sort by start time to get the earliest
          const sortedSlots = [...classSlots].sort((a, b) => {
            const [aHours, aMinutes] = a.startTime.split(':').map(Number);
            const [bHours, bMinutes] = b.startTime.split(':').map(Number);
            const aTotal = aHours * 60 + aMinutes;
            const bTotal = bHours * 60 + bMinutes;
            return aTotal - bTotal;
          });
          
          const firstPeriodStart = sortedSlots[0].startTime; // e.g., "09:30"
          
          // Add 30 minutes to first period start time
          const [hours, minutes] = firstPeriodStart.split(':').map(Number);
          const totalMinutes = hours * 60 + minutes + 30; // Add 30 minutes
          const cutoffHours = Math.floor(totalMinutes / 60);
          const cutoffMinutes = totalMinutes % 60;
          const cutoffTime = `${String(cutoffHours).padStart(2, '0')}:${String(cutoffMinutes).padStart(2, '0')}`;
          
          setLateCutoffTime(cutoffTime); // e.g., "10:00"
        }
      } catch (error) {
        console.error('Error loading time slots:', error);
      }
    };
    loadTimeSlots();
  }, [isAdmin]);

  // Load teacher's own attendance for check-in/check-out
  useEffect(() => {
    const loadSelfAttendance = async () => {
      if (isAdmin) return;
      if (!user?.id) return;
      
      try {
        // Use getTeacherAttendanceHistory instead of getTeacherAttendance
        // Pass today's date to get only today's record
        const historyData = await attendanceApi.getTeacherAttendanceHistory(
          user.id, // teacherId - will be filtered by backend for teachers
          todayStr, // startDate
          todayStr  // endDate - same as startDate to get only today
        );
        
        // Find today's record (should be the first one or filter by date)
        const todayRecord = Array.isArray(historyData) 
          ? historyData.find((record: any) => {
              const recordDate = record.date || record.attendanceDate;
              return recordDate === todayStr || recordDate?.startsWith(todayStr);
            }) || historyData[0] // Fallback to first record if exact match not found
          : null;
        
        if (todayRecord) {
          setIsSelfCheckedIn(!!(todayRecord.checkInTime || todayRecord.checkIn));
          setCheckInTime(todayRecord.checkIn || todayRecord.checkInTime || null);
          setCheckOutTime(todayRecord.checkOut || todayRecord.checkOutTime || null);
        } else {
          // No attendance record for today
          setIsSelfCheckedIn(false);
          setCheckInTime(null);
          setCheckOutTime(null);
        }
      } catch (error) {
        // Silently fail - it's okay if there's no attendance record yet
        console.error('Error loading self attendance:', error);
        setIsSelfCheckedIn(false);
        setCheckInTime(null);
        setCheckOutTime(null);
      }
    };
    loadSelfAttendance();
  }, [isAdmin, todayStr, user?.id]);

  // Load monthly stats (for both admin and teacher)
  useEffect(() => {
    const loadMonthlyStats = async () => {
      try {
        const currentDate = new Date();
        const year = currentDate.getFullYear().toString();
        // For teachers, don't pass classId - backend will filter by teacher's classes automatically
        // For admins, pass selectedClassId if available
        const data = await attendanceApi.getMonthlyStats(
          isAdmin ? (selectedClassId || undefined) : undefined, 
          undefined, 
          year
        );
        setMonthlyStats(data || []);
      } catch (error) {
        console.error('Error loading monthly stats:', error);
        setMonthlyStats([]);
      }
    };
    loadMonthlyStats();
  }, [isAdmin, selectedClassId]);

  // Load teacher's leave requests
  useEffect(() => {
    const loadMyLeaves = async () => {
      if (isAdmin) return; // Only for teachers
      if (!user?.id) return;

      setIsLoadingLeaves(true);
      try {
        const leaves = await timetableApi.getLeaves();
        // Filter leaves for current teacher only
        const myLeavesList = (leaves || []).filter((leave: any) => 
          String(leave.teacherId) === String(user.id)
        );
        // Sort by created date (newest first)
        myLeavesList.sort((a: any, b: any) => {
          const dateA = new Date(a.startDate || a.createdAt || 0).getTime();
          const dateB = new Date(b.startDate || b.createdAt || 0).getTime();
          return dateB - dateA;
        });
        setMyLeaves(myLeavesList);
      } catch (error) {
        console.error('Error loading my leaves:', error);
        setMyLeaves([]);
      } finally {
        setIsLoadingLeaves(false);
      }
    };
    loadMyLeaves();
  }, [isAdmin, user?.id]);

  // Load student attendance percentages for date range
  useEffect(() => {
    const loadStudentAttendancePercentages = async () => {
      if (!selectedClassId) {
        setStudentAttendancePercentages([]);
        return;
      }

      setIsLoadingPercentages(true);
      try {
        console.log('Loading attendance percentages for class:', selectedClassId);
        console.log('Date range:', format(attendanceStartDate, "yyyy-MM-dd"), 'to', format(attendanceEndDate, "yyyy-MM-dd"));
        
        // Get all students in the class
        const studentsData = await studentsApi.getByClass(selectedClassId);
        console.log('Students data:', studentsData);
        
        if (!studentsData || studentsData.length === 0) {
          console.warn('No students found for class:', selectedClassId);
          setStudentAttendancePercentages([]);
          return;
        }
        
        // Format dates for API
        const startDateStr = format(attendanceStartDate, "yyyy-MM-dd");
        const endDateStr = format(attendanceEndDate, "yyyy-MM-dd");

        // Get attendance history for the date range
        const attendanceHistory = await attendanceApi.getStudentAttendanceHistory(
          selectedClassId,
          startDateStr,
          endDateStr
        );
        console.log('Attendance history received:', attendanceHistory);
        console.log('Attendance history type:', Array.isArray(attendanceHistory) ? 'array' : typeof attendanceHistory);
        console.log('Attendance history length:', Array.isArray(attendanceHistory) ? attendanceHistory.length : 'not an array');

        // Flatten the attendance history - convert from date-grouped to flat student records
        const flattenedAttendance: any[] = [];
        if (Array.isArray(attendanceHistory)) {
          attendanceHistory.forEach((record: any) => {
            if (record.students && Array.isArray(record.students)) {
              record.students.forEach((student: any) => {
                flattenedAttendance.push({
                  studentId: student.id,
                  status: student.status,
                  date: record.date
                });
              });
            }
          });
        }
        console.log('Flattened attendance:', flattenedAttendance);
        console.log('Flattened attendance count:', flattenedAttendance.length);

        // Calculate percentage for each student
        const studentsWithPercentages = studentsData.map((student: any) => {
          const studentId = String(student.id);
          
          // Filter attendance records for this student from flattened data
          const studentAttendance = flattenedAttendance.filter((a: any) => 
            String(a.studentId) === studentId || String(a.studentId) === String(student.id)
          );

          // Count present and total
          const presentCount = studentAttendance.filter((a: any) => a.status === 'present').length;
          const totalCount = studentAttendance.length;
          const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

          return {
            id: student.id,
            name: student.name,
            rollNo: student.rollNo || '',
            percentage: percentage,
            presentCount: presentCount,
            totalCount: totalCount
          };
        });

        console.log('Students with percentages:', studentsWithPercentages);
        console.log('Students with percentages count:', studentsWithPercentages.length);

        // Sort by roll number or name
        studentsWithPercentages.sort((a, b) => {
          if (a.rollNo && b.rollNo) {
            return String(a.rollNo).localeCompare(String(b.rollNo), undefined, { numeric: true });
          }
          return a.name.localeCompare(b.name);
        });

        setStudentAttendancePercentages(studentsWithPercentages);
      } catch (error: any) {
        console.error('Error loading student attendance percentages:', error);
        console.error('Error details:', error?.response?.data || error?.message || error);
        toast({
          title: "Error",
          description: error?.message || "Failed to load attendance percentages",
          variant: "destructive"
        });
        setStudentAttendancePercentages([]);
      } finally {
        setIsLoadingPercentages(false);
      }
    };

    loadStudentAttendancePercentages();
  }, [selectedClassId, attendanceStartDate, attendanceEndDate]);

  // Send attendance reports to all parents
  const handleSendAttendanceToAll = async () => {
    if (!selectedClassId) {
      toast({
        title: "Error",
        description: "Please select a class first",
        variant: "destructive",
      });
      return;
    }

    if (studentAttendancePercentages.length === 0) {
      toast({
        title: "Error",
        description: "No attendance data to send",
        variant: "destructive",
      });
      return;
    }

    // Get month and year from the start date (use start date as it represents the month)
    const month = attendanceStartDate.getMonth() + 1; // JavaScript months are 0-indexed
    const year = attendanceStartDate.getFullYear();

    // Confirm before sending
    const monthName = attendanceStartDate.toLocaleString('default', { month: 'long' });
    confirm(
      "Send Attendance Reports",
      `Are you sure you want to send attendance reports for ${monthName} ${year} to ALL parents?`,
      async () => {
        try {
          setIsSendingAttendance(true);
          
          const result = await attendanceApi.sendToAll({
            month,
            year,
            classId: selectedClassId
          });

          if (result.success) {
            toast({
              title: "Success",
              description: `✅ ${result.results.successful} out of ${result.results.total} parents received the attendance report!`,
            });

            if (result.results.failed > 0) {
              console.warn('Some messages failed:', result.results.errors);
              toast({
                title: "Warning",
                description: `⚠️ ${result.results.failed} messages failed. Check console for details.`,
                variant: "destructive",
              });
            }
          } else {
            toast({
              title: "Error",
              description: "Failed to send attendance reports",
              variant: "destructive",
            });
          }
        } catch (error: any) {
          console.error('Error sending attendance reports:', error);
          toast({
            title: "Error",
            description: error?.message || "Failed to send WhatsApp messages",
            variant: "destructive",
          });
        } finally {
          setIsSendingAttendance(false);
        }
      }
    );
  };

  // Load students when class is selected
  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedClassId) {
        setStudentAttendance([]);
        setAttendanceRecords([]);
        return;
      }
      setIsLoading(true);
      try {
        // Load students for the class - use getByClass for both admins and teachers
        let classStudents: any[] = [];
        try {
          // This endpoint works for both admins and teachers
          console.log('Loading students for class ID:', selectedClassId);
          classStudents = await studentsApi.getByClass(selectedClassId);
          console.log('Students loaded:', classStudents);
        } catch (error) {
          // Fallback: if getByClass fails, try getAll and filter (admin only)
          if (isAdmin) {
            const studentsData = await studentsApi.getAll();
            classStudents = (studentsData || []).filter((s: any) => s.classId === selectedClassId);
          } else {
            console.error('Error loading students:', error);
            toast({
              title: "Error",
              description: "Failed to load students for this class",
              variant: "destructive"
            });
          }
        }
        
        if (classStudents.length === 0) {
          console.log('No students found for class:', selectedClassId);
          setStudentAttendance([]);
        } else {
          console.log(`Found ${classStudents.length} students for class ${selectedClassId}`);
          setStudentAttendance(classStudents.map((s: any, index: number) => ({
            id: s.id, // Keep original UUID string, don't convert to number
            name: s.name,
            rollNo: s.rollNo || index + 1,
            status: "not-marked" as const
          })));
        }

        // Load today's attendance if exists
        try {
          const attendanceData = await attendanceApi.getStudentAttendance(selectedClassId, todayStr);
          if (attendanceData && attendanceData.students && attendanceData.students.length > 0) {
            // Check if any student has attendance marked (status is not null/undefined/not-marked)
            const hasAttendanceMarked = attendanceData.students.some((s: any) => 
              s.status !== null && s.status !== undefined && s.status !== 'not-marked'
            );
            
            if (hasAttendanceMarked) {
              setTodayAttendanceTaken(true);
              setStudentAttendance(prev => prev.map(student => {
                const savedStatus = attendanceData.students.find((s: any) => 
                  String(s.id) === String(student.id) || s.id === student.id
                );
                return {
                  ...student,
                  status: (savedStatus?.status as Student["status"]) || "not-marked"
                };
              }));
            } else {
              setTodayAttendanceTaken(false);
            }
          } else {
            setTodayAttendanceTaken(false);
          }
        } catch (error) {
          // No attendance for today, that's okay
          setTodayAttendanceTaken(false);
        }

        // Load attendance history
        try {
          const historyData = await attendanceApi.getStudentAttendanceHistory(selectedClassId);
          console.log('Attendance history data received:', historyData);
          if (historyData && Array.isArray(historyData)) {
            const mappedRecords = historyData.map((record: any) => {
              // Fix: Parse date string properly to avoid timezone issues
              const dateStr = record.date;
              let date: Date;
              if (typeof dateStr === 'string') {
                // Handle both DATE (YYYY-MM-DD) and DATETIME formats
                const dateOnly = dateStr.split('T')[0];
                const dateParts = dateOnly.split('-');
                if (dateParts.length === 3) {
                  // Create date in local timezone to avoid UTC conversion issues
                  date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
                } else {
                  date = new Date(dateStr);
                }
              } else {
                date = new Date(dateStr);
              }

              // Parse markedAt similarly
              let markedAt: Date;
              const markedAtStr = record.markedAt || record.date;
              if (markedAtStr) {
                if (typeof markedAtStr === 'string') {
                  const markedAtOnly = markedAtStr.split('T')[0];
                  const markedAtParts = markedAtOnly.split('-');
                  if (markedAtParts.length === 3 && markedAtParts[0].length === 4) {
                    markedAt = new Date(parseInt(markedAtParts[0]), parseInt(markedAtParts[1]) - 1, parseInt(markedAtParts[2]));
                  } else {
                    markedAt = new Date(markedAtStr);
                  }
                } else {
                  markedAt = new Date(markedAtStr);
                }
              } else {
                markedAt = date;
              }

              return {
                date: date,
                classId: record.classId || selectedClassId,
                students: record.students || [],
                markedAt: markedAt
              };
            });
            console.log(`Loaded ${mappedRecords.length} attendance history records`);
            setAttendanceRecords(mappedRecords);
          } else {
            console.warn('Attendance history data is not an array:', historyData);
            setAttendanceRecords([]);
          }
        } catch (error: any) {
          console.error('Error loading attendance history:', error);
          setAttendanceRecords([]);
          // Only show error if it's not a 404 (class not found) or if it's a real error
          // Don't show error for 404 as it might just mean no records exist
          if (error?.response?.status && error.response.status !== 404) {
            toast({
              title: "Warning",
              description: error?.message || "Failed to load attendance history. Please try refreshing the page.",
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        console.error('Error loading students:', error);
        setStudentAttendance([]);
        toast({
          title: "Error",
          description: "Failed to load students",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadStudents();
  }, [selectedClassId, todayStr]);

  // Load attendance for selected date when date is clicked in history tab
  useEffect(() => {
    const loadAttendanceForDate = async () => {
      if (!historyDate || !selectedClassId) {
        setSelectedHistoryRecord(null);
        setHistoryStatusFilter("all"); // Reset filter when date is cleared
        return;
      }

      setIsLoadingHistoryDate(true);
      try {
        const dateStr = format(historyDate, "yyyy-MM-dd");
        const attendanceData = await attendanceApi.getStudentAttendance(selectedClassId, dateStr);
        
        if (attendanceData && attendanceData.students && attendanceData.students.length > 0) {
          // Parse date properly
          const dateParts = dateStr.split('-');
          const recordDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
          
          setSelectedHistoryRecord({
            date: recordDate,
            classId: attendanceData.classId || selectedClassId,
            students: attendanceData.students || [],
            markedAt: new Date()
          });
          setHistoryStatusFilter("all"); // Reset filter when new date is loaded
        } else {
          setSelectedHistoryRecord(null);
          setHistoryStatusFilter("all");
        }
      } catch (error: any) {
        console.error('Error loading attendance for selected date:', error);
        setSelectedHistoryRecord(null);
        setHistoryStatusFilter("all");
        // Only show error if it's not a 404 (no record exists)
        if (error?.response?.status && error.response.status !== 404) {
          toast({
            title: "Error",
            description: error?.message || "Failed to load attendance for selected date",
            variant: "destructive"
          });
        }
      } finally {
        setIsLoadingHistoryDate(false);
      }
    };

    loadAttendanceForDate();
  }, [historyDate, selectedClassId]);

  // Restore history date from URL params on mount
  useEffect(() => {
    const historyDateParam = searchParams.get('historyDate');
    if (historyDateParam) {
      try {
        const date = new Date(historyDateParam);
        if (!isNaN(date.getTime())) {
          setHistoryDate(date);
        }
      } catch (error) {
        console.error('Error parsing historyDate from URL:', error);
      }
    }
  }, []); // Only run on mount

  // Update URL params when historyDate or selectedClassId changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (historyDate) {
      params.set('historyDate', format(historyDate, 'yyyy-MM-dd'));
    }
    if (selectedClassId && isAdmin) {
      params.set('classId', selectedClassId);
    }
    // Only update if params changed to avoid infinite loops
    const currentParams = new URLSearchParams(searchParams);
    const paramsChanged = 
      params.get('historyDate') !== currentParams.get('historyDate') ||
      params.get('classId') !== currentParams.get('classId');
    
    if (paramsChanged) {
      setSearchParams(params, { replace: true });
    }
  }, [historyDate, selectedClassId, isAdmin]);

  // This is now handled in the loadStudents useEffect above

  const updateStudentStatus = (id: number, status: Student["status"]) => {
    setStudentAttendance(prev => 
      prev.map(s => s.id === id ? { ...s, status } : s)
    );
  };

  const markAllPresent = () => {
    setStudentAttendance(prev => prev.map(s => ({ ...s, status: "present" })));
  };

  const saveAttendance = async () => {
    if (!selectedClassId) {
      toast({
        title: "Error",
        description: "Please select a class",
        variant: "destructive"
      });
      return;
    }

    const unmarked = studentAttendance.filter(s => s.status === "not-marked");
    if (unmarked.length > 0) {
      toast({
        title: "Incomplete Attendance",
        description: `${unmarked.length} student(s) have not been marked. Please mark all students.`,
        variant: "destructive"
      });
      return;
    }

    try {
      await attendanceApi.saveStudentAttendance({
        classId: selectedClassId,
        date: todayStr,
        students: studentAttendance.map(s => ({ id: String(s.id), status: s.status }))
      });

      // Update local state
      const newRecord: AttendanceRecord = {
        date: today,
        classId: selectedClassId,
        students: studentAttendance.map(s => ({ id: s.id, status: s.status })),
        markedAt: new Date(),
      };

      const existingIndex = attendanceRecords.findIndex(
        r => isSameDay(r.date, today) && r.classId === selectedClassId
      );

      if (existingIndex >= 0) {
        const updated = [...attendanceRecords];
        updated[existingIndex] = newRecord;
        setAttendanceRecords(updated);
        toast({ title: "Attendance Updated", description: `Attendance for ${selectedClass} has been updated.` });
      } else {
        setAttendanceRecords([...attendanceRecords, newRecord]);
        toast({ title: "Attendance Saved", description: `Attendance for ${selectedClass} has been saved.` });
      }
      
      setTodayAttendanceTaken(true);
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save attendance",
        variant: "destructive"
      });
    }
  };

  // Get history for selected date
  const getHistoryForDate = (d: Date) => {
    return attendanceRecords.find(r => isSameDay(r.date, d) && r.classId === selectedClassId);
  };

  // Dates with attendance records (for calendar highlighting)
  const attendanceDates = attendanceRecords
    .filter(r => r.classId === selectedClassId)
    .map(r => r.date);

  const presentCount = studentAttendance.filter(s => s.status === "present").length;
  const absentCount = studentAttendance.filter(s => s.status === "absent").length;
  const leaveCount = studentAttendance.filter(s => s.status === "leave").length;

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? "View and manage attendance for all teachers and classes"
                : "Mark student attendance and track your own attendance"}
            </p>
          </div>
        </div>

        <Tabs defaultValue={isAdmin ? "teachers" : "students"} className="space-y-6">
          <TabsList>
            {isAdmin && <TabsTrigger value="teachers">Teacher Attendance</TabsTrigger>}
            <TabsTrigger value="students">Student Attendance</TabsTrigger>
            {!isAdmin && <TabsTrigger value="self">My Attendance</TabsTrigger>}
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Teacher Attendance (Admin Only) */}
          {isAdmin && (
            <TabsContent value="teachers" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-secondary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{teacherAttendance.filter(t => t.status === "present").length}</p>
                        <p className="text-sm text-muted-foreground">Present</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <XCircle className="w-6 h-6 text-destructive" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{teacherAttendance.filter(t => t.status === "absent").length}</p>
                        <p className="text-sm text-muted-foreground">Absent</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{teacherAttendance.filter(t => t.status === "leave").length}</p>
                        <p className="text-sm text-muted-foreground">On Leave</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {teacherAttendance.filter(t => {
                            // Check if teacher has "late" status
                            const hasLateStatus = t.status === "late";
                            
                            // Check if teacher is late based on check-in time
                            const checkIn = t.checkIn || t.checkInTime;
                            const isLateByCheckIn = isTeacherLateByTime(checkIn, lateCutoffTime);
                            
                            return hasLateStatus || isLateByCheckIn;
                          }).length}
                        </p>
                        <p className="text-sm text-muted-foreground">Late</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Today's Teacher Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher Name</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingTeachers ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Loading teacher attendance...
                          </TableCell>
                        </TableRow>
                      ) : teacherAttendance.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No teacher attendance data available
                          </TableCell>
                        </TableRow>
                      ) : (
                        teacherAttendance.map((teacher) => (
                          <TableRow key={teacher.id}>
                            <TableCell className="font-medium">{teacher.name || teacher.teacherName}</TableCell>
                            <TableCell>{teacher.checkIn || teacher.checkInTime || "-"}</TableCell>
                            <TableCell>{teacher.checkOut || teacher.checkOutTime || "-"}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  teacher.status === "present" ? "default" :
                                  teacher.status === "late" || isTeacherLateByTime(teacher.checkIn || teacher.checkInTime, lateCutoffTime) ? "secondary" :
                                  teacher.status === "leave" ? "outline" : "destructive"
                                }
                                className={
                                  teacher.status === "present" && !isTeacherLateByTime(teacher.checkIn || teacher.checkInTime, lateCutoffTime) ? "bg-secondary" : 
                                  teacher.status === "late" || isTeacherLateByTime(teacher.checkIn || teacher.checkInTime, lateCutoffTime) ? "bg-accent text-accent-foreground" : ""
                                }
                              >
                                {(() => {
                                  const checkIn = teacher.checkIn || teacher.checkInTime;
                                  const isLate = isTeacherLateByTime(checkIn, lateCutoffTime);
                                  if (teacher.status === "not-marked") return "Not Marked";
                                  if (isLate && teacher.status !== "late") return "Late";
                                  return teacher.status;
                                })()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedTeacherForHistory({ id: teacher.id, name: teacher.name });
                                  setIsViewHistoryOpen(true);
                                  // Reset dates to default (last 30 days)
                                  const date = new Date();
                                  date.setDate(date.getDate() - 30);
                                  setHistoryStartDate(date);
                                  setHistoryEndDate(new Date());
                                  // Don't fetch immediately - wait for user to select date range
                                  setTeacherHistory([]);
                                }}
                              >
                                View History
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Student Attendance */}
          <TabsContent value="students" className="space-y-4">
            {/* Today's Attendance Notification (Teachers only) */}
            {!isAdmin && todayAttendanceTaken && (
              <Alert className="border-secondary bg-secondary/10">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                <AlertTitle className="text-secondary">Attendance Already Taken</AlertTitle>
                <AlertDescription>
                  Today's attendance for Class {selectedClass} has already been marked. You can update it if needed.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Stats & Quick Actions */}
              <div className="lg:w-80 space-y-4">
                {/* Date Display */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <CalendarIcon className="w-8 h-8 mx-auto text-primary mb-2" />
                      <p className="text-lg font-semibold">{format(today, "EEEE")}</p>
                      <p className="text-2xl font-bold text-primary">{format(today, "dd MMM yyyy")}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions (Teachers only) */}
                {!isAdmin && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button variant="outline" className="w-full justify-start" onClick={markAllPresent}>
                        <CheckCircle2 className="w-4 h-4 mr-2 text-secondary" />
                        Mark All Present
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => setStudentAttendance(prev => prev.map(s => ({ ...s, status: "not-marked" })))}
                      >
                        <XCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                        Reset All
                      </Button>
                    </CardContent>
                  </Card>
                )}
                
                {/* Stats Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Today's Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-secondary" />
                        <span className="text-sm">Present</span>
                      </div>
                      <span className="font-semibold text-secondary">{presentCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-destructive" />
                        <span className="text-sm">Absent</span>
                      </div>
                      <span className="font-semibold text-destructive">{absentCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-accent" />
                        <span className="text-sm">On Leave</span>
                      </div>
                      <span className="font-semibold text-accent">{leaveCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                        <span className="text-sm">Not Marked</span>
                      </div>
                      <span className="font-semibold">{studentAttendance.filter(s => s.status === "not-marked").length}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Total Students</span>
                        <span className="font-bold">{studentAttendance.length}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Student List */}
              <Card className="flex-1">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      {isAdmin ? "Class Attendance" : "My Class Attendance"} - {format(today, "dd/MM/yyyy")}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {/* Only show class selector for admin OR teacher with multiple classes */}
                      {(isAdmin || (!isAdmin && hasMultipleClasses)) && (
                        <Select 
                          value={selectedClassId} 
                          onValueChange={(value) => {
                            setSelectedClassId(value);
                            const selected = classes.find(c => c.id === value);
                            setSelectedClass(selected ? `${selected.name}${selected.section ? ` - Section ${selected.section}` : ''}` : "");
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent className="bg-card">
                            {classes.map((cls) => (
                              <SelectItem key={cls.id} value={cls.id}>
                                {cls.name}{cls.section ? ` - Section ${cls.section}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>Loading students...</p>
                    </div>
                  ) : studentAttendance.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>{selectedClassId ? "No students found for this class" : "Please select a class"}</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Roll</TableHead>
                          <TableHead>Student Name</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          {!isAdmin && <TableHead className="text-right">Mark Attendance</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentAttendance.map((student) => (
                        <TableRow key={student.id} className={student.status === "not-marked" ? "bg-muted/30" : ""}>
                          <TableCell className="font-medium">{student.rollNo}</TableCell>
                          <TableCell>{student.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={student.status === "not-marked" ? "outline" : "default"}
                              className={
                                student.status === "present" ? "bg-secondary" : 
                                student.status === "absent" ? "bg-destructive" : 
                                student.status === "leave" ? "bg-accent" : 
                                "bg-muted text-muted-foreground"
                              }
                            >
                              {student.status === "not-marked" ? "Not Marked" : student.status}
                            </Badge>
                          </TableCell>
                          {!isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button 
                                  size="sm" 
                                  variant={student.status === "present" ? "default" : "outline"}
                                  className={student.status === "present" ? "bg-secondary hover:bg-secondary/90" : ""}
                                  onClick={() => updateStudentStatus(student.id, "present")}
                                >
                                  P
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant={student.status === "absent" ? "default" : "outline"}
                                  className={student.status === "absent" ? "bg-destructive hover:bg-destructive/90" : ""}
                                  onClick={() => updateStudentStatus(student.id, "absent")}
                                >
                                  A
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant={student.status === "leave" ? "default" : "outline"}
                                  className={student.status === "leave" ? "bg-accent hover:bg-accent/90" : ""}
                                  onClick={() => updateStudentStatus(student.id, "leave")}
                                >
                                  L
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {!isAdmin && (
                    <div className="mt-4 flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        {studentAttendance.filter(s => s.status === "not-marked").length > 0 
                          ? `${studentAttendance.filter(s => s.status === "not-marked").length} students not marked`
                          : "All students marked ✓"
                        }
                      </p>
                      <Button onClick={saveAttendance}>
                        <ClipboardCheck className="w-4 h-4 mr-2" />
                        {todayAttendanceTaken ? "Update Attendance" : "Save Attendance"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Student Attendance Percentage Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Student Attendance Percentage
                  </CardTitle>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="attendance-start-date" className="text-sm whitespace-nowrap">From:</Label>
                      <Input
                        id="attendance-start-date"
                        type="date"
                        value={format(attendanceStartDate, "yyyy-MM-dd")}
                        onChange={(e) => {
                          const newDate = e.target.value ? new Date(e.target.value) : startOfMonth(new Date());
                          setAttendanceStartDate(newDate);
                          // Validate: start date should not be after end date
                          if (newDate > attendanceEndDate) {
                            setAttendanceEndDate(newDate);
                          }
                        }}
                        max={format(attendanceEndDate, "yyyy-MM-dd")}
                        className="w-40"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="attendance-end-date" className="text-sm whitespace-nowrap">To:</Label>
                      <Input
                        id="attendance-end-date"
                        type="date"
                        value={format(attendanceEndDate, "yyyy-MM-dd")}
                        onChange={(e) => {
                          const newDate = e.target.value ? new Date(e.target.value) : new Date();
                          setAttendanceEndDate(newDate);
                          // Validate: end date should not be before start date
                          if (newDate < attendanceStartDate) {
                            setAttendanceStartDate(newDate);
                          }
                        }}
                        max={format(new Date(), "yyyy-MM-dd")}
                        className="w-40"
                      />
                    </div>
                    {/* Attendance Percentage Filter */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="≤ %"
                        value={percentageFilter}
                        onChange={(e) => setPercentageFilter(e.target.value)}
                        className="w-20 px-2 py-2 border rounded-md text-sm"
                      />
                      <span className="text-sm text-muted-foreground">Attendance %</span>
                    </div>

                    {/* Send Message Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        toast({
                          title: "Coming Soon",
                          description: "Send message functionality will be added soon.",
                        });
                      }}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
                    </Button>
                    {/* Send to All Parents Button */}
                    {/*<Button
                      onClick={handleSendAttendanceToAll}
                      disabled={isSendingAttendance || !selectedClassId || studentAttendancePercentages.length === 0}
                      className="ml-auto"
                    >
                      {isSendingAttendance ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4 mr-2" />
                          Send to All Parents
                        </>
                      )}
                    </Button>*/}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingPercentages ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                    <p>Loading attendance percentages...</p>
                  </div>
                ) : studentAttendancePercentages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No students found for this class</p>
                  </div>
                ) : (
                  (() => {
                    // Filter students based on attendance percentage threshold
                    let filteredStudents = studentAttendancePercentages;
                    
                    if (percentageFilter && !isNaN(Number(percentageFilter))) {
                      const threshold = Number(percentageFilter);
                      filteredStudents = studentAttendancePercentages.filter((student) => {
                        const percentage = student.percentage || 0;
                        return percentage <= threshold;
                      });
                    }

                    return (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-20">Roll No</TableHead>
                              <TableHead>Student Name</TableHead>
                              <TableHead className="text-center w-32">Attendance %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStudents.map((student) => {
                              const getBadgeVariant = (percentage: number) => {
                                if (percentage === 0) return "outline";
                                if (percentage >= 90) return "default";
                                if (percentage >= 75) return "default";
                                return "default";
                              };

                              const getBadgeClassName = (percentage: number) => {
                                if (percentage === 0) return "bg-muted text-muted-foreground";
                                if (percentage >= 90) return "bg-green-500 hover:bg-green-600 text-white";
                                if (percentage >= 75) return "bg-yellow-500 hover:bg-yellow-600 text-white";
                                return "bg-red-500 hover:bg-red-600 text-white";
                              };

                              return (
                                <TableRow key={student.id}>
                                  <TableCell className="font-medium">{student.rollNo || '-'}</TableCell>
                                  <TableCell>{student.name}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge
                                      variant={getBadgeVariant(student.percentage)}
                                      className={getBadgeClassName(student.percentage)}
                                    >
                                      {student.percentage}%
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Self Attendance (Teacher Only) */}
          {!isAdmin && (
            <TabsContent value="self" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Today's Check-in</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center py-6">
                      <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${
                        isSelfCheckedIn ? "bg-secondary/10" : "bg-muted"
                      }`}>
                        {isSelfCheckedIn ? (
                          <CheckCircle2 className="w-12 h-12 text-secondary" />
                        ) : (
                          <Clock className="w-12 h-12 text-muted-foreground" />
                        )}
                      </div>
                      <p className="mt-4 text-lg font-semibold">
                        {isSelfCheckedIn ? "Checked In" : "Not Checked In"}
                      </p>
                      {checkInTime && (
                        <p className="text-sm text-muted-foreground">Check-in time: {checkInTime}</p>
                      )}
                      {checkOutTime && (
                        <p className="text-sm text-muted-foreground">Check-out time: {checkOutTime}</p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        className="flex-1" 
                        disabled={isSelfCheckedIn}
                        onClick={async () => {
                          try {
                            const result = await attendanceApi.markTeacherCheckIn();
                            setIsSelfCheckedIn(true);
                            // Handle both time formats from backend
                            let timeStr: string;
                            if (result.time) {
                              // Backend returns "HH:MM" format, convert to 12-hour format
                              const [hours, minutes] = result.time.split(':');
                              const hour24 = parseInt(hours);
                              const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                              const ampm = hour24 >= 12 ? 'PM' : 'AM';
                              timeStr = `${hour12}:${minutes} ${ampm}`;
                            } else if (result.checkInTime) {
                              // Format ISO string to 12-hour format
                              const date = new Date(result.checkInTime);
                              timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                            } else {
                              timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                            }
                            setCheckInTime(timeStr);
                            toast({
                              title: "Success",
                              description: "Checked in successfully",
                            });
                          } catch (error: any) {
                            console.error('Check-in error details:', error);
                            // Extract error message details if available
                            const errorMessage = error?.message || error?.details || "Failed to check in. Please check backend console for details.";
                            toast({
                              title: "Error",
                              description: errorMessage,
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <LogIn className="w-4 h-4 mr-2" />
                        Check In
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        disabled={!isSelfCheckedIn || !!checkOutTime}
                        onClick={async () => {
                          try {
                            const result = await attendanceApi.markTeacherCheckOut();
                            // Handle both time formats from backend
                            let timeStr: string;
                            if (result.time) {
                              // Backend returns "HH:MM" format, convert to 12-hour format
                              const [hours, minutes] = result.time.split(':');
                              const hour24 = parseInt(hours);
                              const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                              const ampm = hour24 >= 12 ? 'PM' : 'AM';
                              timeStr = `${hour12}:${minutes} ${ampm}`;
                            } else if (result.checkOutTime) {
                              // Format ISO string to 12-hour format
                              const date = new Date(result.checkOutTime);
                              timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                            } else {
                              timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                            }
                            setCheckOutTime(timeStr);
                            toast({
                              title: "Success",
                              description: "Checked out successfully",
                            });
                          } catch (error: any) {
                            console.error('Check-out error details:', error);
                            toast({
                              title: "Error",
                              description: error?.message || "Failed to check out. Please check console for details.",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Check Out
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Apply for Leave</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">From Date</label>
                        <Input 
                          type="date" 
                          value={leaveFromDate}
                          onChange={(e) => setLeaveFromDate(e.target.value)}
                          min={format(new Date(), "yyyy-MM-dd")}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">To Date</label>
                        <Input 
                          type="date" 
                          value={leaveToDate}
                          onChange={(e) => setLeaveToDate(e.target.value)}
                          min={leaveFromDate || format(new Date(), "yyyy-MM-dd")}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Leave Type</label>
                      <Select value={leaveType} onValueChange={setLeaveType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sick">Sick Leave</SelectItem>
                          <SelectItem value="casual">Casual Leave</SelectItem>
                          <SelectItem value="earned">Earned Leave</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reason</label>
                      <Textarea 
                        placeholder="Enter reason for leave"
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                      />
                    </div>
                    <Button 
                      className="w-full"
                      onClick={async () => {
                        if (!leaveFromDate || !leaveToDate || !leaveType || !leaveReason.trim()) {
                          toast({
                            title: "Validation Error",
                            description: "Please fill in all fields",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        if (new Date(leaveFromDate) > new Date(leaveToDate)) {
                          toast({
                            title: "Validation Error",
                            description: "From date cannot be after To date",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        try {
                          // Use timetable API to create leave (teacher can apply for their own leave)
                          const result = await timetableApi.createLeave({
                            teacherId: user?.id || "",
                            teacherName: user?.name || "",
                            startDate: leaveFromDate,
                            endDate: leaveToDate,
                            reason: `${leaveType.charAt(0).toUpperCase() + leaveType.slice(1)} Leave: ${leaveReason}`
                          });
                          
                          toast({
                            title: "Success",
                            description: "Leave request submitted successfully",
                          });
                          
                          // Reset form
                          setLeaveFromDate("");
                          setLeaveToDate("");
                          setLeaveType("");
                          setLeaveReason("");
                          
                          // Reload leave requests
                          const leaves = await timetableApi.getLeaves();
                          const myLeavesList = (leaves || []).filter((leave: any) => 
                            String(leave.teacherId) === String(user?.id)
                          );
                          myLeavesList.sort((a: any, b: any) => {
                            const dateA = new Date(a.startDate || a.createdAt || 0).getTime();
                            const dateB = new Date(b.startDate || b.createdAt || 0).getTime();
                            return dateB - dateA;
                          });
                          setMyLeaves(myLeavesList);
                        } catch (error: any) {
                          console.error('Leave application error:', error);
                          toast({
                            title: "Error",
                            description: error?.message || "Failed to submit leave request",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      Submit Leave Request
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* My Leave Requests */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">My Leave Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingLeaves ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                      <p>Loading leave requests...</p>
                    </div>
                  ) : myLeaves.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No leave requests submitted yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date Range</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {myLeaves.map((leave: any) => {
                            const startDate = leave.startDate ? format(new Date(leave.startDate), "dd MMM yyyy") : "";
                            const endDate = leave.endDate ? format(new Date(leave.endDate), "dd MMM yyyy") : "";
                            const status = leave.status || 'pending';
                            
                            return (
                              <TableRow key={leave.id}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{startDate}</span>
                                    {startDate !== endDate && (
                                      <span className="text-sm text-muted-foreground">to {endDate}</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-md truncate" title={leave.reason || ''}>
                                    {leave.reason || '—'}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge
                                    className={
                                      status === 'approved'
                                        ? 'bg-green-500 hover:bg-green-600'
                                        : status === 'rejected'
                                        ? 'bg-destructive hover:bg-destructive/90'
                                        : 'bg-yellow-500 hover:bg-yellow-600'
                                    }
                                  >
                                    {status === 'approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                    {status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                                    {status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                  </Badge>
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

              {/* Personal Attendance History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">My Attendance History</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthlyStats.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No monthly statistics available</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-4">
                      {monthlyStats.map((stat) => (
                        <div key={stat.month} className="text-center p-4 rounded-lg bg-muted/50">
                          <p className="font-semibold text-lg">{stat.month}</p>
                          <div className="mt-2 space-y-1 text-sm">
                            <p className="text-secondary">Present: {stat.present || 0}</p>
                            <p className="text-destructive">Absent: {stat.absent || 0}</p>
                            <p className="text-accent">Leave: {stat.leave || 0}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* History */}
          <TabsContent value="history" className="space-y-4">
            {/* Class Selector - Only show if admin OR teacher with multiple classes */}
            {(isAdmin || (!isAdmin && hasMultipleClasses)) && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium">Select Class:</label>
                    <Select 
                      value={selectedClassId} 
                      onValueChange={(value) => {
                        setSelectedClassId(value);
                        const selected = classes.find(c => c.id === value);
                        setSelectedClass(selected ? `${selected.name}${selected.section ? ` - Section ${selected.section}` : ''}` : "");
                        setHistoryDate(undefined); // Reset date when class changes
                        setSelectedHistoryRecord(null); // Reset record
                      }}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent className="bg-card">
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}{cls.section ? ` - Section ${cls.section}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Calendar for History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    Select Date
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={historyDate}
                    onSelect={setHistoryDate}
                    className="rounded-md border pointer-events-auto"
                    modifiers={{
                      hasAttendance: attendanceDates
                    }}
                    modifiersStyles={{
                      hasAttendance: { backgroundColor: "hsl(var(--secondary))", color: "white", fontWeight: "bold" }
                    }}
                  />
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 rounded bg-secondary" />
                    <span>Dates with attendance records</span>
                  </div>
                </CardContent>
              </Card>

              {/* History Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {historyDate 
                      ? `Attendance - ${format(historyDate, "dd MMM yyyy")}`
                      : "Attendance Records"
                    }
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!historyDate ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select a date from the calendar to view attendance records</p>
                    </div>
                  ) : !selectedClassId ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Please select a class first</p>
                    </div>
                  ) : isLoadingHistoryDate ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Clock className="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" />
                      <p>Loading attendance data...</p>
                    </div>
                  ) : !selectedHistoryRecord ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No attendance record for this date</p>
                      <p className="text-sm mt-2">{selectedClass || "No class selected"}</p>
                    </div>
                  ) : (() => {
                    const record = selectedHistoryRecord;
                    const historyPresent = record.students.filter((s: any) => s.status === "present").length;
                    const historyAbsent = record.students.filter((s: any) => s.status === "absent").length;
                    const historyLeave = record.students.filter((s: any) => s.status === "leave").length;

                    return (
                      <div className="space-y-4">
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3">
                          <div 
                            className={`text-center p-3 rounded-lg bg-secondary/10 cursor-pointer transition-all hover:bg-secondary/20 ${
                              historyStatusFilter === "present" ? "ring-2 ring-secondary" : ""
                            }`}
                            onClick={() => setHistoryStatusFilter(historyStatusFilter === "present" ? "all" : "present")}
                          >
                            <p className="text-2xl font-bold text-secondary">{historyPresent}</p>
                            <p className="text-xs text-muted-foreground">Present</p>
                          </div>
                          <div 
                            className={`text-center p-3 rounded-lg bg-destructive/10 cursor-pointer transition-all hover:bg-destructive/20 ${
                              historyStatusFilter === "absent" ? "ring-2 ring-destructive" : ""
                            }`}
                            onClick={() => setHistoryStatusFilter(historyStatusFilter === "absent" ? "all" : "absent")}
                          >
                            <p className="text-2xl font-bold text-destructive">{historyAbsent}</p>
                            <p className="text-xs text-muted-foreground">Absent</p>
                          </div>
                          <div 
                            className={`text-center p-3 rounded-lg bg-accent/10 cursor-pointer transition-all hover:bg-accent/20 ${
                              historyStatusFilter === "leave" ? "ring-2 ring-accent" : ""
                            }`}
                            onClick={() => setHistoryStatusFilter(historyStatusFilter === "leave" ? "all" : "leave")}
                          >
                            <p className="text-2xl font-bold text-accent">{historyLeave}</p>
                            <p className="text-xs text-muted-foreground">Leave</p>
                          </div>
                        </div>

                        {/* Student List */}
                        <div className="max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Roll</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(() => {
                                // Filter students based on selected status
                                let filteredStudents = record.students;
                                
                                if (historyStatusFilter !== "all") {
                                  filteredStudents = record.students.filter((s: any) => s.status === historyStatusFilter);
                                }

                                return filteredStudents.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                      No students found with status: {historyStatusFilter}
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  filteredStudents.map((s: any) => {
                                    const student = studentAttendance.find(st => 
                                      String(st.id) === String(s.id) || st.id === s.id
                                    );
                                    return (
                                      <TableRow key={s.id}>
                                        <TableCell>{s.rollNo || student?.rollNo || s.id}</TableCell>
                                        <TableCell>{s.name || student?.name || `Student ${s.id}`}</TableCell>
                                        <TableCell className="text-right">
                                          <Badge 
                                            className={
                                              s.status === "present" ? "bg-secondary" : 
                                              s.status === "absent" ? "bg-destructive" : "bg-accent"
                                            }
                                          >
                                            {s.status}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })
                                );
                              })()}
                            </TableBody>
                          </Table>
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                          Marked at: {format(record.markedAt, "hh:mm a")}
                        </p>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* View History Dialog */}
      <Dialog open={isViewHistoryOpen} onOpenChange={(open) => {
        setIsViewHistoryOpen(open);
        if (!open) {
          setSelectedTeacherForHistory(null);
          setTeacherHistory([]);
          // Reset dates to default
          const date = new Date();
          date.setDate(date.getDate() - 30);
          setHistoryStartDate(date);
          setHistoryEndDate(new Date());
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Attendance History - {selectedTeacherForHistory?.name}
            </DialogTitle>
            <DialogDescription>
              Select a date range to view attendance records
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Date Range Picker */}
            <div className="grid grid-cols-2 gap-4 pb-4 border-b">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !historyStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {historyStartDate ? format(historyStartDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={historyStartDate}
                      onSelect={setHistoryStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !historyEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {historyEndDate ? format(historyEndDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={historyEndDate}
                      onSelect={setHistoryEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Fetch Button */}
            <div className="flex justify-end">
              <Button
                onClick={async () => {
                  if (!historyStartDate || !historyEndDate) {
                    toast({
                      title: "Error",
                      description: "Please select both start and end dates",
                      variant: "destructive"
                    });
                    return;
                  }
                  if (historyStartDate > historyEndDate) {
                    toast({
                      title: "Error",
                      description: "Start date must be before end date",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  setIsLoadingHistory(true);
                  try {
                    const history = await attendanceApi.getTeacherAttendanceHistory(
                      selectedTeacherForHistory?.id,
                      format(historyStartDate, 'yyyy-MM-dd'),
                      format(historyEndDate, 'yyyy-MM-dd')
                    );
                    setTeacherHistory(history || []);
                  } catch (error: any) {
                    console.error('Error loading teacher history:', error);
                    toast({
                      title: "Error",
                      description: error?.message || "Failed to load attendance history",
                      variant: "destructive"
                    });
                    setTeacherHistory([]);
                  } finally {
                    setIsLoadingHistory(false);
                  }
                }}
                disabled={isLoadingHistory || !historyStartDate || !historyEndDate}
              >
                {isLoadingHistory ? "Loading..." : "Fetch History"}
              </Button>
            </div>

            {isLoadingHistory ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 mx-auto text-muted-foreground animate-spin mb-2" />
                <p className="text-muted-foreground">Loading history...</p>
              </div>
            ) : teacherHistory.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No attendance history found for the selected date range</p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-secondary">
                        {teacherHistory.filter((h: any) => h.status === 'present' || h.status === 'Present').length}
                      </div>
                      <p className="text-xs text-muted-foreground">Present</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-destructive">
                        {teacherHistory.filter((h: any) => h.status === 'absent' || h.status === 'Absent').length}
                      </div>
                      <p className="text-xs text-muted-foreground">Absent</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-accent">
                        {teacherHistory.filter((h: any) => h.status === 'leave' || h.status === 'Leave').length}
                      </div>
                      <p className="text-xs text-muted-foreground">On Leave</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-blue-600">
                        {teacherHistory.filter((h: any) => h.status === 'late' || h.status === 'Late').length}
                      </div>
                      <p className="text-xs text-muted-foreground">Late</p>
                    </CardContent>
                  </Card>
                </div>

                {/* History Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teacherHistory
                        .sort((a: any, b: any) => {
                          try {
                            const dateA = new Date(a.date || a.attendanceDate || 0);
                            const dateB = new Date(b.date || b.attendanceDate || 0);
                            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
                            return dateB.getTime() - dateA.getTime();
                          } catch {
                            return 0;
                          }
                        })
                        .map((record: any, index: number) => {
                          const recordDate = record.date || record.attendanceDate;
                          const checkIn = record.checkInTime || record.checkIn || record.check_in_time;
                          const checkOut = record.checkOutTime || record.checkOut || record.check_out_time;
                          const status = record.status || 'not-marked';
                          const remarks = record.remarks || record.notes || '';

                          // Helper function to format time strings (handles TIME fields from MySQL)
                          const formatTime = (timeValue: any): string => {
                            if (!timeValue) return '-';
                            
                            // If it's a time-only string (HH:MM or HH:MM:SS format from MySQL TIME field)
                            if (typeof timeValue === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(timeValue)) {
                              try {
                                const [hours, minutes] = timeValue.split(':');
                                const hour = parseInt(hours, 10);
                                if (isNaN(hour)) return timeValue;
                                
                                const ampm = hour >= 12 ? 'PM' : 'AM';
                                const displayHour = hour % 12 || 12;
                                return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
                              } catch {
                                return timeValue;
                              }
                            }
                            
                            // If it's a full datetime string, try to parse it
                            try {
                              const date = new Date(timeValue);
                              if (!isNaN(date.getTime())) {
                                return format(date, 'hh:mm a');
                              }
                            } catch {
                              // Invalid date, return as-is
                            }
                            
                            return '-';
                          };

                          // Helper function to format date safely
                          const formatDate = (dateValue: any): string => {
                            if (!dateValue) return '-';
                            try {
                              const date = new Date(dateValue);
                              if (!isNaN(date.getTime())) {
                                return format(date, 'dd MMM yyyy (EEE)');
                              }
                            } catch {
                              // Invalid date
                            }
                            return String(dateValue);
                          };

                          return (
                            <TableRow key={record.id || index}>
                              <TableCell className="font-medium">
                                {formatDate(recordDate)}
                              </TableCell>
                              <TableCell>
                                <span className={checkIn ? '' : 'text-muted-foreground'}>
                                  {formatTime(checkIn)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={checkOut ? '' : 'text-muted-foreground'}>
                                  {formatTime(checkOut)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    status === 'present' || status === 'Present'
                                      ? 'bg-secondary'
                                      : status === 'absent' || status === 'Absent'
                                      ? 'bg-destructive'
                                      : status === 'leave' || status === 'Leave'
                                      ? 'bg-accent'
                                      : status === 'late' || status === 'Late'
                                      ? 'bg-blue-600'
                                      : 'bg-muted'
                                  }
                                >
                                  {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate" title={remarks}>
                                {remarks || <span className="text-muted-foreground">-</span>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsViewHistoryOpen(false);
              setTeacherHistory([]);
              // Reset dates to default
              const date = new Date();
              date.setDate(date.getDate() - 30);
              setHistoryStartDate(date);
              setHistoryEndDate(new Date());
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>

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
    </UnifiedLayout>
  );
}
