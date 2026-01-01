import { useState } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, BookOpen, Calendar, Paperclip, Clock, CheckCircle, Plus, MessageCircle } from "lucide-react";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface HomeworkItem {
  id: number;
  subject: string;
  title: string;
  description: string;
  dueDate: string;
  status: "active" | "completed";
  submissions: number;
  sentToParents: boolean;
}

const initialHomework: HomeworkItem[] = [
  { id: 1, subject: "Mathematics", title: "Algebra Worksheet", description: "Complete exercises 1-20", dueDate: "2024-01-20", status: "active", submissions: 38, sentToParents: true },
  { id: 2, subject: "English", title: "Essay Writing", description: "Write 500 words on environment", dueDate: "2024-01-18", status: "completed", submissions: 45, sentToParents: true },
  { id: 3, subject: "Science", title: "Lab Report", description: "Write lab report on experiment", dueDate: "2024-01-22", status: "active", submissions: 25, sentToParents: false },
];

const defaultSubjects = [
  { id: "mathematics", name: "Mathematics" },
  { id: "english", name: "English" },
  { id: "science", name: "Science" },
  { id: "hindi", name: "Hindi" },
  { id: "social-studies", name: "Social Studies" },
  { id: "computer", name: "Computer Science" },
];

export default function HomeworkModule() {
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subjects, setSubjects] = useState(defaultSubjects);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [homework, setHomework] = useState<HomeworkItem[]>(initialHomework);

  const handleAddSubject = () => {
    if (!newSubjectName.trim()) {
      toast.error("Please enter a subject name");
      return;
    }
    const subjectId = newSubjectName.toLowerCase().replace(/\s+/g, "-");
    if (subjects.some(s => s.id === subjectId)) {
      toast.error("Subject already exists");
      return;
    }
    setSubjects([...subjects, { id: subjectId, name: newSubjectName.trim() }]);
    setNewSubjectName("");
    setIsAddSubjectOpen(false);
    toast.success(`"${newSubjectName.trim()}" added to subjects`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject || !title || !description || !dueDate) {
      toast.error("Please fill all required fields");
      return;
    }

    const selectedSubject = subjects.find(s => s.id === subject);
    const newHomework: HomeworkItem = {
      id: Date.now(),
      subject: selectedSubject?.name || subject,
      title,
      description,
      dueDate,
      status: "active",
      submissions: 0,
      sentToParents: false,
    };

    setHomework([newHomework, ...homework]);
    setSubject("");
    setTitle("");
    setDescription("");
    setDueDate("");
    toast.success("Homework created successfully!");
  };

  const handleSendToParents = (hw: HomeworkItem) => {
    // Format message for WhatsApp
    const message = `📚 *Homework Alert*\n\n` +
      `Subject: ${hw.subject}\n` +
      `Title: ${hw.title}\n` +
      `Description: ${hw.description}\n` +
      `Due Date: ${new Date(hw.dueDate).toLocaleDateString()}\n\n` +
      `Please ensure your child completes this homework on time.`;

    // Open WhatsApp with the message (in production, this would loop through parent numbers)
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');

    // Mark as sent
    setHomework(homework.map(h => 
      h.id === hw.id ? { ...h, sentToParents: true } : h
    ));
    toast.success("WhatsApp opened with homework details");
  };

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Homework</h1>
          <p className="text-muted-foreground mt-1">Send and manage homework for your class.</p>
        </div>

        <Tabs defaultValue="send" className="w-full">
          <TabsList>
            <TabsTrigger value="send">Send Homework</TabsTrigger>
            <TabsTrigger value="sent">Sent Homework</TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="mt-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm max-w-2xl">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-6">
                <Send className="w-5 h-5 text-primary" />
                New Homework
              </h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <div className="flex gap-2">
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subj) => (
                          <SelectItem key={subj.id} value={subj.id}>
                            {subj.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="icon">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Subject</DialogTitle>
                          <DialogDescription>
                            Add a new subject to assign homework for.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label htmlFor="newSubject">Subject Name</Label>
                            <Input
                              id="newSubject"
                              placeholder="e.g., Physical Education"
                              value={newSubjectName}
                              onChange={(e) => setNewSubjectName(e.target.value)}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsAddSubjectOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="button" onClick={handleAddSubject}>
                              Add Subject
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Chapter 5 Worksheet"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
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
                  <Label htmlFor="dueDate">Due Date *</Label>
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
                  Create Homework
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="sent" className="mt-6 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold text-foreground mt-1">{homework.length}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-primary mt-1">
                  {homework.filter(h => h.status === "active").length}
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {homework.filter(h => h.status === "completed").length}
                </p>
              </div>
            </div>

            {/* Homework List */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium text-muted-foreground">Subject</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Title</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Due Date</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {homework.map((hw) => (
                      <tr key={hw.id} className="hover:bg-muted/30">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                            {hw.subject}
                          </div>
                        </td>
                        <td className="p-4 font-medium">{hw.title}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {new Date(hw.dueDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            hw.status === "active" 
                              ? "bg-yellow-100 text-yellow-800" 
                              : "bg-green-100 text-green-800"
                          }`}>
                            {hw.status === "active" ? (
                              <Clock className="w-3 h-3 mr-1" />
                            ) : (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            )}
                            {hw.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <Button
                            size="sm"
                            variant={hw.sentToParents ? "outline" : "default"}
                            onClick={() => handleSendToParents(hw)}
                            className="gap-1"
                          >
                            <MessageCircle className="w-4 h-4" />
                            {hw.sentToParents ? "Resend" : "Send to Parents"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </UnifiedLayout>
  );
}
