import { useState } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  ClipboardCheck,
  Clock,
  TrendingUp,
  Calendar,
  Bell
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const adminClassData = [
  { name: "Class 1", students: 45 },
  { name: "Class 2", students: 42 },
  { name: "Class 3", students: 48 },
  { name: "Class 4", students: 40 },
  { name: "Class 5", students: 44 },
];

const attendanceData = [
  { name: "Present", value: 85, color: "hsl(142 71% 45%)" },
  { name: "Absent", value: 10, color: "hsl(0 84% 60%)" },
  { name: "Leave", value: 5, color: "hsl(38 92% 50%)" },
];

const recentActivities = [
  { id: 1, action: "Attendance marked for Class 5A", time: "10 mins ago", icon: ClipboardCheck },
  { id: 2, action: "New student registered", time: "1 hour ago", icon: GraduationCap },
  { id: 3, action: "Fee reminder sent", time: "2 hours ago", icon: Bell },
  { id: 4, action: "Timetable updated", time: "3 hours ago", icon: Calendar },
];

export default function UnifiedDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Good Morning, {user?.name?.split(" ")[0]}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? "Here's what's happening at your school today."
                : `Here's what's happening in ${user?.className} today.`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-lg font-medium text-foreground">
              {new Date().toLocaleDateString("en-IN", { 
                weekday: "long", 
                day: "numeric", 
                month: "short", 
                year: "numeric" 
              })}
            </p>
          </div>
        </div>

        {/* Stats Grid - Different for each role */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isAdmin ? (
            <>
              <StatCard
                title="Total Classes"
                value="12"
                icon={BookOpen}
                trend="+2 this year"
                trendUp={true}
                iconColor="text-primary"
                iconBg="bg-primary/10"
              />
              <StatCard
                title="Total Students"
                value="524"
                icon={GraduationCap}
                trend="+18 this month"
                trendUp={true}
                iconColor="text-secondary"
                iconBg="bg-secondary/10"
              />
              <StatCard
                title="Total Teachers"
                value="28"
                icon={Users}
                trend="All active"
                trendUp={true}
                iconColor="text-accent"
                iconBg="bg-accent/10"
              />
              <StatCard
                title="Pending Approvals"
                value="5"
                icon={Clock}
                trend="2 new today"
                trendUp={false}
                iconColor="text-destructive"
                iconBg="bg-destructive/10"
              />
            </>
          ) : (
            <>
              <StatCard
                title="My Class Students"
                value="42"
                icon={Users}
                trend={user?.className || ""}
                trendUp={true}
                iconColor="text-primary"
                iconBg="bg-primary/10"
              />
              <StatCard
                title="Present Today"
                value="38"
                icon={ClipboardCheck}
                trend="90% attendance"
                trendUp={true}
                iconColor="text-secondary"
                iconBg="bg-secondary/10"
              />
              <StatCard
                title="Absent Today"
                value="4"
                icon={TrendingUp}
                trend="Parents notified"
                trendUp={false}
                iconColor="text-destructive"
                iconBg="bg-destructive/10"
              />
              <StatCard
                title="Homework This Week"
                value="8"
                icon={BookOpen}
                trend="3 pending review"
                trendUp={true}
                iconColor="text-accent"
                iconBg="bg-accent/10"
              />
            </>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Class Distribution / Today's Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isAdmin ? "Students per Class" : "Today's Schedule"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAdmin ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={adminClassData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        background: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Bar dataKey="students" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="space-y-3">
                  {[
                    { time: "08:00 - 08:45", subject: "Mathematics", room: "Room 101" },
                    { time: "08:45 - 09:30", subject: "English", room: "Room 101" },
                    { time: "09:45 - 10:30", subject: "Science", room: "Lab 2" },
                    { time: "10:30 - 11:15", subject: "Hindi", room: "Room 101" },
                    { time: "11:30 - 12:15", subject: "Social Studies", room: "Room 101" },
                  ].map((period, i) => (
                    <div 
                      key={i} 
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        i === 0 ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${i === 0 ? "text-primary" : "text-foreground"}`}>
                          {period.subject}
                        </p>
                        <p className="text-sm text-muted-foreground">{period.room}</p>
                      </div>
                      <p className={`text-sm ${i === 0 ? "text-primary font-medium" : "text-muted-foreground"}`}>
                        {period.time}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isAdmin ? "Today's Attendance Overview" : "My Class Attendance"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={attendanceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {attendanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                {attendanceData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {item.name} ({item.value}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <activity.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </UnifiedLayout>
  );
}
