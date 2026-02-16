import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { UserPlus, Phone, CheckCircle2, Clock, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { visitorRequestsApi, parentsApi } from "@/lib/api";
import { format } from "date-fns";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface VisitorRequest {
  id: string;
  student_id: string;
  student_name: string;
  class_name: string;
  class_section: string;
  visitor_name: string;
  visitor_relation: string;
  visit_reason: string;
  other_reason: string | null;
  status: string;
  teacher_approval_status: string;
  admin_approval_status: string;
  teacher_name: string | null;
  teacher_phone: string | null;
  created_at: string;
}

export default function VisitorManagement() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showVisitorPass, setShowVisitorPass] = useState(false);
  const [selectedPassRequest, setSelectedPassRequest] = useState<VisitorRequest | null>(null);
  const [children, setChildren] = useState<any[]>([]);
  
  // Form state
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [visitorName, setVisitorName] = useState("");
  const [visitorRelation, setVisitorRelation] = useState("");
  const [visitReason, setVisitReason] = useState<'enquiry' | 'pickup' | 'other'>('pickup');
  const [otherReason, setOtherReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    loadChildren();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await visitorRequestsApi.getMyRequests();
      setRequests(data);
    } catch (error) {
      console.error('Failed to load visitor requests:', error);
      toast.error('Failed to load visitor requests');
    } finally {
      setIsLoading(false);
    }
  };

  const loadChildren = async () => {
    try {
      const data = await parentsApi.getChildren();
      setChildren(data);
    } catch (error) {
      console.error('Failed to load children:', error);
    }
  };

  // Get unique classes from children
  const getUniqueClasses = () => {
    const classMap = new Map<string, { id: string; name: string; section: string }>();
    children.forEach(child => {
      if (child.classId && child.className) {
        const key = `${child.classId}-${child.className}`;
        if (!classMap.has(key)) {
          // Split className like "Class 1 A" to get class name and section
          const parts = child.className.trim().split(/\s+/);
          const section = parts[parts.length - 1]; // Last part is section
          const className = parts.slice(0, -1).join(' '); // Everything except last part is class name
          
          classMap.set(key, {
            id: child.classId,
            name: className || child.className, // Use extracted class name
            section: section || '', // Use extracted section
          });
        }
      }
    });
    return Array.from(classMap.values());
  };

  // Get sections for selected class
  const getSectionsForClass = () => {
    if (!selectedClassId) return [];
    const classStudents = children.filter(c => c.classId === selectedClassId);
    const sections = new Set<string>();
    classStudents.forEach(s => {
      // Extract section (last part) from className like "Class 1 A"
      const parts = s.className?.trim().split(/\s+/) || [];
      const section = parts[parts.length - 1] || '';
      if (section) sections.add(section);
    });
    return Array.from(sections).sort();
  };

  // Get students for selected class and section
  const getStudentsForClassSection = () => {
    if (!selectedClassId || !selectedSection) return [];
    return children.filter(c => {
      // Extract section from className
      const parts = c.className?.trim().split(/\s+/) || [];
      const section = parts[parts.length - 1] || '';
      return c.classId === selectedClassId && section === selectedSection;
    });
  };

  const handleOpenForm = () => {
    setShowRequestForm(true);
    setSelectedClassId("");
    setSelectedSection("");
    setSelectedStudentId("");
    setVisitorName("");
    setVisitorRelation("");
    setVisitReason('pickup');
    setOtherReason("");
  };

  const handleCloseForm = () => {
    setShowRequestForm(false);
    setSelectedClassId("");
    setSelectedSection("");
    setSelectedStudentId("");
    setVisitorName("");
    setVisitorRelation("");
    setVisitReason('pickup');
    setOtherReason("");
  };

  const handleSubmit = async () => {
    if (!selectedStudentId || !visitorName || !visitorRelation || !visitReason) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (visitReason === 'other' && !otherReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedStudent = children.find(c => c.id === selectedStudentId);
      
      await visitorRequestsApi.create({
        studentId: selectedStudentId,
        classId: selectedStudent.classId,
        visitorName,
        visitorRelation,
        visitReason,
        otherReason: visitReason === 'other' ? otherReason : undefined,
      });

      toast.success('Visitor request submitted successfully');
      handleCloseForm();
      loadData();
    } catch (error: any) {
      console.error('Failed to submit request:', error);
      toast.error(error.message || 'Failed to submit visitor request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (request: VisitorRequest) => {
    if (request.status === 'admin_accepted') {
      return <Badge className="bg-green-500">Request Accepted</Badge>;
    }
    if (request.status === 'teacher_accepted') {
      return <Badge className="bg-blue-500">Teacher Approved</Badge>;
    }
    if (request.status === 'rejected') {
      return <Badge className="bg-red-500">Rejected</Badge>;
    }
    return <Badge className="bg-yellow-500">Pending</Badge>;
  };

  const getReasonText = (request: VisitorRequest) => {
    if (request.visit_reason === 'other') {
      return request.other_reason || 'Other';
    }
    return request.visit_reason.charAt(0).toUpperCase() + request.visit_reason.slice(1);
  };

  const handleDownloadVisitorPass = async (request?: VisitorRequest) => {
    const passRequest = request || selectedPassRequest;
    if (!passRequest) return;

    try {
      // Wait a bit for the dialog to fully render
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Find the visitor pass element by a unique ID
      const passId = `visitor-pass-${passRequest.id}`;
      const element = document.getElementById(passId);
      
      if (!element) {
        toast.error('Visitor pass not found');
        return;
      }

      // Show loading toast
      toast.loading('Generating visitor pass...', { id: 'download-pass' });

      // Convert to canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#f0fdf4', // Match the green-50 background
        logging: false,
      });

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add image to PDF
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Direct download - no print dialog
      const fileName = `Visitor_Pass_${passRequest.visitor_name.replace(/\s+/g, '_')}_${passRequest.id.substring(0, 8)}.pdf`;
      pdf.save(fileName);
      
      toast.success('Visitor pass downloaded successfully', { id: 'download-pass' });
    } catch (error) {
      console.error('Failed to download visitor pass:', error);
      toast.error('Failed to download visitor pass', { id: 'download-pass' });
    }
  };

  return (
    <UnifiedLayout role="parent">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Visitor Management</h1>
            <p className="text-muted-foreground mt-1">
              Request and manage visitor passes for school visits
            </p>
          </div>
          <Button onClick={handleOpenForm}>
            <UserPlus className="w-4 h-4 mr-2" />
            Raise a Request
          </Button>
        </div>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle>My Visitor Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No visitor requests yet. Click "Raise a Request" to create one.
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <Card key={request.id} className="border-l-4 border-l-primary">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{request.visitor_name}</span>
                            {getStatusBadge(request)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p>Visitor: {request.visitor_name} ({request.visitor_relation || 'N/A'})</p>
                            <p>Student: {request.student_name}</p>
                            <p>Class: {request.class_name} {request.class_section ? `- ${request.class_section}` : ''}</p>
                            <p>Reason: {getReasonText(request)}</p>
                            <p>Requested: {format(new Date(request.created_at), 'MMM dd, yyyy HH:mm')}</p>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2">
                          {request.status === 'admin_accepted' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedPassRequest(request);
                                setShowVisitorPass(true);
                              }}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              View Pass
                            </Button>
                          )}
                          {request.teacher_phone && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.location.href = `tel:${request.teacher_phone}`}
                            >
                              <Phone className="w-4 h-4 mr-2" />
                              Call Class Teacher
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Form Dialog */}
        <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Raise a Visitor Request</DialogTitle>
              <DialogDescription>
                Fill in the details to request a visitor pass
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Class Selector */}
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={selectedClassId} onValueChange={(value) => {
                  setSelectedClassId(value);
                  setSelectedSection("");
                  setSelectedStudentId("");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {getUniqueClasses().map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Section Selector */}
              {selectedClassId && (
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select value={selectedSection} onValueChange={(value) => {
                    setSelectedSection(value);
                    setSelectedStudentId("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSectionsForClass().map((section) => (
                        <SelectItem key={section} value={section}>
                          {section}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Student Selector */}
              {selectedClassId && selectedSection && (
                <div className="space-y-2">
                  <Label>Student Name</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {getStudentsForClassSection().map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Visitor Name */}
              <div className="space-y-2">
                <Label>Visitor Name *</Label>
                <Input
                  placeholder="Enter visitor's name"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                />
              </div>

              {/* Visitor Relation */}
              <div className="space-y-2">
                <Label>Visitor Relation to Child *</Label>
                <Input
                  placeholder="e.g., Father, Mother, Grandfather, etc."
                  value={visitorRelation}
                  onChange={(e) => setVisitorRelation(e.target.value)}
                />
              </div>

              {/* Reason for Visiting */}
              <div className="space-y-2">
                <Label>Reason for Visiting *</Label>
                <Select value={visitReason} onValueChange={(value) => {
                  setVisitReason(value as 'enquiry' | 'pickup' | 'other');
                  if (value !== 'other') setOtherReason("");
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enquiry">Enquiry</SelectItem>
                    <SelectItem value="pickup">Pickup</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Other Reason */}
              {visitReason === 'other' && (
                <div className="space-y-2">
                  <Label>Please specify reason *</Label>
                  <Textarea
                    placeholder="Enter the reason for visiting"
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseForm}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Visitor Pass Dialog */}
        <Dialog open={showVisitorPass} onOpenChange={setShowVisitorPass}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Visitor Pass</DialogTitle>
              <DialogDescription>
                Download your visitor pass for school entry
              </DialogDescription>
            </DialogHeader>
            {selectedPassRequest && (
              <div className="py-4">
                <Card 
                  id={`visitor-pass-${selectedPassRequest.id}`}
                  className="bg-green-50 border-green-200"
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-800">Visitor Pass</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><strong>Visitor:</strong> {selectedPassRequest.visitor_name} ({selectedPassRequest.visitor_relation || 'N/A'})</p>
                      <p><strong>Student:</strong> {selectedPassRequest.student_name}</p>
                      <p><strong>Class:</strong> {selectedPassRequest.class_name} {selectedPassRequest.class_section ? `- ${selectedPassRequest.class_section}` : ''}</p>
                      <p><strong>Reason:</strong> {getReasonText(selectedPassRequest)}</p>
                      <p><strong>Status:</strong> <span className="text-green-600 font-semibold">Approved</span></p>
                      <p className="text-xs text-muted-foreground mt-2">Request ID: {selectedPassRequest.id.substring(0, 8).toUpperCase()}</p>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setShowVisitorPass(false)}>
                    Close
                  </Button>
                  <Button onClick={() => handleDownloadVisitorPass()}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Pass
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </UnifiedLayout>
  );
}

