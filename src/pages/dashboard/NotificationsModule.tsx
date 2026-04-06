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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Bell, 
  Send, 
  Users, 
  CheckCircle2,
  Clock,
  AlertTriangle,
  Megaphone,
  Loader2,
  FileText,
  X,
  Download,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { notificationsApi, classesApi, uploadApi, Notification, SentNotification } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";

export default function NotificationsModule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sentNotifications, setSentNotifications] = useState<SentNotification[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [recipient, setRecipient] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentInfo, setAttachmentInfo] = useState<{
    name: string;
    url: string;
    type: string;
  } | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState(false);
  const [selectedSentNotification, setSelectedSentNotification] = useState<SentNotification | null>(null);
  const [viewingSentAttachment, setViewingSentAttachment] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [notificationsTab, setNotificationsTab] = useState<"inbox" | "sent">("inbox");

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 10MB",
        variant: "destructive",
      });
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
      
      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
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
        // For teachers: use their assigned classes only
        // For admins: use all classes (targetClasses will be undefined, which means all)
        if (!isAdmin && classes.length > 0) {
          targetType = 'selected_classes';
          targetClasses = classes.map(cls => cls.id);
        } else {
          targetType = 'all_classes';
        }
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
        priority: isAdmin ? priority : 'normal',
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentInfo?.name || undefined,
        attachmentType: attachmentInfo?.type || undefined,
        eventDate: eventDate || undefined,
        scheduledAt: scheduledAt || undefined,
        whatsappEnabled: whatsappEnabled,
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
      setSelectedFile(null);
      setAttachmentUrl(null);
      setAttachmentInfo(null);
      setEventDate("");
      setScheduledAt("");
      setWhatsappEnabled(false);
      
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

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    setViewingAttachment(false); // Reset viewing state when opening new notification
    // Mark as read if unread
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
  };

  // Helper function to check if file is an image
  const isImageFile = (url: string, type?: string) => {
    if (type) {
      return type.startsWith('image/');
    }
    const extension = url.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension || '');
  };

  // Helper function to check if file is PDF
  const isPdfFile = (url: string, type?: string) => {
    if (type) {
      return type === 'application/pdf';
    }
    return url.toLowerCase().endsWith('.pdf');
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Attachment (Optional)</label>
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

              {/* Event Date Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Event Date (Optional)</label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This is the actual event date (for future reminders)
                </p>
              </div>

              {/* Scheduled At Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Schedule Sending (Optional)</label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If empty, notification will be sent immediately
                </p>
              </div>

              {/* WhatsApp Option */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="whatsapp-enabled"
                  checked={whatsappEnabled}
                  onCheckedChange={(checked) => setWhatsappEnabled(checked === true)}
                />
                <label
                  htmlFor="whatsapp-enabled"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Also send via WhatsApp (Coming Soon)
                </label>
              </div>

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

          {/* Quick Stats — opens Inbox / Sent below */}
          <div className="space-y-4">
            <Card
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => {
                setNotificationsTab("inbox");
                document.getElementById("notifications-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setNotificationsTab("inbox");
                  document.getElementById("notifications-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            >
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
            <Card
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => {
                setNotificationsTab("sent");
                document.getElementById("notifications-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setNotificationsTab("sent");
                  document.getElementById("notifications-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            >
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
        <Tabs
          id="notifications-tabs"
          value={notificationsTab}
          onValueChange={(v) => setNotificationsTab(v as "inbox" | "sent")}
          className="space-y-4"
        >
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
                  onClick={() => handleNotificationClick(notification)}
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
                          {notification.attachmentUrl && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Attachment
                            </span>
                          )}
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
                <Card 
                  key={notification.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedSentNotification(notification)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-secondary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{notification.title}</h3>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {notification.recipients}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(notification.time || notification.createdAt)}
                            </span>
                            {notification.attachmentUrl && (
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                Attachment
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {notification.priority === "urgent" && (
                          <Badge variant="destructive" className="text-xs">Urgent</Badge>
                        )}
                        <Badge variant="secondary" className="bg-secondary/10 text-secondary">
                          {notification.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Notification Detail Dialog */}
        {selectedNotification && (
          <Dialog open={!!selectedNotification} onOpenChange={(open) => {
            if (!open) {
              setSelectedNotification(null);
              setViewingAttachment(false);
            }
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedNotification.priority === "urgent" ? (
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  ) : (
                    <Megaphone className="w-5 h-5 text-primary" />
                  )}
                  {selectedNotification.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">From</p>
                  <p className="text-sm">{selectedNotification.sender || selectedNotification.senderName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Message</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedNotification.message}</p>
                </div>
                {selectedNotification.attachmentUrl && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Attachment</p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm flex-1 truncate">{selectedNotification.attachmentName || 'Attachment'}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              // Fetch the file as blob
                              const response = await fetch(selectedNotification.attachmentUrl!);
                              const blob = await response.blob();
                              const blobUrl = window.URL.createObjectURL(blob);
                              
                              // Create download link
                              const link = document.createElement('a');
                              link.href = blobUrl;
                              link.download = selectedNotification.attachmentName || 'attachment';
                              document.body.appendChild(link);
                              link.click();
                              
                              // Cleanup
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(blobUrl);
                              
                              toast({
                                title: "Success",
                                description: "File download started",
                              });
                            } catch (error) {
                              console.error('Error downloading file:', error);
                              toast({
                                title: "Error",
                                description: "Failed to download file",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingAttachment(true)}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </div>
                      
                      {/* Inline viewer for images and PDFs */}
                      {viewingAttachment && (
                        <div className="border rounded-lg p-4 bg-muted/30">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium">Preview</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingAttachment(false)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          {isImageFile(selectedNotification.attachmentUrl, selectedNotification.attachmentType) ? (
                            <div className="flex justify-center">
                              <img
                                src={selectedNotification.attachmentUrl}
                                alt={selectedNotification.attachmentName || 'Attachment'}
                                className="max-w-full max-h-[500px] rounded-lg object-contain"
                              />
                            </div>
                          ) : isPdfFile(selectedNotification.attachmentUrl, selectedNotification.attachmentType) ? (
                            <div className="w-full h-[500px]">
                              <iframe
                                src={selectedNotification.attachmentUrl}
                                className="w-full h-full rounded-lg border"
                                title={selectedNotification.attachmentName || 'PDF Preview'}
                              />
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">Preview not available for this file type</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-4"
                                onClick={() => window.open(selectedNotification.attachmentUrl, '_blank')}
                              >
                                Open in New Tab
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(selectedNotification.time || selectedNotification.createdAt)}
                  </span>
                  {selectedNotification.priority === "urgent" && (
                    <Badge variant="destructive" className="text-xs">Urgent</Badge>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Sent Notification Detail Dialog */}
        {selectedSentNotification && (
          <Dialog open={!!selectedSentNotification} onOpenChange={(open) => {
            if (!open) {
              setSelectedSentNotification(null);
              setViewingSentAttachment(false);
            }
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedSentNotification.priority === "urgent" ? (
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  ) : (
                    <Megaphone className="w-5 h-5 text-primary" />
                  )}
                  {selectedSentNotification.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">To</p>
                  <p className="text-sm">
                    {selectedSentNotification.targetType === 'all_teachers' && 'All Teachers'}
                    {selectedSentNotification.targetType === 'all_parents' && 'All Parents'}
                    {selectedSentNotification.targetType === 'all_classes' && 'All Classes'}
                    {selectedSentNotification.targetType === 'selected_classes' && 'Selected Classes'}
                    {selectedSentNotification.targetType === 'specific_students' && 'Specific Students'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedSentNotification.recipients} recipient{selectedSentNotification.recipients !== 1 ? 's' : ''}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Message</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedSentNotification.message}</p>
                </div>
                {selectedSentNotification.attachmentUrl && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Attachment</p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm flex-1 truncate">{selectedSentNotification.attachmentName || 'Attachment'}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(selectedSentNotification.attachmentUrl!);
                              const blob = await response.blob();
                              const blobUrl = window.URL.createObjectURL(blob);
                              
                              const link = document.createElement('a');
                              link.href = blobUrl;
                              link.download = selectedSentNotification.attachmentName || 'attachment';
                              document.body.appendChild(link);
                              link.click();
                              
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(blobUrl);
                              
                              toast({
                                title: "Success",
                                description: "File download started",
                              });
                            } catch (error) {
                              console.error('Error downloading file:', error);
                              toast({
                                title: "Error",
                                description: "Failed to download file",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingSentAttachment(true)}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </div>
                      
                      {/* Inline viewer for images and PDFs */}
                      {viewingSentAttachment && (
                        <div className="border rounded-lg p-4 bg-muted/30">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium">Preview</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingSentAttachment(false)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          {isImageFile(selectedSentNotification.attachmentUrl, selectedSentNotification.attachmentType) ? (
                            <div className="flex justify-center">
                              <img
                                src={selectedSentNotification.attachmentUrl}
                                alt={selectedSentNotification.attachmentName || 'Attachment'}
                                className="max-w-full max-h-[500px] rounded-lg object-contain"
                              />
                            </div>
                          ) : isPdfFile(selectedSentNotification.attachmentUrl, selectedSentNotification.attachmentType) ? (
                            <div className="w-full h-[500px]">
                              <iframe
                                src={selectedSentNotification.attachmentUrl}
                                className="w-full h-full rounded-lg border"
                                title={selectedSentNotification.attachmentName || 'PDF Preview'}
                              />
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">Preview not available for this file type</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-4"
                                onClick={() => window.open(selectedSentNotification.attachmentUrl, '_blank')}
                              >
                                Open in New Tab
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(selectedSentNotification.time || selectedSentNotification.createdAt)}
                  </span>
                  {selectedSentNotification.priority === "urgent" && (
                    <Badge variant="destructive" className="text-xs">Urgent</Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {selectedSentNotification.status}
                  </Badge>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </UnifiedLayout>
  );
}
