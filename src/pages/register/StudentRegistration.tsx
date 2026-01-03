import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, CheckCircle, GraduationCap, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { registrationLinksApi, studentsApi, uploadApi } from "@/lib/api";

interface FormField {
  id: string;
  fieldName: string;
  label: string;
  fieldType: 'text' | 'textarea' | 'radio' | 'select' | 'tel' | 'email' | 'file' | 'checkbox' | 'date';
  mandatory: boolean;
  options?: string[];
}

export default function StudentRegistration() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const code = searchParams.get("code") || "";
  
  const [isLoading, setIsLoading] = useState(true);
  const [linkData, setLinkData] = useState<{
    classId: string;
    className: string;
    classSection: string;
    fieldConfig: FormField[];
  } | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch registration link data on mount
  useEffect(() => {
    const fetchLinkData = async () => {
      if (!code) {
        toast.error("Invalid registration link");
        setIsLoading(false);
        return;
      }

      try {
        const data = await registrationLinksApi.getByCode(code);
        setLinkData({
          classId: data.classId,
          className: data.className,
          classSection: data.classSection,
          fieldConfig: data.fieldConfig || [],
        });
      } catch (error: any) {
        console.error('Error fetching registration link:', error);
        toast.error(error?.message || "Invalid or expired registration link");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLinkData();
  }, [code]);

  useEffect(() => {
    return () => {
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
        
        // Convert data URL to File for S3 upload
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
            setPhotoFile(file);
          }
        }, 'image/jpeg', 0.8);
        
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
      setPhotoFile(file); // Store file reference for S3 upload
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (fieldName: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!linkData) return;
    
    // Upload photo to S3 first if photo field exists and is mandatory
    let photoUrl: string | null = null;
    const photoField = linkData.fieldConfig.find(f => f.fieldName === 'photo' && f.fieldType === 'file');
    
    if (photoField && photoField.mandatory) {
      // Check if photo is uploaded
      if (!photoFile && !photoPreview) {
        toast.error("Please upload a photo");
        return;
      }
      
      // If we have a file, upload it to S3
      if (photoFile) {
        // Check if already uploaded (contains S3 URL)
        if (photoPreview && photoPreview.includes('amazonaws.com')) {
          // Already uploaded, use existing URL
          photoUrl = photoPreview;
        } else {
          // Upload to S3
          try {
            setIsUploadingPhoto(true);
            toast.loading("Uploading photo...", { id: 'photo-upload' });
            const uploadResult = await uploadApi.uploadPhoto(photoFile);
            photoUrl = uploadResult.photoUrl;
            setPhotoPreview(photoUrl); // Update preview with S3 URL
            toast.success("Photo uploaded successfully!", { id: 'photo-upload' });
          } catch (error: any) {
            toast.error(error?.message || "Failed to upload photo", { id: 'photo-upload' });
            setIsUploadingPhoto(false);
            return;
          } finally {
            setIsUploadingPhoto(false);
          }
        }
      } else if (photoPreview && photoPreview.includes('amazonaws.com')) {
        // Already uploaded, use existing URL
        photoUrl = photoPreview;
      }
    }
    
    // Validate other mandatory fields
    const missingFields: string[] = [];
    
    linkData.fieldConfig.forEach(field => {
      if (field.mandatory) {
        if (field.fieldType === 'file' && field.fieldName === 'photo') {
          // Already validated above - check if we have photoUrl
          if (!photoUrl) {
            missingFields.push(field.label);
          }
        } else if (field.fieldType === 'checkbox') {
          if (!formData[field.fieldName]) {
            missingFields.push(field.label);
          }
        } else if (!formData[field.fieldName] || formData[field.fieldName] === '') {
          missingFields.push(field.label);
        }
      }
    });
    
    if (missingFields.length > 0) {
      toast.error(`Please fill required fields: ${missingFields.join(", ")}`);
      return;
    }
    
    try {
      // Map form data to backend format
      const studentData: any = {
        registrationCode: code, // Send code to get schoolId from backend
        classId: linkData.classId,
        name: formData.studentName || formData.name || '',
        studentName: formData.studentName || formData.name || '', // Support both field names
        rollNo: formData.rollNo || '',
        dateOfBirth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        bloodGroup: formData.bloodGroup || null,
        address: formData.address || null,
        photoUrl: photoUrl, // Use S3 URL
        // Parent/Guardian fields
        fatherName: formData.fatherName || null,
        fatherPhone: formData.fatherPhone || null,
        fatherEmail: formData.fatherEmail || null,
        fatherOccupation: formData.fatherOccupation || null,
        motherName: formData.motherName || null,
        motherPhone: formData.motherPhone || null,
        motherOccupation: formData.motherOccupation || null,
        emergencyContact: formData.emergencyContact || null,
        previousSchool: formData.previousSchool || null,
        medicalConditions: formData.medicalConditions || null,
      };

      // Add any custom fields that were added through "Add Field"
      linkData.fieldConfig.forEach(field => {
        if (field.fieldName !== 'photo' && formData[field.fieldName] !== undefined) {
          // Only include if it's not already mapped above
          if (!studentData[field.fieldName]) {
            studentData[field.fieldName] = formData[field.fieldName];
          }
        }
      });

      // Submit to backend
      await studentsApi.create(studentData);
      
      setIsSubmitted(true);
      toast.success("Registration submitted successfully!");
    } catch (error: any) {
      console.error('Error submitting registration:', error);
      toast.error(error?.message || "Failed to submit registration. Please try again.");
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.fieldName];
    const isMandatory = field.mandatory;
    
    switch (field.fieldType) {
      case "select":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.fieldName}>
              {field.label} {isMandatory && <span className="text-destructive">*</span>}
            </Label>
            <Select 
              value={typeof value === 'string' ? value : ""} 
              onValueChange={(v) => handleInputChange(field.fieldName, v)}
            >
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
      
      case "radio":
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label} {isMandatory && <span className="text-destructive">*</span>}
            </Label>
            <div className="flex flex-wrap gap-4">
              {field.options?.map(opt => (
                <div key={opt} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={`${field.fieldName}-${opt}`}
                    name={field.fieldName}
                    value={opt}
                    checked={value === opt}
                    onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor={`${field.fieldName}-${opt}`} className="cursor-pointer">
                    {opt}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );
      
      case "checkbox":
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <Checkbox
              id={field.fieldName}
              checked={!!value}
              onCheckedChange={(checked) => handleInputChange(field.fieldName, !!checked)}
            />
            <Label htmlFor={field.fieldName} className="cursor-pointer">
              {field.label} {isMandatory && <span className="text-destructive">*</span>}
            </Label>
          </div>
        );
      
      case "textarea":
        return (
          <div key={field.id} className="space-y-2 col-span-full">
            <Label htmlFor={field.fieldName}>
              {field.label} {isMandatory && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id={field.fieldName}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              value={typeof value === 'string' ? value : ""}
              onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
            />
          </div>
        );
      
      case "file":
        if (field.fieldName === 'photo') {
          // Photo field is handled separately
          return null;
        }
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.fieldName}>
              {field.label} {isMandatory && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.fieldName}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    handleInputChange(field.fieldName, reader.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </div>
        );
      
      case "date":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.fieldName}>
              {field.label} {isMandatory && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.fieldName}
              type="date"
              placeholder={`Select ${field.label.toLowerCase()}`}
              value={typeof value === 'string' ? value : ""}
              onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
            />
          </div>
        );
      
      default: // text, tel, email
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.fieldName}>
              {field.label} {isMandatory && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.fieldName}
              type={field.fieldType}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              value={typeof value === 'string' ? value : ""}
              onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
            />
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading registration form...</p>
        </div>
      </div>
    );
  }

  if (!linkData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Invalid Link</h2>
            <p className="text-muted-foreground mb-6">
              This registration link is invalid or has expired.
            </p>
            <Button onClick={() => navigate("/")}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          </CardContent>
        </Card>
      </div>
    );
  }

  const photoField = linkData.fieldConfig.find(f => f.fieldName === 'photo' && f.fieldType === 'file');
  const showPhoto = !!photoField;
  const photoMandatory = photoField?.mandatory || false;
  const otherFields = linkData.fieldConfig.filter(f => f.fieldName !== 'photo' || f.fieldType !== 'file');

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
          {linkData.className && linkData.classSection && (
            <span className="inline-block mt-2 px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
              Registering for: {linkData.className} - Section {linkData.classSection}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Student Photo */}
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
                          onClick={() => {
                            setPhotoPreview(null);
                            setPhotoFile(null);
                          }}
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

          {/* Dynamic Fields */}
          {otherFields.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Registration Details</CardTitle>
                <CardDescription>Please fill in all required information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {otherFields.map(renderField)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/")} disabled={isUploadingPhoto}>
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={isUploadingPhoto}>
              {isUploadingPhoto ? "Uploading Photo..." : "Submit Registration"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
