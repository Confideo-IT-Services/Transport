import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  IndianRupee, 
  Plus, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  Bell,
  Search,
  Eye,
  Loader2,
  Edit,
  X,
  MoreVertical
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { feesApi, classesApi, academicYearsApi } from "@/lib/api";
import { format } from "date-fns";

export default function FeesModule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  
  // State
  const [loading, setLoading] = useState(true);
  const [studentFees, setStudentFees] = useState<any[]>([]);
  const [feeStructure, setFeeStructure] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalCollected: 0,
    totalPending: 0,
    fullyPaidCount: 0,
    unpaidCount: 0
  });
  
  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [isViewStudentFeeOpen, setIsViewStudentFeeOpen] = useState(false);
  const [isEditStructureOpen, setIsEditStructureOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isCreateFeeOpen, setIsCreateFeeOpen] = useState(false);
  const [isEditFeeOpen, setIsEditFeeOpen] = useState(false);
  const [editingStudentFee, setEditingStudentFee] = useState<any>(null);
  const [selectedStudentFee, setSelectedStudentFee] = useState<any>(null);
  const [studentFeeDetails, setStudentFeeDetails] = useState<any>(null);
  const [selectedStudentForFee, setSelectedStudentForFee] = useState<any>(null);
  const [newPayment, setNewPayment] = useState({
    component: "",
    amount: "",
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "cash" as "cash" | "cheque" | "online" | "bank_transfer",
    transactionId: "",
    receiptNumber: "",
    remarks: ""
  });
  const [feeStructureForStudent, setFeeStructureForStudent] = useState<any>(null);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [breakdownData, setBreakdownData] = useState<any>(null);
  const [newStudentFee, setNewStudentFee] = useState({
    academicYearId: "",
    frequency: "yearly" as "yearly" | "quarterly" | "monthly",
    tuitionFee: "",
    transportFee: "",
    labFee: "",
    otherComponents: [] as Array<{ id: string; name: string; amount: string }>,
    dueDate: format(new Date(), "yyyy-MM-dd")
  });
  const [editingStructure, setEditingStructure] = useState<any>(null);
  const [structureForm, setStructureForm] = useState({
    classId: "",
    academicYearId: "",
    frequency: "yearly" as "yearly" | "quarterly" | "monthly",
    tuitionFee: "",
    transportFee: "",
    labFee: "",
    otherComponents: [] as Array<{ id: string; name: string; amount: string }>
  });

  // Load classes and academic years
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [classesData, yearsData] = await Promise.all([
          classesApi.getAll(),
          academicYearsApi.getAll().catch(() => [])
        ]);
        setClasses(classesData || []);
        setAcademicYears(yearsData || []);
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };
    loadInitialData();
  }, []);

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [feesData, structureData, summaryData] = await Promise.all([
          feesApi.getStudentFees(selectedClassId !== "all" ? selectedClassId : undefined, searchTerm || undefined),
          feesApi.getFeeStructure(),
          feesApi.getSummary()
        ]);
        
        setStudentFees(feesData || []);
        setFeeStructure(structureData || []);
        setSummary(summaryData || {
          totalCollected: 0,
          totalPending: 0,
          fullyPaidCount: 0,
          unpaidCount: 0
        });
      } catch (error: any) {
        console.error('Error loading fees data:', error);
        toast({
          title: "Error",
          description: error?.message || "Failed to load fees data",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedClassId, searchTerm, toast]);

  // Filter students
  const filteredStudents = studentFees.filter(s => {
    if (selectedClassId !== "all" && s.classId !== selectedClassId) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        s.studentName?.toLowerCase().includes(search) ||
        s.rollNo?.toString().includes(search)
      );
    }
    return true;
  });

  // Handlers
  const handleViewStudentFee = async (studentFee: any) => {
    try {
      setSelectedStudentFee(studentFee);
      setIsViewStudentFeeOpen(true);
      
      const details = await feesApi.getStudentFeeById(studentFee.studentId);
      setStudentFeeDetails(details);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load student fee details",
        variant: "destructive"
      });
    }
  };

  const handleOpenRecordPayment = async (studentFee: any) => {
    setSelectedStudentFee(studentFee);
    setIsRecordPaymentOpen(true);
    
    // Fetch fee structure for this student's class
    try {
      const structures = await feesApi.getFeeStructure();
      const structure = structures.find((s: any) => s.classId === studentFee.classId);
      setFeeStructureForStudent(structure);
    } catch (error) {
      console.error('Error fetching fee structure:', error);
    }
  };

  const handleRecordPayment = async () => {
    try {
      if (!selectedStudentFee || !newPayment.amount || !newPayment.component) {
        toast({
          title: "Error",
          description: "Please fill in all required fields including component",
          variant: "destructive"
        });
        return;
      }

      await feesApi.recordPayment({
        studentFeeId: selectedStudentFee.id,
        amount: parseFloat(newPayment.amount),
        paymentDate: newPayment.paymentDate,
        paymentMethod: newPayment.paymentMethod,
        component: newPayment.component,
        transactionId: newPayment.transactionId || undefined,
        receiptNumber: newPayment.receiptNumber || undefined,
        remarks: newPayment.remarks || undefined
      });

      toast({
        title: "Success",
        description: "Payment recorded successfully"
      });

      setIsRecordPaymentOpen(false);
      setFeeStructureForStudent(null);
      setNewPayment({
        component: "",
        amount: "",
        paymentDate: format(new Date(), "yyyy-MM-dd"),
        paymentMethod: "cash",
        transactionId: "",
        receiptNumber: "",
        remarks: ""
      });
      
      // Reload data
      const [feesData, summaryData] = await Promise.all([
        feesApi.getStudentFees(selectedClassId !== "all" ? selectedClassId : undefined, searchTerm || undefined),
        feesApi.getSummary()
      ]);
      setStudentFees(feesData || []);
      setSummary(summaryData || summary);
      
      // Reload student fee details if dialog is open
      if (selectedStudentFee) {
        const details = await feesApi.getStudentFeeById(selectedStudentFee.studentId);
        setStudentFeeDetails(details);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to record payment",
        variant: "destructive"
      });
    }
  };

  const handleSendReminder = async (studentFee: any) => {
    try {
      // Fetch reminder data from backend
      const result = await feesApi.sendReminder(studentFee.studentId);
      
      if (!result.parentPhone) {
        toast({
          title: "Error",
          description: "Parent phone number is not available for this student",
          variant: "destructive"
        });
        return;
      }

      // Generate WhatsApp message
      const message = `Dear Parent,

This is a reminder regarding fee payment for your child *${result.studentName}* (${result.className}).

*Pending Amount:* ₹${result.pendingAmount.toLocaleString('en-IN')}

Please clear the dues at the earliest to avoid any inconvenience.

Thank you,
${result.schoolName}`;

      // Create WhatsApp Web URL
      const phoneNumber = result.parentPhone.replace(/\D/g, ''); // Remove all non-digits
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/91${phoneNumber}?text=${encodedMessage}`;
      
      // Open WhatsApp Web
      window.open(whatsappUrl, "_blank");
      
      toast({
        title: "WhatsApp Opened",
        description: `Sending fee reminder to ${result.studentName}'s parent`
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to send reminder",
        variant: "destructive"
      });
    }
  };

  const handleViewBreakdown = async (studentFee: any, type: 'paid' | 'pending') => {
    try {
      if (!studentFee.hasFeeRecord) {
        toast({
          title: "Info",
          description: "No fee record found for this student",
          variant: "default"
        });
        return;
      }

      const breakdown = await feesApi.getComponentBreakdown(studentFee.studentId);
      setBreakdownData({ ...breakdown, type });
      setSelectedStudentFee(studentFee);
      setIsBreakdownOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load breakdown",
        variant: "destructive"
      });
    }
  };

  const handleExportReport = () => {
    toast({
      title: "Coming Soon",
      description: "Export functionality will be available soon"
    });
  };

  // Calculate total fee from all components
  const calculateTotalFee = () => {
    const tuition = parseFloat(structureForm.tuitionFee) || 0;
    const transport = parseFloat(structureForm.transportFee) || 0;
    const lab = parseFloat(structureForm.labFee) || 0;
    const other = structureForm.otherComponents.reduce((sum, comp) => {
      return sum + (parseFloat(comp.amount) || 0);
    }, 0);
    return tuition + transport + lab + other;
  };

  // Calculate total fee for student fee form
  const calculateStudentFeeTotal = () => {
    const tuition = parseFloat(newStudentFee.tuitionFee) || 0;
    const transport = parseFloat(newStudentFee.transportFee) || 0;
    const lab = parseFloat(newStudentFee.labFee) || 0;
    const other = newStudentFee.otherComponents.reduce((sum, comp) => {
      return sum + (parseFloat(comp.amount) || 0);
    }, 0);
    return tuition + transport + lab + other;
  };

  // Add new fee component
  const handleAddComponent = () => {
    const newId = `comp-${Date.now()}`;
    setStructureForm({
      ...structureForm,
      otherComponents: [
        ...structureForm.otherComponents,
        { id: newId, name: "", amount: "" }
      ]
    });
  };

  // Remove fee component
  const handleRemoveComponent = (id: string) => {
    setStructureForm({
      ...structureForm,
      otherComponents: structureForm.otherComponents.filter(comp => comp.id !== id)
    });
  };

  const handleCreateStudentFee = async () => {
    try {
      if (!selectedStudentForFee || !newStudentFee.tuitionFee) {
        toast({
          title: "Error",
          description: "Please enter at least tuition fee",
          variant: "destructive"
        });
        return;
      }

      const totalFee = calculateStudentFeeTotal();
      
      // Format other components
      const components = newStudentFee.otherComponents
        .filter(comp => comp.name && comp.amount)
        .map(comp => ({
          id: comp.id,
          name: comp.name,
          amount: parseFloat(comp.amount) || 0
        }));

      // Store frequency in metadata within otherFees
      const otherFees = components.length > 0 || newStudentFee.frequency ? {
        components: components,
        _metadata: {
          frequency: newStudentFee.frequency
        }
      } : undefined;

      if (editingStudentFee) {
        // Update existing fee
        // Get the student fee ID - it should be in feeId, id, or fee_id
        const studentFeeId = editingStudentFee.feeId || editingStudentFee.id || editingStudentFee.fee_id;
        if (!studentFeeId) {
          toast({
            title: "Error",
            description: "Student fee ID not found. Please try again.",
            variant: "destructive"
          });
          return;
        }
        
        await feesApi.updateStudentFee(studentFeeId, {
          totalFee: totalFee,
          tuitionFee: parseFloat(newStudentFee.tuitionFee) || 0,
          transportFee: parseFloat(newStudentFee.transportFee) || 0,
          labFee: parseFloat(newStudentFee.labFee) || 0,
          otherFees: otherFees,
          frequency: newStudentFee.frequency,
          dueDate: newStudentFee.dueDate || undefined
        });

        toast({
          title: "Success",
          description: "Student fee updated successfully"
        });
      } else {
        // Create new fee
        const result = await feesApi.createStudentFee({
          studentId: selectedStudentForFee.studentId,
          classId: selectedStudentForFee.classId,
          academicYearId: newStudentFee.academicYearId || undefined,
          totalFee: totalFee,
          tuitionFee: parseFloat(newStudentFee.tuitionFee) || 0,
          transportFee: parseFloat(newStudentFee.transportFee) || 0,
          labFee: parseFloat(newStudentFee.labFee) || 0,
          otherFees: otherFees,
          frequency: newStudentFee.frequency,
          dueDate: newStudentFee.dueDate || undefined
        });

        toast({
          title: "Success",
          description: result.updated ? "Student fee updated successfully" : "Student fee created successfully"
        });
      }

      setIsCreateFeeOpen(false);
      setIsEditFeeOpen(false);
      setSelectedStudentForFee(null);
      setEditingStudentFee(null);
      setNewStudentFee({
        academicYearId: "",
        frequency: "yearly",
        tuitionFee: "",
        transportFee: "",
        labFee: "",
        otherComponents: [],
        dueDate: format(new Date(), "yyyy-MM-dd")
      });
      
      // Reload data
      const feesData = await feesApi.getStudentFees(
        selectedClassId !== "all" ? selectedClassId : undefined, 
        searchTerm || undefined
      );
      setStudentFees(feesData || []);
      
      // Reload summary
      const summaryData = await feesApi.getSummary();
      setSummary(summaryData || summary);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create student fee",
        variant: "destructive"
      });
    }
  };


  const handleOpenEditStructure = (structure?: any) => {
    if (structure) {
      // Editing existing structure
      setEditingStructure(structure);
      
      // Parse otherFees if it exists
      let otherComponents: Array<{ id: string; name: string; amount: string }> = [];
      let frequency: "yearly" | "quarterly" | "monthly" = "yearly";
      
      if (structure.otherFees) {
        try {
          const parsed = typeof structure.otherFees === 'string' 
            ? JSON.parse(structure.otherFees) 
            : structure.otherFees;
          
          // Handle new structure with metadata
          if (parsed && parsed.components && Array.isArray(parsed.components)) {
            otherComponents = parsed.components.map((item: any, index: number) => ({
              id: item.id || `comp-${index}-${Date.now()}`,
              name: item.name || "",
              amount: item.amount?.toString() || ""
            }));
            // Extract frequency from metadata
            if (parsed._metadata && parsed._metadata.frequency) {
              frequency = parsed._metadata.frequency;
            }
          } 
          // Handle old structure (direct array)
          else if (Array.isArray(parsed)) {
            otherComponents = parsed.map((item: any, index: number) => ({
              id: item.id || `comp-${index}-${Date.now()}`,
              name: item.name || "",
              amount: item.amount?.toString() || ""
            }));
          }
        } catch (e) {
          console.error('Error parsing otherFees:', e);
        }
      }
      
      // Use frequency from structure if available
      if (structure.frequency) {
        frequency = structure.frequency;
      }
      
      setStructureForm({
        classId: structure.classId || "",
        academicYearId: structure.academicYearId || "",
        frequency: frequency,
        tuitionFee: structure.tuitionFee?.toString() || "",
        transportFee: structure.transportFee?.toString() || "",
        labFee: structure.labFee?.toString() || "",
        otherComponents
      });
    } else {
      // Creating new structure
      setEditingStructure(null);
      setStructureForm({
        classId: "",
        academicYearId: "",
        tuitionFee: "",
        transportFee: "",
        labFee: "",
        otherComponents: []
      });
    }
    setIsEditStructureOpen(true);
  };

  const handleSaveStructure = async () => {
    try {
      if (!structureForm.classId || !structureForm.tuitionFee) {
        toast({
          title: "Error",
          description: "Please select a class and enter at least tuition fee",
          variant: "destructive"
        });
        return;
      }

      const totalFee = calculateTotalFee();
      
      if (totalFee <= 0) {
        toast({
          title: "Error",
          description: "Total fee must be greater than 0. Please enter at least one fee component.",
          variant: "destructive"
        });
        return;
      }

      // Format other components for storage with metadata
      const components = structureForm.otherComponents
        .filter(comp => comp.name && comp.amount)
        .map(comp => ({
          id: comp.id,
          name: comp.name,
          amount: parseFloat(comp.amount) || 0
        }));

      // Store frequency in metadata within otherFees
      const otherFees = components.length > 0 || structureForm.frequency ? {
        components: components,
        _metadata: {
          frequency: structureForm.frequency
        }
      } : undefined;

      await feesApi.updateFeeStructure({
        classId: structureForm.classId,
        academicYearId: structureForm.academicYearId || undefined,
        totalFee: totalFee,
        tuitionFee: parseFloat(structureForm.tuitionFee) || 0,
        transportFee: parseFloat(structureForm.transportFee) || 0,
        labFee: parseFloat(structureForm.labFee) || 0,
        otherFees: otherFees,
        frequency: structureForm.frequency
      });

      toast({
        title: "Success",
        description: editingStructure 
          ? "Fee structure updated successfully" 
          : "Fee structure created successfully. Student fees will be auto-created for all approved students in this class."
      });

      setIsEditStructureOpen(false);
      setEditingStructure(null);
      setStructureForm({
        classId: "",
        academicYearId: "",
        frequency: "yearly",
        tuitionFee: "",
        transportFee: "",
        labFee: "",
        otherComponents: []
      });

      // Reload fee structure and student fees (student fees are auto-created from structure)
      const [structureData, feesData, summaryData] = await Promise.all([
        feesApi.getFeeStructure(),
        feesApi.getStudentFees(selectedClassId !== "all" ? selectedClassId : undefined, searchTerm || undefined),
        feesApi.getSummary()
      ]);
      setFeeStructure(structureData || []);
      setStudentFees(feesData || []);
      setSummary(summaryData || summary);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save fee structure",
        variant: "destructive"
      });
    }
  };

  const handleDeleteStructure = async (structureId: string) => {
    if (!confirm('Are you sure you want to delete this fee structure? This action cannot be undone.')) {
      return;
    }

    try {
      await feesApi.deleteFeeStructure(structureId);
      toast({
        title: "Success",
        description: "Fee structure deleted successfully"
      });
      
      // Reload fee structure
      const structures = await feesApi.getFeeStructure();
      setFeeStructure(structures || []);
      
      // Reload student fees to reflect changes
      const feesData = await feesApi.getStudentFees(
        selectedClassId !== "all" ? selectedClassId : undefined, 
        searchTerm || undefined
      );
      setStudentFees(feesData || []);
      
      // Reload summary
      const summaryData = await feesApi.getSummary();
      setSummary(summaryData || summary);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete fee structure",
        variant: "destructive"
      });
    }
  };

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Fee Management</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? "Manage fee structure and track payments"
                : "View student fee status (Read-only)"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isAdmin && (
              <Badge variant="secondary" className="text-xs">
                <Eye className="w-3 h-3 mr-1" />
                View Only
              </Badge>
            )}
            <Button variant="outline" onClick={handleExportReport}>
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <IndianRupee className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">₹{summary.totalCollected.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Collected</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">₹{summary.totalPending.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.fullyPaidCount}</p>
                  <p className="text-sm text-muted-foreground">Fully Paid</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.unpaidCount}</p>
                  <p className="text-sm text-muted-foreground">Unpaid</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="students" className="space-y-6">
          <TabsList>
            <TabsTrigger value="students">Student Fees</TabsTrigger>
            {isAdmin && <TabsTrigger value="structure">Fee Structure</TabsTrigger>}
          </TabsList>

          {/* Student Fees */}
          <TabsContent value="students" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Student Fee Status</CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search by name or roll no..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}{cls.section ? ` - Section ${cls.section}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No approved students found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roll No</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Total Fee</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Pending</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>{student.rollNo || '-'}</TableCell>
                          <TableCell className="font-medium">{student.studentName}</TableCell>
                          <TableCell>{student.className}{student.classSection ? ` - ${student.classSection}` : ''}</TableCell>
                          <TableCell>
                            {student.status === 'no-fee' || !student.hasFeeRecord ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              `₹${student.totalFee.toLocaleString()}`
                            )}
                          </TableCell>
                          <TableCell 
                            className={`text-secondary ${student.hasFeeRecord ? 'cursor-pointer hover:underline' : ''}`}
                            onClick={() => student.hasFeeRecord && handleViewBreakdown(student, 'paid')}
                          >
                            {student.status === 'no-fee' || !student.hasFeeRecord ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              `₹${student.paidAmount.toLocaleString()}`
                            )}
                          </TableCell>
                          <TableCell 
                            className={`${student.pendingAmount > 0 ? "text-destructive" : ""} ${student.hasFeeRecord ? 'cursor-pointer hover:underline' : ''}`}
                            onClick={() => student.hasFeeRecord && handleViewBreakdown(student, 'pending')}
                          >
                            {student.status === 'no-fee' || !student.hasFeeRecord ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              `₹${student.pendingAmount.toLocaleString()}`
                            )}
                          </TableCell>
                          <TableCell>
                            {student.status === 'no-fee' || !student.hasFeeRecord ? (
                              <Badge variant="outline" className="bg-muted">
                                No Fee
                              </Badge>
                            ) : (
                              <Badge 
                                className={
                                  student.status === "paid" ? "bg-secondary" : 
                                  student.status === "partial" ? "bg-accent" : "bg-destructive"
                                }
                              >
                                {student.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isAdmin ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewStudentFee(student)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSendReminder(student)}>
                                    <Bell className="w-4 h-4 mr-2" />
                                    Remind
                                  </DropdownMenuItem>
                                  {student.hasFeeRecord ? (
                                    <DropdownMenuItem onClick={async () => {
                                      try {
                                        // Fetch existing fee details
                                        const feeDetails = await feesApi.getStudentFeeById(student.studentId);
                                        setEditingStudentFee({
                                          ...student,
                                          feeId: feeDetails.id || student.feeId || student.id
                                        });
                                        setSelectedStudentForFee(student);
                                        
                                        // Load existing fee data
                                        const otherFees = feeDetails.otherFees || {};
                                        const components = otherFees.components || [];
                                        
                                        setNewStudentFee({
                                          academicYearId: feeDetails.academicYearId || "",
                                          frequency: otherFees._metadata?.frequency || "yearly",
                                          tuitionFee: feeDetails.tuitionFee?.toString() || "",
                                          transportFee: feeDetails.transportFee?.toString() || "",
                                          labFee: feeDetails.labFee?.toString() || "",
                                          otherComponents: components.map((c: any) => ({
                                            id: `comp-${Date.now()}-${Math.random()}`,
                                            name: c.name || "",
                                            amount: c.amount?.toString() || ""
                                          })),
                                          dueDate: feeDetails.dueDate || format(new Date(), "yyyy-MM-dd")
                                        });
                                        
                                        setIsEditFeeOpen(true);
                                      } catch (error: any) {
                                        toast({
                                          title: "Error",
                                          description: error?.message || "Failed to load fee details",
                                          variant: "destructive"
                                        });
                                      }
                                    }}>
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit Fee
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedStudentForFee(student);
                                      setEditingStudentFee(null);
                                      
                                      // Replicate the fee structure for this student's class
                                      // This pre-fills the form with class structure, but all fields are editable
                                      // to allow applying discounts for individual students
                                      const classStructure = feeStructure.find(f => f.classId === student.classId);
                                      if (classStructure) {
                                        // Pre-fill with class structure - all fields editable for discounts
                                        const otherFees = classStructure.otherFees || {};
                                        const components = otherFees.components || [];
                                        
                                        setNewStudentFee({
                                          academicYearId: classStructure.academicYearId || "",
                                          frequency: otherFees._metadata?.frequency || "yearly",
                                          tuitionFee: classStructure.tuitionFee?.toString() || "",
                                          transportFee: classStructure.transportFee?.toString() || "",
                                          labFee: classStructure.labFee?.toString() || "",
                                          otherComponents: components.map((c: any) => ({
                                            id: `comp-${Date.now()}-${Math.random()}`,
                                            name: c.name || "",
                                            amount: c.amount?.toString() || ""
                                          })),
                                          dueDate: format(new Date(), "yyyy-MM-dd")
                                        });
                                      } else {
                                        // No class structure - empty form
                                        setNewStudentFee({
                                          academicYearId: "",
                                          frequency: "yearly",
                                          tuitionFee: "",
                                          transportFee: "",
                                          labFee: "",
                                          otherComponents: [],
                                          dueDate: format(new Date(), "yyyy-MM-dd")
                                        });
                                      }
                                      setIsCreateFeeOpen(true);
                                    }}>
                                      <Plus className="w-4 h-4 mr-2" />
                                      Create Fee
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleOpenRecordPayment(student)}>
                                    <IndianRupee className="w-4 h-4 mr-2" />
                                    Record Payment
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <div className="flex justify-end gap-2">
                                {student.pendingAmount > 0 && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleSendReminder(student)}
                                  >
                                    <Bell className="w-4 h-4 mr-1" />
                                    Remind
                                  </Button>
                                )}
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleViewStudentFee(student)}
                                >
                                  View
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fee Structure (Admin Only) */}
          {isAdmin && (
            <TabsContent value="structure" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">Class-wise Fee Structure</h2>
                <Button size="sm" onClick={() => handleOpenEditStructure()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Structure
                </Button>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : feeStructure.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <p>No fee structure defined. Click "Edit Structure" to add one.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Tuition</TableHead>
                        <TableHead>Transport</TableHead>
                        <TableHead>Lab</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feeStructure.map((fee) => {
                        // Extract frequency from otherFees metadata
                        let frequency = "Yearly";
                        if (fee.otherFees) {
                          try {
                            const parsed = typeof fee.otherFees === 'string' 
                              ? JSON.parse(fee.otherFees) 
                              : fee.otherFees;
                            if (parsed && parsed._metadata && parsed._metadata.frequency) {
                              frequency = parsed._metadata.frequency.charAt(0).toUpperCase() + parsed._metadata.frequency.slice(1);
                            }
                          } catch (e) {
                            // Ignore
                          }
                        } else if (fee.frequency) {
                          frequency = fee.frequency.charAt(0).toUpperCase() + fee.frequency.slice(1);
                        }
                        
                        return (
                          <TableRow key={fee.id}>
                            <TableCell className="font-medium">
                              {fee.className}{fee.classSection ? ` - ${fee.classSection}` : ''}
                              {fee.academicYearName && (
                                <span className="text-xs text-muted-foreground block mt-1">
                                  {fee.academicYearName}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{frequency}</Badge>
                            </TableCell>
                            <TableCell>₹{fee.tuitionFee.toLocaleString()}</TableCell>
                            <TableCell>₹{fee.transportFee.toLocaleString()}</TableCell>
                            <TableCell>₹{fee.labFee.toLocaleString()}</TableCell>
                            <TableCell className="font-semibold">₹{fee.totalFee.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenEditStructure(fee)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteStructure(fee.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>
          )}

        </Tabs>

        {/* View Student Fee Dialog */}
        <Dialog open={isViewStudentFeeOpen} onOpenChange={setIsViewStudentFeeOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Student Fee Details</DialogTitle>
              <DialogDescription>
                {selectedStudentFee?.studentName} - {selectedStudentFee?.className}
              </DialogDescription>
            </DialogHeader>
            {studentFeeDetails ? (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Total Fee</Label>
                    <p className="text-2xl font-bold">₹{studentFeeDetails.totalFee.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Pending Amount</Label>
                    <p className={`text-2xl font-bold ${studentFeeDetails.pendingAmount > 0 ? 'text-destructive' : 'text-secondary'}`}>
                      ₹{studentFeeDetails.pendingAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Paid Amount</Label>
                    <p className="text-2xl font-bold text-secondary">₹{studentFeeDetails.paidAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-2">
                      <Badge 
                        className={
                          studentFeeDetails.status === "paid" ? "bg-secondary" : 
                          studentFeeDetails.status === "partial" ? "bg-accent" : "bg-destructive"
                        }
                      >
                        {studentFeeDetails.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {studentFeeDetails.payments && studentFeeDetails.payments.length > 0 && (
                  <div>
                    <Label className="text-lg font-semibold">Payment History</Label>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Receipt No</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentFeeDetails.payments.map((payment: any) => (
                          <TableRow key={payment.id}>
                            <TableCell>{format(new Date(payment.paymentDate), "dd MMM yyyy")}</TableCell>
                            <TableCell>₹{payment.amount.toLocaleString()}</TableCell>
                            <TableCell className="capitalize">{payment.paymentMethod}</TableCell>
                            <TableCell>{payment.receiptNumber || '-'}</TableCell>
                            <TableCell>{payment.remarks || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <DialogFooter>
              {selectedStudentFee && selectedStudentFee.pendingAmount > 0 && (
                <Button onClick={() => {
                  setIsViewStudentFeeOpen(false);
                  handleOpenRecordPayment(selectedStudentFee);
                }}>
                  Record Payment
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsViewStudentFeeOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Record Payment Dialog */}
        <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                {selectedStudentFee?.studentName} - Pending: ₹{selectedStudentFee?.pendingAmount.toLocaleString()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Component *</Label>
                <Select 
                  value={newPayment.component || undefined} 
                  onValueChange={(value) => setNewPayment({...newPayment, component: value})}
                  disabled={!feeStructureForStudent}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fee component" />
                  </SelectTrigger>
                  <SelectContent>
                    {feeStructureForStudent ? (
                      <>
                        {feeStructureForStudent.tuitionFee > 0 && (
                          <SelectItem value="tuition_fee">Tuition Fee (₹{feeStructureForStudent.tuitionFee.toLocaleString()})</SelectItem>
                        )}
                        {feeStructureForStudent.transportFee > 0 && (
                          <SelectItem value="transport_fee">Transport Fee (₹{feeStructureForStudent.transportFee.toLocaleString()})</SelectItem>
                        )}
                        {feeStructureForStudent.labFee > 0 && (
                          <SelectItem value="lab_fee">Lab Fee (₹{feeStructureForStudent.labFee.toLocaleString()})</SelectItem>
                        )}
                        {feeStructureForStudent.otherFees?.components?.map((comp: any) => {
                          const compKey = comp.name.toLowerCase().replace(/\s+/g, '_');
                          return (
                            <SelectItem key={comp.name} value={compKey}>
                              {comp.name} (₹{comp.amount.toLocaleString()})
                            </SelectItem>
                          );
                        })}
                      </>
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No fee structure found for this class
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input 
                  type="number"
                  placeholder="Enter amount"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Date *</Label>
                <Input 
                  type="date"
                  value={newPayment.paymentDate}
                  onChange={(e) => setNewPayment({...newPayment, paymentDate: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select 
                  value={newPayment.paymentMethod} 
                  onValueChange={(value: any) => setNewPayment({...newPayment, paymentMethod: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Transaction ID (Optional)</Label>
                <Input 
                  placeholder="Enter transaction ID"
                  value={newPayment.transactionId}
                  onChange={(e) => setNewPayment({...newPayment, transactionId: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Receipt Number (Optional)</Label>
                <Input 
                  placeholder="Enter receipt number"
                  value={newPayment.receiptNumber}
                  onChange={(e) => setNewPayment({...newPayment, receiptNumber: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Remarks (Optional)</Label>
                <Input 
                  placeholder="Enter remarks"
                  value={newPayment.remarks}
                  onChange={(e) => setNewPayment({...newPayment, remarks: e.target.value})}
                />
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsRecordPaymentOpen(false);
                    setFeeStructureForStudent(null);
                    setNewPayment({
                      component: "",
                      amount: "",
                      paymentDate: format(new Date(), "yyyy-MM-dd"),
                      paymentMethod: "cash",
                      transactionId: "",
                      receiptNumber: "",
                      remarks: ""
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleRecordPayment}>Record Payment</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create/Edit Fee for Individual Student Dialog */}
        <Dialog open={isCreateFeeOpen || isEditFeeOpen} onOpenChange={(open) => {
          if (!open) {
            setIsCreateFeeOpen(false);
            setIsEditFeeOpen(false);
            setSelectedStudentForFee(null);
            setEditingStudentFee(null);
            setNewStudentFee({
              academicYearId: "",
              frequency: "yearly",
              tuitionFee: "",
              transportFee: "",
              labFee: "",
              otherComponents: [],
              dueDate: format(new Date(), "yyyy-MM-dd")
            });
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingStudentFee ? "Edit Fee for Student" : "Create Fee for Student"}
              </DialogTitle>
              <DialogDescription>
                {selectedStudentForFee?.studentName} - {selectedStudentForFee?.className}
                <br />
                <span className="text-xs text-muted-foreground">
                  {editingStudentFee 
                    ? "Edit this student's fee structure (apply discounts or modify amounts)"
                    : "Fee structure pre-filled from class template. Edit amounts to apply discounts for this student."}
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Academic Year */}
              <div className="space-y-2">
                <Label>Academic Year (Optional)</Label>
                <Select 
                  value={newStudentFee.academicYearId || undefined} 
                  onValueChange={(value) => setNewStudentFee({...newStudentFee, academicYearId: value || ""})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select academic year (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Frequency */}
              <div className="space-y-2">
                <Label>Frequency *</Label>
                <Select 
                  value={newStudentFee.frequency} 
                  onValueChange={(value: "yearly" | "quarterly" | "monthly") => setNewStudentFee({...newStudentFee, frequency: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fee Components */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Fee Components</Label>
                  <Button 
                    type="button"
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      const newId = `comp-${Date.now()}-${Math.random()}`;
                      setNewStudentFee({
                        ...newStudentFee,
                        otherComponents: [
                          ...newStudentFee.otherComponents,
                          { id: newId, name: "", amount: "" }
                        ]
                      });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Component
                  </Button>
                </div>

                {/* Tuition Fee */}
                <div className="space-y-2">
                  <Label>Tuition Fee (₹) *</Label>
                  <Input 
                    type="number"
                    placeholder="Enter tuition fee"
                    value={newStudentFee.tuitionFee}
                    onChange={(e) => setNewStudentFee({...newStudentFee, tuitionFee: e.target.value})}
                  />
                </div>

                {/* Transport Fee */}
                <div className="space-y-2">
                  <Label>Transport Fee (₹)</Label>
                  <Input 
                    type="number"
                    placeholder="Enter transport fee"
                    value={newStudentFee.transportFee}
                    onChange={(e) => setNewStudentFee({...newStudentFee, transportFee: e.target.value})}
                  />
                </div>

                {/* Lab Fee */}
                <div className="space-y-2">
                  <Label>Lab Fee (₹)</Label>
                  <Input 
                    type="number"
                    placeholder="Enter lab fee"
                    value={newStudentFee.labFee}
                    onChange={(e) => setNewStudentFee({...newStudentFee, labFee: e.target.value})}
                  />
                </div>

                {/* Other Components */}
                {newStudentFee.otherComponents.map((component) => (
                  <div key={component.id} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Component Name</Label>
                      <Input 
                        placeholder="e.g., Sports Fee, Library Fee"
                        value={component.name}
                        onChange={(e) => {
                          const updated = newStudentFee.otherComponents.map(comp =>
                            comp.id === component.id ? { ...comp, name: e.target.value } : comp
                          );
                          setNewStudentFee({...newStudentFee, otherComponents: updated});
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>Amount (₹)</Label>
                      <Input 
                        type="number"
                        placeholder="Enter amount"
                        value={component.amount}
                        onChange={(e) => {
                          const updated = newStudentFee.otherComponents.map(comp =>
                            comp.id === component.id ? { ...comp, amount: e.target.value } : comp
                          );
                          setNewStudentFee({...newStudentFee, otherComponents: updated});
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNewStudentFee({
                          ...newStudentFee,
                          otherComponents: newStudentFee.otherComponents.filter(comp => comp.id !== component.id)
                        });
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Total Fee (Read-only, Auto-calculated) */}
              <div className="space-y-2 border-t pt-4">
                <Label>Total Fee (₹) - Auto Calculated</Label>
                <Input 
                  type="number"
                  value={calculateStudentFeeTotal().toFixed(2)}
                  readOnly
                  className="bg-muted font-semibold text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Total = Tuition + Transport + Lab + Other Components
                </p>
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label>Due Date (Optional)</Label>
                <Input 
                  type="date"
                  value={newStudentFee.dueDate}
                  onChange={(e) => setNewStudentFee({...newStudentFee, dueDate: e.target.value})}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsCreateFeeOpen(false);
                  setIsEditFeeOpen(false);
                  setSelectedStudentForFee(null);
                  setEditingStudentFee(null);
                  setNewStudentFee({
                    academicYearId: "",
                    frequency: "yearly",
                    tuitionFee: "",
                    transportFee: "",
                    labFee: "",
                    otherComponents: [],
                    dueDate: format(new Date(), "yyyy-MM-dd")
                  });
                }}>
                  Cancel
                </Button>
                <Button onClick={handleCreateStudentFee}>
                  {editingStudentFee ? "Update Fee" : "Create Fee"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Fee Structure Dialog */}
        <Dialog open={isEditStructureOpen} onOpenChange={setIsEditStructureOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingStructure ? "Edit Fee Structure" : "Add Fee Structure"}
              </DialogTitle>
              <DialogDescription>
                {editingStructure 
                  ? "Update the fee structure for the selected class"
                  : "Define fee structure for a class"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select 
                  value={structureForm.classId} 
                  onValueChange={(value) => setStructureForm({...structureForm, classId: value})}
                  disabled={!!editingStructure}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}{cls.section ? ` - Section ${cls.section}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingStructure && (
                  <p className="text-xs text-muted-foreground">
                    Class cannot be changed when editing
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Academic Year (Optional)</Label>
                <Select 
                  value={structureForm.academicYearId || undefined} 
                  onValueChange={(value) => setStructureForm({...structureForm, academicYearId: value || ""})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select academic year (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frequency *</Label>
                <Select 
                  value={structureForm.frequency} 
                  onValueChange={(value: "yearly" | "quarterly" | "monthly") => setStructureForm({...structureForm, frequency: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select how often this fee structure applies
                </p>
              </div>

              {/* Fee Components */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Fee Components</Label>
                  <Button 
                    type="button"
                    size="sm" 
                    variant="outline"
                    onClick={handleAddComponent}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Component
                  </Button>
                </div>

                {/* Tuition Fee */}
                <div className="space-y-2">
                  <Label>Tuition Fee (₹) *</Label>
                  <Input 
                    type="number"
                    placeholder="Enter tuition fee"
                    value={structureForm.tuitionFee}
                    onChange={(e) => setStructureForm({...structureForm, tuitionFee: e.target.value})}
                  />
                </div>

                {/* Transport Fee */}
                <div className="space-y-2">
                  <Label>Transport Fee (₹)</Label>
                  <Input 
                    type="number"
                    placeholder="Enter transport fee"
                    value={structureForm.transportFee}
                    onChange={(e) => setStructureForm({...structureForm, transportFee: e.target.value})}
                  />
                </div>

                {/* Lab Fee */}
                <div className="space-y-2">
                  <Label>Lab Fee (₹)</Label>
                  <Input 
                    type="number"
                    placeholder="Enter lab fee"
                    value={structureForm.labFee}
                    onChange={(e) => setStructureForm({...structureForm, labFee: e.target.value})}
                  />
                </div>

                {/* Other Components */}
                {structureForm.otherComponents.map((component) => (
                  <div key={component.id} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Component Name</Label>
                      <Input 
                        placeholder="e.g., Sports Fee, Library Fee"
                        value={component.name}
                        onChange={(e) => {
                          const updated = structureForm.otherComponents.map(comp =>
                            comp.id === component.id ? { ...comp, name: e.target.value } : comp
                          );
                          setStructureForm({...structureForm, otherComponents: updated});
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>Amount (₹)</Label>
                      <Input 
                        type="number"
                        placeholder="Enter amount"
                        value={component.amount}
                        onChange={(e) => {
                          const updated = structureForm.otherComponents.map(comp =>
                            comp.id === component.id ? { ...comp, amount: e.target.value } : comp
                          );
                          setStructureForm({...structureForm, otherComponents: updated});
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveComponent(component.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Total Fee (Read-only, Auto-calculated) */}
              <div className="space-y-2 border-t pt-4">
                <Label>Total Fee (₹) - Auto Calculated</Label>
                <Input 
                  type="number"
                  value={calculateTotalFee().toFixed(2)}
                  readOnly
                  className="bg-muted font-semibold text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Total = Tuition + Transport + Lab + Other Components
                </p>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditStructureOpen(false);
                    setEditingStructure(null);
                    setStructureForm({
                      classId: "",
                      academicYearId: "",
                      frequency: "yearly",
                      tuitionFee: "",
                      transportFee: "",
                      labFee: "",
                      otherComponents: []
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveStructure}>
                  {editingStructure ? "Update Structure" : "Create Structure"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Component Breakdown Dialog */}
        <Dialog open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Component-wise {breakdownData?.type === 'paid' ? 'Paid' : 'Pending'} Breakdown</DialogTitle>
              <DialogDescription>
                {selectedStudentFee?.studentName} - {selectedStudentFee?.className}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {breakdownData && breakdownData.breakdown && Object.keys(breakdownData.breakdown).length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Fee</p>
                      <p className="text-lg font-semibold">₹{breakdownData.totalFee.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Paid</p>
                      <p className="text-lg font-semibold text-secondary">₹{breakdownData.paidAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Pending</p>
                      <p className="text-lg font-semibold text-destructive">₹{breakdownData.pendingAmount.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(breakdownData.breakdown).map(([component, data]: [string, any]) => (
                      <div key={component} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold capitalize">{component.replace(/_/g, ' ')}</h4>
                          <Badge variant="outline">
                            Total: ₹{data.total.toLocaleString()}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Paid</p>
                            <p className="text-lg font-semibold text-secondary">₹{data.paid.toLocaleString()}</p>
                            {data.total > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {((data.paid / data.total) * 100).toFixed(1)}% of total
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Pending</p>
                            <p className="text-lg font-semibold text-destructive">₹{data.pending.toLocaleString()}</p>
                            {data.total > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {((data.pending / data.total) * 100).toFixed(1)}% of total
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No component breakdown available</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBreakdownOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </UnifiedLayout>
  );
}
