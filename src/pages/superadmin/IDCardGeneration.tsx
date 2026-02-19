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
  getToken,
  StudentForIDCard,
  IDCardTemplate 
} from "@/lib/api";
import { IDCardRenderer } from "@/components/idcards/IDCardRenderer";
import { IDCardLayout, normalizeLayout, PX_PER_MM, resolveElementValue } from "@/lib/idCardLayout";
import type { IDCardElement } from "@/lib/idCardLayout";

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
  const ALL_CLASSES_VALUE = "__all__";
  const [selectedClassFilter, setSelectedClassFilter] = useState(ALL_CLASSES_VALUE);
  const [pdfSheetSize, setPdfSheetSize] = useState<"A4" | "12x18" | "13x19">("A4");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Dialogs
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [previewLayout, setPreviewLayout] = useState<IDCardLayout | null>(null);

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
      const rawStudents = Array.isArray(data.students) ? data.students : [];
      
      // Debug: Log first few students to verify we're getting latest photo URLs
      console.log('[ID Card Gen] Sample students from backend:', rawStudents.slice(0, 3).map(s => ({
        id: s.id,
        name: s.name,
        photoUrl: s.photoUrl ?? s.photo_url,
        photo_url: s.photo_url
      })));
      
      // Normalize so name/admissionNumber/rollNo are always strings (avoid crash on filter/render)
      const studentsWithSelection = rawStudents.map((s: any) => {
        const photoUrl = s.photoUrl ?? s.photo_url ?? "";
        
        // Debug: Log photo URLs for verification - especially for Arjun Saxena
        if (photoUrl && (s.name?.toLowerCase().includes('arjun') || s.id === rawStudents.find((st: any) => st.name?.toLowerCase().includes('arjun'))?.id)) {
          console.log(`[ID Card Gen] Arjun Saxena photo URL:`, photoUrl);
        }
        
        return {
          ...s, 
          name: s.name != null ? String(s.name) : "",
          admissionNumber: s.admissionNumber ?? s.admission_number ?? "",
          rollNo: s.rollNo ?? s.roll_no ?? "",
          class: s.class ?? s.className ?? s.class_name ?? "",
          className: s.className ?? s.class_name ?? s.class ?? "",
          photoUrl: photoUrl,
          selected: false 
        };
      });
      console.log(`[ID Card Gen] Processed ${studentsWithSelection.length} students`);
      setStudents(studentsWithSelection);
      setSelectedClassFilter(ALL_CLASSES_VALUE);
      
      // Show warnings for missing fields
      const missingFields = Array.isArray(data.missing_fields) ? data.missing_fields : [];
      if (missingFields.length > 0) {
        toast.warning(
          `${missingFields.length} student(s) have missing optional fields. ID cards will still generate.`,
          { duration: 5000 }
        );
      }
      
      // Store template layout and metadata
      const meta = data.template_metadata || {};
      const normalizedLayout = normalizeLayout(data.template_layout ?? null, {
        name: selectedTemplate?.name || "Template",
        width_mm: meta.card_width ?? selectedTemplate?.cardWidth ?? 54,
        height_mm: meta.card_height ?? selectedTemplate?.cardHeight ?? 86,
        orientation: (meta.orientation ?? selectedTemplate?.orientation ?? "portrait") as any,
        backgroundImageUrl: meta.background_image_url ?? selectedTemplate?.backgroundImageUrl,
      });
      
      // Debug: Log photo elements to verify photoShape is preserved
      const photoElements = normalizedLayout.elements.filter(el => el.type === 'photo');
      if (photoElements.length > 0) {
        console.log('[ID Card Gen] Photo elements with photoShape:', photoElements.map(el => ({
          id: el.id,
          photoShape: el.photoShape
        })));
      }
      
      console.log('Loaded template layout:', {
        backgroundImageUrl: normalizedLayout.backgroundImageUrl,
        elements: normalizedLayout.elements.length,
        fieldMappings: normalizedLayout.fieldMappings,
      });
      
      setTemplateLayout(normalizedLayout);
      setTemplateMetadata(meta);
      
      toast.success(`Loaded ${studentsWithSelection.length} students`);
    } catch (error: any) {
      toast.error(error.message || "Failed to load students");
    } finally {
      setIsLoading(false);
    }
  };

  const classOptions = Array.from(
    new Set(
      students
        .map(s => String(s.class ?? s.className ?? "").trim())
        .filter(Boolean)
    )
  ).sort();

  const filteredStudents = students.filter(s => {
    const name = (s.name ?? "").toString();
    const admission = (s.admissionNumber ?? s.admission_number ?? "").toString();
    const roll = (s.rollNo ?? s.roll_no ?? "").toString();
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      name.toLowerCase().includes(term) ||
      admission.toLowerCase().includes(term) ||
      roll.toLowerCase().includes(term);
    const studentClass = (s.class ?? s.className ?? "").toString().trim();
    const matchesClass = selectedClassFilter === ALL_CLASSES_VALUE || studentClass === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  const selectedStudents = students.filter(s => s.selected);
  const selectedCount = selectedStudents.length;

  // Fixed counts: A4 = 10 (5×2), 12×18 & 13×19 = 25 (5×5)
  const getCardsPerPage = (sheet: "A4" | "12x18" | "13x19") => {
    if (sheet === "A4") return { cols: 5, rows: 2, total: 10 };
    return { cols: 5, rows: 5, total: 25 };
  };

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
    setShowPreviewDialog(true);
    setPreviewStudent(null);
    setPreviewLayout(null);
    setPreviewLoading(true);
    try {
      const data = await idCardGenerationApi.getPreviewData(student.id, selectedTemplateId);
      setPreviewStudent(data.student as Student);
      const layout = data.template?.templateData;
      if (layout) {
        setPreviewLayout(normalizeLayout(layout, {
          name: data.template?.name || "Template",
          width_mm: data.template?.cardWidth || 54,
          height_mm: data.template?.cardHeight || 86,
          orientation: (data.template?.orientation || "portrait") as any,
          backgroundImageUrl: data.template?.backgroundImageUrl,
        }));
      } else {
        setPreviewLayout(templateLayout);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load preview");
      setShowPreviewDialog(false);
    } finally {
      setPreviewLoading(false);
    }
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

  const renderIDCard = (student: Student, layout: IDCardLayout | null) => {
    if (!layout) return null;
    return <IDCardRenderer layout={layout} student={student} renderHeightPx={400} />;
  };

  /** Fetch image URL to base64 data URL for jsPDF. Tries direct fetch, then backend proxy if CORS blocks. */
  const fetchImageAsDataUrl = async (url: string): Promise<string | null> => {
    if (!url || !url.startsWith("http")) return null;
    const blobToDataUrl = (blob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    try {
      const res = await fetch(url, { mode: "cors", credentials: "omit" });
      if (res.ok) return await blobToDataUrl(await res.blob());
    } catch {
      // CORS or network error – try backend proxy
    }
    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const token = getToken();
      const res = await fetch(
        `${apiBase}/id-cards/proxy-image?url=${encodeURIComponent(url)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (res.ok) return await blobToDataUrl(await res.blob());
    } catch {
      // ignore
    }
    return null;
  };

  /** Load a data URL into an Image for canvas drawing */
  const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });

  /** DPI used for PDF card bitmaps so zoomed view stays sharp */
  const PDF_DPI = 300;

  /** Render a single card to a 300 DPI canvas and return PNG data URL for embedding in PDF */
  const renderCardToHighResDataUrl = async (
    layout: IDCardLayout,
    student: Student,
    cardWidthMm: number,
    cardHeightMm: number,
    imageCache: Map<string, string | null>
  ): Promise<string> => {
    const w = (cardWidthMm / 25.4) * PDF_DPI;
    const h = (cardHeightMm / 25.4) * PDF_DPI;
    const scale = PDF_DPI / 96;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Background
    if (layout.backgroundImageUrl) {
      let dataUrl = imageCache.get(layout.backgroundImageUrl);
      if (dataUrl === undefined) {
        dataUrl = await fetchImageAsDataUrl(layout.backgroundImageUrl);
        imageCache.set(layout.backgroundImageUrl, dataUrl);
      }
      if (dataUrl) {
        try {
          const img = await loadImage(dataUrl);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } catch {
          // skip background
        }
      }
    }

    for (const el of layout.elements || []) {
      const elX = (w * (el.x_percent || 0)) / 100;
      const elY = (h * (el.y_percent || 0)) / 100;
      const elW = (w * (el.width_percent || 0)) / 100;
      const elH = (h * (el.height_percent || 0)) / 100;
      if (elW <= 0 || elH <= 0) continue;

      if (el.type === "text") {
        const value = resolveElementValue(layout, student, el as IDCardElement);
        if (!value) continue;
        const fontSizePx = (el.fontSize || 14) * scale;
        ctx.font = `${el.fontWeight === "bold" ? "bold " : ""}${fontSizePx}px helvetica, Arial, sans-serif`;
        ctx.fillStyle = el.color && /^#([0-9A-Fa-f]{6})$/.test(el.color) ? el.color : "#000000";
        ctx.textBaseline = "top";
        const lineHeight = fontSizePx * 1.2;
        const words = value.split(/\s+/);
        let line = "";
        let y = elY;
        for (const word of words) {
          const test = line ? line + " " + word : word;
          const metrics = ctx.measureText(test);
          if (metrics.width > elW && line) {
            ctx.fillText(line, elX, y, elW);
            line = word;
            y += lineHeight;
          } else {
            line = test;
          }
        }
        if (line) ctx.fillText(line, elX, y, elW);
        continue;
      }

      if (el.type === "photo" || el.type === "logo") {
        const url = resolveElementValue(layout, student, el as IDCardElement);
        if (!url) continue;
        let dataUrl = imageCache.get(url);
        if (dataUrl === undefined) {
          dataUrl = await fetchImageAsDataUrl(url);
          imageCache.set(url, dataUrl);
        }
        if (dataUrl) {
          try {
            const img = await loadImage(dataUrl);
            ctx.drawImage(img, elX, elY, elW, elH);
          } catch {
            // skip image
          }
        }
      }
    }

    return canvas.toDataURL("image/png");
  };

  /** Draw a single ID card on the PDF using jsPDF (no html2canvas = no blank/CORS issues) */
  const drawCardOnPdf = async (
    pdf: jsPDF,
    layout: IDCardLayout,
    student: Student,
    cardX: number,
    cardY: number,
    cardW: number,
    cardH: number,
    imageCache: Map<string, string | null>
  ) => {
    // Background image
    if (layout.backgroundImageUrl) {
      let dataUrl = imageCache.get(layout.backgroundImageUrl);
      if (dataUrl === undefined) {
        dataUrl = await fetchImageAsDataUrl(layout.backgroundImageUrl);
        imageCache.set(layout.backgroundImageUrl, dataUrl);
      }
      if (dataUrl) {
        const fmt = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        try {
          pdf.addImage(dataUrl, fmt, cardX, cardY, cardW, cardH);
        } catch {
          try {
            pdf.addImage(dataUrl, fmt === "PNG" ? "JPEG" : "PNG", cardX, cardY, cardW, cardH);
          } catch {
            // skip background
          }
        }
      }
    }

    const fontSizePt = (px: number) => Math.max(6, (px || 14) * 0.75);

    for (const el of layout.elements || []) {
      // Debug: Log photo elements to verify photoShape
      if (el.type === "photo") {
        console.log('[PDF] Processing photo element:', {
          id: el.id,
          photoShape: el.photoShape,
          x_percent: el.x_percent,
          y_percent: el.y_percent,
          width_percent: el.width_percent,
          height_percent: el.height_percent
        });
      }
      
      const elX = cardX + (cardW * (el.x_percent || 0)) / 100;
      const elY = cardY + (cardH * (el.y_percent || 0)) / 100;
      const elW = (cardW * (el.width_percent || 0)) / 100;
      const elH = (cardH * (el.height_percent || 0)) / 100;
      if (elW <= 0 || elH <= 0) continue;

      if (el.type === "text") {
        const value = resolveElementValue(layout, student, el as IDCardElement);
        if (!value) continue;
        const pt = fontSizePt(el.fontSize || 14);
        pdf.setFontSize(pt);
        const hex = el.color && /^#([0-9A-Fa-f]{6})$/.test(el.color) ? el.color : "#000000";
        pdf.setTextColor(hex);
        pdf.setFont("helvetica", el.fontWeight === "bold" ? "bold" : "normal");
        try {
          pdf.text(value, elX, elY + Math.min(elH - 1, pt * 0.35), { maxWidth: elW });
        } catch {
          pdf.text(value, elX, elY + elH * 0.5, { maxWidth: elW });
        }
        continue;
      }

      if (el.type === "photo" || el.type === "logo") {
        const url = resolveElementValue(layout, student, el as IDCardElement);
        if (!url) continue;
        let dataUrl = imageCache.get(url);
        if (dataUrl === undefined) {
          dataUrl = await fetchImageAsDataUrl(url);
          imageCache.set(url, dataUrl);
        }
        if (dataUrl) {
          const fmt = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
          
          // Apply clipping based on photoShape (only for photos, not logos)
          const photoShape = el.type === "photo" ? (el.photoShape || "rectangle") : "rectangle";
          
          // Debug logging
          if (el.type === "photo") {
            console.log('[PDF Generation] Photo element:', {
              id: el.id,
              photoShape: photoShape,
              elX, elY, elW, elH
            });
          }
          
          // Save graphics state before clipping
          pdf.saveGraphicsState();
          
          try {
            if (photoShape === "circle") {
              // Create circular clipping path using circle method
              const centerX = elX + elW / 2;
              const centerY = elY + elH / 2;
              const radius = Math.min(elW, elH) / 2;
              
              // Use circle method if available, otherwise use ellipse
              if (typeof (pdf as any).circle === 'function') {
                (pdf as any).circle(centerX, centerY, radius);
              } else {
                // Fallback to ellipse
                pdf.ellipse(centerX, centerY, radius, radius, {});
              }
              pdf.clip();
              pdf.addImage(dataUrl, fmt, elX, elY, elW, elH);
            } else if (photoShape === "rounded") {
              // Create rounded rectangle using rect with rounded corners
              const cornerRadius = Math.min(2.12, Math.min(elW, elH) / 4);
              
              // Try using roundedRect if available
              if (typeof (pdf as any).roundedRect === 'function') {
                (pdf as any).roundedRect(elX, elY, elW, elH, cornerRadius);
                pdf.clip();
                pdf.addImage(dataUrl, fmt, elX, elY, elW, elH);
              } else {
                // Fallback: create rounded rectangle using path
                try {
                  pdf.path([
                    ['M', elX + cornerRadius, elY],
                    ['L', elX + elW - cornerRadius, elY],
                    ['Q', elX + elW, elY, elX + elW, elY + cornerRadius],
                    ['L', elX + elW, elY + elH - cornerRadius],
                    ['Q', elX + elW, elY + elH, elX + elW - cornerRadius, elY + elH],
                    ['L', elX + cornerRadius, elY + elH],
                    ['Q', elX, elY + elH, elX, elY + elH - cornerRadius],
                    ['L', elX, elY + cornerRadius],
                    ['Q', elX, elY, elX + cornerRadius, elY],
                    ['Z']
                  ]);
                  pdf.clip();
                  pdf.addImage(dataUrl, fmt, elX, elY, elW, elH);
                } catch (pathError) {
                  console.warn('[PDF] Rounded rectangle path failed, using rectangle:', pathError);
                  pdf.restoreGraphicsState();
                  pdf.addImage(dataUrl, fmt, elX, elY, elW, elH);
                }
              }
            } else {
              // Rectangle or square - no clipping needed
              pdf.addImage(dataUrl, fmt, elX, elY, elW, elH);
            }
          } catch (error) {
            console.error('[PDF] Error applying photo shape clipping:', error, { photoShape, elX, elY, elW, elH });
            // Fallback: try different format without clipping
            try {
              pdf.restoreGraphicsState();
              pdf.addImage(dataUrl, fmt === "PNG" ? "JPEG" : "PNG", elX, elY, elW, elH);
            } catch {
              // skip image
            }
          } finally {
            // Restore graphics state after clipping
            pdf.restoreGraphicsState();
          }
        }
      }
    }
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

      const sheetSize = pdfSheetSize;
      const orientation = selectedTemplate.orientation;

      // Fixed card size from template (same on all sheets)
      const cardWidth = templateLayout.width_mm;
      const cardHeight = templateLayout.height_mm;

      let sheetWidth: number;
      let sheetHeight: number;
      let cardsPerRow: number;
      let cardsPerColumn: number;
      let marginLeft: number;
      let marginRight: number;
      let marginTop: number;
      let marginBottom: number;
      let gap: number;

      if (sheetSize === "A4") {
        gap = 3;
        sheetWidth = 297;
        sheetHeight = 210;
        cardsPerRow = 5;
        cardsPerColumn = 2;
        const m = Math.max(2, Math.min((297 - 5 * cardWidth - 4 * gap) / 2, (210 - 2 * cardHeight - 1 * gap) / 2));
        marginLeft = marginRight = marginTop = marginBottom = m;
      } else if (sheetSize === "12x18") {
        // 12×18: Top/Bottom 7mm, Left/Right 9mm, gap 2mm
        marginTop = marginBottom = 7;
        marginLeft = marginRight = 9;
        gap = 2;
        sheetWidth = 305;
        sheetHeight = 457;
        if (orientation === "landscape") {
          sheetWidth = 457;
          sheetHeight = 305;
        }
        cardsPerRow = 5;
        cardsPerColumn = 5;
      } else {
        gap = 3;
        sheetWidth = 330;
        sheetHeight = 483;
        if (orientation === "landscape") {
          sheetWidth = 483;
          sheetHeight = 330;
        }
        cardsPerRow = 5;
        cardsPerColumn = 5;
        const m = Math.max(2, Math.min((sheetWidth - 5 * cardWidth - 4 * gap) / 2, (sheetHeight - 5 * cardHeight - 4 * gap) / 2));
        marginLeft = marginRight = marginTop = marginBottom = m;
      }

      const cardsPerPage = cardsPerRow * cardsPerColumn;

      const a4Landscape = sheetSize === "A4";
      const pdfFormat =
        sheetSize === "13x19" ? (orientation === "landscape" ? [483, 330] : [330, 483])
        : sheetSize === "12x18" ? (orientation === "landscape" ? [457, 305] : [305, 457])
        : "a4";
      const pdf = new jsPDF({
        orientation: a4Landscape || orientation === "landscape" ? "landscape" : "portrait",
        unit: "mm",
        format: pdfFormat,
      });

      const imageCache = new Map<string, string | null>();
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
          const x = marginLeft + col * (cardWidth + gap);
          const y = marginTop + row * (cardHeight + gap);

          const cardDataUrl = await renderCardToHighResDataUrl(
            templateLayout,
            student,
            cardWidth,
            cardHeight,
            imageCache
          );
          if (cardDataUrl) {
            try {
              pdf.addImage(cardDataUrl, "PNG", x, y, cardWidth, cardHeight);
            } catch {
              try {
                pdf.addImage(cardDataUrl, "JPEG", x, y, cardWidth, cardHeight);
              } catch {
                await drawCardOnPdf(pdf, templateLayout, student, x, y, cardWidth, cardHeight, imageCache);
              }
            }
          } else {
            await drawCardOnPdf(pdf, templateLayout, student, x, y, cardWidth, cardHeight, imageCache);
          }
          // Border around each ID card (light gray stroke)
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineWidth(0.25);
          pdf.rect(x, y, cardWidth, cardHeight);
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div>
                <Label className="mb-2 block">PDF sheet size</Label>
                <Select value={pdfSheetSize} onValueChange={(v: "A4" | "12x18" | "13x19") => setPdfSheetSize(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4 — 5×2 = 10 cards (landscape)</SelectItem>
                    <SelectItem value="12x18">12×18 — 5×5 = 25 cards</SelectItem>
                    <SelectItem value="13x19">13×19 — 5×5 = 25 cards</SelectItem>
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

        {/* Search and Class filter - aligned with Selection Filters above */}
        {students.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div className="relative">
                  <Label className="mb-2 block">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search by name, admission number, or roll number..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Class</Label>
                  <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_CLASSES_VALUE}>All classes</SelectItem>
                      {classOptions.map((cls) => (
                        <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                            <Avatar 
                              className="w-10 h-10"
                              key={`avatar-${student.id}-${student.photoUrl ?? student.photo_url}`}
                            >
                              <AvatarImage 
                                src={student.photoUrl ?? student.photo_url} 
                                alt=""
                                key={`img-${student.id}-${student.photoUrl ?? student.photo_url}`}
                                loading="eager"
                              />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {((student.name ?? "").toString().split(" ").map((n: string) => n[0] || "").join("") || "?").substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{student.name ?? ""}</span>
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
            {previewLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewStudent && (previewLayout || templateLayout) ? (
              <div className="flex justify-center">
                {renderIDCard(previewStudent, previewLayout || templateLayout)}
              </div>
            ) : null}
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