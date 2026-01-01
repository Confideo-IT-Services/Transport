import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Send, Eye, Download, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const students = [
  { id: 1, name: "Alex Johnson", rollNo: "01", hasReport: true },
  { id: 2, name: "Emma Williams", rollNo: "02", hasReport: true },
  { id: 3, name: "Noah Brown", rollNo: "03", hasReport: false },
  { id: 4, name: "Olivia Davis", rollNo: "04", hasReport: true },
  { id: 5, name: "Liam Wilson", rollNo: "05", hasReport: false },
  { id: 6, name: "Sophia Martinez", rollNo: "06", hasReport: true },
  { id: 7, name: "Mason Anderson", rollNo: "07", hasReport: false },
  { id: 8, name: "Isabella Taylor", rollNo: "08", hasReport: true },
];

export default function ProgressReports() {
  const navigate = useNavigate();
  const [selectedStudent, setSelectedStudent] = useState("");
  const [remarks, setRemarks] = useState("");

  const handleLogout = () => {
    navigate("/");
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle upload
  };

  return (
    <DashboardLayout role="teacher" userName="Sarah Johnson" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="page-title">Progress Reports</h1>
          <p className="text-muted-foreground mt-1">Upload and share progress reports with parents.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Form */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload Progress Report
            </h3>

            <form onSubmit={handleUpload} className="space-y-6">
              {/* Student Selection */}
              <div className="space-y-2">
                <Label>Select Student</Label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{student.rollNo}.</span>
                          {student.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Report File (PDF)</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF files only, up to 10MB
                  </p>
                </div>
              </div>

              {/* Teacher Remarks */}
              <div className="space-y-2">
                <Label htmlFor="remarks">Teacher Remarks</Label>
                <Textarea
                  id="remarks"
                  placeholder="Add your remarks about the student's progress..."
                  rows={4}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              {/* Share Options */}
              <div className="space-y-3">
                <Label>Share with</Label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <input type="checkbox" className="rounded border-border" defaultChecked />
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Parents</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <input type="checkbox" className="rounded border-border" defaultChecked />
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">School Admin</span>
                  </label>
                </div>
              </div>

              <Button type="submit" className="w-full sm:w-auto">
                <Send className="w-4 h-4 mr-2" />
                Upload & Share
              </Button>
            </form>
          </div>

          {/* Students Report Status */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Report Status
            </h3>

            <div className="space-y-3">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {student.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{student.name}</p>
                      <p className="text-xs text-muted-foreground">Roll: {student.rollNo}</p>
                    </div>
                  </div>
                  {student.hasReport ? (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No report</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
