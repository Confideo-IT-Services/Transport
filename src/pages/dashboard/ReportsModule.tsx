import { useState } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, TrendingUp, Users, IndianRupee, ClipboardCheck } from "lucide-react";

const attendanceData = [
  { month: "Jan", attendance: 92 },
  { month: "Feb", attendance: 88 },
  { month: "Mar", attendance: 95 },
  { month: "Apr", attendance: 91 },
  { month: "May", attendance: 87 },
  { month: "Jun", attendance: 93 },
];

const feeCollectionData = [
  { month: "Jan", collected: 450000, pending: 50000 },
  { month: "Feb", collected: 420000, pending: 80000 },
  { month: "Mar", collected: 480000, pending: 20000 },
  { month: "Apr", collected: 460000, pending: 40000 },
];

const homeworkData = [
  { week: "Week 1", assigned: 25, completed: 22 },
  { week: "Week 2", assigned: 28, completed: 25 },
  { week: "Week 3", assigned: 30, completed: 27 },
  { week: "Week 4", assigned: 24, completed: 23 },
];

const classPerformance = [
  { name: "Class 1", value: 85, color: "hsl(217 91% 60%)" },
  { name: "Class 2", value: 78, color: "hsl(142 71% 45%)" },
  { name: "Class 3", value: 92, color: "hsl(38 92% 50%)" },
  { name: "Class 4", value: 88, color: "hsl(280 70% 50%)" },
  { name: "Class 5", value: 82, color: "hsl(0 84% 60%)" },
];

export default function ReportsModule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedPeriod, setSelectedPeriod] = useState("month");

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? "School-wide performance insights and analytics"
                : "Class performance and student progress reports"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export All
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClipboardCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">91.2%</p>
                  <p className="text-sm text-muted-foreground">Avg Attendance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {isAdmin && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <IndianRupee className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">₹18.1L</p>
                    <p className="text-sm text-muted-foreground">Fee Collected</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">87%</p>
                  <p className="text-sm text-muted-foreground">HW Completion</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isAdmin ? "524" : "42"}</p>
                  <p className="text-sm text-muted-foreground">{isAdmin ? "Total Students" : "My Students"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Trend */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Attendance Trend</CardTitle>
                <Button variant="ghost" size="sm">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[80, 100]} />
                  <Tooltip 
                    contentStyle={{ 
                      background: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="attendance" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Homework Completion */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Homework Activity</CardTitle>
                <Button variant="ghost" size="sm">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={homeworkData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      background: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }} 
                  />
                  <Bar dataKey="assigned" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted" />
                  <span className="text-sm text-muted-foreground">Assigned</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-secondary" />
                  <span className="text-sm text-muted-foreground">Completed</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fee Collection (Admin Only) */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Fee Collection</CardTitle>
                  <Button variant="ghost" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={feeCollectionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        background: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                      formatter={(value: number) => [`₹${(value/1000).toFixed(0)}K`]}
                    />
                    <Bar dataKey="collected" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pending" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-secondary" />
                    <span className="text-sm text-muted-foreground">Collected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive" />
                    <span className="text-sm text-muted-foreground">Pending</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Class Performance */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {isAdmin ? "Class-wise Performance" : "Subject Performance"}
                </CardTitle>
                <Button variant="ghost" size="sm">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={classPerformance}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {classPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {classPerformance.map((item) => (
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
      </div>
    </UnifiedLayout>
  );
}
