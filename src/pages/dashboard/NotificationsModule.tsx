import { useState } from "react";
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
  Megaphone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const notifications = [
  { 
    id: 1, 
    title: "Staff Meeting Tomorrow", 
    message: "All teachers are requested to attend the staff meeting at 3 PM in the conference room.",
    sender: "School Admin",
    time: "2 hours ago",
    priority: "normal",
    read: false
  },
  { 
    id: 2, 
    title: "Annual Day Preparations", 
    message: "Please submit the list of students participating in Annual Day events by Friday.",
    sender: "School Admin",
    time: "1 day ago",
    priority: "urgent",
    read: true
  },
  { 
    id: 3, 
    title: "Holiday Notice", 
    message: "School will remain closed on 26th January for Republic Day celebrations.",
    sender: "School Admin",
    time: "2 days ago",
    priority: "normal",
    read: true
  },
];

const sentNotifications = [
  { 
    id: 1, 
    title: "Homework Reminder - Class 5A", 
    recipients: "42 parents",
    time: "1 hour ago",
    status: "delivered"
  },
  { 
    id: 2, 
    title: "Absence Notification - Arjun Kumar", 
    recipients: "1 parent",
    time: "3 hours ago",
    status: "delivered"
  },
  { 
    id: 3, 
    title: "PTM Reminder", 
    recipients: "42 parents",
    time: "1 day ago",
    status: "delivered"
  },
];

const quickTemplates = [
  { id: "absence", label: "Absence Notification", title: "Student Absence Notification", message: "Dear Parent, this is to inform you that your child was marked absent today. Please contact the school if you have any queries." },
  { id: "leave", label: "Leave Approved", title: "Leave Application Approved", message: "Dear Parent, your child's leave application has been approved. Please ensure regular attendance after the leave period." },
  { id: "homework", label: "Homework Reminder", title: "Homework Reminder", message: "Dear Parent, this is a reminder that your child has pending homework assignments. Please ensure timely completion." },
  { id: "fee", label: "Fee Reminder", title: "Fee Payment Reminder", message: "Dear Parent, this is a gentle reminder that your child's fee payment is pending. Please clear the dues at the earliest." },
];

export default function NotificationsModule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [recipient, setRecipient] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const handleTemplateSelect = (templateId: string) => {
    const template = quickTemplates.find(t => t.id === templateId);
    if (template) {
      setNotificationTitle(template.title);
      setNotificationMessage(template.message);
      setSelectedTemplate(templateId);
    }
  };

  const handleSendNotification = () => {
    if (!notificationTitle || !notificationMessage || !recipient) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Notification Sent",
      description: `Your notification has been sent to ${recipient}.`,
    });
    
    setNotificationTitle("");
    setNotificationMessage("");
    setRecipient("");
    setSelectedTemplate("");
  };

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
                        <SelectItem value="class-5a">Class 5A Parents</SelectItem>
                        <SelectItem value="class-5b">Class 5B Parents</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="all-parents">All Class Parents</SelectItem>
                        <SelectItem value="specific">Specific Student's Parents</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Quick Templates</label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {quickTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.label}
                      </SelectItem>
                    ))}
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

              {isAdmin && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select defaultValue="normal">
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

              <Button className="w-full" onClick={handleSendNotification}>
                <Send className="w-4 h-4 mr-2" />
                Send Notification
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
                    <p className="text-sm text-muted-foreground">Sent Today</p>
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
            {notifications.map((notification) => (
              <Card key={notification.id} className={!notification.read ? "border-primary/50" : ""}>
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
                        <span>{notification.time}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="sent" className="space-y-4">
            {sentNotifications.map((notification) => (
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
                            {notification.time}
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
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </UnifiedLayout>
  );
}
