import { useState } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Download, 
  Clock, 
  Plus, 
  CalendarDays, 
  MessageCircle, 
  UserX, 
  Trash2,
  Send
} from "lucide-react";
import { format, addDays, startOfWeek, isWithinInterval, isSameDay } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  type: "class" | "break" | "lunch";
}

interface TimetableEntry {
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
}

const initialTimeSlots: TimeSlot[] = [
  { id: "1", startTime: "08:00", endTime: "08:45", type: "class" },
  { id: "2", startTime: "08:45", endTime: "09:30", type: "class" },
  { id: "3", startTime: "09:30", endTime: "10:00", type: "break" },
  { id: "4", startTime: "10:00", endTime: "10:45", type: "class" },
  { id: "5", startTime: "10:45", endTime: "11:30", type: "class" },
  { id: "6", startTime: "11:30", endTime: "12:15", type: "class" },
  { id: "7", startTime: "12:15", endTime: "13:00", type: "lunch" },
  { id: "8", startTime: "13:00", endTime: "13:45", type: "class" },
  { id: "9", startTime: "13:45", endTime: "14:30", type: "class" },
];

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const subjectsList = [
  { code: "MATH", name: "Mathematics", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { code: "ENG", name: "English", color: "bg-green-100 text-green-700 border-green-200" },
  { code: "HIN", name: "Hindi", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { code: "SCI", name: "Science", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { code: "SST", name: "Social Studies", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { code: "COMP", name: "Computer", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { code: "ART", name: "Art", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { code: "PE", name: "Physical Ed.", color: "bg-red-100 text-red-700 border-red-200" },
];

const teachersList = [
  { name: "Mrs. Sharma", phone: "9876543210", subjects: ["Mathematics"] },
  { name: "Mr. Singh", phone: "9876543211", subjects: ["English", "Hindi"] },
  { name: "Mrs. Gupta", phone: "9876543212", subjects: ["Science"] },
  { name: "Mr. Kumar", phone: "9876543213", subjects: ["Social Studies"] },
  { name: "Mrs. Patel", phone: "9876543214", subjects: ["Computer", "Art"] },
  { name: "Mr. Verma", phone: "9876543215", subjects: ["Computer"] },
  { name: "Mrs. Das", phone: "9876543216", subjects: ["Art"] },
  { name: "Mr. Rao", phone: "9876543217", subjects: ["Physical Ed."] },
];

const initialTimetableData: TimetableEntry[] = [
  { slotId: "1", day: "Monday", subjectCode: "MATH", teacherName: "Mrs. Sharma" },
  { slotId: "2", day: "Monday", subjectCode: "ENG", teacherName: "Mr. Singh" },
  { slotId: "4", day: "Monday", subjectCode: "SCI", teacherName: "Mrs. Gupta" },
  { slotId: "5", day: "Monday", subjectCode: "HIN", teacherName: "Mr. Singh" },
  { slotId: "6", day: "Monday", subjectCode: "SST", teacherName: "Mr. Kumar" },
  { slotId: "8", day: "Monday", subjectCode: "COMP", teacherName: "Mr. Verma" },
  { slotId: "9", day: "Monday", subjectCode: "ART", teacherName: "Mrs. Das" },
  // Tuesday
  { slotId: "1", day: "Tuesday", subjectCode: "ENG", teacherName: "Mr. Singh" },
  { slotId: "2", day: "Tuesday", subjectCode: "MATH", teacherName: "Mrs. Sharma" },
  { slotId: "4", day: "Tuesday", subjectCode: "HIN", teacherName: "Mr. Singh" },
  { slotId: "5", day: "Tuesday", subjectCode: "SCI", teacherName: "Mrs. Gupta" },
  { slotId: "6", day: "Tuesday", subjectCode: "COMP", teacherName: "Mr. Verma" },
  { slotId: "8", day: "Tuesday", subjectCode: "SST", teacherName: "Mr. Kumar" },
  { slotId: "9", day: "Tuesday", subjectCode: "PE", teacherName: "Mr. Rao" },
  // Wednesday
  { slotId: "1", day: "Wednesday", subjectCode: "SCI", teacherName: "Mrs. Gupta" },
  { slotId: "2", day: "Wednesday", subjectCode: "HIN", teacherName: "Mr. Singh" },
  { slotId: "4", day: "Wednesday", subjectCode: "MATH", teacherName: "Mrs. Sharma" },
  { slotId: "5", day: "Wednesday", subjectCode: "ENG", teacherName: "Mr. Singh" },
  { slotId: "6", day: "Wednesday", subjectCode: "ART", teacherName: "Mrs. Das" },
  { slotId: "8", day: "Wednesday", subjectCode: "PE", teacherName: "Mr. Rao" },
  { slotId: "9", day: "Wednesday", subjectCode: "SST", teacherName: "Mr. Kumar" },
  // Thursday
  { slotId: "1", day: "Thursday", subjectCode: "HIN", teacherName: "Mr. Singh" },
  { slotId: "2", day: "Thursday", subjectCode: "SCI", teacherName: "Mrs. Gupta" },
  { slotId: "4", day: "Thursday", subjectCode: "ENG", teacherName: "Mr. Singh" },
  { slotId: "5", day: "Thursday", subjectCode: "MATH", teacherName: "Mrs. Sharma" },
  { slotId: "6", day: "Thursday", subjectCode: "PE", teacherName: "Mr. Rao" },
  { slotId: "8", day: "Thursday", subjectCode: "ART", teacherName: "Mrs. Das" },
  { slotId: "9", day: "Thursday", subjectCode: "COMP", teacherName: "Mr. Verma" },
  // Friday
  { slotId: "1", day: "Friday", subjectCode: "MATH", teacherName: "Mrs. Sharma" },
  { slotId: "2", day: "Friday", subjectCode: "COMP", teacherName: "Mr. Verma" },
  { slotId: "4", day: "Friday", subjectCode: "SCI", teacherName: "Mrs. Gupta" },
  { slotId: "5", day: "Friday", subjectCode: "HIN", teacherName: "Mr. Singh" },
  { slotId: "6", day: "Friday", subjectCode: "ENG", teacherName: "Mr. Singh" },
  { slotId: "8", day: "Friday", subjectCode: "SST", teacherName: "Mr. Kumar" },
  { slotId: "9", day: "Friday", subjectCode: "ART", teacherName: "Mrs. Das" },
  // Saturday
  { slotId: "1", day: "Saturday", subjectCode: "ENG", teacherName: "Mr. Singh" },
  { slotId: "2", day: "Saturday", subjectCode: "MATH", teacherName: "Mrs. Sharma" },
  { slotId: "4", day: "Saturday", subjectCode: "HIN", teacherName: "Mr. Singh" },
  { slotId: "5", day: "Saturday", subjectCode: "PE", teacherName: "Mr. Rao" },
  { slotId: "6", day: "Saturday", subjectCode: "COMP", teacherName: "Mr. Verma" },
];

const initialHolidays: Holiday[] = [
  { id: "1", date: new Date(2025, 0, 26), name: "Republic Day", type: "public" },
  { id: "2", date: new Date(2025, 2, 14), name: "Holi", type: "public" },
  { id: "3", date: new Date(2025, 3, 14), name: "Ambedkar Jayanti", type: "public" },
  { id: "4", date: new Date(2025, 7, 15), name: "Independence Day", type: "public" },
  { id: "5", date: new Date(2025, 9, 2), name: "Gandhi Jayanti", type: "public" },
  { id: "6", date: new Date(2025, 10, 1), name: "Diwali", type: "public" },
];

const initialLeaves: TeacherLeave[] = [
  { id: "1", teacherName: "Mrs. Sharma", startDate: new Date(2025, 0, 6), endDate: new Date(2025, 0, 8), reason: "Medical Leave" },
];

export default function Timetable() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedClass, setSelectedClass] = useState("5A");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(initialTimeSlots);
  const [timetableData, setTimetableData] = useState<TimetableEntry[]>(initialTimetableData);
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [teacherLeaves, setTeacherLeaves] = useState<TeacherLeave[]>(initialLeaves);
  
  // Dialog states
  const [isEditSlotOpen, setIsEditSlotOpen] = useState(false);
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);
  const [isAddLeaveOpen, setIsAddLeaveOpen] = useState(false);
  const [isEditEntryOpen, setIsEditEntryOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<{ slotId: string; day: string } | null>(null);
  
  // Form states
  const [newHoliday, setNewHoliday] = useState({ name: "", type: "public" as Holiday["type"] });
  const [selectedHolidayDate, setSelectedHolidayDate] = useState<Date | undefined>(undefined);
  const [newLeave, setNewLeave] = useState({ teacherName: "", reason: "" });
  const [leaveStartDate, setLeaveStartDate] = useState<Date | undefined>(undefined);
  const [leaveEndDate, setLeaveEndDate] = useState<Date | undefined>(undefined);
  const [editEntry, setEditEntry] = useState({ subjectCode: "", teacherName: "" });
  
  const today = new Date();
  const todayName = today.toLocaleDateString("en-US", { weekday: "long" });

  // Check if a date is a holiday
  const isHoliday = (date: Date) => {
    return holidays.some(h => isSameDay(h.date, date));
  };

  // Get holiday name for a date
  const getHolidayName = (date: Date) => {
    const holiday = holidays.find(h => isSameDay(h.date, date));
    return holiday?.name;
  };

  // Check if teacher is on leave for a specific date
  const isTeacherOnLeave = (teacherName: string, date: Date) => {
    return teacherLeaves.some(leave => 
      leave.teacherName === teacherName &&
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

  // Add holiday
  const handleAddHoliday = () => {
    if (!selectedHolidayDate || !newHoliday.name.trim()) return;
    
    const holiday: Holiday = {
      id: Date.now().toString(),
      date: selectedHolidayDate,
      name: newHoliday.name.trim(),
      type: newHoliday.type,
    };
    
    setHolidays([...holidays, holiday]);
    setNewHoliday({ name: "", type: "public" });
    setSelectedHolidayDate(undefined);
    setIsAddHolidayOpen(false);
    toast({ title: "Holiday Added", description: `${holiday.name} added to calendar` });
  };

  // Delete holiday
  const handleDeleteHoliday = (id: string) => {
    setHolidays(holidays.filter(h => h.id !== id));
    toast({ title: "Holiday Removed" });
  };

  // Add teacher leave
  const handleAddLeave = () => {
    if (!leaveStartDate || !leaveEndDate || !newLeave.teacherName) return;
    
    const leave: TeacherLeave = {
      id: Date.now().toString(),
      teacherName: newLeave.teacherName,
      startDate: leaveStartDate,
      endDate: leaveEndDate,
      reason: newLeave.reason,
    };
    
    setTeacherLeaves([...teacherLeaves, leave]);
    setNewLeave({ teacherName: "", reason: "" });
    setLeaveStartDate(undefined);
    setLeaveEndDate(undefined);
    setIsAddLeaveOpen(false);
    toast({ title: "Leave Added", description: `Leave marked for ${leave.teacherName}` });
  };

  // Update timetable entry
  const handleUpdateEntry = () => {
    if (!selectedEntry) return;
    
    const existingIndex = timetableData.findIndex(
      e => e.slotId === selectedEntry.slotId && e.day === selectedEntry.day
    );
    
    if (existingIndex >= 0) {
      const updated = [...timetableData];
      updated[existingIndex] = {
        ...updated[existingIndex],
        subjectCode: editEntry.subjectCode,
        teacherName: editEntry.teacherName,
      };
      setTimetableData(updated);
    } else {
      setTimetableData([...timetableData, {
        slotId: selectedEntry.slotId,
        day: selectedEntry.day,
        subjectCode: editEntry.subjectCode,
        teacherName: editEntry.teacherName,
      }]);
    }
    
    setIsEditEntryOpen(false);
    setSelectedEntry(null);
    toast({ title: "Timetable Updated" });
  };

  // Generate WhatsApp message for teacher's weekly timetable
  const generateTeacherWeeklyMessage = (teacherName: string) => {
    const teacherEntries = timetableData.filter(e => e.teacherName === teacherName);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    
    let message = `📚 *Weekly Timetable for ${teacherName}*\n`;
    message += `Week: ${format(weekStart, "dd MMM")} - ${format(addDays(weekStart, 6), "dd MMM yyyy")}\n\n`;
    
    days.forEach(day => {
      const dayDate = addDays(weekStart, days.indexOf(day));
      
      if (isHoliday(dayDate)) {
        message += `*${day}*: 🎉 Holiday - ${getHolidayName(dayDate)}\n`;
        return;
      }
      
      const dayEntries = teacherEntries.filter(e => e.day === day);
      if (dayEntries.length === 0) {
        message += `*${day}*: No classes\n`;
        return;
      }
      
      message += `*${day}*:\n`;
      dayEntries.forEach(entry => {
        const slot = timeSlots.find(s => s.id === entry.slotId);
        if (slot) {
          message += `  ${slot.startTime}-${slot.endTime}: ${getSubjectName(entry.subjectCode)}\n`;
        }
      });
    });
    
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
  const sendWhatsAppMessage = (teacherName: string) => {
    const teacher = teachersList.find(t => t.name === teacherName);
    if (!teacher) return;
    
    const message = generateTeacherWeeklyMessage(teacherName);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/91${teacher.phone}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, "_blank");
    toast({ title: "WhatsApp Opened", description: `Sending timetable to ${teacherName}` });
  };

  // Send to all teachers
  const sendToAllTeachers = () => {
    toast({ 
      title: "Preparing Messages", 
      description: "WhatsApp will open for each teacher. Please send each message manually." 
    });
    
    teachersList.forEach((teacher, index) => {
      setTimeout(() => {
        sendWhatsAppMessage(teacher.name);
      }, index * 1000);
    });
  };

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
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="1A">Class 1A</SelectItem>
                    <SelectItem value="2A">Class 2A</SelectItem>
                    <SelectItem value="3A">Class 3A</SelectItem>
                    <SelectItem value="4A">Class 4A</SelectItem>
                    <SelectItem value="5A">Class 5A</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={sendToAllTeachers}>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Send to All
                </Button>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
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
                  <span>Class {selectedClass} - Weekly Timetable</span>
                  <Badge variant="outline">Academic Year 2024-25</Badge>
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
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-3">
                  {subjectsList.map((subject) => (
                    <div key={subject.code} className={`px-3 py-1.5 rounded-lg text-sm ${subject.color}`}>
                      {subject.name}
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
                              <Label>Date</Label>
                              <Calendar
                                mode="single"
                                selected={selectedHolidayDate}
                                onSelect={setSelectedHolidayDate}
                                className="rounded-md border pointer-events-auto"
                              />
                            </div>
                            <Button className="w-full" onClick={handleAddHoliday} disabled={!selectedHolidayDate || !newHoliday.name.trim()}>
                              Add Holiday
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
                  </span>
                  {isAdmin && (
                    <Dialog open={isAddLeaveOpen} onOpenChange={setIsAddLeaveOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Leave
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Add Teacher Leave</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Teacher</Label>
                            <Select 
                              value={newLeave.teacherName} 
                              onValueChange={(v) => setNewLeave(prev => ({ ...prev, teacherName: v }))}
                            >
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
                          <div className="space-y-2">
                            <Label>Reason</Label>
                            <Input 
                              placeholder="e.g., Medical Leave" 
                              value={newLeave.reason}
                              onChange={(e) => setNewLeave(prev => ({ ...prev, reason: e.target.value }))}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Start Date</Label>
                              <Calendar
                                mode="single"
                                selected={leaveStartDate}
                                onSelect={setLeaveStartDate}
                                className="rounded-md border pointer-events-auto text-xs"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>End Date</Label>
                              <Calendar
                                mode="single"
                                selected={leaveEndDate}
                                onSelect={setLeaveEndDate}
                                className="rounded-md border pointer-events-auto text-xs"
                              />
                            </div>
                          </div>
                          <Button 
                            className="w-full" 
                            onClick={handleAddLeave} 
                            disabled={!leaveStartDate || !leaveEndDate || !newLeave.teacherName}
                          >
                            Add Leave
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
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
                            <Badge variant={isActive ? "destructive" : isPast ? "secondary" : "outline"}>
                              {isActive ? "On Leave" : isPast ? "Completed" : "Upcoming"}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setTeacherLeaves(teacherLeaves.filter(l => l.id !== leave.id))}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
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
                    <Button size="sm" onClick={() => {
                      const newSlot: TimeSlot = {
                        id: Date.now().toString(),
                        startTime: "14:30",
                        endTime: "15:15",
                        type: "class"
                      };
                      setTimeSlots([...timeSlots, newSlot]);
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
                              value={slot.startTime}
                              className="w-32"
                              onChange={(e) => {
                                const updated = [...timeSlots];
                                updated[index].startTime = e.target.value;
                                setTimeSlots(updated);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              type="time"
                              value={slot.endTime}
                              className="w-32"
                              onChange={(e) => {
                                const updated = [...timeSlots];
                                updated[index].endTime = e.target.value;
                                setTimeSlots(updated);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={slot.type} 
                              onValueChange={(v: TimeSlot["type"]) => {
                                const updated = [...timeSlots];
                                updated[index].type = v;
                                setTimeSlots(updated);
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
                              onClick={() => setTimeSlots(timeSlots.filter(s => s.id !== slot.id))}
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
                    onClick={() => {
                      if (selectedEntry) {
                        setTimetableData(timetableData.filter(
                          e => !(e.slotId === selectedEntry.slotId && e.day === selectedEntry.day)
                        ));
                        setIsEditEntryOpen(false);
                        toast({ title: "Entry Removed" });
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
    </UnifiedLayout>
  );
}
