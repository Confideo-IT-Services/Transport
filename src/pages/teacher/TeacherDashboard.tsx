import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickAction } from "@/components/dashboard/QuickAction";
import { Users, UserCheck, UserX, BookOpen, ClipboardCheck, Bell, FileText, AlertTriangle, Megaphone } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const weeklyAttendance = [
  { day: "Mon", present: 42, absent: 3 },
  { day: "Tue", present: 40, absent: 5 },
  { day: "Wed", present: 44, absent: 1 },
  { day: "Thu", present: 41, absent: 4 },
  { day: "Fri", present: 43, absent: 2 },
];

// Admin announcements for teachers
const adminAnnouncements = [
  { id: 1, title: "Staff Meeting Tomorrow", message: "All teachers are required to attend the staff meeting at 3 PM in the conference room.", time: "2 hours ago", priority: "urgent" },
  { id: 2, title: "New Curriculum Guidelines", message: "Please review the updated curriculum guidelines shared via email.", time: "1 day ago", priority: "normal" },
  { id: 3, title: "Report Submission Deadline", message: "Reminder: Progress reports for Q1 are due by Friday.", time: "2 days ago", priority: "normal" },
];

export default function TeacherDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <DashboardLayout role="teacher" userName="Sarah Johnson" onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6 border border-primary/20">
          <h1 className="text-2xl font-bold text-foreground">Welcome back, Sarah! 👋</h1>
          <p className="text-muted-foreground mt-1">You're managing <span className="font-medium text-primary">Class 3A</span> today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Students"
            value={45}
            icon={Users}
            iconColor="text-primary"
            iconBg="bg-primary/10"
          />
          <StatCard
            title="Present Today"
            value={42}
            icon={UserCheck}
            iconColor="text-secondary"
            iconBg="bg-secondary/10"
          />
          <StatCard
            title="Absent Today"
            value={3}
            icon={UserX}
            iconColor="text-accent"
            iconBg="bg-accent/10"
          />
          <StatCard
            title="Homework This Week"
            value={8}
            icon={BookOpen}
            iconColor="text-primary"
            iconBg="bg-primary/10"
          />
        </div>

        {/* Charts and Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly Attendance Chart */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="section-title">Weekly Attendance</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyAttendance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="present" name="Present" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name="Absent" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <h3 className="section-title">Quick Actions</h3>
            <div className="space-y-3">
              <QuickAction
                title="Take Attendance"
                description="Mark today's attendance"
                icon={ClipboardCheck}
                onClick={() => navigate("/teacher/attendance")}
              />
              <QuickAction
                title="Send Homework"
                description="Assign new homework"
                icon={BookOpen}
                onClick={() => navigate("/teacher/homework")}
              />
              <QuickAction
                title="Send Notification"
                description="Notify parents"
                icon={Bell}
                onClick={() => navigate("/teacher/notifications")}
              />
              <QuickAction
                title="Upload Report"
                description="Progress reports"
                icon={FileText}
                onClick={() => navigate("/teacher/reports")}
              />
            </div>
          </div>
        </div>

        {/* Admin Announcements */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="section-title flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Announcements from School Admin
          </h3>
          <div className="space-y-4 mt-4">
            {adminAnnouncements.map((announcement) => (
              <div
                key={announcement.id}
                className={`p-4 rounded-lg border ${
                  announcement.priority === "urgent"
                    ? "bg-warning/5 border-warning/30"
                    : "bg-muted/30 border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  {announcement.priority === "urgent" ? (
                    <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                  ) : (
                    <Bell className="w-5 h-5 text-muted-foreground mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">{announcement.title}</h4>
                      {announcement.priority === "urgent" && (
                        <span className="badge badge-warning text-xs">Urgent</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{announcement.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">{announcement.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="section-title">Recent Activity</h3>
          <div className="space-y-4">
            {[
              { action: "Marked attendance", time: "Today, 9:00 AM", type: "attendance" },
              { action: "Sent Math homework", time: "Today, 10:30 AM", type: "homework" },
              { action: "Uploaded progress report for Alex J.", time: "Yesterday, 3:00 PM", type: "report" },
              { action: "Sent notification about field trip", time: "Yesterday, 11:00 AM", type: "notification" },
            ].map((activity, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === "attendance" ? "bg-success" :
                  activity.type === "homework" ? "bg-primary" :
                  activity.type === "report" ? "bg-warning" : "bg-info"
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
