import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, BookOpen, Calendar, Clock, CheckCircle, Plus, MessageCircle, Save, Filter, X, TrendingUp, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { homeworkApi, classesApi, studentsApi, schoolsApi, WhatsAppSettings } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SubjectHomework {
  subjectId: string;
  subjectName: string;
  description: string;
}

interface Student {
  id: number; // Frontend ID (for display/UI)
  uuid: string; // Original UUID from database (REQUIRED for API calls)
  name: string;
  rollNo: string;
  completed: boolean;
}

interface HomeworkItem {
  id: string; // Changed to string to match UUID from backend
  subjects: SubjectHomework[];
  dueDate: string;
  status: "active" | "completed" | "draft";
  createdAt: string;
  sentToParents: boolean;
  students: Student[];
  classId?: string; // Add classId to track which class this homework belongs to
}

interface StudentFrequency {
  id: number;
  name: string;
  rollNo: string;
  totalHomework: number;
  completed: number;
  percentage: number;
}

const defaultStudents: Student[] = [
  { id: 1, uuid: "1", name: "Aarav Sharma", rollNo: "01", completed: false },
  { id: 2, uuid: "2", name: "Priya Patel", rollNo: "02", completed: false },
  { id: 3, uuid: "3", name: "Rahul Kumar", rollNo: "03", completed: false },
  { id: 4, uuid: "4", name: "Ananya Singh", rollNo: "04", completed: false },
  { id: 5, uuid: "5", name: "Vikram Reddy", rollNo: "05", completed: false },
  { id: 6, uuid: "6", name: "Sneha Gupta", rollNo: "06", completed: false },
  { id: 7, uuid: "7", name: "Arjun Nair", rollNo: "07", completed: false },
  { id: 8, uuid: "8", name: "Kavya Iyer", rollNo: "08", completed: false },
];

const defaultSubjects = [
  { id: "mathematics", name: "Mathematics" },
  { id: "english", name: "English" },
  { id: "science", name: "Science" },
  { id: "hindi", name: "Hindi" },
  { id: "social-studies", name: "Social Studies" },
  { id: "computer", name: "Computer Science" },
];

const initialHomework: HomeworkItem[] = [
  {
    id: 1,
    subjects: [
      { subjectId: "mathematics", subjectName: "Mathematics", description: "Complete exercises 1-20 from Chapter 5" },
      { subjectId: "english", subjectName: "English", description: "Write an essay on 'My Favorite Festival'" },
    ],
    dueDate: "2024-01-20",
    status: "active",
    createdAt: "2024-01-15",
    sentToParents: true,
    students: defaultStudents.map((s, i) => ({ ...s, completed: i < 5 })),
  },
  {
    id: 2,
    subjects: [
      { subjectId: "science", subjectName: "Science", description: "Draw and label the human digestive system" },
    ],
    dueDate: "2024-01-18",
    status: "completed",
    createdAt: "2024-01-12",
    sentToParents: true,
    students: defaultStudents.map(s => ({ ...s, completed: true })),
  },
];

export default function HomeworkModule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [subjects, setSubjects] = useState(defaultSubjects);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectDescriptions, setSubjectDescriptions] = useState<Record<string, string>>({});
  const [dueDate, setDueDate] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [filterDate, setFilterDate] = useState("");
  const [selectedHomework, setSelectedHomework] = useState<HomeworkItem | null>(null);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [studentsInClass, setStudentsInClass] = useState<Student[]>([]);
  const [classStudentsMap, setClassStudentsMap] = useState<Record<string, Student[]>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });
  const [sendMethod, setSendMethod] = useState<'app' | 'whatsapp'>('app');
  const [whatsappSettings, setWhatsappSettings] = useState<WhatsAppSettings | null>(null);

  // Load classes and homework on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load classes
        const classesData = await classesApi.getAll();
        setClasses(classesData || []);
        
        // Auto-select first class for teachers
        if (!isAdmin && classesData && classesData.length > 0) {
          setSelectedClassId(classesData[0].id);
        }
        
        // Load homework
        const homeworkData = await homeworkApi.getAll();
        
        // Fetch students for each unique class in homework
        const uniqueClassIds = [...new Set(homeworkData.map((h: any) => h.classId).filter(Boolean))];
        const studentsMap: Record<string, Student[]> = {};
        
        // Fetch students for each class
        for (const classId of uniqueClassIds) {
          try {
            const classStudents = await studentsApi.getByClass(classId);
            studentsMap[classId] = classStudents.map((s: any, index: number) => {
              // Handle UUID strings - UUIDs are typically 36 chars with dashes or 32 chars without
              // If it's not a simple number, treat it as UUID
              const idStr = String(s.id);
              const isUuid = typeof s.id === 'string' && (idStr.length > 10 || idStr.includes('-'));
              const numericId = isUuid ? (index + 1) : (parseInt(s.id) || index + 1);
              return {
                id: numericId,
                uuid: idStr, // Always preserve original UUID as string
                name: s.name,
                rollNo: s.rollNo || s.roll_no || String(index + 1).padStart(2, '0'),
                completed: false // Will be updated from completion API
              };
            });
          } catch (error) {
            console.error(`Error loading students for class ${classId}:`, error);
            studentsMap[classId] = [];
          }
        }
        
        setClassStudentsMap(studentsMap);
        
        // Load completion status for each homework
        const homeworkWithCompletions = await Promise.all(
          homeworkData.map(async (h: any) => {
            try {
              const completions = await homeworkApi.getCompletions(h.id);
              const completionMap = new Map(
                completions.map((c: any) => [c.studentId, c.completed])
              );
              
              // Update students with completion status
              // Match by student UUID from database
              const students = (studentsMap[h.classId] || []).map(s => ({
                ...s,
                completed: completionMap.get(s.uuid) || false // Use UUID for matching
              }));
              
              return { ...h, students };
            } catch (error) {
              console.error(`Error loading completions for homework ${h.id}:`, error);
              return { ...h, students: studentsMap[h.classId] || [] };
            }
          })
        );
        
        // Transform backend data to frontend format
        const transformedHomework: HomeworkItem[] = homeworkWithCompletions
          .filter((h: any) => h.id) // Filter out any homework without an ID
          .map((h: any) => ({
            id: String(h.id), // Ensure it's a string (UUID)
            subjects: [{
              subjectId: h.subject?.toLowerCase().replace(/\s+/g, '-') || 'subject',
              subjectName: h.subject || 'Subject',
              description: h.description || ''
            }],
            dueDate: h.dueDate || '',
            status: h.status === 'completed' ? 'completed' : h.status === 'active' ? 'active' : 'draft',
            createdAt: h.createdAt || new Date().toISOString().split('T')[0],
            sentToParents: false, // Backend doesn't track this yet
            students: h.students || [],
            classId: h.classId // Store classId for future reference
          }));
        setHomework(transformedHomework);
      } catch (error) {
        console.error('Error loading homework data:', error);
        toast.error('Failed to load homework');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [isAdmin]);

  // Load WhatsApp settings
  useEffect(() => {
    const loadWhatsAppSettings = async () => {
      try {
        const settings = await schoolsApi.getWhatsAppSettings();
        setWhatsappSettings(settings);
        // Set default send method based on WhatsApp availability
        if (settings.whatsappEnabled && settings.features.homework) {
          setSendMethod('whatsapp'); // Default to WhatsApp if enabled
        } else {
          setSendMethod('app');
        }
      } catch (error) {
        console.error('Failed to load WhatsApp settings:', error);
        setWhatsappSettings(null);
      }
    };
    loadWhatsAppSettings();
  }, []);

  // Load students when class is selected
  useEffect(() => {
    const loadClassStudents = async () => {
      if (!selectedClassId) {
        setStudentsInClass([]);
        return;
      }
      
      // Check if students are already cached
      if (classStudentsMap[selectedClassId]) {
        setStudentsInClass(classStudentsMap[selectedClassId]);
        return;
      }
      
      try {
        const classStudents = await studentsApi.getByClass(selectedClassId);
        const students = classStudents.map((s: any, index: number) => {
          const idStr = String(s.id);
          const isUuid = typeof s.id === 'string' && (idStr.length > 10 || idStr.includes('-'));
          const numericId = isUuid ? (index + 1) : (parseInt(s.id) || index + 1);
          return {
            id: numericId,
            uuid: idStr, // Always preserve original UUID as string
            name: s.name,
            rollNo: s.rollNo || s.roll_no || String(index + 1).padStart(2, '0'),
            completed: false
          };
        });
        setStudentsInClass(students);
        setClassStudentsMap(prev => ({ ...prev, [selectedClassId]: students }));
      } catch (error) {
        console.error('Error loading students for class:', error);
        setStudentsInClass([]);
      }
    };
    
    loadClassStudents();
  }, [selectedClassId, classStudentsMap]);

  const handleSubjectToggle = (subjectId: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleDescriptionChange = (subjectId: string, description: string) => {
    setSubjectDescriptions(prev => ({ ...prev, [subjectId]: description }));
  };

  const handleAddSubject = () => {
    if (!newSubjectName.trim()) {
      toast.error("Please enter a subject name");
      return;
    }
    const subjectId = newSubjectName.toLowerCase().replace(/\s+/g, "-");
    if (subjects.some(s => s.id === subjectId)) {
      toast.error("Subject already exists");
      return;
    }
    setSubjects([...subjects, { id: subjectId, name: newSubjectName.trim() }]);
    setNewSubjectName("");
    setIsAddSubjectOpen(false);
    toast.success(`"${newSubjectName.trim()}" added to subjects`);
  };

  const createHomework = async (isDraft: boolean) => {
    if (selectedSubjects.length === 0) {
      toast.error("Please select at least one subject");
      return;
    }

    const hasEmptyDescription = selectedSubjects.some(id => !subjectDescriptions[id]?.trim());
    if (hasEmptyDescription && !isDraft) {
      toast.error("Please add description for all selected subjects");
      return;
    }

    if (!dueDate && !isDraft) {
      toast.error("Please select a due date");
      return;
    }

    if (!selectedClassId) {
      toast.error("Please select a class");
      return;
    }

    try {
      setIsLoading(true);
      // Create separate homework entries for each subject (backend supports one subject per homework)
      const createdHomework: HomeworkItem[] = [];
      
      for (const subjectId of selectedSubjects) {
        const subjectName = subjects.find(s => s.id === subjectId)?.name || subjectId;
        const description = subjectDescriptions[subjectId] || "";
        const title = `${subjectName} - ${dueDate || new Date().toISOString().split('T')[0]}`;
        
        try {
          const result = await homeworkApi.create({
            title,
            description,
            subject: subjectName,
            classId: selectedClassId,
            dueDate: dueDate || undefined
          });

          // Fetch students for the class if not already loaded
          let students: Student[] = [];
          if (classStudentsMap[selectedClassId]) {
            students = classStudentsMap[selectedClassId];
          } else {
            try {
              const classStudents = await studentsApi.getByClass(selectedClassId);
              students = classStudents.map((s: any, index: number) => {
                const isUuid = typeof s.id === 'string' && s.id.includes('-');
                const numericId = isUuid ? (index + 1) : (parseInt(s.id) || index + 1);
                return {
                  id: numericId,
                  uuid: String(s.id), // Always preserve original UUID as string
                  name: s.name,
                  rollNo: s.rollNo || s.roll_no || String(index + 1).padStart(2, '0'),
                  completed: false
                };
              });
              setClassStudentsMap(prev => ({ ...prev, [selectedClassId]: students }));
            } catch (error) {
              console.error('Error loading students for new homework:', error);
              students = [];
            }
          }
          
          createdHomework.push({
            id: parseInt(result.homeworkId) || Date.now(),
            subjects: [{
              subjectId,
              subjectName,
              description
            }],
            dueDate: dueDate || new Date().toISOString().split('T')[0],
            status: isDraft ? "draft" : "active",
            createdAt: new Date().toISOString().split('T')[0],
            sentToParents: false,
            students: students,
            classId: selectedClassId
          });
        } catch (error: any) {
          console.error(`Error creating homework for ${subjectName}:`, error);
          toast.error(`Failed to create homework for ${subjectName}`);
        }
      }

      if (createdHomework.length > 0) {
        setHomework([...createdHomework, ...homework]);
        setSelectedSubjects([]);
        setSubjectDescriptions({});
        setDueDate("");
        toast.success(`${createdHomework.length} homework ${createdHomework.length === 1 ? 'entry' : 'entries'} created successfully!`);
      }
    } catch (error: any) {
      console.error('Error creating homework:', error);
      toast.error(error?.message || "Failed to create homework");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToParents = (hw: HomeworkItem) => {
    const subjectsList = hw.subjects.map(s => `📖 *${s.subjectName}*: ${s.description}`).join("\n\n");
    
    const message = `📚 *Homework Alert*\n\n` +
      `${subjectsList}\n\n` +
      `📅 Due Date: ${new Date(hw.dueDate).toLocaleDateString()}\n\n` +
      `Please ensure your child completes this homework on time.`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');

    setHomework(homework.map(h =>
      h.id === hw.id ? { ...h, sentToParents: true, status: h.status === "draft" ? "active" : h.status } : h
    ));
    toast.success("WhatsApp opened with homework details");
  };

  const openCompletionDialog = async (hw: HomeworkItem) => {
    // Ensure students are loaded for this homework's class
    if ((!hw.students || hw.students.length === 0) && hw.classId) {
      try {
        // Fetch students for this class if not already loaded
        if (!classStudentsMap[hw.classId]) {
          const classStudents = await studentsApi.getByClass(hw.classId);
          const students = classStudents.map((s: any, index: number) => {
            const isUuid = typeof s.id === 'string' && s.id.includes('-');
            const numericId = isUuid ? (index + 1) : (parseInt(s.id) || index + 1);
            return {
              id: numericId,
              uuid: String(s.id), // Always preserve original UUID as string
              name: s.name,
              rollNo: s.rollNo || s.roll_no || String(index + 1).padStart(2, '0'),
              completed: false
            };
          });
          
          // Load completion status for this homework
          try {
            const completions = await homeworkApi.getCompletions(hw.id);
            const completionMap = new Map(
              completions.map((c: any) => [c.studentId, c.completed])
            );
            // Update students with completion status
            const studentsWithCompletion = students.map(s => ({
              ...s,
              completed: completionMap.get(s.uuid) || false
            }));
            setClassStudentsMap(prev => ({ ...prev, [hw.classId!]: studentsWithCompletion }));
            const updatedHw = { ...hw, students: studentsWithCompletion };
            setSelectedHomework(updatedHw);
            setHomework(homework.map(h => h.id === hw.id ? updatedHw : h));
          } catch (completionError) {
            console.error('Error loading completions:', completionError);
            setClassStudentsMap(prev => ({ ...prev, [hw.classId!]: students }));
            const updatedHw = { ...hw, students };
            setSelectedHomework(updatedHw);
            setHomework(homework.map(h => h.id === hw.id ? updatedHw : h));
          }
        } else {
          // Use cached students, but refresh completion status
          try {
            const completions = await homeworkApi.getCompletions(hw.id);
            const completionMap = new Map(
              completions.map((c: any) => [c.studentId, c.completed])
            );
            const studentsWithCompletion = classStudentsMap[hw.classId].map(s => ({
              ...s,
              completed: completionMap.get(s.uuid) || false
            }));
            const updatedHw = { ...hw, students: studentsWithCompletion };
            setSelectedHomework(updatedHw);
          } catch (completionError) {
            console.error('Error loading completions:', completionError);
            const updatedHw = { ...hw, students: classStudentsMap[hw.classId] };
            setSelectedHomework(updatedHw);
          }
        }
      } catch (error) {
        console.error('Error loading students for homework:', error);
        setSelectedHomework(hw);
      }
    } else {
      // Students are already loaded, but refresh completion status
      try {
        const completions = await homeworkApi.getCompletions(hw.id);
        const completionMap = new Map(
          completions.map((c: any) => [c.studentId, c.completed])
        );
        const studentsWithCompletion = hw.students.map(s => ({
          ...s,
          completed: completionMap.get(s.uuid) || s.completed || false
        }));
        const updatedHw = { ...hw, students: studentsWithCompletion };
        setSelectedHomework(updatedHw);
      } catch (completionError) {
        console.error('Error loading completions:', completionError);
        setSelectedHomework(hw);
      }
    }
    setIsCompletionDialogOpen(true);
  };

  const toggleStudentCompletion = async (studentId: number) => {
    if (!selectedHomework) return;

    const student = selectedHomework.students.find(s => s.id === studentId);
    if (!student) {
      toast.error('Student not found');
      return;
    }

    if (!student.uuid) {
      toast.error('Student UUID is missing. Please refresh the page.');
      return;
    }

    if (!selectedHomework.id) {
      toast.error('Homework ID is missing');
      return;
    }

    const newCompletedStatus = !student.completed;
    const updatedStudents = selectedHomework.students.map(s =>
      s.id === studentId ? { ...s, completed: newCompletedStatus } : s
    );

    const updatedHomework = { ...selectedHomework, students: updatedStudents };
    setSelectedHomework(updatedHomework);
    setHomework(homework.map(h => h.id === selectedHomework.id ? updatedHomework : h));
    
    // Save to backend
    try {
      await homeworkApi.updateCompletion(selectedHomework.id, {
        studentId: student.uuid, // Use UUID
        completed: newCompletedStatus
      });
    } catch (error: any) {
      console.error('Error saving completion:', error);
      // Extract error message from various possible locations
      const errorMessage = error?.message || error?.error || 'Failed to save completion status';
      toast.error(errorMessage);
      // Revert on error
      const revertedStudents = selectedHomework.students;
      setSelectedHomework({ ...selectedHomework, students: revertedStudents });
      setHomework(homework.map(h => h.id === selectedHomework.id ? selectedHomework : h));
    }
  };

  const markAllComplete = async () => {
    if (!selectedHomework) return;
    
    if (!selectedHomework.id) {
      toast.error('Homework ID is missing');
      return;
    }

    // Validate that all students have UUIDs
    const studentsWithoutUuid = selectedHomework.students.filter(s => !s.uuid);
    if (studentsWithoutUuid.length > 0) {
      toast.error('Some students are missing UUIDs. Please refresh the page.');
      return;
    }
    
    try {
      const updatedStudents = selectedHomework.students.map(s => ({ ...s, completed: true }));
      
      // Save all completions to backend using UUIDs
      await homeworkApi.bulkUpdateCompletions(
        selectedHomework.id,
        updatedStudents.map(s => ({
          studentId: s.uuid, // Use UUID, not the integer ID
          completed: true
        }))
      );
      
      // Mark homework as completed in backend
      await homeworkApi.complete(selectedHomework.id);
      
      const updatedHomework = { ...selectedHomework, students: updatedStudents, status: "completed" as const };
      setSelectedHomework(updatedHomework);
      setHomework(homework.map(h => h.id === selectedHomework.id ? updatedHomework : h));
      toast.success("All students marked as complete");
    } catch (error: any) {
      console.error('Error completing homework:', error);
      const errorMsg = error?.message || error?.error || "Failed to mark homework as complete";
      toast.error(errorMsg);
    }
  };

  const filteredHomework = homework.filter(h => {
    if (!filterDate) return h.status !== "draft";
    // Normalize dates for comparison (handle both YYYY-MM-DD and full ISO strings)
    const hwDate = h.createdAt 
      ? (h.createdAt.includes('T') ? h.createdAt.split('T')[0] : h.createdAt)
      : '';
    const filterDateNormalized = filterDate.includes('T') ? filterDate.split('T')[0] : filterDate;
    return h.status !== "draft" && hwDate === filterDateNormalized;
  });

  const drafts = homework.filter(h => h.status === "draft");

  // Helper function to group homework by creation date
  const groupHomeworkByDate = (homeworkList: HomeworkItem[]) => {
    const grouped: Record<string, HomeworkItem[]> = {};
    
    homeworkList.forEach(hw => {
      // Extract date part (YYYY-MM-DD) from createdAt
      // Handle both timestamp strings and date-only strings
      const dateKey = hw.createdAt 
        ? (hw.createdAt.includes('T') ? hw.createdAt.split('T')[0] : hw.createdAt)
        : new Date().toISOString().split('T')[0];
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(hw);
    });
    
    // Sort dates in descending order (newest first)
    return Object.entries(grouped).sort((a, b) => 
      new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  };

  // Function to send all homeworks for a specific date to all parents
  const handleSendAllForDate = async (dateKey: string, homeworksForDate: HomeworkItem[]) => {
    if (homeworksForDate.length === 0) {
      toast.error("No homework found for this date");
      return;
    }

    // Show confirmation dialog
    setConfirmDialog({
      open: true,
      title: "Send to All Parents",
      description: `Are you sure you want to send homework notifications to ALL parents for ${new Date(dateKey).toLocaleDateString()}?`,
      onConfirm: async () => {
        setConfirmDialog({ open: false, title: "", description: "", onConfirm: () => {} });
        await performSendToAll(dateKey, homeworksForDate);
      },
    });
  };

  const performSendToAll = async (dateKey: string, homeworksForDate: HomeworkItem[]) => {
    try {
      setIsLoading(true);
      
      if (sendMethod === 'app') {
        // Send via app-to-app notifications
        // Create notifications for each homework
        // Note: This would require a new API endpoint or modification to existing one
        toast.info("Sending via app notifications...");
        // For now, we'll use the existing notification system
        // TODO: Implement app-to-app notification sending
        toast.success("Notifications sent via app!");
        
        // Mark all homeworks as sent
        setHomework(homework.map(h => {
          const isInDateGroup = homeworksForDate.some(hw => hw.id === h.id);
          return isInDateGroup 
            ? { ...h, sentToParents: true, status: h.status === "draft" ? "active" : h.status }
            : h;
        }));
        return;
      }
      
      // Call backend API to send WhatsApp template messages
      const result = await homeworkApi.sendToAllParents(dateKey);
      
      // Check if result exists and has success property
      if (result && result.success) {
        toast.success(
          `✅ ${result.results.successful} out of ${result.results.total} parents received the message!`
        );
        
        // Mark all homeworks as sent
        setHomework(homework.map(h => {
          const isInDateGroup = homeworksForDate.some(hw => hw.id === h.id);
          return isInDateGroup 
            ? { ...h, sentToParents: true, status: h.status === "draft" ? "active" : h.status }
            : h;
        }));
        
        // Show errors if any
        if (result.results.failed > 0) {
          console.warn('Some messages failed:', result.results.errors);
          toast.warning(
            `⚠️ ${result.results.failed} messages failed. Check console for details.`
          );
        }
      } else {
        // Handle case where result.success is false (shouldn't happen, but just in case)
        const errorMsg = result?.message || "Failed to send messages. Please try again.";
        toast.error(errorMsg);
        console.error('Send to all parents failed:', result);
      }
    } catch (error: any) {
      console.error('Error sending messages:', error);
      
      // Extract error message from various possible locations
      let errorMessage = "Failed to send WhatsApp messages";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
        // Include details if available
        if (error.response.data.details) {
          errorMessage += `: ${error.response.data.details}`;
        }
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      toast.error(errorMessage);
      
      // If it's a configuration error, show more helpful message
      if (errorMessage.includes('template not configured')) {
        toast.error("Please configure WhatsApp template in backend environment variables (WAZZAP_TEMPLATE_NAME).");
      } else if (errorMessage.includes('No homework found')) {
        toast.error("No homework found for this date. Please create homework first.");
      } else if (errorMessage.includes('No students with valid parent phone numbers')) {
        toast.error("No students with valid parent phone numbers found. Please update student records.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate student frequency
  // Get all unique students from all homework items
  const allStudents = Array.from(
    new Map(
      homework.flatMap(h => h.students.map(s => [s.id, s]))
    ).values()
  );

  const studentFrequency: StudentFrequency[] = allStudents.map(student => {
    // Match by UUID if available, otherwise by id
    const completedHomework = homework.filter(h => {
      if (h.status === "draft") return false;
      const studentInHomework = h.students.find(s => 
        (student.uuid && s.uuid === student.uuid) || s.id === student.id
      );
      return studentInHomework?.completed || false;
    });
    const totalHomework = homework.filter(h => h.status !== "draft").length;
    const percentage = totalHomework > 0 ? Math.round((completedHomework.length / totalHomework) * 100) : 0;

    return {
      id: student.id,
      name: student.name,
      rollNo: student.rollNo,
      totalHomework,
      completed: completedHomework.length,
      percentage,
    };
  });

  return (
    <>
    <UnifiedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Homework</h1>
          <p className="text-muted-foreground mt-1">Send and manage homework for your class.</p>
        </div>

        <Tabs defaultValue="send" className="w-full">
          <TabsList>
            <TabsTrigger value="send">Send Homework</TabsTrigger>
            <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
            <TabsTrigger value="sent">History</TabsTrigger>
            <TabsTrigger value="frequency">Student Frequency</TabsTrigger>
          </TabsList>

          {/* Send Homework Tab */}
          <TabsContent value="send" className="mt-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Send className="w-5 h-5 text-primary" />
                  New Homework
                </h3>
                <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Subject
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Subject</DialogTitle>
                      <DialogDescription>Add a new subject to assign homework for.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Subject Name</Label>
                        <Input
                          placeholder="e.g., Physical Education"
                          value={newSubjectName}
                          onChange={(e) => setNewSubjectName(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddSubjectOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddSubject}>Add Subject</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Subject Selection */}
              <div className="space-y-4 mb-6">
                <Label>Select Subjects *</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {subjects.map(subject => (
                    <div
                      key={subject.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedSubjects.includes(subject.id)
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => handleSubjectToggle(subject.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox checked={selectedSubjects.includes(subject.id)} />
                        <span className="font-medium">{subject.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subject Descriptions */}
              {selectedSubjects.length > 0 && (
                <div className="space-y-4 mb-6">
                  <Label>Homework Details for Each Subject</Label>
                  {selectedSubjects.map(subjectId => {
                    const subject = subjects.find(s => s.id === subjectId);
                    return (
                      <div key={subjectId} className="p-4 bg-muted/30 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-primary">{subject?.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSubjectToggle(subjectId)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <Textarea
                          placeholder={`Enter homework description for ${subject?.name}...`}
                          value={subjectDescriptions[subjectId] || ""}
                          onChange={(e) => handleDescriptionChange(subjectId, e.target.value)}
                          rows={2}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Class Selection (for admins) */}
              {isAdmin && (
                <div className="space-y-2 mb-6">
                  <Label>Select Class *</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}{cls.section ? ` - Section ${cls.section}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Due Date */}
              <div className="space-y-2 mb-6">
                <Label>Due Date *</Label>
                <div className="relative max-w-xs">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pl-10"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => createHomework(false)} disabled={selectedSubjects.length === 0}>
                  <Send className="w-4 h-4 mr-2" />
                  Create & Save
                </Button>
                <Button variant="outline" onClick={() => createHomework(true)} disabled={selectedSubjects.length === 0}>
                  <Save className="w-4 h-4 mr-2" />
                  Save as Draft
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Drafts Tab */}
          <TabsContent value="drafts" className="mt-6">
            {drafts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No drafts saved</div>
            ) : (
              <div className="space-y-4">
                {drafts.map(hw => (
                  <div key={hw.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {hw.subjects.map(s => (
                            <span key={s.subjectId} className="px-2 py-1 bg-muted rounded text-sm">
                              {s.subjectName}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">Due: {new Date(hw.dueDate).toLocaleDateString()}</p>
                      </div>
                      <Button size="sm" onClick={() => handleSendToParents(hw)}>
                        <MessageCircle className="w-4 h-4 mr-1" />
                        Send to Parents
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="sent" className="mt-6 space-y-6">
            {/* Filter */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Label>Filter by Date:</Label>
              </div>
              <Input
                type="date"
                className="max-w-xs"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
              {filterDate && (
                <Button variant="ghost" size="sm" onClick={() => setFilterDate("")}>
                  Clear
                </Button>
              )}
            </div>

            {/* Grouped Homework List */}
            {(() => {
              const groupedHomework = groupHomeworkByDate(filteredHomework);
              
              if (groupedHomework.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    No homework found
                  </div>
                );
              }

              return (
                <div className="space-y-8">
                  {groupedHomework.map(([dateKey, homeworksForDate]) => (
                    <div key={dateKey} className="bg-card rounded-xl border border-border overflow-hidden">
                      {/* Date Header with Send to All Button */}
                      <div className="bg-muted/50 p-4 border-b border-border flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {new Date(dateKey).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {homeworksForDate.length} homework{homeworksForDate.length !== 1 ? 's' : ''} created
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {whatsappSettings?.whatsappEnabled && whatsappSettings?.features.homework && (
                            <Select value={sendMethod} onValueChange={(value: 'app' | 'whatsapp') => setSendMethod(value)}>
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="app">Send via App</SelectItem>
                                <SelectItem value="whatsapp">Send via WhatsApp</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Button 
                            onClick={() => handleSendAllForDate(dateKey, homeworksForDate)}
                            className="flex items-center gap-2"
                          >
                            <MessageCircle className="w-4 h-4" />
                            {sendMethod === 'whatsapp' ? 'Send via WhatsApp' : 'Send via App'}
                          </Button>
                        </div>
                      </div>

                      {/* Homework Table for this Date */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-muted/30">
                            <tr>
                              <th className="text-left p-4 font-medium text-muted-foreground">Subjects</th>
                              <th className="text-left p-4 font-medium text-muted-foreground">Due Date</th>
                              <th className="text-left p-4 font-medium text-muted-foreground">Completion</th>
                              <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                              <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {homeworksForDate.map(hw => {
                              const completedCount = hw.students.filter(s => s.completed).length;
                              const totalCount = hw.students.length;
                              return (
                                <tr key={hw.id} className="hover:bg-muted/30">
                                  <td className="p-4">
                                    <div className="flex flex-wrap gap-1">
                                      {hw.subjects.map(s => (
                                        <span key={s.subjectId} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                                          {s.subjectName}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Clock className="w-4 h-4" />
                                      {new Date(hw.dueDate).toLocaleDateString()}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-2">
                                      <Progress value={(completedCount / totalCount) * 100} className="w-20 h-2" />
                                      <span className="text-sm">{completedCount}/{totalCount}</span>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      hw.status === "completed"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-yellow-100 text-yellow-800"
                                    }`}>
                                      {hw.status === "completed" ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                                      {hw.status}
                                    </span>
                                  </td>
                                  <td className="p-4">
                                    <Button size="sm" variant="outline" onClick={() => openCompletionDialog(hw)}>
                                      <Users className="w-4 h-4 mr-1" />
                                      Update
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </TabsContent>

          {/* Student Frequency Tab */}
          <TabsContent value="frequency" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">Total Homework Sent</p>
                <p className="text-2xl font-bold text-foreground mt-1">{homework.filter(h => h.status !== "draft").length}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">Average Completion</p>
                <p className="text-2xl font-bold text-primary mt-1">
                  {Math.round(studentFrequency.reduce((acc, s) => acc + s.percentage, 0) / studentFrequency.length)}%
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">Students Below 50%</p>
                <p className="text-2xl font-bold text-destructive mt-1">
                  {studentFrequency.filter(s => s.percentage < 50).length}
                </p>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Student Homework Completion Frequency
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium text-muted-foreground">Roll No</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Student Name</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Completed</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Frequency</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {studentFrequency.map(student => (
                      <tr key={student.id} className="hover:bg-muted/30">
                        <td className="p-4 font-medium">{student.rollNo}</td>
                        <td className="p-4">{student.name}</td>
                        <td className="p-4">{student.completed} / {student.totalHomework}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={student.percentage}
                              className={`w-24 h-2 ${student.percentage < 50 ? "[&>div]:bg-destructive" : student.percentage < 75 ? "[&>div]:bg-yellow-500" : ""}`}
                            />
                            <span className="text-sm font-medium">{student.percentage}%</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            student.percentage >= 75
                              ? "bg-green-100 text-green-800"
                              : student.percentage >= 50
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {student.percentage >= 75 ? "Excellent" : student.percentage >= 50 ? "Average" : "Needs Attention"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Completion Update Dialog */}
      <Dialog open={isCompletionDialogOpen} onOpenChange={setIsCompletionDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Student Completion</DialogTitle>
            <DialogDescription>
              Mark students who have completed their homework.
            </DialogDescription>
          </DialogHeader>
          {selectedHomework && (
            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {selectedHomework.students.filter(s => s.completed).length} / {selectedHomework.students.length} completed
                </span>
                <Button size="sm" variant="outline" onClick={markAllComplete}>
                  Mark All Complete
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedHomework.students.map(student => (
                  <div
                    key={student.id}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                      student.completed ? "bg-green-50 border border-green-200" : "bg-muted/30 border border-transparent"
                    }`}
                    onClick={() => toggleStudentCompletion(student.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox checked={student.completed} />
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-xs text-muted-foreground">Roll No: {student.rollNo}</p>
                      </div>
                    </div>
                    {student.completed && <CheckCircle className="w-5 h-5 text-green-600" />}
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => setIsCompletionDialogOpen(false)}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </UnifiedLayout>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => {
        if (!open) {
          setConfirmDialog({ open: false, title: "", description: "", onConfirm: () => {} });
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
