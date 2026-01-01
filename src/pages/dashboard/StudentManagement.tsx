import { useState, useRef } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Check, X, Eye, Filter, Link2, Copy, Plus, Settings, Camera } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface FieldConfig {
  id: string;
  label: string;
  mandatory: boolean;
  enabled: boolean;
}

interface Student {
  id: number;
  name: string;
  class: string;
  section: string;
  parentPhone: string;
  parentName: string;
  status: "pending" | "approved" | "rejected";
  avatar: string;
  rollNo: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  submittedAt: string;
  fatherName: string;
  motherName: string;
  bloodGroup: string;
  admissionNumber?: string;
}

const defaultFields: FieldConfig[] = [
  { id: "studentName", label: "Student Name", mandatory: true, enabled: true },
  { id: "photo", label: "Student Photo", mandatory: true, enabled: true },
  { id: "dateOfBirth", label: "Date of Birth", mandatory: true, enabled: true },
  { id: "gender", label: "Gender", mandatory: true, enabled: true },
  { id: "bloodGroup", label: "Blood Group", mandatory: false, enabled: true },
  { id: "address", label: "Address", mandatory: true, enabled: true },
  { id: "fatherName", label: "Father's Name", mandatory: true, enabled: true },
  { id: "fatherPhone", label: "Father's Phone", mandatory: true, enabled: true },
  { id: "fatherEmail", label: "Father's Email", mandatory: false, enabled: true },
  { id: "fatherOccupation", label: "Father's Occupation", mandatory: false, enabled: true },
  { id: "motherName", label: "Mother's Name", mandatory: false, enabled: true },
  { id: "motherPhone", label: "Mother's Phone", mandatory: false, enabled: true },
  { id: "motherOccupation", label: "Mother's Occupation", mandatory: false, enabled: true },
  { id: "emergencyContact", label: "Emergency Contact", mandatory: true, enabled: true },
  { id: "previousSchool", label: "Previous School", mandatory: false, enabled: false },
  { id: "medicalConditions", label: "Medical Conditions", mandatory: false, enabled: true },
];

const mockStudents: Student[] = [
  { id: 1, name: "Alex Johnson", class: "3", section: "A", parentPhone: "+91 98765 43210", parentName: "John Johnson", status: "pending", avatar: "", rollNo: "2024001", dateOfBirth: "2015-03-15", gender: "Male", address: "123 Main St, City", submittedAt: "2024-01-15", fatherName: "John Johnson", motherName: "Jane Johnson", bloodGroup: "A+" },
  { id: 2, name: "Emma Williams", class: "4", section: "B", parentPhone: "+91 98765 43211", parentName: "Sarah Williams", status: "approved", avatar: "", rollNo: "2024002", dateOfBirth: "2014-07-22", gender: "Female", address: "456 Oak Ave, Town", submittedAt: "2024-01-10", fatherName: "Mike Williams", motherName: "Sarah Williams", bloodGroup: "B+", admissionNumber: "ADM2024002" },
  { id: 3, name: "Noah Brown", class: "2", section: "A", parentPhone: "+91 98765 43212", parentName: "Michael Brown", status: "pending", avatar: "", rollNo: "2024003", dateOfBirth: "2016-11-08", gender: "Male", address: "789 Pine Rd, Village", submittedAt: "2024-01-14", fatherName: "Michael Brown", motherName: "Lisa Brown", bloodGroup: "O+" },
  { id: 4, name: "Olivia Davis", class: "5", section: "A", parentPhone: "+91 98765 43213", parentName: "Emily Davis", status: "approved", avatar: "", rollNo: "2024004", dateOfBirth: "2013-05-30", gender: "Female", address: "321 Elm St, City", submittedAt: "2024-01-08", fatherName: "Tom Davis", motherName: "Emily Davis", bloodGroup: "AB+", admissionNumber: "ADM2024004" },
  { id: 5, name: "Liam Wilson", class: "3", section: "B", parentPhone: "+91 98765 43214", parentName: "David Wilson", status: "pending", avatar: "", rollNo: "2024005", dateOfBirth: "2015-09-12", gender: "Male", address: "654 Maple Dr, Town", submittedAt: "2024-01-13", fatherName: "David Wilson", motherName: "Mary Wilson", bloodGroup: "A-" },
];

const classes = [
  { id: "1", name: "Class 1", sections: ["A", "B"] },
  { id: "2", name: "Class 2", sections: ["A", "B"] },
  { id: "3", name: "Class 3", sections: ["A", "B"] },
  { id: "4", name: "Class 4", sections: ["A", "B"] },
  { id: "5", name: "Class 5", sections: ["A"] },
];

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showFieldConfigDialog, setShowFieldConfigDialog] = useState(false);
  const [selectedClassForLink, setSelectedClassForLink] = useState("");
  const [selectedSectionForLink, setSelectedSectionForLink] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>(defaultFields);

  const handleGenerateLink = () => {
    if (!selectedClassForLink || !selectedSectionForLink) {
      toast.error("Please select class and section");
      return;
    }
    
    // Encode field configuration in the URL
    const enabledFields = fieldConfigs.filter(f => f.enabled);
    const mandatoryFields = enabledFields.filter(f => f.mandatory).map(f => f.id);
    const optionalFields = enabledFields.filter(f => !f.mandatory).map(f => f.id);
    
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      class: selectedClassForLink,
      section: selectedSectionForLink,
      school: "ALLPULSE001",
      mandatory: mandatoryFields.join(","),
      optional: optionalFields.join(","),
    });
    
    const link = `${baseUrl}/register?${params.toString()}`;
    setGeneratedLink(link);
    toast.success("Registration link generated!");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast.success("Link copied to clipboard!");
  };

  const handleApprove = (studentId: number) => {
    setStudents(prev => prev.map(s => 
      s.id === studentId 
        ? { ...s, status: "approved" as const, admissionNumber: `ADM${new Date().getFullYear()}${String(studentId).padStart(4, "0")}` }
        : s
    ));
    toast.success("Student approved and added to class!");
  };

  const handleReject = (studentId: number) => {
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, status: "rejected" as const } : s
    ));
    toast.error("Student registration rejected");
  };

  const toggleFieldMandatory = (fieldId: string) => {
    setFieldConfigs(prev => prev.map(f => 
      f.id === fieldId ? { ...f, mandatory: !f.mandatory } : f
    ));
  };

  const toggleFieldEnabled = (fieldId: string) => {
    setFieldConfigs(prev => prev.map(f => 
      f.id === fieldId ? { ...f, enabled: !f.enabled, mandatory: !f.enabled ? f.mandatory : false } : f
    ));
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNo.includes(searchTerm);
    const matchesClass = filterClass === "all" || student.class === filterClass;
    const matchesStatus = filterStatus === "all" || student.status === filterStatus;
    return matchesSearch && matchesClass && matchesStatus;
  });

  const pendingCount = students.filter(s => s.status === "pending").length;
  const approvedCount = students.filter(s => s.status === "approved").length;

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Student Management</h1>
            <p className="text-muted-foreground mt-1">Manage student registrations and approvals.</p>
          </div>
          <Button onClick={() => setShowLinkDialog(true)}>
            <Link2 className="w-4 h-4 mr-2" />
            Generate Registration Link
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-warning">{pendingCount}</div>
              <p className="text-sm text-muted-foreground">Pending Approvals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-success">{approvedCount}</div>
              <p className="text-sm text-muted-foreground">Approved Students</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{students.length}</div>
              <p className="text-sm text-muted-foreground">Total Registrations</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="submissions" className="w-full">
          <TabsList>
            <TabsTrigger value="submissions">
              Pending Submissions
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
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>Class {c.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Students Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Student</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Class</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Parent Info</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Submitted</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.filter(s => s.status === "pending").map((student) => (
                    <tr key={student.id} className="border-t border-border">
                      <td className="p-4">
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
                      <td className="p-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                          Class {student.class}-{student.section}
                        </span>
                      </td>
                      <td className="p-4">
                        <div>
                          <span className="block text-sm">{student.fatherName}</span>
                          <span className="text-xs text-muted-foreground">{student.parentPhone}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">{student.submittedAt}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedStudent(student)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredStudents.filter(s => s.status === "pending").length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No pending submissions
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="approved" className="space-y-4 mt-4">
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Student</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Admission No</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Class</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Parent Contact</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.filter(s => s.status === "approved").map((student) => (
                    <tr key={student.id} className="border-t border-border">
                      <td className="p-4">
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
                      <td className="p-4 text-muted-foreground">{student.admissionNumber || "-"}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                          Class {student.class}-{student.section}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">{student.parentPhone}</td>
                      <td className="p-4">
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Generate Registration Link</DialogTitle>
              <DialogDescription>
                Create a customized registration link for students. Configure which fields are required.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Class</Label>
                  <Select value={selectedClassForLink} onValueChange={(v) => {
                    setSelectedClassForLink(v);
                    setSelectedSectionForLink("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          Class {cls.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Select Section</Label>
                  <Select value={selectedSectionForLink} onValueChange={setSelectedSectionForLink}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedClassForLink && classes.find(c => c.id === selectedClassForLink)?.sections.map((sec) => (
                        <SelectItem key={sec} value={sec}>
                          Section {sec}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Form Fields Configuration</Label>
                  <Button variant="ghost" size="sm" onClick={() => setShowFieldConfigDialog(true)}>
                    <Settings className="w-4 h-4 mr-1" />
                    Configure
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {fieldConfigs.filter(f => f.enabled && f.mandatory).length} mandatory fields, 
                  {" "}{fieldConfigs.filter(f => f.enabled && !f.mandatory).length} optional fields
                </div>
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
                    Share this link with parents. Students will see a form with camera access for photo capture.
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

        {/* Field Configuration Dialog */}
        <Dialog open={showFieldConfigDialog} onOpenChange={setShowFieldConfigDialog}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configure Form Fields</DialogTitle>
              <DialogDescription>
                Select which fields to include and mark them as mandatory or optional.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {fieldConfigs.map((field) => (
                <div key={field.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      checked={field.enabled}
                      onCheckedChange={() => toggleFieldEnabled(field.id)}
                    />
                    <span className={field.enabled ? "text-foreground" : "text-muted-foreground"}>
                      {field.label}
                    </span>
                  </div>
                  {field.enabled && (
                    <Button
                      variant={field.mandatory ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleFieldMandatory(field.id)}
                    >
                      {field.mandatory ? "Required" : "Optional"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowFieldConfigDialog(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Student Profile Dialog */}
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-lg">
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
                    <p className="text-muted-foreground">Class {selectedStudent.class}-{selectedStudent.section}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                      selectedStudent.status === "approved" 
                        ? "bg-success/10 text-success" 
                        : selectedStudent.status === "pending"
                        ? "bg-warning/10 text-warning"
                        : "bg-destructive/10 text-destructive"
                    }`}>
                      {selectedStudent.status}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-sm text-muted-foreground">Admission Number</p>
                    <p className="font-medium">{selectedStudent.admissionNumber || "Pending"}</p>
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
                    <p className="text-sm text-muted-foreground">Blood Group</p>
                    <p className="font-medium">{selectedStudent.bloodGroup}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <h4 className="font-medium mb-3">Parent/Guardian Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Father's Name</p>
                      <p className="font-medium">{selectedStudent.fatherName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Mother's Name</p>
                      <p className="font-medium">{selectedStudent.motherName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Contact Number</p>
                      <p className="font-medium">{selectedStudent.parentPhone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{selectedStudent.address}</p>
                    </div>
                  </div>
                </div>

                {selectedStudent.status === "pending" && (
                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button 
                      className="flex-1" 
                      variant="outline"
                      onClick={() => {
                        handleReject(selectedStudent.id);
                        setSelectedStudent(null);
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button 
                      className="flex-1"
                      onClick={() => {
                        handleApprove(selectedStudent.id);
                        setSelectedStudent(null);
                      }}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </UnifiedLayout>
  );
}
