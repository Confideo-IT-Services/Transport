import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { schoolsApi, WhatsAppSettings } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageSquare, BookOpen, Calendar, IndianRupee, Bell, FileText, Clock, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function WhatsAppSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WhatsAppSettings>({
    whatsappEnabled: false,
    features: {
      homework: false,
      attendance: false,
      fees: false,
      notifications: false,
      reports: false,
      timetable: false
    }
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await schoolsApi.getWhatsAppSettings();
      setSettings(data);
    } catch (error: any) {
      console.error('Failed to load WhatsApp settings:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load WhatsApp settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await schoolsApi.updateWhatsAppSettings(settings);
      toast({
        title: "Success",
        description: "WhatsApp settings saved successfully"
      });
    } catch (error: any) {
      console.error('Failed to save WhatsApp settings:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save WhatsApp settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleWhatsApp = (enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      whatsappEnabled: enabled,
      // If disabling WhatsApp, disable all features
      features: enabled ? prev.features : {
        homework: false,
        attendance: false,
        fees: false,
        notifications: false,
        reports: false,
        timetable: false
      }
    }));
  };

  const toggleFeature = (feature: keyof WhatsAppSettings['features'], enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: enabled
      }
    }));
  };

  if (loading) {
    return (
      <UnifiedLayout role={user?.role === 'admin' ? 'admin' : 'teacher'}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </UnifiedLayout>
    );
  }

  const featureConfig = [
    {
      key: 'homework' as const,
      label: 'Homework',
      description: 'Send homework assignments to parents via WhatsApp',
      icon: BookOpen
    },
    {
      key: 'attendance' as const,
      label: 'Attendance',
      description: 'Send attendance reports to parents via WhatsApp',
      icon: Calendar
    },
    {
      key: 'fees' as const,
      label: 'Fees',
      description: 'Send fee reminders to parents via WhatsApp',
      icon: IndianRupee
    },
    {
      key: 'notifications' as const,
      label: 'Notifications',
      description: 'Send notifications to parents/teachers via WhatsApp',
      icon: Bell
    },
    {
      key: 'reports' as const,
      label: 'Test Reports',
      description: 'Send test results to parents via WhatsApp',
      icon: FileText
    },
    {
      key: 'timetable' as const,
      label: 'Timetable',
      description: 'Send timetable to teachers via WhatsApp',
      icon: Clock
    }
  ];

  return (
    <UnifiedLayout role={user?.role === 'admin' ? 'admin' : 'teacher'}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Integration Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure WhatsApp integration for your school. Enable WhatsApp for specific features to allow sending messages via WhatsApp in addition to app-to-app notifications.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>WhatsApp Integration</CardTitle>
                <CardDescription>
                  Master toggle for WhatsApp integration. When enabled, you can choose which features use WhatsApp.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="whatsapp-enabled" className="text-base font-medium">
                  Enable WhatsApp Integration
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow sending messages via WhatsApp API (in addition to app-to-app notifications)
                </p>
              </div>
              <Switch
                id="whatsapp-enabled"
                checked={settings.whatsappEnabled}
                onCheckedChange={toggleWhatsApp}
              />
            </div>

            {settings.whatsappEnabled && (
              <div className="mt-6 space-y-4">
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4">Feature-Specific Settings</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enable WhatsApp for specific features. When enabled, users will see both "Send via App" and "Send via WhatsApp" options.
                  </p>
                  
                  <div className="space-y-3">
                    {featureConfig.map((feature) => {
                      const Icon = feature.icon;
                      return (
                        <div
                          key={feature.key}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <Label htmlFor={`feature-${feature.key}`} className="text-base font-medium cursor-pointer">
                                {feature.label}
                              </Label>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {feature.description}
                              </p>
                            </div>
                          </div>
                          <Switch
                            id={`feature-${feature.key}`}
                            checked={settings.features[feature.key]}
                            onCheckedChange={(enabled) => toggleFeature(feature.key, enabled)}
                            disabled={!settings.whatsappEnabled}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="space-y-2">
              <p><strong>When WhatsApp is disabled:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Only "Send via App" option is available</li>
                <li>All messages are sent through app-to-app notifications</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p><strong>When WhatsApp is enabled for a feature:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Users see both "Send via App" and "Send via WhatsApp" options</li>
                <li>Users can choose their preferred method for each message</li>
                <li>WhatsApp messages are sent via WhatsApp Cloud API</li>
                <li>App notifications are still available as an alternative</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p><strong>Note:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>WhatsApp integration requires proper backend configuration</li>
                <li>Make sure WhatsApp API credentials are configured in backend environment variables</li>
                <li>Each school can independently configure their WhatsApp settings</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </UnifiedLayout>
  );
}

