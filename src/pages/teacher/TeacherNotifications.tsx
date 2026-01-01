import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Bell, AlertTriangle, Clock, Users, User } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

const recentNotifications = [
  { id: 1, title: "Field Trip Permission", priority: "normal", time: "2 hours ago", recipients: "All Parents" },
  { id: 2, title: "Parent Meeting Reminder", priority: "urgent", time: "1 day ago", recipients: "All Parents" },
  { id: 3, title: "Homework Deadline Extended", priority: "normal", time: "2 days ago", recipients: "Rahul S., Priya M." },
  { id: 4, title: "Emergency School Closure", priority: "urgent", time: "3 days ago", recipients: "All Parents" },
];

const students = [
  { id: 1, name: "Rahul Sharma", rollNo: "01" },
  { id: 2, name: "Priya Mehta", rollNo: "02" },
  { id: 3, name: "Amit Kumar", rollNo: "03" },
  { id: 4, name: "Sneha Patel", rollNo: "04" },
  { id: 5, name: "Vikram Singh", rollNo: "05" },
  { id: 6, name: "Ananya Das", rollNo: "06" },
  { id: 7, name: "Rohan Gupta", rollNo: "07" },
  { id: 8, name: "Kavya Nair", rollNo: "08" },
];

export default function TeacherNotifications() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [recipientType, setRecipientType] = useState("all");
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);

  const handleLogout = () => {
    navigate("/");
  };

  const handleStudentToggle = (studentId: number) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
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

              {/* Recipients */}
              <div className="space-y-3">
                <Label>Send To</Label>
                <RadioGroup value={recipientType} onValueChange={setRecipientType} className="flex gap-4">
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
                      {selectedStudents.length === students.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
                    {students.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={() => handleStudentToggle(student.id)}
                        />
                        <span className="text-sm">
                          {student.rollNo}. {student.name}
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedStudents.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedStudents.length} student(s) selected
                    </p>
                  )}
                </div>
              )}

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

              <Button type="submit" className="w-full sm:w-auto" disabled={recipientType === "selected" && selectedStudents.length === 0}>
                <Send className="w-4 h-4 mr-2" />
                {recipientType === "all" ? "Send to All Parents" : `Send to ${selectedStudents.length} Parent(s)`}
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
                      <p className="text-xs text-muted-foreground mt-0.5">To: {notification.recipients}</p>
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
