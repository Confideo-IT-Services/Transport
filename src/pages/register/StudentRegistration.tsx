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
import { Upload, CheckCircle, GraduationCap, Camera, X, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { registrationLinksApi, studentsApi, uploadApi, otpApi } from "@/lib/api";

interface FormField {
  id: string;
  fieldName: string;
  label: string;
  fieldType: 'text' | 'textarea' | 'radio' | 'select' | 'tel' | 'email' | 'file' | 'checkbox' | 'date';
  mandatory: boolean;
  options?: string[];
  requires_otp?: boolean;
  is_primary_identity?: boolean;
}

export default function StudentRegistration() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const code = searchParams.get("code") || "";
  
  const [isLoading, setIsLoading] = useState(true);
  const [linkData, setLinkData] = useState<{
    name?: string | null;
    linkType?: string;
    classId: string | null;
    className: string | null;
    classSection: string | null;
    fieldConfig: FormField[];
    classes?: { id: string; name: string; section: string }[];
  } | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [otpState, setOtpState] = useState<{
    fieldName: string | null;
    mobile: string;
    otp: string;
    isVerified: boolean;
    isSending: boolean;
    isVerifying: boolean;
    error: string | null;
    canResend: boolean;
    resendTimer: number;
  }>({
    fieldName: null,
    mobile: '',
    otp: '',
    isVerified: false,
    isSending: false,
    isVerifying: false,
    error: null,
    canResend: false,
    resendTimer: 0,
  });
  
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
          name: data.name ?? null,
          linkType: data.linkType,
          classId: data.classId ?? null,
          className: data.className ?? null,
          classSection: data.classSection ?? null,
          fieldConfig: data.fieldConfig || [],
          classes: data.classes || [],
        });
        setSelectedClassId("");
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

  // Resend timer countdown
  useEffect(() => {
    if (otpState.resendTimer > 0) {
      const timer = setTimeout(() => {
        setOtpState(prev => ({ ...prev, resendTimer: prev.resendTimer - 1 }));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (otpState.resendTimer === 0 && !otpState.canResend) {
      setOtpState(prev => ({ ...prev, canResend: true }));
    }
  }, [otpState.resendTimer, otpState.canResend]);

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

  // OTP handler functions
  const handleSendOTP = async (mobile: string, fieldName: string) => {
    const cleanedMobile = mobile.replace(/\D/g, '');
    
    if (cleanedMobile.length !== 10) {
      setOtpState(prev => ({ ...prev, error: 'Please enter a valid 10-digit mobile number' }));
      return;
    }

    setOtpState(prev => ({ 
      ...prev, 
      isSending: true, 
      error: null,
      fieldName,
      mobile: cleanedMobile,
      isVerified: false,
      otp: '',
    }));

    try {
      const response = await otpApi.send(cleanedMobile);
      setOtpState(prev => ({ 
        ...prev, 
        isSending: false,
        canResend: false,
        resendTimer: 60, // 60 seconds cooldown
        error: null,
      }));
      toast.success('OTP sent successfully to your mobile number');
    } catch (error: any) {
      setOtpState(prev => ({ 
        ...prev, 
        isSending: false,
        error: error?.message || 'Failed to send OTP',
      }));
      toast.error(error?.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOTP = async () => {
    const cleanedOtp = otpState.otp.replace(/\D/g, '');
    
    if (cleanedOtp.length !== 6) {
      setOtpState(prev => ({ ...prev, error: 'Please enter a valid 6-digit OTP' }));
      return;
    }

    setOtpState(prev => ({ ...prev, isVerifying: true, error: null }));

    try {
      const response = await otpApi.verify(otpState.mobile, cleanedOtp);
      setOtpState(prev => ({ 
        ...prev, 
        isVerifying: false,
        isVerified: true,
        error: null,
      }));
      toast.success('Mobile number verified successfully');
    } catch (error: any) {
      setOtpState(prev => ({ 
        ...prev, 
        isVerifying: false,
        error: error?.message || 'Invalid OTP',
      }));
      toast.error(error?.message || 'Invalid OTP. Please try again.');
    }
  };

  const handleResendOTP = async () => {
    if (!otpState.mobile || !otpState.fieldName) return;
    
    setOtpState(prev => ({ ...prev, isSending: true, error: null }));
    
    try {
      await otpApi.resend(otpState.mobile);
      setOtpState(prev => ({ 
        ...prev, 
        isSending: false,
        canResend: false,
        resendTimer: 60,
        error: null,
      }));
      toast.success('OTP resent successfully');
    } catch (error: any) {
      setOtpState(prev => ({ 
        ...prev, 
        isSending: false,
        error: error?.message || 'Failed to resend OTP',
      }));
      toast.error(error?.message || 'Failed to resend OTP');
    }
  };

  // Handle phone number change - reset OTP if number changes
  const handlePhoneChange = (fieldName: string, value: string) => {
    handleInputChange(fieldName, value);
    
    // If this is the OTP-required field and number changed, reset OTP state
    const cleanedValue = value.replace(/\D/g, '');
    if (otpState.fieldName === fieldName && cleanedValue !== otpState.mobile) {
      setOtpState({
        fieldName: null,
        mobile: '',
        otp: '',
        isVerified: false,
        isSending: false,
        isVerifying: false,
        error: null,
        canResend: false,
        resendTimer: 0,
      });
    }
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

    // For all_classes links, class selection is required
    const isAllClasses = linkData.linkType === 'all_classes';
    const effectiveClassId = isAllClasses ? selectedClassId : linkData.classId;
    
    // Validate class is selected
    if (!effectiveClassId) {
      toast.error("Class assignment is required for this registration");
      return;
    }

    // Check OTP verification if required
    const primaryPhoneField = linkData.fieldConfig.find(
      (f) => f.fieldType === 'tel' && f.requires_otp === true && f.is_primary_identity === true
    );
    
    if (primaryPhoneField) {
      const phoneFieldName = primaryPhoneField.fieldName || primaryPhoneField.field_id || primaryPhoneField.id;
      const phoneValue = formData[phoneFieldName];
      const cleanedPhone = typeof phoneValue === 'string' ? phoneValue.replace(/\D/g, '') : '';
      
      if (!otpState.isVerified || 
          otpState.mobile !== cleanedPhone || 
          otpState.fieldName !== phoneFieldName) {
        toast.error('Please verify your mobile number before submitting the form');
        return;
      }
    }
    
    try {
      // Map form data to backend format
      const studentData: any = {
        registrationCode: code, // Send code to get schoolId from backend
        classId: effectiveClassId,
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

      // Add OTP verification status
      if (primaryPhoneField) {
        studentData.otp_verified = otpState.isVerified;
        studentData.verified_mobile_number = otpState.isVerified ? otpState.mobile : undefined;
      }

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
      
      case "tel":
        const cleanedMobile = typeof value === 'string' ? value.replace(/\D/g, '') : '';
        const requiresOTP = field.requires_otp === true;
        const isPrimaryIdentity = field.is_primary_identity === true;
        const isOTPField = requiresOTP && isPrimaryIdentity;
        const isCurrentOTPField = otpState.fieldName === field.fieldName;
        const showOTPUI = isOTPField && cleanedMobile.length === 10;

        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.fieldName}>
              {field.label} {isMandatory && <span className="text-destructive">*</span>}
              {isCurrentOTPField && otpState.isVerified && (
                <CheckCircle2 className="inline-block w-4 h-4 text-green-500 ml-2" />
              )}
            </Label>
            <Input
              id={field.fieldName}
              type="tel"
              placeholder={`Enter ${field.label.toLowerCase()}`}
              value={typeof value === 'string' ? value : ""}
              onChange={(e) => handlePhoneChange(field.fieldName, e.target.value)}
              maxLength={10}
            />
            
            {/* OTP UI - Only show for primary identity field with requires_otp */}
            {showOTPUI && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                {!isCurrentOTPField && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendOTP(cleanedMobile, field.fieldName)}
                    disabled={cleanedMobile.length !== 10 || otpState.isSending}
                    className="w-full"
                  >
                    {otpState.isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send OTP'
                    )}
                  </Button>
                )}
                
                {isCurrentOTPField && !otpState.isVerified && (
                  <>
                    <div className="space-y-2">
                      <Label>Enter OTP</Label>
                      <Input
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={otpState.otp}
                        onChange={(e) => {
                          const otpValue = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setOtpState(prev => ({ ...prev, otp: otpValue, error: null }));
                        }}
                        maxLength={6}
                      />
                      {otpState.error && (
                        <p className="text-sm text-destructive">{otpState.error}</p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleVerifyOTP}
                        disabled={otpState.otp.length !== 6 || otpState.isVerifying}
                        className="flex-1"
                      >
                        {otpState.isVerifying ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          'Verify OTP'
                        )}
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResendOTP}
                        disabled={!otpState.canResend || otpState.isSending}
                      >
                        {otpState.isSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : otpState.resendTimer > 0 ? (
                          `Resend (${otpState.resendTimer}s)`
                        ) : (
                          'Resend'
                        )}
                      </Button>
                    </div>
                  </>
                )}
                
                {isCurrentOTPField && otpState.isVerified && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Mobile number verified</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      default: // text, email
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
          <h1 className="text-3xl font-bold text-foreground">{linkData.name?.trim() || "Student Registration"}</h1>
          <p className="text-muted-foreground mt-2">Fill in the details to register</p>
          {linkData.linkType === 'class' && linkData.className && (
            <span className="inline-block mt-2 px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
              Registering for: {linkData.className}{linkData.classSection ? ` - Section ${linkData.classSection}` : ""}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Class and Section selection - only when link was generated for "All classes" */}
          {linkData.linkType === 'all_classes' && linkData.classes && linkData.classes.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Class and Section</CardTitle>
                <CardDescription>Select the class and section you are registering for</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Class and Section <span className="text-destructive">*</span></Label>
                  <Select
                    value={selectedClassId}
                    onValueChange={setSelectedClassId}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class and section" />
                    </SelectTrigger>
                    <SelectContent>
                      {linkData.classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}{cls.section ? ` - Section ${cls.section}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Student Photo */}
          {showPhoto && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">
                  Photo {photoMandatory && <span className="text-destructive">*</span>}
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
            <Button
              type="submit"
              size="lg"
              disabled={
                isUploadingPhoto ||
                (linkData.linkType === 'all_classes' && !selectedClassId)
              }
            >
              {isUploadingPhoto ? "Uploading Photo..." : "Submit Registration"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
