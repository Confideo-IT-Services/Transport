import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  User, 
  Mail, 
  Phone, 
  School, 
  BookOpen, 
  Lock,
  Save,
  Loader2,
  MapPin,
  Building,
  Hash
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authApi, schoolsApi } from "@/lib/api";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingSchool, setIsEditingSchool] = useState(false);
  const [isSavingSchool, setIsSavingSchool] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Personal info form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // School details form state
  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [schoolLocation, setSchoolLocation] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Initialize forms with user data
  useEffect(() => {
    if (user) {
      // Personal info
      const nameParts = user.name?.split(" ") || [];
      setFirstName(nameParts[0] || "");
      setLastName(nameParts.slice(1).join(" ") || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");

      // School details
      setSchoolName(user.schoolName || "");
      setSchoolType(user.schoolType || "");
      setSchoolLocation(user.schoolLocation || "");
      setSchoolAddress(user.schoolAddress || "");
      setSchoolPhone(user.schoolPhone || "");
      setSchoolEmail(user.schoolEmail || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    // Validation
    if (!firstName.trim()) {
      toast({
        title: "Validation Error",
        description: "First name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const fullName = lastName.trim() 
        ? `${firstName.trim()} ${lastName.trim()}` 
        : firstName.trim();

      const updateData: any = {
        name: fullName,
      };

      if (user.role === 'teacher') {
        // Teachers can update email and phone
        if (email !== (user.email || "")) {
          updateData.email = email;
        }
        if (phone !== (user.phone || "")) {
          updateData.phone = phone;
        }
      } else if (user.role === 'admin') {
        // Admins can update email and phone
        if (email && email !== (user.email || "")) {
          updateData.email = email;
        }
        if (phone !== (user.phone || "")) {
          updateData.phone = phone;
        }
      }

      const response = await authApi.updateProfile(updateData);
      
      // Update user in context
      if (response.user) {
        setUser(response.user);
        // Also update localStorage
        localStorage.setItem("conventpulse_user", JSON.stringify(response.user));
      }

      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSchool = async () => {
    if (!user) return;

    try {
      setIsSavingSchool(true);
      await schoolsApi.updateMySchool({
        name: schoolName,
        type: schoolType,
        location: schoolLocation,
        address: schoolAddress,
        phone: schoolPhone,
        email: schoolEmail,
      });

      // Refresh user data to get updated school details
      const updatedUser = await authApi.verifyToken();
      setUser(updatedUser);
      localStorage.setItem("conventpulse_user", JSON.stringify(updatedUser));

      toast({
        title: "School Details Updated",
        description: "School information has been saved successfully.",
      });
      setIsEditingSchool(false);
    } catch (error: any) {
      console.error('Error updating school:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update school details",
        variant: "destructive",
      });
    } finally {
      setIsSavingSchool(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Validation Error",
        description: "All password fields are required",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "New password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Validation Error",
        description: "New password and confirm password do not match",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsChangingPassword(true);
      await authApi.changePassword({
        currentPassword,
        newPassword,
      });

      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });

      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original user data
    if (user) {
      const nameParts = user.name?.split(" ") || [];
      setFirstName(nameParts[0] || "");
      setLastName(nameParts.slice(1).join(" ") || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
    }
    setIsEditing(false);
  };

  const handleCancelSchool = () => {
    // Reset school form to original user data
    if (user) {
      setSchoolName(user.schoolName || "");
      setSchoolType(user.schoolType || "");
      setSchoolLocation(user.schoolLocation || "");
      setSchoolAddress(user.schoolAddress || "");
      setSchoolPhone(user.schoolPhone || "");
      setSchoolEmail(user.schoolEmail || "");
    }
    setIsEditingSchool(false);
  };

  if (!user) {
    return (
      <UnifiedLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </UnifiedLayout>
    );
  }

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">My Profile</h1>
            <p className="text-muted-foreground mt-1">
              View and manage your account settings
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Avatar className="w-24 h-24 mx-auto">
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {user?.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <h2 className="mt-4 text-xl font-semibold">{user?.name}</h2>
                <Badge className="mt-2" variant="secondary">
                  {user?.role === "admin" ? "School Admin" : "Class Teacher"}
                </Badge>
                <p className="mt-3 text-sm text-muted-foreground">{user?.schoolName}</p>
                {user?.className && (
                  <p className="text-sm text-muted-foreground">{user.className}</p>
                )}
              </div>
              
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{user?.email || "Not provided"}</span>
                </div>
                {user?.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{user.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <School className="w-4 h-4 text-muted-foreground" />
                  <span>{user?.schoolName}</span>
                </div>
                {user?.schoolCode && (
                  <div className="flex items-center gap-3 text-sm">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Code: {user.schoolCode}</span>
                  </div>
                )}
                {user?.schoolType && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{user.schoolType}</span>
                  </div>
                )}
                {user?.schoolLocation && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{user.schoolLocation}</span>
                  </div>
                )}
                {user?.role === "teacher" && user?.className && (
                  <div className="flex items-center gap-3 text-sm">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <span>{user.className}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Account Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="school" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="school">School Details</TabsTrigger>
                  <TabsTrigger value="personal">Personal Info</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>

                {/* School Details Tab */}
                <TabsContent value="school" className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>School Name</Label>
                      <Input 
                        value={schoolName} 
                        onChange={(e) => setSchoolName(e.target.value)}
                        disabled={!isEditingSchool} 
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>School Code</Label>
                        <Input value={user?.schoolCode || ""} disabled />
                        <p className="text-xs text-muted-foreground">School code cannot be changed</p>
                      </div>
                      <div className="space-y-2">
                        <Label>School Type</Label>
                        <Select value={schoolType} onValueChange={setSchoolType} disabled={!isEditingSchool}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Primary">Primary</SelectItem>
                            <SelectItem value="Secondary">Secondary</SelectItem>
                            <SelectItem value="High School">High School</SelectItem>
                            <SelectItem value="K-12">K-12</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Location (City, State)</Label>
                      <Input 
                        value={schoolLocation} 
                        onChange={(e) => setSchoolLocation(e.target.value)}
                        disabled={!isEditingSchool}
                        placeholder="e.g., New York, NY"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Textarea 
                        value={schoolAddress} 
                        onChange={(e) => setSchoolAddress(e.target.value)}
                        disabled={!isEditingSchool}
                        rows={3}
                        placeholder="Enter complete address..."
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>School Phone</Label>
                        <Input 
                          value={schoolPhone} 
                          onChange={(e) => setSchoolPhone(e.target.value)}
                          disabled={!isEditingSchool}
                          type="tel"
                          placeholder="+1 234-567-8900"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>School Email</Label>
                        <Input 
                          value={schoolEmail} 
                          onChange={(e) => setSchoolEmail(e.target.value)}
                          disabled={!isEditingSchool}
                          type="email"
                          placeholder="admin@school.edu"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      {isEditingSchool ? (
                        <>
                          <Button onClick={handleSaveSchool} disabled={isSavingSchool}>
                            {isSavingSchool ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                              </>
                            )}
                          </Button>
                          <Button variant="outline" onClick={handleCancelSchool} disabled={isSavingSchool}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button onClick={() => setIsEditingSchool(true)}>
                          Edit School Details
                        </Button>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Personal Info Tab */}
                <TabsContent value="personal" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input 
                        value={firstName} 
                        onChange={(e) => setFirstName(e.target.value)}
                        disabled={!isEditing} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input 
                        value={lastName} 
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={!isEditing} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={!isEditing} 
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={!isEditing}
                      type="tel"
                      placeholder="Enter phone number (optional)"
                    />
                    <p className="text-xs text-muted-foreground">Optional - You can add this later</p>
                  </div>
                  <div className="flex gap-3">
                    {isEditing ? (
                      <>
                        <Button onClick={handleSave} disabled={isSaving}>
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Save Changes
                            </>
                          )}
                        </Button>
                        <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => setIsEditing(true)}>
                        Edit Profile
                      </Button>
                    )}
                  </div>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Current Password</Label>
                    <Input 
                      type="password" 
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={isChangingPassword}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <Input 
                      type="password" 
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isChangingPassword}
                    />
                    <p className="text-xs text-muted-foreground">
                      Password must be at least 6 characters
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm New Password</Label>
                    <Input 
                      type="password" 
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isChangingPassword}
                    />
                  </div>
                  <Button onClick={handleChangePassword} disabled={isChangingPassword}>
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Update Password
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </UnifiedLayout>
  );
}
