import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, BookOpen, Calendar, Paperclip, Clock, CheckCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const sentHomework = [
  { id: 1, subject: "Mathematics", title: "Algebra Worksheet", dueDate: "2024-01-20", status: "active", submissions: 38 },
  { id: 2, subject: "English", title: "Essay Writing", dueDate: "2024-01-18", status: "completed", submissions: 45 },
  { id: 3, subject: "Science", title: "Lab Report", dueDate: "2024-01-22", status: "active", submissions: 25 },
  { id: 4, subject: "History", title: "Chapter 5 Questions", dueDate: "2024-01-15", status: "completed", submissions: 44 },
  { id: 5, subject: "Mathematics", title: "Geometry Problems", dueDate: "2024-01-25", status: "active", submissions: 12 },
];

export default function Homework() {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

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
          <h1 className="page-title">Homework</h1>
          <p className="text-muted-foreground mt-1">Send and manage homework for your class.</p>
        </div>

        <Tabs defaultValue="send" className="w-full">
          <TabsList>
            <TabsTrigger value="send">Send Homework</TabsTrigger>
            <TabsTrigger value="sent">Sent Homework</TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="mt-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-card max-w-2xl">
              <h3 className="section-title flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                New Homework
              </h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mathematics">Mathematics</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="science">Science</SelectItem>
                      <SelectItem value="history">History</SelectItem>
                      <SelectItem value="geography">Geography</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Chapter 5 Worksheet"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Provide detailed instructions for the homework..."
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="dueDate"
                      type="date"
                      className="pl-10"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Attachment */}
                <div className="space-y-2">
                  <Label>Attachment (Optional)</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <Paperclip className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, DOC, or images up to 10MB
                    </p>
                  </div>
                </div>

                <Button type="submit" className="w-full sm:w-auto">
                  <Send className="w-4 h-4 mr-2" />
                  Send Homework
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="sent" className="mt-6 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold text-foreground mt-1">{sentHomework.length}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-primary mt-1">
                  {sentHomework.filter(h => h.status === "active").length}
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-success mt-1">
                  {sentHomework.filter(h => h.status === "completed").length}
                </p>
              </div>
            </div>

            {/* Homework List */}
            <div className="data-table">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Title</th>
                    <th>Due Date</th>
                    <th>Submissions</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sentHomework.map((homework) => (
                    <tr key={homework.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-muted-foreground" />
                          {homework.subject}
                        </div>
                      </td>
                      <td className="font-medium">{homework.title}</td>
                      <td>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {new Date(homework.dueDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <span className="font-medium">{homework.submissions}</span>
                        <span className="text-muted-foreground">/45</span>
                      </td>
                      <td>
                        <span className={`badge ${homework.status === "active" ? "badge-warning" : "badge-success"}`}>
                          {homework.status === "active" ? (
                            <Clock className="w-3 h-3 mr-1" />
                          ) : (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          )}
                          {homework.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
