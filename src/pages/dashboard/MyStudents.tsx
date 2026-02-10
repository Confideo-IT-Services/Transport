import { useState, useEffect, useRef } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Eye, Edit, Save, X, Camera, Upload } from "lucide-react";
import { classesApi, studentsApi, uploadApi, academicYearsApi } from "@/lib/api";
import { toast } from "sonner";

interface Student {
  id: string | number;
  name: string;
  rollNo: string;
  photoUrl?: string;
  admissionNumber?: string;
  submittedData?: any;
  parentPhone?: string;
  parentEmail?: string;
  parentName?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
}

export default function MyStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [teacherClass, setTeacherClass] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [schoolClassesForDropdown, setSchoolClassesForDropdown] = useState<{ id: string; name: string; section: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | null>(null);
  const [activeYearId, setActiveYearId] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<any>({});
  // Photo: take photo or upload
  const [showCamera, setShowCamera] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadYears = async () => {
      try {
        const [years, active] = await Promise.all([
          academicYearsApi.getAll().catch(() => []),
          academicYearsApi.getActive().catch(() => null)
        ]);
        setAcademicYears(years || []);
        if (active?.id) {
          setActiveYearId(active.id);
          setSelectedAcademicYearId((prev) => prev ?? active.id);
        } else if ((years || []).length > 0) setSelectedAcademicYearId((prev) => prev ?? (years || [])[0].id);
      } catch {
        setAcademicYears([]);
      }
    };
    loadYears();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedAcademicYearId]);

  // Attach stream to video after the video element is mounted (it only exists when showCamera is true)
  useEffect(() => {
    if (!showCamera || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
  }, [showCamera]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Get teacher's assigned class
      const classesData = await classesApi.getAll();
      if (classesData && classesData.length > 0) {
        const assignedClass = classesData[0];
        setTeacherClass(assignedClass);

        // Get all students in the class for the selected academic year
        const studentsData = await studentsApi.getByClass(assignedClass.id, selectedAcademicYearId || undefined);
        
        setStudents(studentsData || []);
      } else {
        toast.error("No class assigned to you");
      }
    } catch (error: any) {
      console.error('Error loading students:', error);
      toast.error(error?.message || "Failed to load students");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedYear = selectedAcademicYearId ? academicYears.find((y) => y.id === selectedAcademicYearId) : null;
  const isReadOnlyYear = !!selectedYear && selectedYear.status !== "active";

  const handleView = (student: Student) => {
    setSelectedStudent(student);
    setIsViewOpen(true);
  };

  const handleEdit = async (student: Student) => {
    setSelectedStudent(student);
    // Load all school classes for section dropdown (teacher can change section)
    try {
      const classesList = await classesApi.getForDropdown();
      setSchoolClassesForDropdown(classesList || []);
    } catch {
      setSchoolClassesForDropdown([]);
    }
    // Current class is teacher's class (all students in My Students are in this class)
    const currentClassId = teacherClass?.id || '';
    const submittedData = student.submittedData || {};
    setEditForm({
      classId: currentClassId,
      name: student.name || '',
      rollNo: student.rollNo || '',
      photoUrl: student.photoUrl || (student as any).avatar || '',
      address: student.address || submittedData.address || '',
      dateOfBirth: student.dateOfBirth || submittedData.dateOfBirth || '',
      gender: student.gender || submittedData.gender || '',
      bloodGroup: student.bloodGroup || submittedData.bloodGroup || '',
      fatherName: submittedData.fatherName || '',
      fatherPhone: submittedData.fatherPhone || '',
      fatherEmail: submittedData.fatherEmail || '',
      fatherOccupation: submittedData.fatherOccupation || '',
      motherName: submittedData.motherName || '',
      motherPhone: submittedData.motherPhone || '',
      motherOccupation: submittedData.motherOccupation || '',
      emergencyContact: submittedData.emergencyContact || '',
      previousSchool: submittedData.previousSchool || '',
      medicalConditions: submittedData.medicalConditions || '',
      parentPhone: student.parentPhone || submittedData.fatherPhone || submittedData.motherPhone || '',
      parentEmail: student.parentEmail || submittedData.fatherEmail || submittedData.motherEmail || '',
      parentName: student.parentName || submittedData.fatherName || submittedData.motherName || '',
    });
    setShowCamera(false);
    setIsEditOpen(true);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCamera(true);
    } catch {
      toast.error("Unable to access camera. Please use upload from device instead.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("Camera not ready. Wait a moment and try again.");
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    stopCamera();
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
        setIsUploadingPhoto(true);
        try {
          const res = await uploadApi.uploadPhoto(file);
          setEditForm((prev: any) => ({ ...prev, photoUrl: res.photoUrl }));
          toast.success("Photo captured and set.");
        } catch (e: any) {
          toast.error(e?.message || "Failed to upload photo");
        } finally {
          setIsUploadingPhoto(false);
        }
      },
      "image/jpeg",
      0.8
    );
  };

  const handlePhotoUploadFromDevice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo should be less than 2MB");
      return;
    }
    e.target.value = "";
    setIsUploadingPhoto(true);
    try {
      const res = await uploadApi.uploadPhoto(file);
      setEditForm((prev: any) => ({ ...prev, photoUrl: res.photoUrl }));
      toast.success("Photo uploaded.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload photo");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!selectedStudent) return;

    setIsSaving(true);
    try {
      await studentsApi.update(selectedStudent.id, editForm);
      toast.success("Student updated successfully!");
      setIsEditOpen(false);
      setSelectedStudent(null);
      loadData(); // Reload data
    } catch (error: any) {
      console.error('Error updating student:', error);
      toast.error(error?.message || "Failed to update student");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFieldValue = (fieldName: string, student: Student): string => {
    const submittedData = student.submittedData || {};
    return submittedData[fieldName] || (student as any)[fieldName] || '—';
  };

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Academic year filter */}
        {academicYears.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-muted-foreground">Academic year</Label>
            <Select
              value={selectedAcademicYearId ?? ""}
              onValueChange={(v) => setSelectedAcademicYearId(v || null)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.name}{y.status === "active" ? " (Current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAcademicYearId && academicYears.find((y) => y.id === selectedAcademicYearId)?.status !== "active" && (
              <span className="text-sm text-amber-600 font-medium">Read-only — viewing previous year data</span>
            )}
          </div>
        )}

        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold">My Students</h1>
        <p className="text-muted-foreground mt-1">
          {teacherClass 
            ? `Class ${teacherClass.name}${teacherClass.section ? ` - Section ${teacherClass.section}` : ''}`
            : "Loading..."}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, roll number, or admission number..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Students Table */}
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Roll No</TableHead>
              <TableHead>Admission No</TableHead>
              <TableHead>Parent Contact</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading students...
                </TableCell>
              </TableRow>
            ) : filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No students found
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={student.photoUrl} />
                      <AvatarFallback>
                        {student.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.rollNo || '—'}</TableCell>
                  <TableCell>{student.admissionNumber || '—'}</TableCell>
                  <TableCell>{student.parentPhone || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(student)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      {!isReadOnlyYear && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(student)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>
              All information submitted by the student
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={selectedStudent.photoUrl} />
                  <AvatarFallback className="text-2xl">
                    {selectedStudent.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold">{selectedStudent.name}</h3>
                  <p className="text-muted-foreground">Roll No: {selectedStudent.rollNo || '—'}</p>
                  <p className="text-muted-foreground">
                    Admission No: {selectedStudent.admissionNumber || '—'}
                  </p>
                </div>
              </div>

              {/* Student Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Date of Birth</Label>
                  <p className="font-medium">{getFieldValue('dateOfBirth', selectedStudent)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Gender</Label>
                  <p className="font-medium">{getFieldValue('gender', selectedStudent)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Blood Group</Label>
                  <p className="font-medium">{getFieldValue('bloodGroup', selectedStudent)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Address</Label>
                  <p className="font-medium">{getFieldValue('address', selectedStudent)}</p>
                </div>
              </div>

              {/* Father Details */}
              <div className="space-y-2">
                <h4 className="font-semibold">Father's Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">{getFieldValue('fatherName', selectedStudent)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{getFieldValue('fatherPhone', selectedStudent)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{getFieldValue('fatherEmail', selectedStudent)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Occupation</Label>
                    <p className="font-medium">{getFieldValue('fatherOccupation', selectedStudent)}</p>
                  </div>
                </div>
              </div>

              {/* Mother Details */}
              <div className="space-y-2">
                <h4 className="font-semibold">Mother's Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">{getFieldValue('motherName', selectedStudent)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{getFieldValue('motherPhone', selectedStudent)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Occupation</Label>
                    <p className="font-medium">{getFieldValue('motherOccupation', selectedStudent)}</p>
                  </div>
                </div>
              </div>

              {/* Other Information */}
              <div className="space-y-2">
                <h4 className="font-semibold">Other Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Emergency Contact</Label>
                    <p className="font-medium">{getFieldValue('emergencyContact', selectedStudent)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Previous School</Label>
                    <p className="font-medium">{getFieldValue('previousSchool', selectedStudent)}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Medical Conditions</Label>
                    <p className="font-medium">{getFieldValue('medicalConditions', selectedStudent)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) {
          setShowCamera(false);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student Details</DialogTitle>
            <DialogDescription>
              Update student information
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4 py-4">
              {/* Profile photo: Take a photo or Upload from device */}
              <div className="space-y-3 border-b pb-4">
                <Label>Profile photo</Label>
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={editForm.photoUrl || selectedStudent.photoUrl || (selectedStudent as any).avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {selectedStudent.name?.split(" ").map((n) => n[0]).join("") || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={startCamera}
                        disabled={isUploadingPhoto || showCamera}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Take a photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPhoto || showCamera}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload from device
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUploadFromDevice}
                      />
                    </div>
                    {isUploadingPhoto && <p className="text-sm text-muted-foreground">Uploading photo...</p>}
                  </div>
                </div>
                {/* Camera view (inside dialog) */}
                {showCamera && (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3 space-y-2">
                    <p className="text-sm text-muted-foreground">Position the student and click Capture.</p>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full max-w-sm rounded-lg bg-black aspect-video object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex gap-2">
                      <Button type="button" variant="default" size="sm" onClick={capturePhoto}>
                        Capture
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={stopCamera}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Class and Section (change section) */}
              {schoolClassesForDropdown.length > 0 && (
                <div className="space-y-2">
                  <Label>Class and Section</Label>
                  <Select
                    value={editForm.classId || ''}
                    onValueChange={(value) => setEditForm({ ...editForm, classId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class and section" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolClassesForDropdown.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}{cls.section ? ` - Section ${cls.section}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Change the student&apos;s class/section here</p>
                </div>
              )}
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Roll No</Label>
                  <Input
                    value={editForm.rollNo || ''}
                    onChange={(e) => setEditForm({ ...editForm, rollNo: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={editForm.dateOfBirth || ''}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select
                    value={editForm.gender || ''}
                    onValueChange={(value) => setEditForm({ ...editForm, gender: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Blood Group</Label>
                  <Select
                    value={editForm.bloodGroup || ''}
                    onValueChange={(value) => setEditForm({ ...editForm, bloodGroup: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    value={editForm.address || ''}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>
              </div>

              {/* Father Details */}
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold">Father's Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={editForm.fatherName || ''}
                      onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={editForm.fatherPhone || ''}
                      onChange={(e) => setEditForm({ ...editForm, fatherPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editForm.fatherEmail || ''}
                      onChange={(e) => setEditForm({ ...editForm, fatherEmail: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Occupation</Label>
                    <Input
                      value={editForm.fatherOccupation || ''}
                      onChange={(e) => setEditForm({ ...editForm, fatherOccupation: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Mother Details */}
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold">Mother's Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={editForm.motherName || ''}
                      onChange={(e) => setEditForm({ ...editForm, motherName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={editForm.motherPhone || ''}
                      onChange={(e) => setEditForm({ ...editForm, motherPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Occupation</Label>
                    <Input
                      value={editForm.motherOccupation || ''}
                      onChange={(e) => setEditForm({ ...editForm, motherOccupation: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Other Information */}
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold">Other Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Emergency Contact</Label>
                    <Input
                      value={editForm.emergencyContact || ''}
                      onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Previous School</Label>
                    <Input
                      value={editForm.previousSchool || ''}
                      onChange={(e) => setEditForm({ ...editForm, previousSchool: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Medical Conditions</Label>
                    <Textarea
                      value={editForm.medicalConditions || ''}
                      onChange={(e) => setEditForm({ ...editForm, medicalConditions: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-2" />
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

