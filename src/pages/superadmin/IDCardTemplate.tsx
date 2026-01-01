import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  Save, 
  Eye, 
  Palette, 
  Type, 
  Image, 
  Move, 
  School,
  GraduationCap,
  User
} from "lucide-react";

interface TemplateElement {
  id: string;
  type: "photo" | "text" | "logo" | "qr";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  textAlign?: "left" | "center" | "right";
  field?: string;
}

interface Template {
  id: string;
  name: string;
  schoolId: string;
  schoolName: string;
  backgroundColor: string;
  primaryColor: string;
  textColor: string;
  elements: TemplateElement[];
}

const defaultElements: TemplateElement[] = [
  { id: "logo", type: "logo", label: "School Logo", x: 10, y: 5, width: 15, height: 20 },
  { id: "schoolName", type: "text", label: "School Name", x: 30, y: 8, width: 60, height: 10, fontSize: 12, fontWeight: "bold", textAlign: "center", field: "schoolName" },
  { id: "photo", type: "photo", label: "Student Photo", x: 32, y: 22, width: 36, height: 40 },
  { id: "name", type: "text", label: "Student Name", x: 10, y: 65, width: 80, height: 8, fontSize: 11, fontWeight: "bold", textAlign: "center", field: "name" },
  { id: "class", type: "text", label: "Class", x: 10, y: 74, width: 80, height: 6, fontSize: 9, fontWeight: "normal", textAlign: "center", field: "class" },
  { id: "admNo", type: "text", label: "Admission No", x: 10, y: 81, width: 80, height: 6, fontSize: 9, fontWeight: "normal", textAlign: "center", field: "admissionNo" },
  { id: "dob", type: "text", label: "Date of Birth", x: 10, y: 88, width: 80, height: 6, fontSize: 8, fontWeight: "normal", textAlign: "center", field: "dob" },
];

const mockSchools = [
  { id: "1", name: "Delhi Public School" },
  { id: "2", name: "St. Mary's Convent" },
  { id: "3", name: "Modern Public School" },
];

const mockTemplates: Template[] = [
  {
    id: "1",
    name: "Standard Template",
    schoolId: "1",
    schoolName: "Delhi Public School",
    backgroundColor: "#ffffff",
    primaryColor: "#1e40af",
    textColor: "#1f2937",
    elements: defaultElements,
  },
];

export default function IDCardTemplate() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>(mockTemplates);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  
  // Editor state
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [selectedElement, setSelectedElement] = useState<TemplateElement | null>(null);

  const handleCreateTemplate = () => {
    if (!selectedSchool) {
      toast.error("Please select a school first");
      return;
    }
    
    const school = mockSchools.find(s => s.id === selectedSchool);
    const newTemplate: Template = {
      id: Date.now().toString(),
      name: "New Template",
      schoolId: selectedSchool,
      schoolName: school?.name || "",
      backgroundColor: "#ffffff",
      primaryColor: "#1e40af",
      textColor: "#1f2937",
      elements: [...defaultElements],
    };
    
    setEditingTemplate(newTemplate);
    setShowEditor(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate({ ...template });
    setShowEditor(true);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    
    const exists = templates.find(t => t.id === editingTemplate.id);
    if (exists) {
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? editingTemplate : t));
    } else {
      setTemplates(prev => [...prev, editingTemplate]);
    }
    
    toast.success("Template saved successfully!");
    setShowEditor(false);
    setEditingTemplate(null);
  };

  const handleElementChange = (elementId: string, changes: Partial<TemplateElement>) => {
    if (!editingTemplate) return;
    
    setEditingTemplate({
      ...editingTemplate,
      elements: editingTemplate.elements.map(el => 
        el.id === elementId ? { ...el, ...changes } : el
      ),
    });
    
    if (selectedElement?.id === elementId) {
      setSelectedElement({ ...selectedElement, ...changes });
    }
  };

  const filteredTemplates = selectedSchool 
    ? templates.filter(t => t.schoolId === selectedSchool)
    : templates;

  const handleLogout = () => navigate("/");

  return (
    <DashboardLayout role="superadmin" userName="Super Admin" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">ID Card Templates</h1>
            <p className="text-muted-foreground mt-1">Design and manage ID card templates for schools</p>
          </div>
        </div>

        {/* School Filter & Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 max-w-xs">
                <Label className="mb-2 block">Select School</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Schools" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Schools</SelectItem>
                    {mockSchools.map(school => (
                      <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleCreateTemplate} disabled={!selectedSchool}>
                  <Palette className="w-4 h-4 mr-2" />
                  Create New Template
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <Card key={template.id} className="overflow-hidden">
              <div 
                className="h-48 relative border-b border-border"
                style={{ backgroundColor: template.backgroundColor }}
              >
                {/* Mini Preview */}
                <div className="absolute inset-4 flex flex-col items-center justify-center">
                  <div 
                    className="w-12 h-12 rounded-full mb-2"
                    style={{ backgroundColor: template.primaryColor }}
                  >
                    <GraduationCap className="w-6 h-6 text-white m-3" />
                  </div>
                  <div className="w-16 h-20 bg-muted rounded-lg mb-2 flex items-center justify-center">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="text-xs font-medium" style={{ color: template.textColor }}>
                    Student Name
                  </div>
                  <div className="text-[10px]" style={{ color: template.textColor }}>
                    Class X-A
                  </div>
                </div>
              </div>
              <CardContent className="pt-4">
                <h3 className="font-semibold text-foreground">{template.name}</h3>
                <p className="text-sm text-muted-foreground">{template.schoolName}</p>
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowPreview(true);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleEditTemplate(template)}
                  >
                    <Palette className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredTemplates.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {selectedSchool 
                ? "No templates found for this school. Create one to get started."
                : "Select a school to view or create templates."}
            </div>
          )}
        </div>

        {/* Template Editor Dialog */}
        <Dialog open={showEditor} onOpenChange={setShowEditor}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit ID Card Template</DialogTitle>
            </DialogHeader>
            
            {editingTemplate && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Preview Panel */}
                <div className="lg:col-span-2">
                  <Label className="mb-2 block">ID Card Preview (54mm × 86mm)</Label>
                  <div 
                    className="relative border-2 border-dashed border-border rounded-lg mx-auto"
                    style={{ 
                      width: "324px", // 54mm * 6 for display
                      height: "516px", // 86mm * 6 for display
                      backgroundColor: editingTemplate.backgroundColor,
                    }}
                  >
                    {editingTemplate.elements.map(element => (
                      <div
                        key={element.id}
                        className={`absolute cursor-pointer border transition-all ${
                          selectedElement?.id === element.id 
                            ? "border-primary border-2" 
                            : "border-transparent hover:border-muted-foreground/30"
                        }`}
                        style={{
                          left: `${element.x}%`,
                          top: `${element.y}%`,
                          width: `${element.width}%`,
                          height: `${element.height}%`,
                        }}
                        onClick={() => setSelectedElement(element)}
                      >
                        {element.type === "photo" && (
                          <div className="w-full h-full bg-muted rounded flex items-center justify-center">
                            <User className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        {element.type === "logo" && (
                          <div 
                            className="w-full h-full rounded-full flex items-center justify-center"
                            style={{ backgroundColor: editingTemplate.primaryColor }}
                          >
                            <GraduationCap className="w-6 h-6 text-white" />
                          </div>
                        )}
                        {element.type === "text" && (
                          <div 
                            className="w-full h-full flex items-center overflow-hidden"
                            style={{ 
                              color: editingTemplate.textColor,
                              fontSize: `${element.fontSize || 10}px`,
                              fontWeight: element.fontWeight || "normal",
                              textAlign: element.textAlign || "center",
                              justifyContent: element.textAlign === "left" ? "flex-start" : element.textAlign === "right" ? "flex-end" : "center",
                            }}
                          >
                            {element.label}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Settings Panel */}
                <div className="space-y-6">
                  {/* Template Settings */}
                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Template Settings
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <Label>Template Name</Label>
                        <Input 
                          value={editingTemplate.name}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Background Color</Label>
                        <div className="flex gap-2">
                          <Input 
                            type="color" 
                            value={editingTemplate.backgroundColor}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, backgroundColor: e.target.value })}
                            className="w-12 h-10 p-1"
                          />
                          <Input 
                            value={editingTemplate.backgroundColor}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, backgroundColor: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Primary Color (Logo/Accents)</Label>
                        <div className="flex gap-2">
                          <Input 
                            type="color" 
                            value={editingTemplate.primaryColor}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, primaryColor: e.target.value })}
                            className="w-12 h-10 p-1"
                          />
                          <Input 
                            value={editingTemplate.primaryColor}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, primaryColor: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Text Color</Label>
                        <div className="flex gap-2">
                          <Input 
                            type="color" 
                            value={editingTemplate.textColor}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, textColor: e.target.value })}
                            className="w-12 h-10 p-1"
                          />
                          <Input 
                            value={editingTemplate.textColor}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, textColor: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Element Settings */}
                  {selectedElement && (
                    <div className="space-y-4 pt-4 border-t border-border">
                      <h3 className="font-medium flex items-center gap-2">
                        <Move className="w-4 h-4" />
                        {selectedElement.label} Settings
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>X Position (%)</Label>
                          <Input 
                            type="number"
                            value={selectedElement.x}
                            onChange={(e) => handleElementChange(selectedElement.id, { x: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label>Y Position (%)</Label>
                          <Input 
                            type="number"
                            value={selectedElement.y}
                            onChange={(e) => handleElementChange(selectedElement.id, { y: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label>Width (%)</Label>
                          <Input 
                            type="number"
                            value={selectedElement.width}
                            onChange={(e) => handleElementChange(selectedElement.id, { width: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label>Height (%)</Label>
                          <Input 
                            type="number"
                            value={selectedElement.height}
                            onChange={(e) => handleElementChange(selectedElement.id, { height: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      
                      {selectedElement.type === "text" && (
                        <>
                          <div>
                            <Label>Font Size (px)</Label>
                            <Input 
                              type="number"
                              value={selectedElement.fontSize || 10}
                              onChange={(e) => handleElementChange(selectedElement.id, { fontSize: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label>Font Weight</Label>
                            <Select 
                              value={selectedElement.fontWeight || "normal"}
                              onValueChange={(v) => handleElementChange(selectedElement.id, { fontWeight: v as "normal" | "bold" })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="bold">Bold</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Text Align</Label>
                            <Select 
                              value={selectedElement.textAlign || "center"}
                              onValueChange={(v) => handleElementChange(selectedElement.id, { textAlign: v as "left" | "center" | "right" })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">Left</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="right">Right</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {!selectedElement && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Click on an element in the preview to edit its properties
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditor(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate}>
                <Save className="w-4 h-4 mr-2" />
                Save Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>ID Card Preview</DialogTitle>
            </DialogHeader>
            {selectedTemplate && (
              <div 
                className="relative border border-border rounded-lg mx-auto"
                style={{ 
                  width: "270px", // 54mm * 5
                  height: "430px", // 86mm * 5
                  backgroundColor: selectedTemplate.backgroundColor,
                }}
              >
                {selectedTemplate.elements.map(element => (
                  <div
                    key={element.id}
                    className="absolute"
                    style={{
                      left: `${element.x}%`,
                      top: `${element.y}%`,
                      width: `${element.width}%`,
                      height: `${element.height}%`,
                    }}
                  >
                    {element.type === "photo" && (
                      <div className="w-full h-full bg-muted rounded flex items-center justify-center">
                        <User className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    {element.type === "logo" && (
                      <div 
                        className="w-full h-full rounded-full flex items-center justify-center"
                        style={{ backgroundColor: selectedTemplate.primaryColor }}
                      >
                        <GraduationCap className="w-5 h-5 text-white" />
                      </div>
                    )}
                    {element.type === "text" && (
                      <div 
                        className="w-full h-full flex items-center"
                        style={{ 
                          color: selectedTemplate.textColor,
                          fontSize: `${(element.fontSize || 10) * 0.8}px`,
                          fontWeight: element.fontWeight || "normal",
                          textAlign: element.textAlign || "center",
                          justifyContent: element.textAlign === "left" ? "flex-start" : element.textAlign === "right" ? "flex-end" : "center",
                        }}
                      >
                        {element.field === "schoolName" ? selectedTemplate.schoolName :
                         element.field === "name" ? "John Doe" :
                         element.field === "class" ? "Class 5-A" :
                         element.field === "admissionNo" ? "ADM2024001" :
                         element.field === "dob" ? "15-Mar-2015" :
                         element.label}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
