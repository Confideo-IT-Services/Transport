import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
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
import { toast } from "sonner";
import { homeworkApi, classesApi, timetableApi } from "@/lib/api";

export default function Homework() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [sentHomework, setSentHomework] = useState<any[]>([]);
  const [classId, setClassId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load teacher's class and homework on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load teacher's assigned class
        const classesData = await classesApi.getAll();
        if (classesData && classesData.length > 0) {
          setClassId(classesData[0].id);
        }

        try {
          const subjectsData = await timetableApi.getSubjects();
          setSubjects(
            (subjectsData || []).map((s: { id: string; name?: string; code?: string }) => ({
              id: String(s.id),
              name: s.name || s.code || "Subject",
            }))
          );
        } catch (subErr) {
          console.error("Error loading subjects:", subErr);
          setSubjects([]);
          toast.error("Failed to load subjects");
        }

        // Load homework
        const homeworkData = await homeworkApi.getAll();
        const transformedHomework = homeworkData.map((h: any) => ({
          id: h.id,
          subject: h.subject || "Subject",
          title: h.title || h.subject || "Homework",
          dueDate: h.dueDate || "",
          status: h.status || "active",
          submissions: 0 // Backend doesn't track submissions yet
        }));
        setSentHomework(transformedHomework);
      } catch (error) {
        console.error('Error loading homework data:', error);
        toast.error('Failed to load homework');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  const handleLogout = () => {
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    
    if (!subject) {
      toast.error("Please select a subject");
      return;
    }
    
    if (!classId) {
      toast.error("No class assigned. Please contact admin.");
      return;
    }

    if (!dueDate) {
      toast.error("Please select a due date");
      return;
    }

    try {
      setIsLoading(true);
      const selectedSubject = subjects.find(s => s.id === subject);
      const result = await homeworkApi.create({
        title,
        description: description || undefined,
        subject: selectedSubject?.name || subject,
        classId,
        dueDate
      });

      // Refresh homework list
      const homeworkData = await homeworkApi.getAll();
      const transformedHomework = homeworkData.map((h: any) => ({
        id: h.id,
        subject: h.subject || "Subject",
        title: h.title || h.subject || "Homework",
        dueDate: h.dueDate || "",
        status: h.status || "active",
        submissions: 0
      }));
      setSentHomework(transformedHomework);

      // Reset form
      setTitle("");
      setDescription("");
      setDueDate("");
      setSubject("");
      
      toast.success("Homework created successfully!");
    } catch (error: any) {
      console.error('Error creating homework:', error);
      toast.error(error?.message || "Failed to create homework");
    } finally {
      setIsLoading(false);
    }
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
                    <SelectTrigger className="flex-1" id="subject">
                      <SelectValue placeholder={subjects.length ? "Select subject" : "No subjects — ask admin to add in Academic Setup"} />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subj) => (
                        <SelectItem key={subj.id} value={subj.id}>
                          {subj.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {subjects.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Subjects are managed by your school admin (Academic Setup).
                    </p>
                  )}
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
