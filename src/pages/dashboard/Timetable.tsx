import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { classesApi, teachersApi, timetableApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Edit, 
  Eye, 
  Clock, 
  Plus, 
  CalendarDays, 
  MessageCircle, 
  UserX, 
  Trash2,
  Send,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { format, addDays, startOfWeek, isWithinInterval, isSameDay } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  type: "class" | "break" | "lunch";
}

interface TimetableEntry {
  id?: string;
  slotId: string;
  day: string;
  subjectCode: string;
  teacherName: string;
}

interface Holiday {
  id: string;
  date: Date;
  name: string;
  type: "public" | "school" | "exam";
}

interface TeacherLeave {
  id: string;
  teacherName: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status?: 'pending' | 'approved' | 'rejected';
}

const initialTimeSlots: TimeSlot[] = [];

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Default subjects (will be replaced by API data)
const defaultSubjects: Array<{ code: string; name: string; color: string }> = [
  { code: "MATH", name: "Mathematics", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { code: "ENG", name: "English", color: "bg-green-100 text-green-700 border-green-200" },
  { code: "HIN", name: "Hindi", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { code: "SCI", name: "Science", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { code: "SST", name: "Social Studies", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { code: "COMP", name: "Computer", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { code: "ART", name: "Art", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { code: "PE", name: "Physical Ed.", color: "bg-red-100 text-red-700 border-red-200" },
];

// teachersList will be state, initialized below

const initialTimetableData: TimetableEntry[] = [];

const initialHolidays: Holiday[] = [];

const initialLeaves: TeacherLeave[] = [];

export default function Timetable() {
  const { dialog, confirm, close } = useConfirmDialog();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(initialTimeSlots);
  const [timetableData, setTimetableData] = useState<TimetableEntry[]>(initialTimetableData);
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [teacherLeaves, setTeacherLeaves] = useState<TeacherLeave[]>(initialLeaves);
  const [teachersList, setTeachersList] = useState<Array<{ id: string; name: string; phone: string; subjects: string[] }>>([]);
  const [subjectsList, setSubjectsList] = useState<Array<{ id?: string; code: string; name: string; color: string }>>(defaultSubjects);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [newSubject, setNewSubject] = useState({ code: "", name: "", color: "bg-gray-100 text-gray-700 border-gray-200" });
  
  // Dialog states
  const [isEditSlotOpen, setIsEditSlotOpen] = useState(false);
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);
  const [isAddLeaveOpen, setIsAddLeaveOpen] = useState(false);
  const [isEditEntryOpen, setIsEditEntryOpen] = useState(false);
  const [isSendAllDialogOpen, setIsSendAllDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<{ slotId: string; day: string } | null>(null);
  const [generatedTeacherLinks, setGeneratedTeacherLinks] = useState<Array<{ teacher: { id: string; name: string; phone: string }, message: string, url: string }>>([]);
  
  // Form states
  const [newHoliday, setNewHoliday] = useState({ name: "", type: "public" as Holiday["type"] });
  const [selectedHolidayDates, setSelectedHolidayDates] = useState<Date[]>([]);
  const [newLeave, setNewLeave] = useState({ teacherName: "", reason: "" });
  const [leaveStartDate, setLeaveStartDate] = useState<Date | undefined>(undefined);
  const [leaveEndDate, setLeaveEndDate] = useState<Date | undefined>(undefined);
  const [editEntry, setEditEntry] = useState({ subjectCode: "", teacherName: "" });
  
  const today = new Date();
  const todayName = today.toLocaleDateString("en-US", { weekday: "long" });

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        // Load subjects (school-wide, available to all)
        try {
          const subjectsData = await timetableApi.getSubjects();
          if (subjectsData && subjectsData.length > 0) {
            setSubjectsList(subjectsData);
          } else {
            // If no subjects in DB, use defaults and optionally seed them
            setSubjectsList(defaultSubjects);
          }
        } catch (error) {
          console.error('Error loading subjects:', error);
          // Use defaults on error
          setSubjectsList(defaultSubjects);
        }

        // Load time slots (school-wide, available to all)
        const slotsData = await timetableApi.getTimeSlots();
        const transformedSlots = (slotsData || []).map(s => {
          // Ensure time format is HH:MM for HTML time input
          const formatTime = (time: string) => {
            if (!time) return '';
            // If already in HH:MM format, return as is
            if (time.length === 5) return time;
            // If in HH:MM:SS format, remove seconds
            if (time.includes(':') && time.length >= 5) {
              return time.substring(0, 5);
            }
            return time;
          };

          return {
            id: s.id,
            startTime: formatTime(s.startTime),
            endTime: formatTime(s.endTime),
            type: s.type
          };
        });
        setTimeSlots(transformedSlots);

        // Load holidays (school-wide, available to all)
        const holidaysData = await timetableApi.getHolidays();
        const transformedHolidays = (holidaysData || []).map(h => ({
          id: h.id,
          date: new Date(h.date),
          name: h.name,
          type: h.type
        }));
        setHolidays(transformedHolidays);

        // Load teacher leaves (school-wide, available to all)
        const leavesData = await timetableApi.getLeaves();
        const transformedLeaves = (leavesData || []).map(l => ({
          id: l.id,
          teacherName: l.teacherName,
          startDate: new Date(l.startDate),
          endDate: new Date(l.endDate),
          reason: l.reason || "",
          status: l.status || 'pending'
        }));
        setTeacherLeaves(transformedLeaves);

        // Admin-specific: Load classes and teachers
        if (isAdmin) {
          const classesData = await classesApi.getAll();
          setClasses(classesData || []);

          const teachersData = await teachersApi.getAll();
          const transformedTeachers = (teachersData || []).map(t => ({
            id: t.id,
            name: t.name,
            phone: t.phone || "",
            subjects: t.subjects || []
          }));
          setTeachersList(transformedTeachers);
        } else {
          // Teacher-specific: Load their assigned class
          try {
            const classesData = await classesApi.getAll(); // Already filtered for teacher
            if (classesData && classesData.length > 0) {
              const teacherClass = classesData[0];
              setSelectedClass(`${teacherClass.name}${teacherClass.section ? `-${teacherClass.section}` : ''}`);
              setSelectedClassId(teacherClass.id);
              setClasses(classesData); // Store for reference
            }
          } catch (error) {
            console.error('Error loading teacher class:', error);
            toast({
              title: "Error",
              description: "Failed to load your assigned class",
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        console.error('Error loading timetable data:', error);
        toast({ 
          title: "Error", 
          description: "Failed to load timetable data",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [isAdmin]);

  // Load timetable when class is selected (works for both admin and teacher)
  useEffect(() => {
    const loadTimetable = async () => {
      if (!selectedClassId) return;

      try {
        const entriesData = await timetableApi.getTimetableByClass(selectedClassId);
        const transformedEntries = (entriesData || []).map(e => ({
          id: e.id,
          slotId: e.slotId,
          day: e.day,
          subjectCode: e.subjectCode,
          teacherName: e.teacherName
        }));
        setTimetableData(transformedEntries);
      } catch (error) {
        console.error('Error loading timetable:', error);
        toast({ 
          title: "Error", 
          description: "Failed to load timetable",
          variant: "destructive"
        });
      }
    };

    loadTimetable();
  }, [selectedClassId]);

  // Check if a date is a holiday
  const isHoliday = (date: Date) => {
    return holidays.some(h => isSameDay(h.date, date));
  };

  // Get holiday name for a date
  const getHolidayName = (date: Date) => {
    const holiday = holidays.find(h => isSameDay(h.date, date));
    return holiday?.name;
  };

  // Check if teacher is on leave for a specific date (only approved leaves)
  const isTeacherOnLeave = (teacherName: string, date: Date) => {
    return teacherLeaves.some(leave => 
      leave.teacherName === teacherName &&
      leave.status === 'approved' &&
      isWithinInterval(date, { start: leave.startDate, end: leave.endDate })
    );
  };

  // Get subject color
  const getSubjectColor = (code: string) => {
    return subjectsList.find(s => s.code === code)?.color || "bg-muted";
  };

  // Get subject name
  const getSubjectName = (code: string) => {
    return subjectsList.find(s => s.code === code)?.name || "";
  };

  // Get timetable entry
  const getEntry = (slotId: string, day: string) => {
    return timetableData.find(e => e.slotId === slotId && e.day === day);
  };

  // Add holiday (supports multiple dates)
  const handleAddHoliday = async () => {
    if (selectedHolidayDates.length === 0 || !newHoliday.name.trim()) return;
    
    try {
      const newHolidays: Holiday[] = [];
      let successCount = 0;
      let errorCount = 0;

      // Create a holiday for each selected date
      for (const date of selectedHolidayDates) {
        try {
          const dateStr = date.toISOString().split('T')[0];
          const result = await timetableApi.createHoliday({
            date: dateStr,
            name: newHoliday.name.trim(),
            type: newHoliday.type,
          });

          const holiday: Holiday = {
            id: result.id,
            date: date,
            name: newHoliday.name.trim(),
            type: newHoliday.type,
          };
          
          newHolidays.push(holiday);
          successCount++;
        } catch (error: any) {
          console.error(`Failed to add holiday for date ${date.toISOString().split('T')[0]}:`, error);
          errorCount++;
        }
      }

      if (newHolidays.length > 0) {
        setHolidays([...holidays, ...newHolidays]);
      }

      setNewHoliday({ name: "", type: "public" });
      setSelectedHolidayDates([]);
      setIsAddHolidayOpen(false);
      
      if (errorCount === 0) {
        toast({ 
          title: "Holidays Added", 
          description: `${successCount} holiday(s) added successfully` 
        });
      } else {
        toast({ 
          title: "Partial Success", 
          description: `${successCount} holiday(s) added, ${errorCount} failed`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to add holidays",
        variant: "destructive"
      });
    }
  };

  // Delete holiday
  const handleDeleteHoliday = async (id: string) => {
    try {
      await timetableApi.deleteHoliday(id);
      setHolidays(holidays.filter(h => h.id !== id));
      toast({ title: "Holiday Removed" });
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to delete holiday",
        variant: "destructive"
      });
    }
  };

  // Add teacher leave (Admin only - for backward compatibility, but should be removed)
  // Note: Teachers should apply for leave through Attendance page, not here
  const handleAddLeave = async () => {
    if (!isAdmin) {
      toast({ 
        title: "Error", 
        description: "Only teachers can apply for leave. Please use the Attendance page.",
        variant: "destructive"
      });
      return;
    }
    
    if (!leaveStartDate || !leaveEndDate || !newLeave.teacherName) return;
    
    try {
      const teacher = teachersList.find(t => t.name === newLeave.teacherName);
      if (!teacher) {
        toast({ 
          title: "Error", 
          description: "Teacher not found",
          variant: "destructive"
        });
        return;
      }

      const startDateStr = leaveStartDate.toISOString().split('T')[0];
      const endDateStr = leaveEndDate.toISOString().split('T')[0];

      const result = await timetableApi.createLeave({
        teacherId: teacher.id,
        teacherName: newLeave.teacherName,
        startDate: startDateStr,
        endDate: endDateStr,
        reason: newLeave.reason,
      });

      const leave: TeacherLeave = {
        id: result.id,
        teacherName: newLeave.teacherName,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: newLeave.reason,
        status: 'pending', // Admin-created leaves should also be pending
      };
      
      setTeacherLeaves([...teacherLeaves, leave]);
      setNewLeave({ teacherName: "", reason: "" });
      setLeaveStartDate(undefined);
      setLeaveEndDate(undefined);
      setIsAddLeaveOpen(false);
      toast({ title: "Leave Added", description: `Leave marked for ${leave.teacherName}` });
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to add leave",
        variant: "destructive"
      });
    }
  };

  // Update timetable entry
  const handleUpdateEntry = async () => {
    if (!selectedClassId) {
      toast({ 
        title: "Class Required", 
        description: "Please select a class from the dropdown above",
        variant: "destructive"
      });
      setIsEditEntryOpen(false);
      return;
    }

    if (!selectedEntry) {
      toast({ 
        title: "Slot Required", 
        description: "Please select a time slot",
        variant: "destructive"
      });
      setIsEditEntryOpen(false);
      return;
    }

    if (!editEntry.subjectCode || !editEntry.teacherName) {
      toast({ 
        title: "Validation Error", 
        description: "Please select both subject and teacher",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const subject = subjectsList.find(s => s.code === editEntry.subjectCode);
      if (!subject) {
        toast({ 
          title: "Error", 
          description: "Subject not found",
          variant: "destructive"
        });
        return;
      }

      const teacher = teachersList.find(t => t.name === editEntry.teacherName);
      if (!teacher) {
        toast({ 
          title: "Error", 
          description: "Teacher not found",
          variant: "destructive"
        });
        return;
      }

      console.log('Updating timetable entry:', {
        classId: selectedClassId,
        slotId: selectedEntry.slotId,
        day: selectedEntry.day,
        subjectCode: editEntry.subjectCode,
        subjectName: subject.name,
        teacherId: teacher.id,
        teacherName: editEntry.teacherName,
      });
      
      const result = await timetableApi.createOrUpdateEntry({
        classId: selectedClassId,
        slotId: selectedEntry.slotId,
        day: selectedEntry.day,
        subjectCode: editEntry.subjectCode,
        subjectName: subject.name,
        teacherId: teacher.id,
        teacherName: editEntry.teacherName,
      });

      console.log('API response:', result);

      // Reload timetable data to get the updated entry
      const entriesData = await timetableApi.getTimetableByClass(selectedClassId);
      const transformedEntries = (entriesData || []).map(e => ({
        id: e.id,
        slotId: e.slotId,
        day: e.day,
        subjectCode: e.subjectCode,
        subjectName: e.subjectName,
        teacherId: e.teacherId,
        teacherName: e.teacherName
      }));
      setTimetableData(transformedEntries);
      
      setIsEditEntryOpen(false);
      setSelectedEntry(null);
      setEditEntry({ subjectCode: "", teacherName: "" });
      toast({ title: "Timetable Updated", description: "Entry saved successfully" });
    } catch (error: any) {
      console.error('Error updating timetable entry:', error);
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to update timetable. Please check the console for details.",
        variant: "destructive"
      });
    }
  };

  // Generate WhatsApp message for teacher's weekly timetable
  const generateTeacherWeeklyMessage = async (teacherName: string) => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    
    let message = `📚 *Weekly Timetable for ${teacherName}*\n`;
    message += `Week: ${format(weekStart, "dd MMM")} - ${format(addDays(weekStart, 6), "dd MMM yyyy")}\n\n`;
    
    // Fetch timetable entries for ALL classes this teacher teaches
    const allTeacherEntries: Array<{ entry: TimetableEntry; className: string; classId: string }> = [];
    
    for (const classItem of classes) {
      try {
        const entriesData = await timetableApi.getTimetableByClass(classItem.id);
        const classEntries = (entriesData || [])
          .filter(e => e.teacherName === teacherName)
          .map(e => ({
            entry: e,
            className: `${classItem.name}${classItem.section ? ` - Section ${classItem.section}` : ''}`,
            classId: classItem.id
          }));
        allTeacherEntries.push(...classEntries);
      } catch (error) {
        console.error(`Error fetching timetable for class ${classItem.id}:`, error);
      }
    }
    
    // If no entries found
    if (allTeacherEntries.length === 0) {
      message += "No classes scheduled for this week.\n";
    } else {
      // Group entries by class
      const entriesByClass = new Map<string, { entries: TimetableEntry[], classId: string }>();
      allTeacherEntries.forEach(({ entry, className, classId }) => {
        if (!entriesByClass.has(className)) {
          entriesByClass.set(className, { entries: [], classId });
        }
        entriesByClass.get(className)!.entries.push(entry);
      });
      
      // Generate message grouped by class
      entriesByClass.forEach(({ entries: classEntries }, className) => {
        message += `\n📖 *${className}*\n`;
        
        days.forEach(day => {
          const dayDate = addDays(weekStart, days.indexOf(day));
          
          if (isHoliday(dayDate)) {
            message += `  *${day}*: 🎉 Holiday - ${getHolidayName(dayDate)}\n`;
            return;
          }
          
          const dayEntries = classEntries.filter(e => e.day === day);
          if (dayEntries.length === 0) {
            // Don't show "No classes" for each day, only show if there are classes
            return;
          }
          
          // Sort by time slot
          dayEntries.sort((a, b) => {
            const slotA = timeSlots.find(s => s.id === a.slotId);
            const slotB = timeSlots.find(s => s.id === b.slotId);
            if (!slotA || !slotB) return 0;
            return slotA.startTime.localeCompare(slotB.startTime);
          });
          
          dayEntries.forEach(entry => {
            const slot = timeSlots.find(s => s.id === entry.slotId);
            if (slot) {
              message += `  *${day}*: ${slot.startTime}-${slot.endTime} - ${getSubjectName(entry.subjectCode)}\n`;
            }
          });
        });
        
        message += "\n";
      });
    }
    
    // Check for leaves
    const activeLeaves = teacherLeaves.filter(l => 
      l.teacherName === teacherName &&
      isWithinInterval(new Date(), { start: l.startDate, end: l.endDate })
    );
    
    if (activeLeaves.length > 0) {
      message += `\n⚠️ *Note*: You have approved leave from ${format(activeLeaves[0].startDate, "dd MMM")} to ${format(activeLeaves[0].endDate, "dd MMM")}`;
    }
    
    return message;
  };

  // Send WhatsApp message
  const sendWhatsAppMessage = async (teacherName: string) => {
    const teacher = teachersList.find(t => t.name === teacherName);
    if (!teacher || !teacher.phone) {
      toast({ 
        title: "Error", 
        description: `Phone number not available for ${teacherName}`,
        variant: "destructive"
      });
      return;
    }
    
    try {
      const message = await generateTeacherWeeklyMessage(teacherName);
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/91${teacher.phone.replace(/\D/g, '')}?text=${encodedMessage}`;
      
      window.open(whatsappUrl, "_blank");
      toast({ title: "WhatsApp Opened", description: `Sending timetable to ${teacherName}` });
    } catch (error) {
      console.error(`Error generating message for ${teacherName}:`, error);
      toast({ 
        title: "Error", 
        description: `Failed to generate timetable for ${teacherName}`,
        variant: "destructive"
      });
    }
  };

  // Send to all teachers
  const sendToAllTeachers = async () => {
    if (teachersList.length === 0) {
      toast({ 
        title: "No Teachers", 
        description: "No teachers available to send messages to",
        variant: "destructive"
      });
      return;
    }

    confirm(
      "Generate WhatsApp Links",
      `Generate WhatsApp links for all ${teachersList.length} teachers?\n\nA dialog will open with links for each teacher. Click each link to send their timetable.`,
      async () => {
        toast({ 
          title: "Generating Messages", 
          description: `Preparing timetables for ${teachersList.length} teachers...` 
        });

        // Generate all messages first
        const teacherMessages: Array<{ teacher: { id: string; name: string; phone: string }, message: string, url: string }> = [];
        
        for (const teacher of teachersList) {
          if (!teacher.phone) {
            console.warn(`Skipping ${teacher.name} - no phone number`);
            continue;
          }
          
          try {
            const message = await generateTeacherWeeklyMessage(teacher.name);
            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/91${teacher.phone.replace(/\D/g, '')}?text=${encodedMessage}`;
            
            teacherMessages.push({
              teacher: {
                id: teacher.id,
                name: teacher.name,
                phone: teacher.phone
              },
              message,
              url: whatsappUrl
            });
          } catch (error) {
            console.error(`Error generating message for ${teacher.name}:`, error);
            toast({ 
              title: "Error", 
              description: `Failed to generate timetable for ${teacher.name}`,
              variant: "destructive"
            });
          }
        }

        // Store in state to show in dialog
        setGeneratedTeacherLinks(teacherMessages);
        setIsSendAllDialogOpen(true);
        
        toast({ 
          title: "Ready", 
          description: `Generated ${teacherMessages.length} timetable messages. Click each link to send.` 
        });
      }
    );
  };

  if (isLoading) {
    return (
      <UnifiedLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading timetable data...</p>
          </div>
        </div>
      </UnifiedLayout>
    );
  }

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Timetable</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? "Create and manage weekly timetables with holidays and leaves"
                : "View your class timetable"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isAdmin ? (
              <>
                <Select value={selectedClass} onValueChange={(value) => {
                  setSelectedClass(value);
                  const classData = classes.find(c => `${c.name}${c.section ? `-${c.section}` : ''}` === value);
                  setSelectedClassId(classData?.id || "");
                }}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={`${cls.name}${cls.section ? `-${cls.section}` : ''}`}>
                        {cls.name}{cls.section ? ` - Section ${cls.section}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={sendToAllTeachers}>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Send to All
                </Button>
              </>
            ) : (
              <Badge variant="secondary" className="text-xs">
                <Eye className="w-3 h-3 mr-1" />
                View Only
              </Badge>
            )}
          </div>
        </div>

        <Tabs defaultValue="week" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="week">Weekly View</TabsTrigger>
            <TabsTrigger value="today">Today's Schedule</TabsTrigger>
            <TabsTrigger value="holidays">Holidays Calendar</TabsTrigger>
            <TabsTrigger value="leaves">Teacher Leaves</TabsTrigger>
            {isAdmin && <TabsTrigger value="settings">Time Slots</TabsTrigger>}
          </TabsList>

          {/* Weekly Timetable */}
          <TabsContent value="week">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{selectedClass ? `Class ${selectedClass} - Weekly Timetable` : "Weekly Timetable"}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-7 gap-2">
                    {/* Header */}
                    <div className="p-3 text-center font-medium text-muted-foreground">
                      <Clock className="w-4 h-4 mx-auto mb-1" />
                      Time
                    </div>
                    {days.map((day) => {
                      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
                      const dayDate = addDays(weekStart, days.indexOf(day));
                      const holidayName = getHolidayName(dayDate);
                      
                      return (
                        <div 
                          key={day} 
                          className={`p-3 text-center font-medium rounded-lg ${
                            holidayName 
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : day === todayName 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-muted"
                          }`}
                        >
                          {day}
                          {holidayName && <span className="block text-xs">🎉 {holidayName}</span>}
                          {day === todayName && !holidayName && <span className="block text-xs opacity-80">Today</span>}
                        </div>
                      );
                    })}

                    {/* Time Slots */}
                    {timeSlots.map((slot) => {
                      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
                      
                      return (
                        <>
                          <div 
                            key={`time-${slot.id}`} 
                            className={`p-3 text-center text-sm font-medium rounded-lg ${
                              slot.type === "break" || slot.type === "lunch"
                                ? "bg-muted/80 text-muted-foreground"
                                : "bg-muted/50 text-muted-foreground"
                            }`}
                          >
                            {slot.startTime} - {slot.endTime}
                            {slot.type !== "class" && (
                              <span className="block text-xs capitalize">({slot.type})</span>
                            )}
                          </div>
                          {days.map((day) => {
                            const dayDate = addDays(weekStart, days.indexOf(day));
                            
                            // Check if holiday
                            if (isHoliday(dayDate)) {
                              return (
                                <div 
                                  key={`${day}-${slot.id}`} 
                                  className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-center"
                                >
                                  <span className="text-amber-600 text-xs">Holiday</span>
                                </div>
                              );
                            }
                            
                            // Break/Lunch
                            if (slot.type === "break" || slot.type === "lunch") {
                              return (
                                <div 
                                  key={`${day}-${slot.id}`} 
                                  className="p-2 rounded-lg bg-muted text-center"
                                >
                                  <span className="text-muted-foreground text-sm capitalize">{slot.type}</span>
                                </div>
                              );
                            }
                            
                            const entry = getEntry(slot.id, day);
                            
                            if (!entry) {
                              return (
                                <div 
                                  key={`${day}-${slot.id}`} 
                                  className={`p-2 rounded-lg border border-dashed border-border text-center ${
                                    isAdmin ? "cursor-pointer hover:bg-muted/50" : ""
                                  }`}
                                  onClick={() => {
                                    if (isAdmin) {
                                      if (!selectedClassId) {
                                        toast({ 
                                          title: "Class Required", 
                                          description: "Please select a class first from the dropdown above",
                                          variant: "destructive"
                                        });
                                        return;
                                      }
                                      setSelectedEntry({ slotId: slot.id, day });
                                      setEditEntry({ subjectCode: "", teacherName: "" });
                                      setIsEditEntryOpen(true);
                                    }
                                  }}
                                >
                                  {isAdmin && <Plus className="w-4 h-4 mx-auto text-muted-foreground" />}
                                </div>
                              );
                            }
                            
                            const teacherOnLeave = isTeacherOnLeave(entry.teacherName, dayDate);
                            
                            return (
                              <div
                                key={`${day}-${slot.id}`}
                                className={`p-2 rounded-lg border text-center relative ${
                                  teacherOnLeave 
                                    ? "bg-red-50 border-red-200" 
                                    : getSubjectColor(entry.subjectCode)
                                } ${isAdmin ? "cursor-pointer" : ""}`}
                                onClick={() => {
                                  if (isAdmin) {
                                    if (!selectedClassId) {
                                      toast({ 
                                        title: "Class Required", 
                                        description: "Please select a class first from the dropdown above",
                                        variant: "destructive"
                                      });
                                      return;
                                    }
                                    setSelectedEntry({ slotId: slot.id, day });
                                    setEditEntry({ 
                                      subjectCode: entry.subjectCode, 
                                      teacherName: entry.teacherName 
                                    });
                                    setIsEditEntryOpen(true);
                                  }
                                }}
                              >
                                <p className="font-medium text-sm">{getSubjectName(entry.subjectCode)}</p>
                                <p className={`text-xs mt-0.5 ${teacherOnLeave ? "text-red-600" : "opacity-75"}`}>
                                  {entry.teacherName}
                                  {teacherOnLeave && (
                                    <span className="block text-red-500 font-medium">
                                      <UserX className="w-3 h-3 inline mr-1" />
                                      On Leave
                                    </span>
                                  )}
                                </p>
                              </div>
                            );
                          })}
                        </>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Subjects</span>
                  {isAdmin && (
                    <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Subject
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Add New Subject</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Subject Code</Label>
                            <Input 
                              placeholder="e.g., MATH, ENG" 
                              value={newSubject.code}
                              onChange={(e) => setNewSubject(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                              maxLength={10}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Subject Name</Label>
                            <Input 
                              placeholder="e.g., Mathematics" 
                              value={newSubject.name}
                              onChange={(e) => setNewSubject(prev => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Color Class</Label>
                            <Input 
                              placeholder="e.g., bg-blue-100 text-blue-700 border-blue-200" 
                              value={newSubject.color}
                              onChange={(e) => setNewSubject(prev => ({ ...prev, color: e.target.value }))}
                            />
                            <p className="text-xs text-muted-foreground">
                              Tailwind CSS classes for background, text, and border colors
                            </p>
                          </div>
                          <Button 
                            className="w-full" 
                            onClick={async () => {
                              if (!newSubject.code || !newSubject.name) {
                                toast({ 
                                  title: "Validation Error", 
                                  description: "Please fill in subject code and name",
                                  variant: "destructive"
                                });
                                return;
                              }
                              try {
                                await timetableApi.createSubject({
                                  code: newSubject.code,
                                  name: newSubject.name,
                                  color: newSubject.color
                                });
                                // Reload subjects
                                const subjectsData = await timetableApi.getSubjects();
                                if (subjectsData && subjectsData.length > 0) {
                                  setSubjectsList(subjectsData);
                                }
                                setNewSubject({ code: "", name: "", color: "bg-gray-100 text-gray-700 border-gray-200" });
                                setIsAddSubjectOpen(false);
                                toast({ title: "Subject Added" });
                              } catch (error: any) {
                                toast({ 
                                  title: "Error", 
                                  description: error?.message || "Failed to add subject",
                                  variant: "destructive"
                                });
                              }
                            }}
                            disabled={!newSubject.code || !newSubject.name}
                          >
                            Add Subject
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-3">
                  {subjectsList.map((subject) => (
                    <div key={subject.code} className="flex items-center gap-2">
                      <div className={`px-3 py-1.5 rounded-lg text-sm ${subject.color}`}>
                        {subject.name}
                      </div>
                      {isAdmin && subject.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={async () => {
                            confirm(
                              "Delete Subject",
                              `Delete subject "${subject.name}"?`,
                              async () => {
                                try {
                                  await timetableApi.deleteSubject(subject.id!);
                                  // Reload subjects
                                  const subjectsData = await timetableApi.getSubjects();
                                  if (subjectsData && subjectsData.length > 0) {
                                  setSubjectsList(subjectsData);
                                } else {
                                  setSubjectsList(defaultSubjects);
                                }
                                toast({ title: "Subject Deleted" });
                                } catch (error: any) {
                                  toast({ 
                                    title: "Error", 
                                    description: error?.message || "Failed to delete subject",
                                    variant: "destructive"
                                  });
                                }
                              },
                              {
                                variant: "destructive",
                                confirmText: "Delete",
                              }
                            );
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <div className="px-3 py-1.5 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                    <UserX className="w-3 h-3 inline mr-1" />
                    Teacher on Leave
                  </div>
                  <div className="px-3 py-1.5 rounded-lg text-sm bg-amber-100 text-amber-700 border border-amber-200">
                    🎉 Holiday
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Today's Schedule */}
          <TabsContent value="today">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Today's Schedule - {todayName}
                  {isHoliday(today) && (
                    <Badge className="ml-2 bg-amber-500">🎉 {getHolidayName(today)}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isHoliday(today) ? (
                  <div className="text-center py-12">
                    <CalendarDays className="w-16 h-16 mx-auto text-amber-500 mb-4" />
                    <h3 className="text-xl font-semibold">It's a Holiday!</h3>
                    <p className="text-muted-foreground">{getHolidayName(today)}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {timeSlots.map((slot) => {
                      const entry = getEntry(slot.id, todayName);
                      const currentHour = new Date().getHours();
                      const currentMin = new Date().getMinutes();
                      const [slotHour, slotMin] = slot.startTime.split(":").map(Number);
                      const [endHour, endMin] = slot.endTime.split(":").map(Number);
                      
                      const isCurrentPeriod = 
                        (currentHour > slotHour || (currentHour === slotHour && currentMin >= slotMin)) &&
                        (currentHour < endHour || (currentHour === endHour && currentMin < endMin));
                      
                      if (slot.type !== "class") {
                        return (
                          <div
                            key={slot.id}
                            className={`flex items-center gap-4 p-4 rounded-xl border ${
                              isCurrentPeriod ? "border-primary bg-primary/5" : "border-border"
                            }`}
                          >
                            <div className="w-16 text-center text-muted-foreground">
                              <p className="text-sm">{slot.startTime}</p>
                              <p className="text-xs">to</p>
                              <p className="text-sm">{slot.endTime}</p>
                            </div>
                            <div className="w-px h-12 bg-border" />
                            <div className="flex-1 px-4 py-2 rounded-lg bg-muted">
                              <p className="font-semibold capitalize">{slot.type}</p>
                            </div>
                            {isCurrentPeriod && <Badge className="bg-primary">Now</Badge>}
                          </div>
                        );
                      }

                      if (!entry) return null;
                      
                      const teacherOnLeave = isTeacherOnLeave(entry.teacherName, today);

                      return (
                        <div
                          key={slot.id}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                            isCurrentPeriod 
                              ? "border-primary bg-primary/5 shadow-sm" 
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <div className={`w-16 text-center ${isCurrentPeriod ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                            <p className="text-sm">{slot.startTime}</p>
                            <p className="text-xs">to</p>
                            <p className="text-sm">{slot.endTime}</p>
                          </div>
                          <div className="w-px h-12 bg-border" />
                          <div className={`flex-1 px-4 py-2 rounded-lg ${
                            teacherOnLeave ? "bg-red-50 border border-red-200" : getSubjectColor(entry.subjectCode)
                          }`}>
                            <p className="font-semibold">{getSubjectName(entry.subjectCode)}</p>
                            <p className={`text-sm ${teacherOnLeave ? "text-red-600" : "opacity-75"}`}>
                              {entry.teacherName}
                              {teacherOnLeave && " (On Leave)"}
                            </p>
                          </div>
                          {isCurrentPeriod && <Badge className="bg-primary">Now</Badge>}
                          {teacherOnLeave && <Badge variant="destructive">Substitute Needed</Badge>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Holidays Calendar */}
          <TabsContent value="holidays">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CalendarDays className="w-5 h-5 text-primary" />
                      Holidays Calendar
                    </span>
                    {isAdmin && (
                      <Dialog open={isAddHolidayOpen} onOpenChange={setIsAddHolidayOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Holiday
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Holiday</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Holiday Name</Label>
                              <Input 
                                placeholder="e.g., Diwali" 
                                value={newHoliday.name}
                                onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <Select 
                                value={newHoliday.type} 
                                onValueChange={(v: Holiday["type"]) => setNewHoliday(prev => ({ ...prev, type: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card">
                                  <SelectItem value="public">Public Holiday</SelectItem>
                                  <SelectItem value="school">School Holiday</SelectItem>
                                  <SelectItem value="exam">Exam Holiday</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Date{selectedHolidayDates.length > 0 && ` (${selectedHolidayDates.length} selected)`}</Label>
                              <Calendar
                                mode="multiple"
                                selected={selectedHolidayDates}
                                onSelect={(dates) => setSelectedHolidayDates(dates || [])}
                                className="rounded-md border pointer-events-auto"
                              />
                              {selectedHolidayDates.length > 0 && (
                                <div className="mt-2 p-2 bg-muted rounded-md">
                                  <p className="text-xs text-muted-foreground mb-1">Selected dates:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {selectedHolidayDates
                                      .sort((a, b) => a.getTime() - b.getTime())
                                      .map((date, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs">
                                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </Badge>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <Button 
                              className="w-full" 
                              onClick={handleAddHoliday} 
                              disabled={selectedHolidayDates.length === 0 || !newHoliday.name.trim()}
                            >
                              Add Holiday{selectedHolidayDates.length > 1 ? ` (${selectedHolidayDates.length} dates)` : ''}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    className="rounded-md border pointer-events-auto"
                    modifiers={{
                      holiday: holidays.map(h => h.date)
                    }}
                    modifiersStyles={{
                      holiday: { backgroundColor: "hsl(var(--chart-4))", color: "white", fontWeight: "bold" }
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Upcoming Holidays</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {holidays
                      .filter(h => h.date >= today)
                      .sort((a, b) => a.date.getTime() - b.date.getTime())
                      .map((holiday) => (
                        <div 
                          key={holiday.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              holiday.type === "public" ? "bg-amber-100 text-amber-700" :
                              holiday.type === "school" ? "bg-blue-100 text-blue-700" :
                              "bg-purple-100 text-purple-700"
                            }`}>
                              🎉
                            </div>
                            <div>
                              <p className="font-medium">{holiday.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(holiday.date, "EEEE, dd MMM yyyy")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">{holiday.type}</Badge>
                            {isAdmin && (
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteHoliday(holiday.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    {holidays.filter(h => h.date >= today).length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No upcoming holidays</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Teacher Leaves */}
          <TabsContent value="leaves">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <UserX className="w-5 h-5 text-primary" />
                    Teacher Leaves
                    {isAdmin && (
                      <Badge variant="outline" className="ml-2">
                        {teacherLeaves.filter(l => l.status === 'pending').length} Pending
                      </Badge>
                    )}
                  </span>
                  {/* Admins cannot add leaves directly - only teachers can apply through Attendance page */}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teacherLeaves.map((leave) => {
                      const isActive = isWithinInterval(today, { start: leave.startDate, end: leave.endDate });
                      const isPast = leave.endDate < today;
                      
                      return (
                        <TableRow key={leave.id}>
                          <TableCell className="font-medium">{leave.teacherName}</TableCell>
                          <TableCell>
                            {format(leave.startDate, "dd MMM")} - {format(leave.endDate, "dd MMM yyyy")}
                          </TableCell>
                          <TableCell>{leave.reason}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                leave.status === 'pending' ? "outline" : 
                                leave.status === 'approved' ? "default" : 
                                "secondary"
                              }
                              className={
                                leave.status === 'pending' ? "border-yellow-500 text-yellow-700" :
                                leave.status === 'approved' ? "bg-green-100 text-green-700 border-green-200" :
                                "bg-red-100 text-red-700 border-red-200"
                              }
                            >
                              {leave.status === 'pending' ? 'Pending' : 
                               leave.status === 'approved' ? 'Approved' : 
                               leave.status === 'rejected' ? 'Rejected' : 
                               'Pending'}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {leave.status === 'pending' && (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          await timetableApi.approveLeave(leave.id);
                                          setTeacherLeaves(teacherLeaves.map(l => 
                                            l.id === leave.id ? { ...l, status: 'approved' as const } : l
                                          ));
                                          toast({ 
                                            title: "Success", 
                                            description: "Leave approved successfully" 
                                          });
                                        } catch (error: any) {
                                          toast({ 
                                            title: "Error", 
                                            description: error?.message || "Failed to approve leave",
                                            variant: "destructive"
                                          });
                                        }
                                      }}
                                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    >
                                      <CheckCircle2 className="w-4 h-4 mr-1" />
                                      Approve
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          await timetableApi.rejectLeave(leave.id);
                                          setTeacherLeaves(teacherLeaves.map(l => 
                                            l.id === leave.id ? { ...l, status: 'rejected' as const } : l
                                          ));
                                          toast({ 
                                            title: "Success", 
                                            description: "Leave rejected" 
                                          });
                                        } catch (error: any) {
                                          toast({ 
                                            title: "Error", 
                                            description: error?.message || "Failed to reject leave",
                                            variant: "destructive"
                                          });
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <XCircle className="w-4 h-4 mr-1" />
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {leave.status !== 'pending' && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={async () => {
                                      try {
                                        await timetableApi.deleteLeave(leave.id);
                                        setTeacherLeaves(teacherLeaves.filter(l => l.id !== leave.id));
                                        toast({ title: "Leave Deleted" });
                                      } catch (error: any) {
                                        toast({ 
                                          title: "Error", 
                                          description: error?.message || "Failed to delete leave",
                                          variant: "destructive"
                                        });
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                    {teacherLeaves.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No leaves recorded
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* WhatsApp Notification Section */}
            {isAdmin && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                    Send Timetable via WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Send weekly timetable to teachers including holidays and their leave status.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {teachersList.map((teacher) => (
                      <div 
                        key={teacher.name}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div>
                          <p className="font-medium">{teacher.name}</p>
                          <p className="text-xs text-muted-foreground">+91 {teacher.phone}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => sendWhatsAppMessage(teacher.name)}>
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Time Slots Settings */}
          {isAdmin && (
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      Time Slots Configuration
                    </span>
                    <Button size="sm" onClick={async () => {
                      try {
                        const result = await timetableApi.createTimeSlot({
                          startTime: "14:30",
                          endTime: "15:15",
                          type: "class",
                          displayOrder: timeSlots.length
                        });

                        const newSlot: TimeSlot = {
                          id: result.id,
                          startTime: "14:30",
                          endTime: "15:15",
                          type: "class"
                        };
                        setTimeSlots([...timeSlots, newSlot]);
                        toast({ title: "Time Slot Added" });
                      } catch (error: any) {
                        console.error('Error creating time slot:', error);
                        const errorMessage = error?.message || "Failed to add time slot";
                        if (errorMessage.includes('Database tables not found') || errorMessage.includes('doesn\'t exist')) {
                          toast({ 
                            title: "Database Setup Required", 
                            description: "Timetable tables not found. Please run the database schema first.",
                            variant: "destructive"
                          });
                        } else {
                          toast({ 
                            title: "Error", 
                            description: errorMessage,
                            variant: "destructive"
                          });
                        }
                      }
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Slot
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Start Time</TableHead>
                        <TableHead>End Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeSlots.map((slot, index) => (
                        <TableRow key={slot.id}>
                          <TableCell>
                            <Input 
                              type="time"
                              value={slot.startTime || ''}
                              className="w-32"
                              disabled={!isAdmin}
                              onChange={async (e) => {
                                const newValue = e.target.value;
                                // Optimistically update UI first
                                const updated = [...timeSlots];
                                updated[index].startTime = newValue;
                                setTimeSlots(updated);
                                
                                try {
                                  await timetableApi.updateTimeSlot(slot.id, { startTime: newValue });
                                } catch (error: any) {
                                  // Revert on error
                                  const reverted = [...timeSlots];
                                  reverted[index].startTime = slot.startTime;
                                  setTimeSlots(reverted);
                                  toast({ 
                                    title: "Error", 
                                    description: error?.message || "Failed to update time slot",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              type="time"
                              value={slot.endTime || ''}
                              className="w-32"
                              disabled={!isAdmin}
                              onChange={async (e) => {
                                const newValue = e.target.value;
                                // Optimistically update UI first
                                const updated = [...timeSlots];
                                updated[index].endTime = newValue;
                                setTimeSlots(updated);
                                
                                try {
                                  await timetableApi.updateTimeSlot(slot.id, { endTime: newValue });
                                } catch (error: any) {
                                  // Revert on error
                                  const reverted = [...timeSlots];
                                  reverted[index].endTime = slot.endTime;
                                  setTimeSlots(reverted);
                                  toast({ 
                                    title: "Error", 
                                    description: error?.message || "Failed to update time slot",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={slot.type} 
                              onValueChange={async (v: TimeSlot["type"]) => {
                                try {
                                  await timetableApi.updateTimeSlot(slot.id, { type: v });
                                  const updated = [...timeSlots];
                                  updated[index].type = v;
                                  setTimeSlots(updated);
                                } catch (error: any) {
                                  toast({ 
                                    title: "Error", 
                                    description: error?.message || "Failed to update time slot",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card">
                                <SelectItem value="class">Class</SelectItem>
                                <SelectItem value="break">Break</SelectItem>
                                <SelectItem value="lunch">Lunch</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={async () => {
                                try {
                                  await timetableApi.deleteTimeSlot(slot.id);
                                  setTimeSlots(timeSlots.filter(s => s.id !== slot.id));
                                  toast({ title: "Time Slot Deleted" });
                                } catch (error: any) {
                                  toast({ 
                                    title: "Error", 
                                    description: error?.message || "Failed to delete time slot",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Edit Entry Dialog */}
        <Dialog open={isEditEntryOpen} onOpenChange={setIsEditEntryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Timetable Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={editEntry.subjectCode} onValueChange={(v) => setEditEntry(prev => ({ ...prev, subjectCode: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    {subjectsList.map(s => (
                      <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Teacher</Label>
                <Select value={editEntry.teacherName} onValueChange={(v) => setEditEntry(prev => ({ ...prev, teacherName: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    {teachersList.map(t => (
                      <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleUpdateEntry} disabled={!editEntry.subjectCode || !editEntry.teacherName}>
                  Save
                </Button>
                {selectedEntry && getEntry(selectedEntry.slotId, selectedEntry.day) && (
                  <Button 
                    variant="destructive"
                    onClick={async () => {
                      if (selectedEntry) {
                        try {
                          const entry = timetableData.find(
                            e => e.slotId === selectedEntry.slotId && e.day === selectedEntry.day
                          );
                          
                          if (entry && entry.id) {
                            await timetableApi.deleteEntry(entry.id);
                            setTimetableData(timetableData.filter(
                              e => !(e.slotId === selectedEntry.slotId && e.day === selectedEntry.day)
                            ));
                            setIsEditEntryOpen(false);
                            toast({ title: "Entry Removed" });
                          } else {
                            // Entry doesn't have ID yet (newly created), just remove from local state
                            setTimetableData(timetableData.filter(
                              e => !(e.slotId === selectedEntry.slotId && e.day === selectedEntry.day)
                            ));
                            setIsEditEntryOpen(false);
                            toast({ title: "Entry Removed" });
                          }
                        } catch (error: any) {
                          toast({ 
                            title: "Error", 
                            description: error?.message || "Failed to delete entry",
                            variant: "destructive"
                          });
                        }
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Send to All Dialog */}
      <Dialog open={isSendAllDialogOpen} onOpenChange={setIsSendAllDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Timetables to All Teachers</DialogTitle>
            <DialogDescription>
              Click on each teacher's link to open WhatsApp with their timetable. Each link must be clicked individually to avoid browser popup blocking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {generatedTeacherLinks.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No teacher links generated yet.</p>
            ) : (
              generatedTeacherLinks.map((item, index) => (
                <div key={item.teacher.id || index} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium">{item.teacher.name}</p>
                    <p className="text-xs text-muted-foreground">+91 {item.teacher.phone}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      window.open(item.url, "_blank");
                      toast({ 
                        title: "WhatsApp Opened", 
                        description: `Sending to ${item.teacher.name}` 
                      });
                    }}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Open WhatsApp
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsSendAllDialogOpen(false)}>
              Close
            </Button>
          </div>
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
