import { useState } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Mail, 
  Phone, 
  School, 
  BookOpen, 
  Lock,
  Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    toast({
      title: "Profile Updated",
      description: "Your profile has been saved successfully.",
    });
    setIsEditing(false);
  };

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
                  <span>{user?.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>+91 98765 43210</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <School className="w-4 h-4 text-muted-foreground" />
                  <span>{user?.schoolName}</span>
                </div>
                {user?.role === "teacher" && (
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
              <Tabs defaultValue="personal" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="personal">Personal Info</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input defaultValue={user?.name.split(" ")[0]} disabled={!isEditing} />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input defaultValue={user?.name.split(" ")[1]} disabled={!isEditing} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input defaultValue={user?.email} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input defaultValue="+91 98765 43210" disabled={!isEditing} />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input defaultValue="123, Main Street, New Delhi" disabled={!isEditing} />
                  </div>
                  <div className="flex gap-3">
                    {isEditing ? (
                      <>
                        <Button onClick={handleSave}>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>
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

                <TabsContent value="security" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Current Password</Label>
                    <Input type="password" placeholder="Enter current password" />
                  </div>
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <Input type="password" placeholder="Enter new password" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm New Password</Label>
                    <Input type="password" placeholder="Confirm new password" />
                  </div>
                  <Button>
                    <Lock className="w-4 h-4 mr-2" />
                    Update Password
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
