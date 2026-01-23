import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Bell, Users, School, Clock, UserCog, AlertTriangle, FileText, X, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { uploadApi, notificationsApi, classesApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const recentNotifications = [
  { id: 1, title: "School Holiday Announcement", target: "All Classes", time: "2 hours ago", status: "sent" },
  { id: 2, title: "Parent-Teacher Meeting", target: "Class 3, Class 4", time: "1 day ago", status: "sent" },
  { id: 3, title: "Exam Schedule Update", target: "All Classes", time: "2 days ago", status: "sent" },
  { id: 4, title: "Staff Meeting Tomorrow", target: "All Teachers", time: "3 days ago", status: "sent" },
  { id: 5, title: "New Curriculum Guidelines", target: "All Teachers", time: "4 days ago", status: "sent" },
];

const classes = [
  "Class 1A", "Class 1B", "Class 2A", "Class 2B",
  "Class 3A", "Class 3B", "Class 4A", "Class 4B",
];

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [target, setTarget] = useState("all");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentInfo, setAttachmentInfo] = useState<{
    name: string;
    url: string;
    type: string;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [classesList, setClassesList] = useState<any[]>([]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const classesData = await classesApi.getAll();
        setClassesList(classesData);
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    };
    fetchClasses();
  }, []);

  const handleLogout = () => {
    navigate("/");
  };

  const toggleClass = (className: string) => {
    setSelectedClasses((prev) =>
      prev.includes(className)
        ? prev.filter((c) => c !== className)
        : [...prev, className]
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    try {
      setUploadingFile(true);
      setSelectedFile(file);
      
      const result = await uploadApi.uploadNotificationAttachment(file);
      
      setAttachmentUrl(result.fileUrl);
      setAttachmentInfo({
        name: result.originalName,
        url: result.fileUrl,
        type: result.fileType
      });
      
      toast.success("File uploaded successfully");
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(error.message || "Failed to upload file");
      setSelectedFile(null);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setAttachmentUrl(null);
    setAttachmentInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !message) {
      toast.error("Please fill in title and message");
      return;
    }

    try {
      setSending(true);

      // Determine target type
      let targetType: 'all_classes' | 'selected_classes' | 'all_teachers';
      let targetClasses: string[] | undefined;

      if (target === "all") {
        targetType = 'all_classes';
      } else if (target === "selected") {
        if (selectedClasses.length === 0) {
          toast.error("Please select at least one class");
          return;
        }
        targetType = 'selected_classes';
        // Map class names to IDs - need to find matching classes
        const matchedClasses = classesList.filter(cls => 
          selectedClasses.includes(`${cls.name}${cls.section ? cls.section : ''}`)
        );
        targetClasses = matchedClasses.map(cls => cls.id);
      } else if (target === "teachers") {
        targetType = 'all_teachers';
      } else {
        targetType = 'all_classes';
      }

      const result = await notificationsApi.send({
        title,
        message,
        targetType,
        targetClasses,
        priority: priority as 'normal' | 'urgent',
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentInfo?.name || undefined,
        attachmentType: attachmentInfo?.type || undefined,
      });

      toast.success(result.message || `Notification sent!`);
      setTitle("");
      setMessage("");
      setSelectedClasses([]);
      setSelectedFile(null);
      setAttachmentUrl(null);
      setAttachmentInfo(null);
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast.error(error.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout role="admin" userName="Admin User" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="text-muted-foreground mt-1">Send announcements to classes and teachers.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Send Notification Form */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Send Notification
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Target Selection */}
              <div className="space-y-3">
                <Label>Send to</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <School className="w-4 h-4" />
                        All Classes (Parents)
                      </div>
                    </SelectItem>
                    <SelectItem value="selected">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Selected Classes (Parents)
                      </div>
                    </SelectItem>
                    <SelectItem value="teachers">
                      <div className="flex items-center gap-2">
                        <UserCog className="w-4 h-4" />
                        All Teachers
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Teacher notification info */}
              {target === "teachers" && (
                <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <UserCog className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Sending to All Teachers</p>
                    <p className="text-sm text-muted-foreground">
                      This notification will appear in all teachers' dashboards and notification panels.
                    </p>
                  </div>
                </div>
              )}

              {/* Class Selection (if selected classes) */}
              {target === "selected" && (
                <div className="space-y-3">
                  <Label>Select Classes</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {classesList.length > 0 ? (
                      classesList.map((cls) => {
                        const classDisplayName = `${cls.name}${cls.section ? cls.section : ''}`;
                        return (
                          <label
                            key={cls.id}
                            className="flex items-center gap-2 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              checked={selectedClasses.includes(classDisplayName)}
                              onCheckedChange={() => toggleClass(classDisplayName)}
                            />
                            <span className="text-sm">{classDisplayName}</span>
                          </label>
                        );
                      })
                    ) : (
                      classes.map((cls) => (
                        <label
                          key={cls}
                          className="flex items-center gap-2 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={selectedClasses.includes(cls)}
                            onCheckedChange={() => toggleClass(cls)}
                          />
                          <span className="text-sm">{cls}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Priority (for teacher notifications) */}
              {target === "teachers" && (
                <div className="space-y-3">
                  <Label>Priority</Label>
                  <RadioGroup value={priority} onValueChange={setPriority} className="flex gap-4">
                    <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors flex-1">
                      <RadioGroupItem value="normal" />
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Normal</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors flex-1">
                      <RadioGroupItem value="urgent" />
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning" />
                        <span className="text-sm font-medium">Urgent</span>
                      </div>
                    </label>
                  </RadioGroup>
                </div>
              )}

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
                  placeholder="Write your announcement here..."
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {/* Attachment */}
              <div className="space-y-2">
                <Label>Attachment (Optional)</Label>
                {!attachmentInfo ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                      onChange={handleFileSelect}
                      disabled={uploadingFile}
                      className="flex-1"
                    />
                    {uploadingFile && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{attachmentInfo.name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Supported: Images, PDF, Word, Excel, Text files (Max 10MB)
                </p>
              </div>

              <Button type="submit" className="w-full sm:w-auto" disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {target === "teachers" ? "Send to Teachers" : "Send Notification"}
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Recent Notifications */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Recent Notifications
            </h3>
            
            <div className="space-y-4">
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <h4 className="font-medium text-foreground">{notification.title}</h4>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {notification.target === "All Teachers" ? (
                        <UserCog className="w-3 h-3" />
                      ) : (
                        <Users className="w-3 h-3" />
                      )}
                      {notification.target}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {notification.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
