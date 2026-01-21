import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, 
  Send, 
  Users, 
  CheckCircle2,
  Clock,
  AlertTriangle,
  Megaphone,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { notificationsApi, classesApi, Notification, SentNotification, NotificationTemplate } from "@/lib/api";

export default function NotificationsModule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sentNotifications, setSentNotifications] = useState<SentNotification[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [recipient, setRecipient] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [inboxData, sentData, classesData] = await Promise.all([
        notificationsApi.getInbox().catch(() => []),
        notificationsApi.getSent().catch(() => []),
        classesApi.getAll().catch(() => [])
      ]);

      setNotifications(inboxData);
      setSentNotifications(sentData);
      setClasses(classesData);

      // Fetch templates if admin
      if (isAdmin) {
        const templatesData = await notificationsApi.getTemplates().catch(() => []);
        setTemplates(templatesData);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setNotificationTitle(template.title);
      setNotificationMessage(template.message);
      setSelectedTemplate(templateId);
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

  const handleSendNotification = async () => {
    if (!notificationTitle || !notificationMessage || !recipient) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setSending(true);

      // Determine target type and classes
      let targetType: 'all_classes' | 'selected_classes' | 'all_teachers' | 'all_parents' | 'specific_students';
      let targetClasses: string[] | undefined;

      if (recipient === 'all-teachers') {
        targetType = 'all_teachers';
      } else if (recipient === 'all-parents') {
        targetType = 'all_classes';
      } else if (recipient.startsWith('class-')) {
        targetType = 'selected_classes';
        const classId = recipient.replace('class-', '');
        targetClasses = [classId];
      } else {
        targetType = 'all_classes';
      }

      const result = await notificationsApi.send({
        title: notificationTitle,
        message: notificationMessage,
        targetType,
        targetClasses,
        priority: isAdmin ? priority : 'normal'
      });

      toast({
        title: "Success",
        description: result.message,
      });

      // Reset form
      setNotificationTitle("");
      setNotificationMessage("");
      setRecipient("");
      setSelectedClassIds([]);
      setSelectedTemplate("");
      
      // Refresh data
      await fetchData();
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      // Dispatch custom event to update header badge
      window.dispatchEvent(new CustomEvent('notification-read'));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  if (loading) {
    return (
      <UnifiedLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </UnifiedLayout>
    );
  }

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? "Send announcements to teachers and manage notifications"
                : "View announcements and send notifications to parents"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Send Notification */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="w-5 h-5" />
                Send Notification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Recipient</label>
                <Select value={recipient} onValueChange={setRecipient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {isAdmin ? (
                      <>
                        <SelectItem value="all-teachers">All Teachers</SelectItem>
                        <SelectItem value="all-parents">All Parents</SelectItem>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={`class-${cls.id}`}>
                            {cls.name} {cls.section ? `- ${cls.section}` : ''} Parents
                          </SelectItem>
                        ))}
                      </>
                    ) : (
                      <>
                        <SelectItem value="all-parents">All Class Parents</SelectItem>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={`class-${cls.id}`}>
                            {cls.name} {cls.section ? `- ${cls.section}` : ''} Parents
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {isAdmin && templates.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quick Templates</label>
                  <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input 
                  placeholder="Notification title"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea 
                  placeholder="Enter your message..."
                  rows={4}
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                />
              </div>

              {isAdmin && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={priority} onValueChange={(value: "normal" | "urgent") => setPriority(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={handleSendNotification}
                disabled={sending}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Notification
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bell className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{notifications.filter(n => !n.read).length}</p>
                    <p className="text-sm text-muted-foreground">Unread</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{sentNotifications.length}</p>
                    <p className="text-sm text-muted-foreground">Sent</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Notifications List */}
        <Tabs defaultValue="inbox" className="space-y-4">
          <TabsList>
            <TabsTrigger value="inbox">
              Inbox
              {notifications.filter(n => !n.read).length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                  {notifications.filter(n => !n.read).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="space-y-4">
            {notifications.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No notifications
                </CardContent>
              </Card>
            ) : (
              notifications.map((notification) => (
                <Card 
                  key={notification.id} 
                  className={!notification.read ? "border-primary/50 cursor-pointer" : "cursor-pointer"}
                  onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        notification.priority === "urgent" 
                          ? "bg-destructive/10" 
                          : "bg-primary/10"
                      }`}>
                        {notification.priority === "urgent" ? (
                          <AlertTriangle className="w-5 h-5 text-destructive" />
                        ) : (
                          <Megaphone className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-semibold ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <Badge variant="default" className="text-xs">New</Badge>
                          )}
                          {notification.priority === "urgent" && (
                            <Badge variant="destructive" className="text-xs">Urgent</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>From: {notification.sender}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(notification.time)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="sent" className="space-y-4">
            {sentNotifications.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No sent notifications
                </CardContent>
              </Card>
            ) : (
              sentNotifications.map((notification) => (
                <Card key={notification.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{notification.title}</h3>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {notification.recipients}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(notification.time)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-secondary/10 text-secondary">
                        {notification.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </UnifiedLayout>
  );
}
