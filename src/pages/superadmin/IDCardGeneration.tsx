import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { createRoot } from "react-dom/client";
import { 
  Printer, 
  Download, 
  Search,
  CheckSquare,
  Square,
  GraduationCap,
  User,
  FileDown,
  Eye,
  Edit,
  MoreVertical,
  Loader2,
  School
} from "lucide-react";
import { 
  schoolsApi, 
  idCardTemplatesApi, 
  idCardGenerationApi, 
  studentsApi,
  StudentForIDCard,
  IDCardTemplate 
} from "@/lib/api";
import { IDCardRenderer } from "@/components/idcards/IDCardRenderer";
import { IDCardLayout, normalizeLayout, PX_PER_MM } from "@/lib/idCardLayout";

interface Student extends StudentForIDCard {
  selected: boolean;
}

export default function IDCardGeneration() {
  const navigate = useNavigate();
  const cardPreviewRef = useRef<HTMLDivElement>(null);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [templates, setTemplates] = useState<IDCardTemplate[]>([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<IDCardTemplate | null>(null);
  const [templateLayout, setTemplateLayout] = useState<IDCardLayout | null>(null);
  const [templateMetadata, setTemplateMetadata] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Dialogs
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    if (selectedSchool) {
      loadTemplates();
    } else {
      setTemplates([]);
      setSelectedTemplateId("");
    }
  }, [selectedSchool]);

  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const template = templates.find(t => t.id === selectedTemplateId);
      setSelectedTemplate(template || null);
    }
  }, [selectedTemplateId, templates]);

  const loadSchools = async () => {
    try {
      const data = await schoolsApi.getAll();
      setSchools(data);
    } catch (error) {
      console.error("Failed to load schools:", error);
      toast.error("Failed to load schools");
    }
  };

  const loadTemplates = async () => {
    if (!selectedSchool) return;
    try {
      setIsLoading(true);
      const data = await idCardTemplatesApi.getBySchool(selectedSchool);
      setTemplates(data);
      if (data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSubmissions = async () => {
    if (!selectedSchool || !selectedTemplateId) {
      toast.error("Please select school and template first");
      return;
    }
    
    try {
      setIsLoading(true);
      const data = await idCardGenerationApi.getStudents(selectedSchool, selectedTemplateId);
      
      // Process students with resolved fields
      const studentsWithSelection = data.students.map(s => ({ 
        ...s, 
        selected: false 
      }));
      setStudents(studentsWithSelection);
      
      // Show warnings for missing fields
      if (data.missing_fields.length > 0) {
        const missingCount = data.missing_fields.length;
        toast.warning(
          `${missingCount} student(s) have missing optional fields. ID cards will still generate.`,
          { duration: 5000 }
        );
      }
      
      // Store template layout and metadata
      const normalizedLayout = normalizeLayout(data.template_layout, {
        name: selectedTemplate?.name || "Template",
        width_mm: data.template_metadata?.card_width || selectedTemplate?.cardWidth || 54,
        height_mm: data.template_metadata?.card_height || selectedTemplate?.cardHeight || 86,
        orientation: (data.template_metadata?.orientation || selectedTemplate?.orientation || "portrait") as any,
        backgroundImageUrl: data.template_metadata?.background_image_url || selectedTemplate?.backgroundImageUrl,
      });
      
      console.log('Loaded template layout:', {
        backgroundImageUrl: normalizedLayout.backgroundImageUrl,
        elements: normalizedLayout.elements.length,
        fieldMappings: normalizedLayout.fieldMappings,
      });
      
      setTemplateLayout(normalizedLayout);
      setTemplateMetadata(data.template_metadata);
      
      toast.success(`Loaded ${studentsWithSelection.length} students`);
    } catch (error: any) {
      toast.error(error.message || "Failed to load students");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.rollNo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const selectedStudents = students.filter(s => s.selected);
  const selectedCount = selectedStudents.length;

  const toggleSelectAll = () => {
    const allSelected = filteredStudents.every(s => s.selected);
    setStudents(prev => prev.map(s => {
      if (filteredStudents.find(fs => fs.id === s.id)) {
        return { ...s, selected: !allSelected };
      }
      return s;
    }));
  };

  const toggleSelect = (studentId: string) => {
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, selected: !s.selected } : s
    ));
  };

  const handleViewStudent = (student: Student) => {
    setSelectedStudent(student);
    setShowViewDialog(true);
  };

  const handleEditStudent = (student: Student) => {
    setSelectedStudent(student);
    setShowEditDialog(true);
  };

  const handlePreviewID = async (student: Student) => {
    if (!selectedTemplateId) {
      toast.error("Please select a template first");
      return;
    }
    setPreviewStudent(student);
    setShowPreviewDialog(true);
  };

  const handleUpdateStudent = async (updatedData: Partial<Student>) => {
    if (!selectedStudent) return;
    
    try {
      setIsLoading(true);
      await studentsApi.update(selectedStudent.id, updatedData);
      setStudents(prev => prev.map(s => 
        s.id === selectedStudent.id ? { ...s, ...updatedData } : s
      ));
      toast.success("Student updated successfully");
      setShowEditDialog(false);
      setSelectedStudent(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update student");
    } finally {
      setIsLoading(false);
    }
  };

  const renderIDCard = (student: Student, template: IDCardTemplate | null) => {
    if (!templateLayout) return null;
    return <IDCardRenderer layout={templateLayout} student={student} renderHeightPx={400} />;
  };

  const waitForImages = async (rootEl: HTMLElement) => {
    const imgs = Array.from(rootEl.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if ((img as HTMLImageElement).complete) return resolve();
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
      )
    );
  };

  const renderCardToPngDataUrl = async (layout: IDCardLayout, student: Student) => {
    const heightPx = layout.height_mm * PX_PER_MM;
    const widthPx = layout.width_mm * PX_PER_MM;

    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-100000px";
    host.style.top = "0";
    host.style.width = `${widthPx}px`;
    host.style.height = `${heightPx}px`;
    host.style.background = "transparent";
    document.body.appendChild(host);

    const root = createRoot(host);
    root.render(<IDCardRenderer layout={layout} student={student} renderHeightPx={heightPx} />);

    // Let React paint + images begin loading
    await new Promise((r) => setTimeout(r, 50));
    await waitForImages(host);

    const target = host.firstElementChild as HTMLElement;
    const canvas = await html2canvas(target, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true,  // Allow cross-origin images
      logging: false,     // Disable console logs
    });

    root.unmount();
    host.remove();
    return canvas.toDataURL("image/png");
  };

  const handleGeneratePDF = async () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one student");
      return;
    }

    if (!selectedTemplate || !templateLayout) {
      toast.error("Please select a template");
      return;
    }

    try {
      setIsGenerating(true);
      
      // Calculate layout (mm)
      const cardWidth = templateLayout.width_mm;
      const cardHeight = templateLayout.height_mm;
      const sheetSize = selectedTemplate.sheetSize;
      const orientation = selectedTemplate.orientation;

      let sheetWidth = 210; // A4 width in mm
      let sheetHeight = 297; // A4 height in mm
      
      if (sheetSize === "13x19") {
        sheetWidth = 330;
        sheetHeight = 483;
      }
      
      if (orientation === "landscape") {
        [sheetWidth, sheetHeight] = [sheetHeight, sheetWidth];
      }

      const margin = 10;
      const gap = 3;
      const availableWidth = sheetWidth - (margin * 2);
      const availableHeight = sheetHeight - (margin * 2);
      
      const cardsPerRow = Math.floor((availableWidth + gap) / (cardWidth + gap));
      const cardsPerColumn = Math.floor((availableHeight + gap) / (cardHeight + gap));
      const cardsPerPage = cardsPerRow * cardsPerColumn;

      // Create PDF
      const pdf = new jsPDF({
        orientation: orientation === "landscape" ? "landscape" : "portrait",
        unit: "mm",
        format: sheetSize === "13x19" ? [330, 483] : "a4",
      });

      const pages = Math.ceil(selectedCount / cardsPerPage);

      for (let page = 0; page < pages; page++) {
        if (page > 0) pdf.addPage();

        const pageStudents = selectedStudents.slice(
          page * cardsPerPage,
          (page + 1) * cardsPerPage
        );

        for (let index = 0; index < pageStudents.length; index++) {
          const student = pageStudents[index];
          const row = Math.floor(index / cardsPerRow);
          const col = index % cardsPerRow;

          const x = margin + col * (cardWidth + gap);
          const y = margin + row * (cardHeight + gap);

          const dataUrl = await renderCardToPngDataUrl(templateLayout, student);
          pdf.addImage(dataUrl, "PNG", x, y, cardWidth, cardHeight);
        }
      }

      pdf.save(`ID_Cards_${selectedSchool}_${Date.now()}.pdf`);
      toast.success("PDF generated successfully!");
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast.error(error.message || "Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportExcel = () => {
    if (students.length === 0) {
      toast.error("No students to export");
      return;
    }

    const exportData = students.map(s => ({
      "Student Name": s.name,
      "Admission Number": s.admissionNumber || "",
      "Roll Number": s.rollNo || "",
      "Class": s.className || "",
      "Section": s.section || "",
      "Date of Birth": s.dateOfBirth || "",
      "Gender": s.gender || "",
      "Blood Group": s.bloodGroup || "",
      "Father Name": s.fatherName || "",
      "Mother Name": s.motherName || "",
      "Address": s.address || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `Students_${selectedSchool}_${Date.now()}.xlsx`);
    toast.success("Excel file exported successfully!");
  };

  const handleLogout = () => navigate("/");

  return (
    <DashboardLayout role="superadmin" userName="Super Admin" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">ID Card Generation</h1>
            <p className="text-muted-foreground mt-1">Generate ID cards for students</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleExportExcel}
              disabled={students.length === 0}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export to Excel
            </Button>
            <Button 
              onClick={handleGeneratePDF} 
              disabled={selectedCount === 0 || !selectedTemplate || isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Printer className="w-4 h-4 mr-2" />
              )}
              Generate ID Cards ({selectedCount})
            </Button>
          </div>
        </div>

        {/* Selection Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="mb-2 block">School</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select School" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map(school => (
                      <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Template</Label>
                <Select 
                  value={selectedTemplateId} 
                  onValueChange={setSelectedTemplateId}
                  disabled={!selectedSchool || templates.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleLoadSubmissions} 
                  disabled={!selectedSchool || !selectedTemplateId || isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Load Submissions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        {students.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, admission number, or roll number..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Students Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Students ({filteredStudents.length})</CardTitle>
              {filteredStudents.length > 0 && (
                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  {filteredStudents.every(s => s.selected) ? (
                    <>
                      <CheckSquare className="w-4 h-4 mr-2" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      Select All
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedSchool ? (
              <div className="text-center py-12 text-muted-foreground">
                Please select a school first
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Click "Load Submissions" to load students
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No students found matching your search
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 w-12"></th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Student</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Admission No</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Class</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr 
                        key={student.id} 
                        className={`border-t border-border transition-colors ${
                          student.selected ? "bg-primary/5" : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="p-4">
                          <Checkbox 
                            checked={student.selected}
                            onCheckedChange={() => toggleSelect(student.id)}
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={student.photoUrl} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {student.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{student.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">{student.admissionNumber || "-"}</td>
                        <td className="p-4">
                          <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                            {student.class || "-"}
                          </span>
                        </td>
                        <td className="p-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewStudent(student)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditStudent(student)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePreviewID(student)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Preview ID
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Student Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Student Details</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <p className="text-sm">{selectedStudent.name}</p>
                  </div>
                  <div>
                    <Label>Admission Number</Label>
                    <p className="text-sm">{selectedStudent.admissionNumber || "-"}</p>
                  </div>
                  <div>
                    <Label>Roll Number</Label>
                    <p className="text-sm">{selectedStudent.rollNo || "-"}</p>
                  </div>
                  <div>
                    <Label>Class</Label>
                    <p className="text-sm">{selectedStudent.class || "-"}</p>
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <p className="text-sm">{selectedStudent.dateOfBirth || "-"}</p>
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <p className="text-sm">{selectedStudent.gender || "-"}</p>
                  </div>
                  <div>
                    <Label>Blood Group</Label>
                    <p className="text-sm">{selectedStudent.bloodGroup || "-"}</p>
                  </div>
                  <div>
                    <Label>Father Name</Label>
                    <p className="text-sm">{selectedStudent.fatherName || "-"}</p>
                  </div>
                  <div>
                    <Label>Mother Name</Label>
                    <p className="text-sm">{selectedStudent.motherName || "-"}</p>
                  </div>
                  <div>
                    <Label>Address</Label>
                    <p className="text-sm">{selectedStudent.address || "-"}</p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Student Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input 
                      value={selectedStudent.name}
                      onChange={(e) => setSelectedStudent({ ...selectedStudent, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Admission Number</Label>
                    <Input 
                      value={selectedStudent.admissionNumber || ""}
                      onChange={(e) => setSelectedStudent({ ...selectedStudent, admissionNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Roll Number</Label>
                    <Input 
                      value={selectedStudent.rollNo || ""}
                      onChange={(e) => setSelectedStudent({ ...selectedStudent, rollNo: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <Input 
                      type="date"
                      value={selectedStudent.dateOfBirth || ""}
                      onChange={(e) => setSelectedStudent({ ...selectedStudent, dateOfBirth: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Father Name</Label>
                    <Input 
                      value={selectedStudent.fatherName || ""}
                      onChange={(e) => setSelectedStudent({ ...selectedStudent, fatherName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Mother Name</Label>
                    <Input 
                      value={selectedStudent.motherName || ""}
                      onChange={(e) => setSelectedStudent({ ...selectedStudent, motherName: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Address</Label>
                    <Textarea 
                      value={selectedStudent.address || ""}
                      onChange={(e) => setSelectedStudent({ ...selectedStudent, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => selectedStudent && handleUpdateStudent(selectedStudent)} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview ID Dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Preview ID Card</DialogTitle>
            </DialogHeader>
            {previewStudent && selectedTemplate && (
              <div className="flex justify-center">
                {renderIDCard(previewStudent, selectedTemplate)}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
