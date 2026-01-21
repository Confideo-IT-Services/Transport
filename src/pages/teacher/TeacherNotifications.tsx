import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Bell, AlertTriangle, Clock, Users, User, UserX, Calendar, Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { notificationsApi, studentsApi, classesApi, SentNotification } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const notificationTemplates = [
  { 
    id: "absence", 
    label: "Absence Notification", 
    icon: UserX,
    title: "Student Absence Notification",
    message: "Dear Parent, we would like to inform you that your child was marked absent today. Please contact the school if this was not expected."
  },
  { 
    id: "leave", 
    label: "Leave Notification", 
    icon: Calendar,
    title: "Leave Application Received",
    message: "Dear Parent, we have received the leave application for your child. The leave has been recorded in our system."
  },
  { 
    id: "custom", 
    label: "Custom Message", 
    icon: Bell,
    title: "",
    message: ""
  },
];

export default function TeacherNotifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [recipientType, setRecipientType] = useState<"all" | "selected">("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [notificationType, setNotificationType] = useState("custom");
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<SentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [classesData, sentData] = await Promise.all([
        classesApi.getAll().catch(() => []),
        notificationsApi.getSent().catch(() => [])
      ]);

      setClasses(classesData);
      setRecentNotifications(sentData.slice(0, 5));

      // Get students from teacher's assigned classes
      if (classesData.length > 0) {
        const allStudents: any[] = [];
        for (const cls of classesData) {
          try {
            const classStudents = await studentsApi.getByClass(cls.id);
            allStudents.push(...classStudents);
          } catch (error) {
            console.error(`Error fetching students for class ${cls.id}:`, error);
          }
        }
        setStudents(allStudents);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    navigate("/");
  };

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map(s => s.id));
    }
  };

  const handleNotificationTypeChange = (value: string) => {
    setNotificationType(value);
    const template = notificationTemplates.find(t => t.id === value);
    if (template && value !== "custom") {
      setTitle(template.title);
      setMessage(template.message);
      setPriority(value === "absence" ? "urgent" : "normal");
    } else {
      setTitle("");
      setMessage("");
      setPriority("normal");
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !message) {
      toast.error("Please fill in title and message");
      return;
    }

    if (recipientType === "selected" && selectedStudentIds.length === 0) {
      toast.error("Please select at least one student");
      return;
    }

    try {
      setSending(true);

      let targetType: 'all_classes' | 'specific_students';
      let targetStudents: string[] | undefined;

      if (recipientType === "all") {
        // Get all class IDs for teacher's classes
        const classIds = classes.map(c => c.id);
        if (classIds.length === 0) {
          toast.error("No classes assigned");
          return;
        }
        // For "all", we'll use all_classes with the teacher's classes
        targetType = 'all_classes';
      } else {
        targetType = 'specific_students';
        targetStudents = selectedStudentIds;
      }

      const result = await notificationsApi.send({
        title,
        message,
        targetType: targetType === 'all_classes' ? 'all_classes' : 'specific_students',
        targetStudents,
        priority
      });

      toast.success(result.message);
      setTitle("");
      setMessage("");
      setSelectedStudentIds([]);
      setRecipientType("all");
      setNotificationType("custom");
      
      // Refresh data
      await fetchData();
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast.error(error.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  const classNames = classes.map(c => `${c.name}${c.section ? ` - ${c.section}` : ''}`).join(', ');

  if (loading) {
    return (
      <DashboardLayout role="teacher" userName={user?.name || "Teacher"} onLogout={handleLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher" userName={user?.name || "Teacher"} onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Send notifications to parents of {classNames || "your assigned classes"}.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Send Notification Form */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Send Notification
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Notification Type */}
              <div className="space-y-2">
                <Label>Quick Templates</Label>
                <Select value={notificationType} onValueChange={handleNotificationTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select notification type" />
                  </SelectTrigger>
                  <SelectContent>
                    {notificationTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <template.icon className="w-4 h-4" />
                          {template.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {notificationType !== "custom" && (
                  <p className="text-xs text-muted-foreground">
                    Template selected. You can modify the message below.
                  </p>
                )}
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Notification title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Write your notification message..."
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {/* Recipients */}
              <div className="space-y-3">
                <Label>Send To</Label>
                <RadioGroup value={recipientType} onValueChange={(value: "all" | "selected") => setRecipientType(value)} className="flex gap-4">
                  <label className="flex items-center gap-3 p-4 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors flex-1">
                    <RadioGroupItem value="all" />
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">All Parents</p>
                        <p className="text-xs text-muted-foreground">Send to entire class</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-4 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors flex-1">
                    <RadioGroupItem value="selected" />
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Select Students</p>
                        <p className="text-xs text-muted-foreground">Choose specific students</p>
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* Student Selection */}
              {recipientType === "selected" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Select Students</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="text-xs"
                    >
                      {selectedStudentIds.length === students.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
                    {students.length === 0 ? (
                      <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
                        No students found
                      </p>
                    ) : (
                      students.map((student) => (
                        <label
                          key={student.id}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={selectedStudentIds.includes(student.id)}
                            onCheckedChange={() => handleStudentToggle(student.id)}
                          />
                          <span className="text-sm">
                            {student.rollNo || ''}. {student.name}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedStudentIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedStudentIds.length} student(s) selected
                    </p>
                  )}
                </div>
              )}

              {/* Priority */}
              <div className="space-y-3">
                <Label>Priority</Label>
                <RadioGroup value={priority} onValueChange={(value: "normal" | "urgent") => setPriority(value)} className="flex gap-4">
                  <label className="flex items-center gap-3 p-4 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors flex-1">
                    <RadioGroupItem value="normal" />
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Normal</p>
                        <p className="text-xs text-muted-foreground">Standard notification</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-4 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors flex-1">
                    <RadioGroupItem value="urgent" />
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      <div>
                        <p className="font-medium">Urgent</p>
                        <p className="text-xs text-muted-foreground">High priority alert</p>
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <Button 
                type="submit" 
                className="w-full sm:w-auto" 
                disabled={(recipientType === "selected" && selectedStudentIds.length === 0) || sending}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {recipientType === "all" ? "Send to All Parents" : `Send to ${selectedStudentIds.length} Parent(s)`}
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Notification History */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Recent Notifications
            </h3>

            <div className="space-y-4">
              {recentNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent notifications</p>
              ) : (
                recentNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Bell className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{notification.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">To: {notification.recipients}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(notification.time)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
