import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Save, 
  Eye, 
  Palette, 
  Type, 
  Image as ImageIcon,
  Upload,
  Move, 
  School,
  GraduationCap,
  User,
  X,
  Plus,
  Trash2
} from "lucide-react";
import { schoolsApi, idCardTemplatesApi, uploadApi, IDCardTemplate } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { IDCardRenderer } from "@/components/idcards/IDCardRenderer";
import { IDCardLayout, normalizeLayout, PX_PER_MM } from "@/lib/idCardLayout";

interface TemplateElement {
  id: string;
  type: "photo" | "text" | "logo" | "qr" | "textbox";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: "left" | "center" | "right";
  color?: string;
  field?: string;
  templateField?: string; // NEW: canonical key used for mappings
  photoShape?: "circle" | "square" | "rounded" | "rectangle";
  text?: string;
}

const STUDENT_FIELDS = [
  // Prefer backend canonical keys (snake_case + extra_fields.*)
  { value: "name", label: "Student Name" },
  { value: "admission_number", label: "Admission Number" },
  { value: "roll_no", label: "Roll Number" },
  { value: "class", label: "Class-Section" },
  { value: "photo_url", label: "Student Photo URL" },
  { value: "date_of_birth", label: "Date of Birth" },
  { value: "gender", label: "Gender" },
  { value: "blood_group", label: "Blood Group" },
  { value: "school_name", label: "School Name" },
  { value: "parent_name", label: "Parent Name" },
  { value: "parent_phone", label: "Parent Phone" },
  { value: "address", label: "Address" },
  { value: "extra_fields.blood_group", label: "Extra: Blood Group" },
  { value: "extra_fields.house", label: "Extra: House" },
  { value: "extra_fields.id_valid_upto", label: "Extra: ID Valid Until" },
];

const SHEET_SIZES = [
  { value: "A4", label: "A4 (210mm × 297mm)" },
  { value: "12x18", label: "12×18 (305mm × 457mm)" },
  { value: "13x19", label: "13×19 (330mm × 483mm)" },
  { value: "custom", label: "Custom Size" },
];

const FONT_FAMILIES = [
  "Arial", "Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana", "Comic Sans MS"
];

const PHOTO_SHAPES = [
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "rectangle", label: "Rectangle" },
];

function calculateCardsPerSheet(cardWidth: number, cardHeight: number, sheetSize: string, orientation: string) {
  let sheetWidth = 210; // A4 width in mm
  let sheetHeight = 297; // A4 height in mm

  if (sheetSize === "13x19") {
    sheetWidth = 330;
    sheetHeight = 483;
  } else if (sheetSize === "12x18") {
    sheetWidth = 305;
    sheetHeight = 457;
  }

  if (orientation === "landscape") {
    [sheetWidth, sheetHeight] = [sheetHeight, sheetWidth];
  }

  // A4 = 10 (5×2), 12×18 & 13×19 = 25 (5×5); margins are adjusted in generation to fit
  if (sheetSize === "A4") return { cardsPerRow: 5, cardsPerColumn: 2, total: 10 };
  if (sheetSize === "12x18" || sheetSize === "13x19") return { cardsPerRow: 5, cardsPerColumn: 5, total: 25 };
  const margin = 10;
  const gap = 3;
  const availableWidth = sheetWidth - margin * 2;
  const availableHeight = sheetHeight - margin * 2;
  const cardsPerRow = Math.floor((availableWidth + gap) / (cardWidth + gap)) || 1;
  const cardsPerColumn = Math.floor((availableHeight + gap) / (cardHeight + gap)) || 1;
  return { cardsPerRow, cardsPerColumn, total: cardsPerRow * cardsPerColumn };
}

export default function IDCardTemplate() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [templates, setTemplates] = useState<IDCardTemplate[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<IDCardTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSchools, setIsLoadingSchools] = useState(true);
  
  // Editor state
  const [editingTemplate, setEditingTemplate] = useState<Partial<IDCardTemplate> | null>(null);
  const [selectedElement, setSelectedElement] = useState<TemplateElement | null>(null);
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const [s3LayoutUrl, setS3LayoutUrl] = useState<string>("");
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [editorTab, setEditorTab] = useState<"front" | "back">("front");
  const [backEnabled, setBackEnabled] = useState(false);
  const [backBackgroundImageUrl, setBackBackgroundImageUrl] = useState<string>("");
  const [backFieldMappings, setBackFieldMappings] = useState<Record<string, string>>({});
  const backFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    if (selectedSchool) {
      loadTemplates();
    }
  }, [selectedSchool]);

  const loadSchools = async () => {
    try {
      setIsLoadingSchools(true);
      console.log("Loading schools...");
      const data = await schoolsApi.getAll();
      console.log("Schools loaded:", data);
      setSchools(data || []);
      if (data && data.length === 0) {
        toast.info("No schools found. Please create a school first.");
      }
    } catch (error: any) {
      console.error("Failed to load schools:", error);
      const errorMessage = error?.message || error?.error || "Failed to load schools";
      toast.error(errorMessage);
      setSchools([]);
    } finally {
      setIsLoadingSchools(false);
    }
  };

  const loadTemplates = async () => {
    if (!selectedSchool) return;
    try {
      setIsLoading(true);
      const data = await idCardTemplatesApi.getBySchool(selectedSchool);
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    if (!selectedSchool) {
      toast.error("Please select a school first");
      return;
    }
    
    setEditingTemplate({
      id: "",
      name: "New Template",
      schoolId: selectedSchool,
      templateData: { elements: [], backElements: [] },
      cardWidth: 54,
      cardHeight: 86,
      orientation: "portrait",
      sheetSize: "A4",
      isDefault: false,
    });
    setBackEnabled(false);
    setBackBackgroundImageUrl("");
    setBackFieldMappings({});
    setEditorTab("front");
    setShowEditor(true);
  };

  const handleEditTemplate = async (template: IDCardTemplate) => {
    try {
      const fullTemplate = await idCardTemplatesApi.getById(template.id);
      // If layout JSON exists in S3, prefer that for editing; else fall back to DB JSON
      let layoutFromS3: any = null;
      if ((fullTemplate as any).layoutJsonUrl) {
        try {
          const resp = await fetch((fullTemplate as any).layoutJsonUrl);
          if (resp.ok) layoutFromS3 = await resp.json();
        } catch {}
      }

      const normalized = normalizeLayout(layoutFromS3 || fullTemplate.templateData, {
        id: fullTemplate.id,
        name: fullTemplate.name,
        width_mm: fullTemplate.cardWidth,
        height_mm: fullTemplate.cardHeight,
        orientation: fullTemplate.orientation,
        backgroundImageUrl: fullTemplate.backgroundImageUrl,
      });

      // Hydrate editor (legacy element format) from normalized layout
      const elements: TemplateElement[] = normalized.elements.map((el) => ({
        id: el.id,
        type: el.type === "text" ? "text" : el.type,
        label: el.label,
        x: el.x_percent,
        y: el.y_percent,
        width: el.width_percent,
        height: el.height_percent,
        fontSize: el.fontSize,
        fontFamily: el.fontFamily,
        fontWeight: el.fontWeight,
        textAlign: el.align,
        color: el.color,
        templateField: el.templateField,
        field: el.templateField, // keep legacy
        photoShape: el.photoShape || "rectangle",
      }));

      const td = fullTemplate.templateData as any || {};
      const backElementsRaw = td.backElements || [];
      const backElements: TemplateElement[] = Array.isArray(backElementsRaw)
        ? backElementsRaw.map((el: any) => ({
            id: el.id ?? `el-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: (el.type === "textbox" ? "text" : el.type) || "text",
            label: el.label ?? "Field",
            x: el.x_percent ?? el.x ?? 0,
            y: el.y_percent ?? el.y ?? 0,
            width: el.width_percent ?? el.width ?? 30,
            height: el.height_percent ?? el.height ?? 10,
            fontSize: el.fontSize ?? 12,
            fontFamily: el.fontFamily,
            fontWeight: el.fontWeight,
            textAlign: el.align ?? el.textAlign,
            color: el.color,
            templateField: el.templateField ?? el.field,
            field: el.templateField ?? el.field,
            photoShape: el.photoShape ?? "rectangle",
          }))
        : [];

      setEditingTemplate({
        ...fullTemplate,
        templateData: { elements, backElements },
        cardWidth: normalized.width_mm,
        cardHeight: normalized.height_mm,
        orientation: normalized.orientation,
        backgroundImageUrl: normalized.backgroundImageUrl,
      });

      const mappings = normalized.fieldMappings || {};
      setBackEnabled(!!td.backEnabled);
      setBackBackgroundImageUrl(td.backBackgroundImageUrl || td.back_background_image_url || "");
      setBackFieldMappings(td.backFieldMappings || td.back_field_mappings || {});
      
      // Log field mappings for debugging
      console.log('[IDCardTemplate] Loaded template field mappings:', mappings);
      
      // If photo mapping exists but uses old "photoUrl", warn in console
      if (mappings.photo === 'photoUrl') {
        console.warn('[IDCardTemplate] Template uses old photo mapping "photoUrl". Consider updating to "photo_url" in the template editor.');
      }
      
      setFieldMappings(mappings);
      setEditorTab("front");
      setShowEditor(true);
    } catch (error) {
      toast.error("Failed to load template");
    }
  };

  const handleBackgroundUpload = async (file: File) => {
    try {
      setIsLoading(true);
      const result = await uploadApi.uploadIdTemplate(file);
      if (editingTemplate) {
        setEditingTemplate({
          ...editingTemplate,
          backgroundImageUrl: result.templateUrl,
        });
      }
      toast.success("Background uploaded successfully!");
      setBackgroundFile(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload background");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackBackgroundUpload = async (file: File) => {
    try {
      setIsLoading(true);
      const result = await uploadApi.uploadIdTemplate(file);
      setBackBackgroundImageUrl(result.templateUrl);
      toast.success("Back background uploaded successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload back background");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLayoutUpload = async (file: File) => {
    try {
      setIsLoading(true);
      const result = await uploadApi.uploadIdLayout(file);
      setS3LayoutUrl(result.layoutUrl);
      toast.success("Layout JSON uploaded successfully!");
      setLayoutFile(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload layout");
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentElements = () =>
    editorTab === "front"
      ? (editingTemplate?.templateData?.elements || [])
      : (editingTemplate?.templateData?.backElements || []);

  const setCurrentElements = (els: TemplateElement[]) => {
    if (!editingTemplate) return;
    if (editorTab === "front") {
      setEditingTemplate({
        ...editingTemplate,
        templateData: { ...editingTemplate.templateData, elements: els },
      });
    } else {
      setEditingTemplate({
        ...editingTemplate,
        templateData: { ...editingTemplate.templateData, backElements: els },
      });
    }
  };

  const getCurrentMappings = () => (editorTab === "front" ? fieldMappings : backFieldMappings);
  const setCurrentMappings = (m: Record<string, string>) => {
    if (editorTab === "front") setFieldMappings(m);
    else setBackFieldMappings(m);
  };

  const handleAddField = (fieldType: "text" | "photo" | "logo" | "textbox") => {
    if (!editingTemplate) return;
    
    const newElement: TemplateElement = {
      id: `element-${Date.now()}`,
      type: fieldType,
      label: fieldType === "photo" ? "Student Photo" : fieldType === "logo" ? "School Logo" : "Text Field",
      templateField: fieldType === "photo" ? "photo" : fieldType === "logo" ? "logo" : "",
      x: 10,
      y: 10,
      width: 30,
      height: 10,
      fontSize: 12,
      fontFamily: "Arial",
      fontWeight: "normal",
      fontStyle: "normal",
      textAlign: "center",
      color: "#000000",
      photoShape: "rectangle",
    };

    const current = getCurrentElements();
    setCurrentElements([...current, newElement]);
    
    const maps = getCurrentMappings();
    if (fieldType === "photo") {
      setCurrentMappings({ ...maps, photo: "photo_url" });
    } else if (fieldType === "logo") {
      setCurrentMappings({ ...maps, logo: "schoolLogo" });
    }
    
    setSelectedElement(newElement);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !editingTemplate) return;
    
    const fieldType = active.id as string;
    const rect = over.rect;
    
    // Calculate position based on drop location
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const x = ((active.rect.current.translated?.left || 0) / canvasWidth) * 100;
    const y = ((active.rect.current.translated?.top || 0) / canvasHeight) * 100;
    
    const elementType = fieldType.includes("photo") ? "photo" : fieldType.includes("logo") ? "logo" : "text";
    const newElement: TemplateElement = {
      id: `element-${Date.now()}`,
      type: elementType,
      label: fieldType,
      templateField: elementType === "photo" ? "photo" : elementType === "logo" ? "logo" : fieldType,
      x: Math.max(0, Math.min(90, x)),
      y: Math.max(0, Math.min(90, y)),
      width: 30,
      height: 10,
      fontSize: 12,
      fontFamily: "Arial",
      fontWeight: "normal",
      textAlign: "center",
      color: "#000000",
      field: fieldType !== "photo" && fieldType !== "logo" ? fieldType : undefined,
      photoShape: "rectangle",
    };

    const current = getCurrentElements();
    setCurrentElements([...current, newElement]);
    
    const maps = getCurrentMappings();
    if (elementType === "photo") {
      setCurrentMappings({ ...maps, photo: "photo_url" });
    } else if (elementType === "logo") {
      setCurrentMappings({ ...maps, logo: "schoolLogo" });
    }
    
    setSelectedElement(newElement);
  };

  const handleElementChange = (elementId: string, changes: Partial<TemplateElement>) => {
    if (!editingTemplate || !editingTemplate.templateData) return;
    
    const current = getCurrentElements();
    const updated = current.map(el => 
      el.id === elementId ? { ...el, ...changes } : el
    );
    setCurrentElements(updated);
    
    if (selectedElement?.id === elementId) {
      setSelectedElement({ ...selectedElement, ...changes });
    }
  };

  const handleRemoveElement = (elementId: string) => {
    if (!editingTemplate || !editingTemplate.templateData) return;
    
    const current = getCurrentElements();
    setCurrentElements(current.filter(el => el.id !== elementId));
    
    if (selectedElement?.id === elementId) {
      setSelectedElement(null);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate || !selectedSchool) {
      toast.error("Missing required fields");
      return;
    }

    try {
      setIsLoading(true);

      const layout: IDCardLayout = {
        id: editingTemplate.id || undefined,
        name: editingTemplate.name || "New Template",
        width_mm: editingTemplate.cardWidth || 54,
        height_mm: editingTemplate.cardHeight || 86,
        orientation: (editingTemplate.orientation || "portrait") as any,
        backgroundImageUrl: editingTemplate.backgroundImageUrl,
        elements: (editingTemplate.templateData?.elements || []).map((el) => ({
          id: el.id,
          type: (el.type === "textbox" ? "text" : (el.type as any)),
          label: el.label,
          templateField: el.templateField || el.field,
          x_percent: el.x,
          y_percent: el.y,
          width_percent: el.width,
          height_percent: el.height,
          fontSize: el.fontSize,
          fontFamily: el.fontFamily,
          fontWeight: el.fontWeight,
          color: el.color,
          align: el.textAlign,
          photoShape: el.photoShape,
        })),
        fieldMappings,
      };
      
      console.log('Saving template:', {
        backgroundImageUrl: layout.backgroundImageUrl,
        elements: layout.elements.length,
        fieldMappings: layout.fieldMappings,
        cardSize: `${layout.width_mm}x${layout.height_mm}mm`,
      });

      // Upload layout JSON to S3 (front only for generation)
      let layoutJsonUrl: string | undefined = undefined;
      try {
        const json = JSON.stringify(layout);
        const file = new File([json], `id-layout-${Date.now()}.json`, { type: "application/json" });
        const uploaded = await uploadApi.uploadIdLayout(file);
        layoutJsonUrl = uploaded.layoutUrl;
        setS3LayoutUrl(uploaded.layoutUrl);
      } catch (e) {
        // Non-fatal: DB layout JSON will still exist
      }

      const backElementsNorm = (editingTemplate.templateData?.backElements || []).map((el) => ({
        id: el.id,
        type: (el.type === "textbox" ? "text" : (el.type as any)),
        label: el.label,
        templateField: el.templateField || el.field,
        x_percent: el.x,
        y_percent: el.y,
        width_percent: el.width,
        height_percent: el.height,
        fontSize: el.fontSize,
        fontFamily: el.fontFamily,
        fontWeight: el.fontWeight,
        color: el.color,
        align: el.textAlign,
        photoShape: el.photoShape,
      }));
      const templateDataWithBack = {
        ...layout,
        backEnabled,
        backBackgroundImageUrl: backEnabled ? backBackgroundImageUrl : undefined,
        backElements: backEnabled ? backElementsNorm : [],
        backFieldMappings: backEnabled ? backFieldMappings : {},
      } as any;
      
      if (editingTemplate.id) {
        await idCardTemplatesApi.update(editingTemplate.id, {
          name: editingTemplate.name,
          templateData: templateDataWithBack,
          layoutJsonUrl,
          backgroundImageUrl: editingTemplate.backgroundImageUrl,
          cardWidth: editingTemplate.cardWidth,
          cardHeight: editingTemplate.cardHeight,
          orientation: editingTemplate.orientation,
          sheetSize: editingTemplate.sheetSize,
        });
        toast.success("Template updated successfully!");
      } else {
        await idCardTemplatesApi.create({
          schoolId: selectedSchool,
          name: editingTemplate.name || "New Template",
          templateData: templateDataWithBack,
          layoutJsonUrl,
          backgroundImageUrl: editingTemplate.backgroundImageUrl,
          cardWidth: editingTemplate.cardWidth || 54,
          cardHeight: editingTemplate.cardHeight || 86,
          orientation: editingTemplate.orientation || "portrait",
          sheetSize: editingTemplate.sheetSize || "A4",
        });
        toast.success("Template created successfully!");
      }
      
      await loadTemplates();
      setShowEditor(false);
      setEditingTemplate(null);
      setS3LayoutUrl("");
      setFieldMappings({});
      setBackEnabled(false);
      setBackBackgroundImageUrl("");
      setBackFieldMappings({});
      setEditorTab("front");
    } catch (error: any) {
      toast.error(error.message || "Failed to save template");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTemplates = selectedSchool 
    ? templates.filter(t => t.schoolId === selectedSchool)
    : templates;

  const layoutInfo = editingTemplate
    ? calculateCardsPerSheet(
        editingTemplate.cardWidth || 54,
        editingTemplate.cardHeight || 86,
        editingTemplate.sheetSize || "A4",
        editingTemplate.orientation || "portrait"
      )
    : null;

  const handleLogout = () => logout();

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
                <Select 
                  value={selectedSchool} 
                  onValueChange={setSelectedSchool}
                  disabled={isLoadingSchools || schools.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      isLoadingSchools 
                        ? "Loading schools..." 
                        : schools.length === 0 
                          ? "No schools found" 
                          : "Select School"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map(school => (
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
        {isLoading && !templates.length ? (
          <div className="text-center py-12">Loading templates...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map(template => {
              const td = (template as any).templateData || {};
              const miniLayout = normalizeLayout(
                { elements: td.elements || [], fieldMappings: td.field_mappings || td.fieldMappings || {} },
                {
                  name: template.name,
                  width_mm: template.cardWidth || 54,
                  height_mm: template.cardHeight || 86,
                  orientation: (template.orientation || "portrait") as any,
                  backgroundImageUrl: template.backgroundImageUrl,
                }
              );
              return (
              <Card key={template.id} className="overflow-hidden">
                <div className="h-48 relative border-b border-border flex items-center justify-center bg-muted/30 p-2">
                  <IDCardRenderer
                    layout={miniLayout}
                    renderHeightPx={180}
                  />
                </div>
                <CardContent className="pt-4">
                  <h3 className="font-semibold text-foreground">{template.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {template.cardWidth}mm × {template.cardHeight}mm ({template.orientation})
                  </p>
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
            );
            })}
            
            {filteredTemplates.length === 0 && !isLoading && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                {selectedSchool 
                  ? "No templates found for this school. Create one to get started."
                  : "Select a school to view or create templates."}
              </div>
            )}
          </div>
        )}

        {/* Template Editor Dialog */}
        <Dialog open={showEditor} onOpenChange={setShowEditor}>
          <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit ID Card Template</DialogTitle>
            </DialogHeader>
            
            {editingTemplate && (
              <DndContext onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Fields Palette */}
                  <div className="lg:col-span-1 space-y-4">
                    <div>
                      <Label className="mb-2 block">Add Fields</Label>
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleAddField("text")}
                        >
                          <Type className="w-4 h-4 mr-2" />
                          Text Field
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleAddField("photo")}
                        >
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Photo
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleAddField("logo")}
                        >
                          <School className="w-4 h-4 mr-2" />
                          Logo
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleAddField("textbox")}
                        >
                          <Type className="w-4 h-4 mr-2" />
                          Text Box
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Student Data Fields</Label>
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {STUDENT_FIELDS.map(field => (
                          <div
                            key={field.value}
                            className="p-2 border rounded cursor-move hover:bg-muted text-sm"
                            draggable
                            onDragStart={() => setDraggedField(field.value)}
                          >
                            {field.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Canvas Preview */}
                  <div className="lg:col-span-2">
                    <div className="space-y-4">
                      {/* Template Settings */}
                      <div className="flex items-center space-x-2 pb-2">
                        <Checkbox
                          id="back-enabled"
                          checked={backEnabled}
                          onCheckedChange={(checked) => {
                            setBackEnabled(!!checked);
                            if (!checked) setEditorTab("front");
                          }}
                        />
                        <label
                          htmlFor="back-enabled"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Enable back template
                        </label>
                      </div>

                      {backEnabled && (
                        <Tabs value={editorTab} onValueChange={(v) => { setEditorTab(v as "front" | "back"); setSelectedElement(null); }} className="mb-4">
                          <TabsList>
                            <TabsTrigger value="front">Front</TabsTrigger>
                            <TabsTrigger value="back">Back</TabsTrigger>
                          </TabsList>
                          <TabsContent value="front" className="mt-2" />
                          <TabsContent value="back" className="mt-2 space-y-2">
                            <div>
                              <Label>Back Background Image</Label>
                              <div className="flex gap-2 mt-1">
                                <Input
                                  ref={backFileInputRef}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleBackBackgroundUpload(file);
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => backFileInputRef.current?.click()}
                                >
                                  <Upload className="w-4 h-4 mr-2" />
                                  Upload Back Background
                                </Button>
                                {backBackgroundImageUrl && (
                                  <span className="text-sm text-green-600 flex items-center">✓ Uploaded</span>
                                )}
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Template Name</Label>
                          <Input 
                            value={editingTemplate.name || ""}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Background Image</Label>
                          <div className="flex gap-2">
                            <Input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setBackgroundFile(file);
                                  handleBackgroundUpload(file);
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Upload
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label>Template Layout JSON</Label>
                          <div className="flex gap-2">
                            <Input
                              type="file"
                              accept=".json"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setLayoutFile(file);
                                  handleLayoutUpload(file);
                                }
                              }}
                              className="max-w-xs"
                            />
                            {s3LayoutUrl && (
                              <span className="text-sm text-green-600 flex items-center">✓ Layout uploaded</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Upload a JSON file containing the layout structure
                          </p>
                        </div>
                        <div>
                          <Label>Card Width (mm)</Label>
                          <Input 
                            type="number"
                            value={editingTemplate.cardWidth || 54}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, cardWidth: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label>Card Height (mm)</Label>
                          <Input 
                            type="number"
                            value={editingTemplate.cardHeight || 86}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, cardHeight: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label>Orientation</Label>
                          <Select 
                            value={editingTemplate.orientation || "portrait"}
                            onValueChange={(v: "portrait" | "landscape") => setEditingTemplate({ ...editingTemplate, orientation: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="portrait">Portrait</SelectItem>
                              <SelectItem value="landscape">Landscape</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Sheet Size</Label>
                          <Select 
                            value={editingTemplate.sheetSize || "A4"}
                            onValueChange={(v) => setEditingTemplate({ ...editingTemplate, sheetSize: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SHEET_SIZES.map(size => (
                                <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {layoutInfo && (
                        <div className="p-3 bg-muted rounded-lg text-sm">
                          <p className="font-medium">Layout: {layoutInfo.cardsPerRow} × {layoutInfo.cardsPerColumn} = {layoutInfo.total} cards per sheet</p>
                        </div>
                      )}

                      {/* Field mappings are now edited per-element in the right panel to keep a single source of truth */}

                      <Label>ID Card Preview {editorTab === "back" && "(Back)"}</Label>
                      {editingTemplate && (
                        <div className="relative border-2 border-dashed border-border rounded-lg mx-auto bg-white p-2">
                          <IDCardRenderer
                            layout={normalizeLayout(
                              {
                                id: editingTemplate.id,
                                name: editingTemplate.name || "Template",
                                width_mm: editingTemplate.cardWidth || 54,
                                height_mm: editingTemplate.cardHeight || 86,
                                orientation: editingTemplate.orientation || "portrait",
                                backgroundImageUrl: editorTab === "front" ? editingTemplate.backgroundImageUrl : backBackgroundImageUrl,
                                elements: getCurrentElements().map((el) => ({
                                  id: el.id,
                                  type: (el.type === "textbox" ? "text" : (el.type as any)),
                                  label: el.label,
                                  templateField: el.templateField || el.field,
                                  x_percent: el.x,
                                  y_percent: el.y,
                                  width_percent: el.width,
                                  height_percent: el.height,
                                  fontSize: el.fontSize,
                                  fontFamily: el.fontFamily,
                                  fontWeight: el.fontWeight,
                                  color: el.color,
                                  align: el.textAlign,
                                  photoShape: el.photoShape,
                                })),
                                fieldMappings: getCurrentMappings(),
                              },
                              undefined
                            )}
                            renderHeightPx={400}
                          />

                          {/* Click overlay to select + delete (keeps renderer purely presentational) */}
                          <div
                            className="absolute inset-2"
                            style={{
                              width: `${((editingTemplate.cardWidth || 54) / (editingTemplate.cardHeight || 86)) * 400}px`,
                              height: "400px",
                            }}
                          >
                            {getCurrentElements().map((element) => (
                              <div
                                key={element.id}
                                className={`absolute cursor-pointer border-2 transition-all ${
                                  selectedElement?.id === element.id
                                    ? "border-primary"
                                    : "border-transparent hover:border-muted-foreground/50"
                                }`}
                                style={{
                                  left: `${element.x}%`,
                                  top: `${element.y}%`,
                                  width: `${element.width}%`,
                                  height: `${element.height}%`,
                                }}
                                onClick={() => setSelectedElement(element)}
                              >
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="absolute -top-2 -right-2 h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveElement(element.id);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Field Editor Panel */}
                  <div className="lg:col-span-1 space-y-4">
                    {selectedElement ? (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">Edit Field</h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedElement(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <Label>Label</Label>
                            <Input 
                              value={selectedElement.label}
                              onChange={(e) => handleElementChange(selectedElement.id, { label: e.target.value })}
                            />
                          </div>

                          {selectedElement.type === "text" || selectedElement.type === "textbox" ? (
                            <>
                              <div>
                                <Label>Template Field Key</Label>
                                <Input
                                  value={selectedElement.templateField || selectedElement.field || ""}
                                  placeholder="e.g., name, blood_group"
                                  onChange={(e) => {
                                    const newKey = e.target.value;
                                    const oldKey = selectedElement.templateField || selectedElement.field || "";
                                    const maps = getCurrentMappings();
                                    // Update element key
                                    handleElementChange(selectedElement.id, { templateField: newKey, field: newKey });
                                    // Move mapping key if needed
                                    if (oldKey && oldKey !== newKey && maps[oldKey]) {
                                      const next = { ...maps };
                                      next[newKey] = next[oldKey];
                                      delete next[oldKey];
                                      setCurrentMappings(next);
                                    }
                                  }}
                                />
                              </div>

                              <div>
                                <Label>Map To Student Field</Label>
                                <Select
                                  value={
                                    (() => {
                                      const key = selectedElement.templateField || selectedElement.field || "";
                                      return key ? (getCurrentMappings()[key] || "") : "";
                                    })()
                                  }
                                  onValueChange={(v) => {
                                    const key = selectedElement.templateField || selectedElement.field || "";
                                    if (!key) {
                                      toast.error("Please set Template Field Key first");
                                      return;
                                    }
                                    setCurrentMappings({ ...getCurrentMappings(), [key]: v });
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select student field" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STUDENT_FIELDS.map((field) => (
                                      <SelectItem key={field.value} value={field.value}>
                                        {field.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Font Size: {selectedElement.fontSize || 12}px</Label>
                                <Slider
                                  value={[selectedElement.fontSize || 12]}
                                  onValueChange={([value]) => handleElementChange(selectedElement.id, { fontSize: value })}
                                  min={8}
                                  max={48}
                                  step={1}
                                />
                              </div>

                              <div>
                                <Label>Font Family</Label>
                                <Select 
                                  value={selectedElement.fontFamily || "Arial"}
                                  onValueChange={(v) => handleElementChange(selectedElement.id, { fontFamily: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FONT_FAMILIES.map(font => (
                                      <SelectItem key={font} value={font}>{font}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Font Weight</Label>
                                <Select 
                                  value={selectedElement.fontWeight || "normal"}
                                  onValueChange={(v) => handleElementChange(selectedElement.id, { fontWeight: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="bold">Bold</SelectItem>
                                    <SelectItem value="300">Light</SelectItem>
                                    <SelectItem value="600">Semi-Bold</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Text Color</Label>
                                <div className="flex gap-2">
                                  <Input 
                                    type="color"
                                    value={selectedElement.color || "#000000"}
                                    onChange={(e) => handleElementChange(selectedElement.id, { color: e.target.value })}
                                    className="w-12 h-10 p-1"
                                  />
                                  <Input 
                                    value={selectedElement.color || "#000000"}
                                    onChange={(e) => handleElementChange(selectedElement.id, { color: e.target.value })}
                                  />
                                </div>
                              </div>

                              <div>
                                <Label>Text Align</Label>
                                <Select 
                                  value={selectedElement.textAlign || "center"}
                                  onValueChange={(v: "left" | "center" | "right") => handleElementChange(selectedElement.id, { textAlign: v })}
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
                          ) : selectedElement.type === "photo" || selectedElement.type === "logo" ? (
                            <>
                              <div>
                                <Label>Template Field Key</Label>
                                <Input
                                  value={selectedElement.templateField || selectedElement.field || ""}
                                  placeholder={selectedElement.type === "photo" ? "e.g., photo, photoUrl" : "e.g., logo, schoolLogo"}
                                  onChange={(e) => {
                                    const newKey = e.target.value;
                                    const oldKey = selectedElement.templateField || selectedElement.field || "";
                                    const maps = getCurrentMappings();
                                    // Update element key
                                    handleElementChange(selectedElement.id, { templateField: newKey, field: newKey });
                                    // Move mapping key if needed
                                    if (oldKey && oldKey !== newKey && maps[oldKey]) {
                                      const next = { ...maps };
                                      next[newKey] = next[oldKey];
                                      delete next[oldKey];
                                      setCurrentMappings(next);
                                    }
                                  }}
                                />
                              </div>

                              <div>
                                <Label>Map To Student Field</Label>
                                <Select
                                  value={
                                    (() => {
                                      const key = selectedElement.templateField || selectedElement.field || "";
                                      return key ? (getCurrentMappings()[key] || "") : "";
                                    })()
                                  }
                                  onValueChange={(v) => {
                                    const key = selectedElement.templateField || selectedElement.field || "";
                                    if (!key) {
                                      toast.error("Please set Template Field Key first");
                                      return;
                                    }
                                    setCurrentMappings({ ...getCurrentMappings(), [key]: v });
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select student field" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STUDENT_FIELDS.map((field) => (
                                      <SelectItem key={field.value} value={field.value}>
                                        {field.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {selectedElement.type === "photo" && (
                                <div>
                                  <Label>Photo Shape</Label>
                                  <Select 
                                    value={selectedElement.photoShape || "rectangle"}
                                    onValueChange={(v: "circle" | "square" | "rounded" | "rectangle") => handleElementChange(selectedElement.id, { photoShape: v })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PHOTO_SHAPES.map(shape => (
                                        <SelectItem key={shape.value} value={shape.value}>{shape.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </>
                          ) : null}

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label>X (%)</Label>
                              <Input 
                                type="number"
                                value={selectedElement.x}
                                onChange={(e) => handleElementChange(selectedElement.id, { x: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <Label>Y (%)</Label>
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
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Click on a field in the preview to edit its properties
                      </p>
                    )}
                  </div>
                </div>
              </DndContext>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEditor(false);
                setEditingTemplate(null);
                setSelectedElement(null);
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate} disabled={isLoading}>
                <Save className="w-4 h-4 mr-2" />
                Save Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>ID Card Preview</DialogTitle>
            </DialogHeader>
            {selectedTemplate && (() => {
              const td = (selectedTemplate as any).templateData || {};
              const previewLayout = normalizeLayout(
                {
                  elements: td.elements || [],
                  fieldMappings: td.field_mappings || td.fieldMappings || {},
                  backgroundImageUrl: selectedTemplate.backgroundImageUrl,
                },
                {
                  name: selectedTemplate.name,
                  width_mm: selectedTemplate.cardWidth || 54,
                  height_mm: selectedTemplate.cardHeight || 86,
                  orientation: (selectedTemplate.orientation || "portrait") as any,
                  backgroundImageUrl: selectedTemplate.backgroundImageUrl,
                }
              );
              return (
                <div className="flex flex-col gap-4">
                  <div className="border border-border rounded-lg overflow-hidden bg-white mx-auto">
                    <IDCardRenderer layout={previewLayout} renderHeightPx={400} />
                  </div>
                  {(td.backEnabled && Array.isArray(td.backElements) && td.backElements.length > 0) && (
                    <>
                      <h4 className="text-sm font-medium">Back</h4>
                      <div className="border border-border rounded-lg overflow-hidden bg-white mx-auto">
                        <IDCardRenderer
                          layout={normalizeLayout(
                            {
                              elements: td.backElements,
                              fieldMappings: td.backFieldMappings || td.back_field_mappings || {},
                              backgroundImageUrl: td.backBackgroundImageUrl || td.back_background_image_url,
                            },
                            {
                              name: selectedTemplate.name,
                              width_mm: selectedTemplate.cardWidth || 54,
                              height_mm: selectedTemplate.cardHeight || 86,
                              orientation: (selectedTemplate.orientation || "portrait") as any,
                              backgroundImageUrl: td.backBackgroundImageUrl || td.back_background_image_url,
                            }
                          )}
                          renderHeightPx={400}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
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