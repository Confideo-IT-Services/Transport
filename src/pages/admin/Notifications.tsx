import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Bell, Users, School, Clock, UserCog, AlertTriangle, Loader2 } from "lucide-react";
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
import { notificationsApi, classesApi } from "@/lib/api";

export default function Notifications() {
  const navigate = useNavigate();
  const [target, setTarget] = useState("all");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Load classes and notifications
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [classesData, notificationsData] = await Promise.all([
          classesApi.getAll(),
          notificationsApi.getAll()
        ]);
        setClasses(classesData || []);
        setNotifications(notificationsData || []);
      } catch (error: any) {
        console.error('Error loading data:', error);
        toast.error(error?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleLogout = () => {
    navigate("/");
  };

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((c) => c !== classId)
        : [...prev, classId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      toast.error("Please fill in title and message");
      return;
    }

    if (target === "selected" && selectedClassIds.length === 0) {
      toast.error("Please select at least one class");
      return;
    }

    setSending(true);
    try {
      // Map target values to API target types
      let targetType: 'all_classes' | 'selected_classes' | 'all_teachers' | 'all_parents';
      if (target === "all") {
        targetType = "all_parents";
      } else if (target === "selected") {
        targetType = "selected_classes";
      } else if (target === "teachers") {
        targetType = "all_teachers";
      } else {
        targetType = "all_parents";
      }

      const result = await notificationsApi.send({
        title: title.trim(),
        message: message.trim(),
        targetType,
        classIds: target === "selected" ? selectedClassIds : undefined,
        priority
      });

      toast.success(`Notification sent successfully to ${result.sentCount} recipient${result.sentCount !== 1 ? 's' : ''}!`);
      
      // Reset form
      setTitle("");
      setMessage("");
      setSelectedClassIds([]);
      setTarget("all");
      setPriority("normal");

      // Reload notifications
      const updatedNotifications = await notificationsApi.getAll();
      setNotifications(updatedNotifications || []);
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast.error(error?.message || "Failed to send notification");
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

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
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
                    {classes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No classes available</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-60 overflow-y-auto">
                        {classes.map((cls) => {
                          const classDisplay = `${cls.name}${cls.section ? ` - Section ${cls.section}` : ''}`;
                          return (
                            <label
                              key={cls.id}
                              className="flex items-center gap-2 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                            >
                              <Checkbox
                                checked={selectedClassIds.includes(cls.id)}
                                onCheckedChange={() => toggleClass(cls.id)}
                              />
                              <span className="text-sm">{classDisplay}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Priority */}
                <div className="space-y-3">
                  <Label>Priority</Label>
                  <RadioGroup value={priority} onValueChange={(value) => setPriority(value as "normal" | "urgent")} className="flex gap-4">
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

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Notification title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
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
                    required
                  />
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
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No notifications sent yet
                  </p>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{notification.title}</h4>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              {notification.targetType === "all_teachers" ? (
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
                          {notification.priority === "urgent" && (
                            <div className="mt-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
                                <AlertTriangle className="w-3 h-3" />
                                Urgent
                              </span>
                            </div>
                          )}
                          {notification.sentCount > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Sent to {notification.sentCount} recipient{notification.sentCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
