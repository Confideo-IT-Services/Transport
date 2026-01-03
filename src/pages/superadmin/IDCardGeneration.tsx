import { useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { 
  Printer, 
  Download, 
  Search,
  Filter,
  CheckSquare,
  Square,
  GraduationCap,
  User,
  FileDown
} from "lucide-react";

interface Student {
  id: string;
  name: string;
  class: string;
  section: string;
  admissionNo: string;
  dob: string;
  photo: string;
  schoolId: string;
  selected: boolean;
}

interface PrintSettings {
  paperSize: "a4" | "letter";
  cardWidth: number; // mm
  cardHeight: number; // mm
  horizontalGap: number; // mm
  verticalGap: number; // mm
  marginTop: number; // mm
  marginBottom: number; // mm
  marginLeft: number; // mm
  marginRight: number; // mm
}

// Mock data removed - will fetch from API

const defaultPrintSettings: PrintSettings = {
  paperSize: "a4",
  cardWidth: 54,
  cardHeight: 86,
  horizontalGap: 3,
  verticalGap: 3,
  marginTop: 10,
  marginBottom: 10,
  marginLeft: 10,
  marginRight: 10,
};

export default function IDCardGeneration() {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(defaultPrintSettings);
  const [showPreview, setShowPreview] = useState(false);

  const filteredStudents = students.filter(s => {
    const matchesSchool = !selectedSchool || s.schoolId === selectedSchool;
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.admissionNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = filterClass === "all" || s.class === filterClass;
    return matchesSchool && matchesSearch && matchesClass;
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

  const handleGenerateCards = () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one student");
      return;
    }
    setShowPrintDialog(true);
  };

  const calculateLayout = () => {
    const paperWidth = printSettings.paperSize === "a4" ? 210 : 215.9; // mm
    const paperHeight = printSettings.paperSize === "a4" ? 297 : 279.4; // mm
    
    const availableWidth = paperWidth - printSettings.marginLeft - printSettings.marginRight;
    const availableHeight = paperHeight - printSettings.marginTop - printSettings.marginBottom;
    
    const cardsPerRow = Math.floor((availableWidth + printSettings.horizontalGap) / (printSettings.cardWidth + printSettings.horizontalGap));
    const cardsPerColumn = Math.floor((availableHeight + printSettings.verticalGap) / (printSettings.cardHeight + printSettings.verticalGap));
    const cardsPerPage = cardsPerRow * cardsPerColumn;
    
    return { cardsPerRow, cardsPerColumn, cardsPerPage, paperWidth, paperHeight };
  };

  const handlePrint = () => {
    setShowPreview(true);
    setShowPrintDialog(false);
    
    // Wait for preview to render, then print
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const layout = calculateLayout();
  const school = schools.find(s => s.id === selectedSchool);

  const handleLogout = () => navigate("/");

  return (
    <DashboardLayout role="superadmin" userName="Super Admin" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">ID Card Generation</h1>
            <p className="text-muted-foreground mt-1">Select students and generate printable ID cards</p>
          </div>
          <Button onClick={handleGenerateCards} disabled={selectedCount === 0}>
            <Printer className="w-4 h-4 mr-2" />
            Generate Cards ({selectedCount})
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                <Label className="mb-2 block">Class</Label>
                <Select value={filterClass} onValueChange={setFilterClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {["1", "2", "3", "4", "5"].map(c => (
                      <SelectItem key={c} value={c}>Class {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-2 block">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or admission number..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Students</CardTitle>
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
            </div>
          </CardHeader>
          <CardContent>
            {!selectedSchool ? (
              <div className="text-center py-12 text-muted-foreground">
                Please select a school to view students
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
                      <th className="text-left p-4 font-medium text-muted-foreground">DOB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr 
                        key={student.id} 
                        className={`border-t border-border cursor-pointer transition-colors ${
                          student.selected ? "bg-primary/5" : "hover:bg-muted/30"
                        }`}
                        onClick={() => toggleSelect(student.id)}
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
                              <AvatarImage src={student.photo} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {student.name.split(" ").map(n => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{student.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">{student.admissionNo}</td>
                        <td className="p-4">
                          <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                            Class {student.class}-{student.section}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">{student.dob}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredStudents.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    No students found
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Print Settings Dialog */}
        <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Print Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Paper Size</Label>
                <Select 
                  value={printSettings.paperSize} 
                  onValueChange={(v) => setPrintSettings({ ...printSettings, paperSize: v as "a4" | "letter" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                    <SelectItem value="letter">Letter (8.5 × 11 in)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Card Width (mm)</Label>
                  <Input 
                    type="number"
                    value={printSettings.cardWidth}
                    onChange={(e) => setPrintSettings({ ...printSettings, cardWidth: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Card Height (mm)</Label>
                  <Input 
                    type="number"
                    value={printSettings.cardHeight}
                    onChange={(e) => setPrintSettings({ ...printSettings, cardHeight: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Horizontal Gap (mm)</Label>
                  <Input 
                    type="number"
                    value={printSettings.horizontalGap}
                    onChange={(e) => setPrintSettings({ ...printSettings, horizontalGap: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Vertical Gap (mm)</Label>
                  <Input 
                    type="number"
                    value={printSettings.verticalGap}
                    onChange={(e) => setPrintSettings({ ...printSettings, verticalGap: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Top/Bottom Margin (mm)</Label>
                  <Input 
                    type="number"
                    value={printSettings.marginTop}
                    onChange={(e) => setPrintSettings({ 
                      ...printSettings, 
                      marginTop: Number(e.target.value),
                      marginBottom: Number(e.target.value) 
                    })}
                  />
                </div>
                <div>
                  <Label>Left/Right Margin (mm)</Label>
                  <Input 
                    type="number"
                    value={printSettings.marginLeft}
                    onChange={(e) => setPrintSettings({ 
                      ...printSettings, 
                      marginLeft: Number(e.target.value),
                      marginRight: Number(e.target.value) 
                    })}
                  />
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="font-medium mb-1">Layout Preview:</p>
                <p className="text-muted-foreground">
                  {layout.cardsPerRow} cards × {layout.cardsPerColumn} rows = {layout.cardsPerPage} cards per page
                </p>
                <p className="text-muted-foreground">
                  Total pages needed: {Math.ceil(selectedCount / layout.cardsPerPage)}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPrintDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Print Preview (Hidden, shows only when printing) */}
        {showPreview && (
          <div className="fixed inset-0 bg-background z-50 overflow-auto print:static print:inset-auto print:bg-transparent print:overflow-visible">
            <div className="p-4 print:p-0">
              <div className="flex justify-between items-center mb-4 print:hidden">
                <h2 className="text-lg font-semibold">Print Preview</h2>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    Close
                  </Button>
                  <Button onClick={() => window.print()}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                </div>
              </div>
              
              <div 
                ref={printRef}
                className="mx-auto bg-white"
                style={{
                  width: `${layout.paperWidth}mm`,
                  minHeight: `${layout.paperHeight}mm`,
                  padding: `${printSettings.marginTop}mm ${printSettings.marginRight}mm ${printSettings.marginBottom}mm ${printSettings.marginLeft}mm`,
                }}
              >
                <div 
                  className="grid"
                  style={{
                    gridTemplateColumns: `repeat(${layout.cardsPerRow}, ${printSettings.cardWidth}mm)`,
                    gap: `${printSettings.verticalGap}mm ${printSettings.horizontalGap}mm`,
                  }}
                >
                  {selectedStudents.map((student) => (
                    <div
                      key={student.id}
                      className="border border-gray-300 rounded-lg overflow-hidden bg-white"
                      style={{
                        width: `${printSettings.cardWidth}mm`,
                        height: `${printSettings.cardHeight}mm`,
                      }}
                    >
                      {/* Card Content */}
                      <div className="h-full flex flex-col p-2">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: school?.primaryColor || "#1e40af" }}
                          >
                            <GraduationCap className="w-3 h-3 text-white" />
                          </div>
                          <div className="text-[8px] font-bold leading-tight flex-1">
                            {school?.name || "School Name"}
                          </div>
                        </div>
                        
                        {/* Photo */}
                        <div className="flex-1 flex justify-center items-center">
                          <div className="w-16 h-20 bg-gray-100 rounded flex items-center justify-center">
                            {student.photo ? (
                              <img src={student.photo} alt={student.name} className="w-full h-full object-cover rounded" />
                            ) : (
                              <User className="w-8 h-8 text-gray-400" />
                            )}
                          </div>
                        </div>
                        
                        {/* Details */}
                        <div className="text-center mt-2">
                          <div className="text-[9px] font-bold truncate">{student.name}</div>
                          <div className="text-[7px] text-gray-600">Class {student.class}-{student.section}</div>
                          <div className="text-[7px] text-gray-600">{student.admissionNo}</div>
                          <div className="text-[6px] text-gray-500">DOB: {student.dob}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:static,
          .print\\:static * {
            visibility: visible;
          }
          @page {
            size: ${printSettings.paperSize};
            margin: 0;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
