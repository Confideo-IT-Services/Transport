import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getDriverJwt } from "@transport/driverSession";
import { driverChangePassword } from "@transport/lib/transportApi";

export default function DriverSettingsPage() {
  const jwt = useMemo(() => getDriverJwt(), []);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jwt) {
      toast.error("Not signed in (JWT missing). Please sign out and sign in again.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await driverChangePassword(jwt, { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Update your password for this driver account.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
          <CardDescription>You’ll need your current password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cur">Current password</Label>
              <Input id="cur" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New password</Label>
              <Input id="new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
            </div>
            <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700">
              {saving ? "Saving…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

