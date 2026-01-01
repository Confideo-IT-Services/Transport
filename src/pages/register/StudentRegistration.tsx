import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, CheckCircle, GraduationCap, Camera, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface FormField {
  id: string;
  label: string;
  type: "text" | "date" | "select" | "textarea" | "tel" | "email";
  mandatory: boolean;
  options?: string[];
  placeholder?: string;
}

const allFields: Record<string, FormField> = {
  studentName: { id: "studentName", label: "Student Name", type: "text", mandatory: true, placeholder: "Enter student's full name" },
  dateOfBirth: { id: "dateOfBirth", label: "Date of Birth", type: "date", mandatory: true },
  gender: { id: "gender", label: "Gender", type: "select", mandatory: true, options: ["Male", "Female", "Other"] },
  bloodGroup: { id: "bloodGroup", label: "Blood Group", type: "select", mandatory: false, options: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] },
  address: { id: "address", label: "Address", type: "textarea", mandatory: true, placeholder: "Enter complete address" },
  fatherName: { id: "fatherName", label: "Father's Name", type: "text", mandatory: true, placeholder: "Enter father's name" },
  fatherPhone: { id: "fatherPhone", label: "Father's Phone", type: "tel", mandatory: true, placeholder: "+91 XXXXX XXXXX" },
  fatherEmail: { id: "fatherEmail", label: "Father's Email", type: "email", mandatory: false, placeholder: "email@example.com" },
  fatherOccupation: { id: "fatherOccupation", label: "Father's Occupation", type: "text", mandatory: false, placeholder: "Enter occupation" },
  motherName: { id: "motherName", label: "Mother's Name", type: "text", mandatory: false, placeholder: "Enter mother's name" },
  motherPhone: { id: "motherPhone", label: "Mother's Phone", type: "tel", mandatory: false, placeholder: "+91 XXXXX XXXXX" },
  motherOccupation: { id: "motherOccupation", label: "Mother's Occupation", type: "text", mandatory: false, placeholder: "Enter occupation" },
  emergencyContact: { id: "emergencyContact", label: "Emergency Contact", type: "tel", mandatory: true, placeholder: "+91 XXXXX XXXXX" },
  previousSchool: { id: "previousSchool", label: "Previous School", type: "text", mandatory: false, placeholder: "Enter previous school name" },
  medicalConditions: { id: "medicalConditions", label: "Medical Conditions / Allergies", type: "textarea", mandatory: false, placeholder: "Mention any medical conditions or allergies" },
};

export default function StudentRegistration() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const classId = searchParams.get("class") || "";
  const section = searchParams.get("section") || "";
  const schoolCode = searchParams.get("school") || "";
  const mandatoryFields = searchParams.get("mandatory")?.split(",") || [];
  const optionalFields = searchParams.get("optional")?.split(",") || [];
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Determine which fields to show
  const enabledFields = [...mandatoryFields, ...optionalFields].filter(f => f && allFields[f]);
  const showPhoto = mandatoryFields.includes("photo") || optionalFields.includes("photo");
  const photoMandatory = mandatoryFields.includes("photo");

  useEffect(() => {
    return () => {
      // Cleanup camera stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: 640, height: 480 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      toast.error("Unable to access camera. Please use file upload instead.");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setPhotoPreview(dataUrl);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Photo size should be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate mandatory fields
    const missingFields: string[] = [];
    
    if (photoMandatory && !photoPreview) {
      missingFields.push("Student Photo");
    }
    
    mandatoryFields.forEach(fieldId => {
      if (fieldId !== "photo" && allFields[fieldId] && !formData[fieldId]) {
        missingFields.push(allFields[fieldId].label);
      }
    });
    
    if (missingFields.length > 0) {
      toast.error(`Please fill required fields: ${missingFields.join(", ")}`);
      return;
    }
    
    // In real app, this would submit to backend
    setIsSubmitted(true);
    toast.success("Registration submitted successfully!");
  };

  const renderField = (fieldId: string) => {
    const field = allFields[fieldId];
    if (!field) return null;
    
    const isMandatory = mandatoryFields.includes(fieldId);
    
    switch (field.type) {
      case "select":
        return (
          <div key={fieldId} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label} {isMandatory && <span className="text-destructive">*</span>}
            </Label>
            <Select value={formData[fieldId] || ""} onValueChange={(v) => handleInputChange(fieldId, v)}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case "textarea":
        return (
          <div key={fieldId} className="space-y-2 col-span-full">
            <Label htmlFor={fieldId}>
              {field.label} {isMandatory && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id={fieldId}
              placeholder={field.placeholder}
              value={formData[fieldId] || ""}
              onChange={(e) => handleInputChange(fieldId, e.target.value)}
            />
          </div>
        );
      default:
        return (
          <div key={fieldId} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label} {isMandatory && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={fieldId}
              type={field.type}
              placeholder={field.placeholder}
              value={formData[fieldId] || ""}
              onChange={(e) => handleInputChange(fieldId, e.target.value)}
            />
          </div>
        );
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Registration Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Your registration has been submitted successfully. The school admin will review and approve your application soon.
            </p>
            <p className="text-sm text-muted-foreground">
              You will receive a confirmation once your application is approved.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Student Registration</h1>
          <p className="text-muted-foreground mt-2">Fill in the details to register</p>
          {classId && section && (
            <span className="inline-block mt-2 px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
              Registering for: Class {classId} - Section {section}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Student Photo with Camera */}
          {showPhoto && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">
                  Student Photo {photoMandatory && <span className="text-destructive">*</span>}
                </CardTitle>
                <CardDescription>Take a photo using camera or upload from device</CardDescription>
              </CardHeader>
              <CardContent>
                {showCamera ? (
                  <div className="space-y-4">
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex justify-center gap-3">
                      <Button type="button" variant="outline" onClick={stopCamera}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button type="button" onClick={capturePhoto}>
                        <Camera className="w-4 h-4 mr-2" />
                        Capture Photo
                      </Button>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative">
                      <Avatar className="w-32 h-32 border-2 border-dashed border-border">
                        <AvatarImage src={photoPreview || ""} />
                        <AvatarFallback className="bg-muted">
                          <Upload className="w-8 h-8 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      {photoPreview && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 w-8 h-8"
                          onClick={() => setPhotoPreview(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-col gap-3">
                      <Button type="button" variant="outline" onClick={startCamera}>
                        <Camera className="w-4 h-4 mr-2" />
                        Open Camera
                      </Button>
                      <div className="relative">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="cursor-pointer"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG. Max size 2MB. Passport size recommended.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Student Details */}
          {enabledFields.some(f => ["studentName", "dateOfBirth", "gender", "bloodGroup", "address"].includes(f)) && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Student Details</CardTitle>
                <CardDescription>Basic information about the student</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {["studentName", "dateOfBirth", "gender", "bloodGroup", "address"]
                    .filter(f => enabledFields.includes(f))
                    .map(renderField)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parent/Guardian Details */}
          {enabledFields.some(f => f.startsWith("father") || f.startsWith("mother") || f === "emergencyContact") && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Parent/Guardian Details</CardTitle>
                <CardDescription>Information about parents or guardians</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Father's Details */}
                {enabledFields.some(f => f.startsWith("father")) && (
                  <div>
                    <h4 className="font-medium text-foreground mb-4">Father's Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {["fatherName", "fatherPhone", "fatherEmail", "fatherOccupation"]
                        .filter(f => enabledFields.includes(f))
                        .map(renderField)}
                    </div>
                  </div>
                )}

                {/* Mother's Details */}
                {enabledFields.some(f => f.startsWith("mother")) && (
                  <div>
                    <h4 className="font-medium text-foreground mb-4">Mother's Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {["motherName", "motherPhone", "motherOccupation"]
                        .filter(f => enabledFields.includes(f))
                        .map(renderField)}
                    </div>
                  </div>
                )}

                {enabledFields.includes("emergencyContact") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderField("emergencyContact")}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Additional Information */}
          {enabledFields.some(f => ["previousSchool", "medicalConditions"].includes(f)) && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Additional Information</CardTitle>
                <CardDescription>Other relevant details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  {["previousSchool", "medicalConditions"]
                    .filter(f => enabledFields.includes(f))
                    .map(renderField)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/")}>
              Cancel
            </Button>
            <Button type="submit" size="lg">
              Submit Registration
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
