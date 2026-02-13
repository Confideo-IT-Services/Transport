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
import { FileText, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { classesApi, studentsApi, feesApi } from "@/lib/api";

interface TCRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  className: string;
  section: string;
  admissionNumber: string;
  reason: string;
  remarks: string;
  feeStatus: 'paid' | 'pending' | 'partial' | 'no-fee' | 'unpaid';
  paidAmount: number;
  pendingAmount: number;
  totalFee: number;
  tcStatus: 'none' | 'applied' | 'issued';
  appliedDate?: string;
  issuedDate?: string;
}

export default function ExitFormalities() {
  const { user } = useAuth();
  const [tcRecords, setTcRecords] = useState<TCRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TCRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTcForm, setShowTcForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // TC Form state
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassName, setSelectedClassName] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [feeInfo, setFeeInfo] = useState<any>(null);
  const [tcStatus, setTcStatus] = useState<'none' | 'applied' | 'issued'>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TCRecord | null>(null);
  const [showStudentDetails, setShowStudentDetails] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
    loadClasses();
  }, []);

  useEffect(() => {
    filterRecords();
  }, [tcRecords, statusFilter, searchTerm]);

  useEffect(() => {
    if (selectedClassName && selectedSection) {
      loadStudents();
    } else {
      setStudents([]);
      setFilteredStudents([]);
    }
  }, [selectedClassName, selectedSection]);

  useEffect(() => {
    if (studentSearchTerm) {
      const filtered = students.filter(s =>
        s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
        s.rollNo?.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
        s.admissionNumber?.toLowerCase().includes(studentSearchTerm.toLowerCase())
      );
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents(students);
    }
  }, [studentSearchTerm, students]);

  useEffect(() => {
    if (selectedStudentId) {
      loadFeeInfo();
      loadStudentTcStatus();
    } else {
      setFeeInfo(null);
      setTcStatus('none');
    }
  }, [selectedStudentId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const allStudents = await studentsApi.getAll();
      
      // Get fee information for all students
      const feeData = await feesApi.getStudentFees();
      
      // Create TC records from students
      const records: TCRecord[] = allStudents
        .filter(s => s.status === 'approved' && (s.tcStatus === 'applied' || s.tcStatus === 'issued'))
        .map(student => {
          const fee = feeData.find((f: any) => f.studentId === student.id);
          
          // Extract TC reason and remarks from extra_fields
          const extraFields = student.extra_fields || {};
          const tcReason = extraFields.tc_reason || '';
          const tcRemarks = extraFields.tc_remarks || '';
          
          return {
            id: student.id,
            studentId: student.id,
            studentName: student.name,
            rollNo: student.rollNo || '-',
            className: student.class || '',
            section: student.section || '',
            admissionNumber: student.admissionNumber || '-',
            reason: tcReason,
            remarks: tcRemarks,
            feeStatus: fee?.status || 'no-fee',
            paidAmount: fee?.paidAmount || 0,
            pendingAmount: fee?.pendingAmount || 0,
            totalFee: fee?.totalFee || 0,
            tcStatus: student.tcStatus || 'none',
          };
        });
      
      setTcRecords(records);
    } catch (error) {
      console.error('Failed to load TC records:', error);
      toast.error('Failed to load exit formalities data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      const data = await classesApi.getAll();
      setClasses(data);
    } catch (error) {
      console.error('Failed to load classes:', error);
    }
  };

  const loadStudents = async () => {
    try {
      if (!selectedClassName || !selectedSection) return;
      
      // Find the class ID that matches the selected class name and section
      const matchingClass = classes.find(
        c => c.name === selectedClassName && c.section === selectedSection
      );
      
      if (!matchingClass) {
        setStudents([]);
        setFilteredStudents([]);
        return;
      }
      
      const classStudents = await studentsApi.getByClass(matchingClass.id);
      
      setStudents(classStudents.filter(s => s.status === 'approved'));
      setFilteredStudents(classStudents.filter(s => s.status === 'approved'));
    } catch (error) {
      console.error('Failed to load students:', error);
      toast.error('Failed to load students');
    }
  };

  const loadFeeInfo = async () => {
    try {
      if (!selectedStudentId) return;
      
      const feeData = await feesApi.getStudentFees();
      const studentFee = feeData.find((f: any) => f.studentId === selectedStudentId);
      
      if (studentFee) {
        setFeeInfo({
          status: studentFee.status,
          paidAmount: studentFee.paidAmount || 0,
          pendingAmount: studentFee.pendingAmount || 0,
          totalFee: studentFee.totalFee || 0,
        });
      } else {
        setFeeInfo({
          status: 'no-fee',
          paidAmount: 0,
          pendingAmount: 0,
          totalFee: 0,
        });
      }
    } catch (error) {
      console.error('Failed to load fee info:', error);
      setFeeInfo({
        status: 'no-fee',
        paidAmount: 0,
        pendingAmount: 0,
        totalFee: 0,
      });
    }
  };

  const loadStudentTcStatus = async () => {
    try {
      if (!selectedStudentId) return;
      
      const allStudents = await studentsApi.getAll();
      const student = allStudents.find(s => s.id === selectedStudentId);
      
      if (student) {
        setTcStatus(student.tcStatus || 'none');
      }
    } catch (error) {
      console.error('Failed to load TC status:', error);
    }
  };

  const filterRecords = () => {
    let filtered = [...tcRecords];

    if (statusFilter !== "all") {
      filtered = filtered.filter(r => r.tcStatus === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.studentName.toLowerCase().includes(term) ||
        r.rollNo.toLowerCase().includes(term) ||
        r.admissionNumber.toLowerCase().includes(term) ||
        r.className.toLowerCase().includes(term)
      );
    }

    setFilteredRecords(filtered);
  };

  const handleOpenTcForm = () => {
    setShowTcForm(true);
    // Reset form
    setSelectedClassName("");
    setSelectedSection("");
    setStudents([]);
    setFilteredStudents([]);
    setStudentSearchTerm("");
    setSelectedStudentId("");
    setReason("");
    setRemarks("");
    setFeeInfo(null);
    setTcStatus('none');
  };

  const handleCloseTcForm = () => {
    setShowTcForm(false);
    // Reset form
    setSelectedClassName("");
    setSelectedSection("");
    setStudents([]);
    setFilteredStudents([]);
    setStudentSearchTerm("");
    setSelectedStudentId("");
    setReason("");
    setRemarks("");
    setFeeInfo(null);
    setTcStatus('none');
  };

  const handleSubmitTcForm = async () => {
    if (!selectedStudentId) {
      toast.error('Please select a student');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for TC');
      return;
    }

    try {
      setIsSubmitting(true);

      // Update TC status
      await studentsApi.updateTcStatus(selectedStudentId, tcStatus);

      // Get current student to preserve existing extra_fields
      const allStudents = await studentsApi.getAll();
      const student = allStudents.find(s => s.id === selectedStudentId);
      
      if (student) {
        // Update extra_fields with TC reason and remarks
        const extraFields = student.extra_fields || {};
        const updatedExtraFields = {
          ...extraFields,
          tc_reason: reason || '',
          tc_remarks: remarks || '',
        };

        // Update student with TC info in extra_fields
        await studentsApi.update(selectedStudentId, {
          extra_fields: updatedExtraFields,
        });
      }

      toast.success('TC form submitted successfully');
      handleCloseTcForm();
      loadData(); // Reload TC records
    } catch (error: any) {
      console.error('Failed to submit TC form:', error);
      toast.error(error.message || 'Failed to submit TC form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFeeStatusBadge = (status: string, paid: number, pending: number, total: number) => {
    if (status === 'no-fee') {
      return <Badge variant="outline">No Fee</Badge>;
    }
    if (status === 'paid') {
      return <Badge className="bg-green-500">Paid (₹{paid.toLocaleString()})</Badge>;
    }
    if (status === 'partial') {
      return <Badge className="bg-yellow-500">Partially Paid (₹{paid.toLocaleString()} / ₹{total.toLocaleString()}, Pending: ₹{pending.toLocaleString()})</Badge>;
    }
    return <Badge className="bg-red-500">Pending (₹{pending.toLocaleString()})</Badge>;
  };

  const getTcStatusBadge = (status: string) => {
    switch (status) {
      case 'applied':
        return <Badge className="bg-yellow-500">Applied</Badge>;
      case 'issued':
        return <Badge className="bg-green-500">Issued</Badge>;
      default:
        return <Badge variant="outline">None</Badge>;
    }
  };

  const handleViewStudent = async (record: TCRecord) => {
    try {
      const allStudents = await studentsApi.getAll();
      const student = allStudents.find(s => s.id === record.studentId);
      
      if (student) {
        // Extract TC reason and remarks from extra_fields
        const extraFields = student.extra_fields || {};
        const tcReason = extraFields.tc_reason || record.reason || '';
        const tcRemarks = extraFields.tc_remarks || record.remarks || '';
        
        setEditingStudent({
          ...student,
          tcStatus: record.tcStatus,
          reason: tcReason,
          remarks: tcRemarks,
          extra_fields: extraFields,
        });
        setSelectedRecord(record);
        setShowStudentDetails(true);
      }
    } catch (error) {
      console.error('Failed to load student details:', error);
      toast.error('Failed to load student details');
    }
  };

  const handleSaveStudent = async () => {
    if (!editingStudent || !selectedRecord) return;

    try {
      setIsSaving(true);

      // Update TC status if changed
      if (editingStudent.tcStatus !== selectedRecord.tcStatus) {
        await studentsApi.updateTcStatus(editingStudent.id, editingStudent.tcStatus);
      }

      // Prepare extra_fields with TC reason and remarks
      const { tcStatus, reason, remarks, extra_fields, ...studentUpdateData } = editingStudent;
      
      // Merge TC info into extra_fields
      const updatedExtraFields = {
        ...(extra_fields || {}),
        tc_reason: reason || '',
        tc_remarks: remarks || '',
      };

      // Update student with extra_fields containing TC info
      await studentsApi.update(editingStudent.id, {
        ...studentUpdateData,
        extra_fields: updatedExtraFields,
      });

      toast.success('Student details updated successfully');
      setShowStudentDetails(false);
      setSelectedRecord(null);
      setEditingStudent(null);
      loadData(); // Reload TC records
    } catch (error: any) {
      console.error('Failed to save student:', error);
      toast.error(error.message || 'Failed to save student details');
    } finally {
      setIsSaving(false);
    }
  };

  // Get unique class names
  const getClassNames = () => {
    const classNames = new Set<string>();
    classes.forEach(c => {
      if (c.name) classNames.add(c.name);
    });
    return Array.from(classNames).sort();
  };

  // Get unique sections for selected class name
  const getSectionsForClass = () => {
    if (!selectedClassName) return [];
    
    // Get all classes with the same name (different sections)
    const classesWithSameName = classes.filter(c => c.name === selectedClassName);
    const sections = classesWithSameName
      .map(c => c.section)
      .filter((section): section is string => !!section)
      .sort();
    
    return sections;
  };

  return (
    <UnifiedLayout role="admin">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Exit Formalities</h1>
            <p className="text-muted-foreground mt-1">
              Manage Transfer Certificate (TC) applications and issuances
            </p>
          </div>
          <Button onClick={handleOpenTcForm}>
            <FileText className="w-4 h-4 mr-2" />
            TC Form
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by name, roll no, admission no..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-[200px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="applied">TC Applied</SelectItem>
                    <SelectItem value="issued">TC Issued</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TC Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>TC Records</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No TC records found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium text-muted-foreground">Student</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Roll No</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Admission No</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Class</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Fee Status</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">TC Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => (
                      <tr 
                        key={record.id} 
                        className="border-b hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleViewStudent(record)}
                      >
                        <td className="p-4 font-medium">{record.studentName}</td>
                        <td className="p-4 text-muted-foreground">{record.rollNo}</td>
                        <td className="p-4 text-muted-foreground">{record.admissionNumber}</td>
                        <td className="p-4">
                          <Badge variant="outline">
                            {record.className} {record.section ? `- ${record.section}` : ''}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {getFeeStatusBadge(
                            record.feeStatus,
                            record.paidAmount,
                            record.pendingAmount,
                            record.totalFee
                          )}
                        </td>
                        <td className="p-4">
                          {getTcStatusBadge(record.tcStatus)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TC Form Dialog */}
        <Dialog open={showTcForm} onOpenChange={setShowTcForm}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>TC Form</DialogTitle>
              <DialogDescription>
                Fill in the details to apply for or issue a Transfer Certificate
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Class Selector */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={selectedClassName} onValueChange={(value) => {
                    setSelectedClassName(value);
                    setSelectedSection(""); // Reset section when class changes
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {getClassNames().map((className) => (
                        <SelectItem key={className} value={className}>
                          {className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedClassName}>
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
              </div>

              {/* Student Selector */}
              {selectedClassName && selectedSection && (
                <div className="space-y-2">
                  <Label>Student</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Search student by name, roll no, or admission no..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                    />
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select student" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} {student.rollNo ? `(${student.rollNo})` : ''} {student.admissionNumber ? `- ${student.admissionNumber}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Fee Status Display */}
              {selectedStudentId && feeInfo && (
                <div className="space-y-2">
                  <Label>Fee Status</Label>
                  <div className="p-4 bg-muted rounded-lg">
                    {getFeeStatusBadge(
                      feeInfo.status,
                      feeInfo.paidAmount,
                      feeInfo.pendingAmount,
                      feeInfo.totalFee
                    )}
                  </div>
                </div>
              )}

              {/* TC Status */}
              <div className="space-y-2">
                <Label>TC Status</Label>
                <Select value={tcStatus} onValueChange={(value) => setTcStatus(value as 'none' | 'applied' | 'issued')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="applied">Applied</SelectItem>
                    <SelectItem value="issued">Issued</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason for TC *</Label>
                <Textarea
                  placeholder="Enter the reason for requesting Transfer Certificate"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  placeholder="Any additional remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseTcForm}>
                  Cancel
                </Button>
                <Button onClick={handleSubmitTcForm} disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Student Details Dialog */}
        <Dialog open={showStudentDetails} onOpenChange={(open) => {
          setShowStudentDetails(open);
          if (!open) {
            setSelectedRecord(null);
            setEditingStudent(null);
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Student Details</DialogTitle>
              <DialogDescription>
                View and edit student information and TC details
              </DialogDescription>
            </DialogHeader>
            {editingStudent && (
              <div className="space-y-6 py-4">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input 
                        value={editingStudent.name || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Roll Number</Label>
                      <Input 
                        value={editingStudent.rollNo || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, rollNo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admission Number</Label>
                      <Input 
                        value={editingStudent.admissionNumber || ''}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Class</Label>
                      <Input 
                        value={`${editingStudent.class || ''} ${editingStudent.section ? `- ${editingStudent.section}` : ''}`}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input 
                        type="date"
                        value={editingStudent.dateOfBirth || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, dateOfBirth: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select 
                        value={editingStudent.gender || ''}
                        onValueChange={(value) => setEditingStudent({ ...editingStudent, gender: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Blood Group</Label>
                      <Input 
                        value={editingStudent.bloodGroup || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, bloodGroup: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Parent Phone</Label>
                      <Input 
                        value={editingStudent.parentPhone || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, parentPhone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Parent Email</Label>
                      <Input 
                        type="email"
                        value={editingStudent.parentEmail || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, parentEmail: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Parent Name</Label>
                      <Input 
                        value={editingStudent.parentName || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, parentName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Address</Label>
                      <Textarea 
                        value={editingStudent.address || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, address: e.target.value })}
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Fee Status Display */}
                {selectedRecord && (
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold mb-4">Fee Status</h3>
                    <div className="p-4 bg-muted rounded-lg">
                      {getFeeStatusBadge(
                        selectedRecord.feeStatus,
                        selectedRecord.paidAmount,
                        selectedRecord.pendingAmount,
                        selectedRecord.totalFee
                      )}
                    </div>
                  </div>
                )}

                {/* TC Information */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4">TC Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>TC Status</Label>
                      <Select 
                        value={editingStudent.tcStatus || 'none'}
                        onValueChange={(value) => setEditingStudent({ ...editingStudent, tcStatus: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">NA</SelectItem>
                          <SelectItem value="applied">TC Applied</SelectItem>
                          <SelectItem value="issued">TC Issued</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Reason for TC</Label>
                      <Input 
                        value={editingStudent.reason || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, reason: e.target.value })}
                        placeholder="Enter reason for TC"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Remarks</Label>
                      <Textarea 
                        value={editingStudent.remarks || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, remarks: e.target.value })}
                        placeholder="Any additional remarks"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={() => {
                    setShowStudentDetails(false);
                    setSelectedRecord(null);
                    setEditingStudent(null);
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveStudent} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
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

