import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Check, X, Eye, Filter, Link2, Copy, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const students = [
  { id: 1, name: "Alex Johnson", class: "Class 3A", parentPhone: "+1 234 567 890", parentName: "John Johnson", status: "pending", avatar: "", rollNo: "2024001", dateOfBirth: "2015-03-15", gender: "Male", address: "123 Main St, City", submittedAt: "2024-01-15" },
  { id: 2, name: "Emma Williams", class: "Class 4B", parentPhone: "+1 234 567 891", parentName: "Sarah Williams", status: "approved", avatar: "", rollNo: "2024002", dateOfBirth: "2014-07-22", gender: "Female", address: "456 Oak Ave, Town", submittedAt: "2024-01-10" },
  { id: 3, name: "Noah Brown", class: "Class 2A", parentPhone: "+1 234 567 892", parentName: "Michael Brown", status: "pending", avatar: "", rollNo: "2024003", dateOfBirth: "2016-11-08", gender: "Male", address: "789 Pine Rd, Village", submittedAt: "2024-01-14" },
  { id: 4, name: "Olivia Davis", class: "Class 5A", parentPhone: "+1 234 567 893", parentName: "Emily Davis", status: "approved", avatar: "", rollNo: "2024004", dateOfBirth: "2013-05-30", gender: "Female", address: "321 Elm St, City", submittedAt: "2024-01-08" },
  { id: 5, name: "Liam Wilson", class: "Class 3B", parentPhone: "+1 234 567 894", parentName: "David Wilson", status: "pending", avatar: "", rollNo: "2024005", dateOfBirth: "2015-09-12", gender: "Male", address: "654 Maple Dr, Town", submittedAt: "2024-01-13" },
  { id: 6, name: "Sophia Martinez", class: "Class 1A", parentPhone: "+1 234 567 895", parentName: "Maria Martinez", status: "approved", avatar: "", rollNo: "2024006", dateOfBirth: "2017-02-18", gender: "Female", address: "987 Cedar Ln, Village", submittedAt: "2024-01-05" },
  { id: 7, name: "Mason Anderson", class: "Class 4A", parentPhone: "+1 234 567 896", parentName: "Robert Anderson", status: "pending", avatar: "", rollNo: "2024007", dateOfBirth: "2014-12-25", gender: "Male", address: "147 Birch Way, City", submittedAt: "2024-01-12" },
  { id: 8, name: "Isabella Taylor", class: "Class 2B", parentPhone: "+1 234 567 897", parentName: "Jennifer Taylor", status: "approved", avatar: "", rollNo: "2024008", dateOfBirth: "2016-06-03", gender: "Female", address: "258 Walnut St, Town", submittedAt: "2024-01-03" },
];

const classes = [
  { id: "1a", name: "Class 1A", section: "A", grade: "1" },
  { id: "1b", name: "Class 1B", section: "B", grade: "1" },
  { id: "2a", name: "Class 2A", section: "A", grade: "2" },
  { id: "2b", name: "Class 2B", section: "B", grade: "2" },
  { id: "3a", name: "Class 3A", section: "A", grade: "3" },
  { id: "3b", name: "Class 3B", section: "B", grade: "3" },
  { id: "4a", name: "Class 4A", section: "A", grade: "4" },
  { id: "4b", name: "Class 4B", section: "B", grade: "4" },
  { id: "5a", name: "Class 5A", section: "A", grade: "5" },
];

export default function StudentManagement() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<typeof students[0] | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedClassForLink, setSelectedClassForLink] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  const handleLogout = () => {
    navigate("/");
  };

  const handleGenerateLink = () => {
    if (!selectedClassForLink) {
      toast.error("Please select a class");
      return;
    }
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/register?class=${selectedClassForLink}&school=CONVENTPULSE001`;
    setGeneratedLink(link);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast.success("Link copied to clipboard!");
  };

  const handleApprove = (studentId: number) => {
    toast.success("Student approved and added to class!");
  };

  const handleReject = (studentId: number) => {
    toast.error("Student registration rejected");
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNo.includes(searchTerm);
    const matchesClass = filterClass === "all" || student.class.includes(filterClass);
    const matchesStatus = filterStatus === "all" || student.status === filterStatus;
    return matchesSearch && matchesClass && matchesStatus;
  });

  const pendingCount = students.filter(s => s.status === "pending").length;

  return (
    <DashboardLayout role="admin" userName="Admin User" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Student Management</h1>
            <p className="text-muted-foreground mt-1">View and manage student submissions and approvals.</p>
          </div>
          <Button onClick={() => setShowLinkDialog(true)}>
            <Link2 className="w-4 h-4 mr-2" />
            Generate Registration Link
          </Button>
        </div>

        <Tabs defaultValue="submissions" className="w-full">
          <TabsList>
            <TabsTrigger value="submissions">
              Submissions
              {pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-warning/20 text-warning">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved Students</TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="space-y-4 mt-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or roll number..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  <SelectItem value="Class 1">Class 1</SelectItem>
                  <SelectItem value="Class 2">Class 2</SelectItem>
                  <SelectItem value="Class 3">Class 3</SelectItem>
                  <SelectItem value="Class 4">Class 4</SelectItem>
                  <SelectItem value="Class 5">Class 5</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Students Table */}
            <div className="data-table">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class Applied</th>
                    <th>Parent Info</th>
                    <th>Submitted On</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={student.avatar} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {student.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium block">{student.name}</span>
                            <span className="text-xs text-muted-foreground">{student.gender} • {student.dateOfBirth}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info">{student.class}</span>
                      </td>
                      <td>
                        <div>
                          <span className="block text-sm">{student.parentName}</span>
                          <span className="text-xs text-muted-foreground">{student.parentPhone}</span>
                        </div>
                      </td>
                      <td className="text-muted-foreground">{student.submittedAt}</td>
                      <td>
                        <span className={`badge ${student.status === "approved" ? "badge-success" : "badge-warning"}`}>
                          {student.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedStudent(student)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {student.status === "pending" && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-success hover:text-success hover:bg-success/10"
                                onClick={() => handleApprove(student.id)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleReject(student.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="approved" className="space-y-4 mt-4">
            <div className="data-table">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll No</th>
                    <th>Class</th>
                    <th>Parent Contact</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.filter(s => s.status === "approved").map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={student.avatar} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {student.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{student.name}</span>
                        </div>
                      </td>
                      <td className="text-muted-foreground">{student.rollNo}</td>
                      <td>
                        <span className="badge badge-info">{student.class}</span>
                      </td>
                      <td className="text-muted-foreground">{student.parentPhone}</td>
                      <td>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedStudent(student)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Generate Link Dialog */}
        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogContent className="bg-card max-w-md">
            <DialogHeader>
              <DialogTitle>Generate Registration Link</DialogTitle>
              <DialogDescription>
                Create a registration link for students to submit their details. Share this link with parents.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Class</Label>
                <Select value={selectedClassForLink} onValueChange={setSelectedClassForLink}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.name}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {generatedLink && (
                <div className="space-y-2">
                  <Label>Registration Link</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={generatedLink} 
                      readOnly 
                      className="text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={handleCopyLink}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with parents. Students can fill the form and submit their registration.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
                Close
              </Button>
              <Button onClick={handleGenerateLink}>
                <Plus className="w-4 h-4 mr-2" />
                Generate Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Student Profile Dialog */}
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="bg-card max-w-lg">
            <DialogHeader>
              <DialogTitle>Student Profile</DialogTitle>
              <DialogDescription>Complete student and parent details.</DialogDescription>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={selectedStudent.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {selectedStudent.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedStudent.name}</h3>
                    <p className="text-muted-foreground">{selectedStudent.class}</p>
                    <span className={`badge mt-1 ${selectedStudent.status === "approved" ? "badge-success" : "badge-warning"}`}>
                      {selectedStudent.status}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-sm text-muted-foreground">Roll Number</p>
                    <p className="font-medium">{selectedStudent.rollNo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">{selectedStudent.dateOfBirth}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gender</p>
                    <p className="font-medium">{selectedStudent.gender}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Submitted On</p>
                    <p className="font-medium">{selectedStudent.submittedAt}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{selectedStudent.address}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <h4 className="font-medium mb-3">Parent Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Parent Name</p>
                      <p className="font-medium">{selectedStudent.parentName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone Number</p>
                      <p className="font-medium">{selectedStudent.parentPhone}</p>
                    </div>
                  </div>
                </div>

                {selectedStudent.status === "pending" && (
                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button 
                      className="flex-1 bg-success hover:bg-success/90" 
                      onClick={() => {
                        handleApprove(selectedStudent.id);
                        setSelectedStudent(null);
                      }}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve & Add to Class
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      onClick={() => {
                        handleReject(selectedStudent.id);
                        setSelectedStudent(null);
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
