import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Bell, AlertTriangle, Clock } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const recentNotifications = [
  { id: 1, title: "Field Trip Permission", priority: "normal", time: "2 hours ago" },
  { id: 2, title: "Parent Meeting Reminder", priority: "urgent", time: "1 day ago" },
  { id: 3, title: "Homework Deadline Extended", priority: "normal", time: "2 days ago" },
  { id: 4, title: "Emergency School Closure", priority: "urgent", time: "3 days ago" },
];

export default function TeacherNotifications() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");

  const handleLogout = () => {
    navigate("/");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle submission
  };

  return (
    <DashboardLayout role="teacher" userName="Sarah Johnson" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="text-muted-foreground mt-1">Send notifications to parents of Class 3A.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Send Notification Form */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Send Notification
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">
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

              {/* Priority */}
              <div className="space-y-3">
                <Label>Priority</Label>
                <RadioGroup value={priority} onValueChange={setPriority} className="flex gap-4">
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

              <Button type="submit" className="w-full sm:w-auto">
                <Send className="w-4 h-4 mr-2" />
                Send to Parents
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
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {notification.priority === "urgent" ? (
                      <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                    ) : (
                      <Bell className="w-5 h-5 text-muted-foreground mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">{notification.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`badge ${notification.priority === "urgent" ? "badge-warning" : "badge-info"}`}>
                          {notification.priority}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {notification.time}
                        </span>
                      </div>
                    </div>
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
