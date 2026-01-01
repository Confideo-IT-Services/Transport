import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import StudentRegistration from "./pages/StudentRegistration";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ClassManagement from "./pages/admin/ClassManagement";
import StudentManagement from "./pages/admin/StudentManagement";
import TeacherManagement from "./pages/admin/TeacherManagement";
import Reports from "./pages/admin/Reports";
import Notifications from "./pages/admin/Notifications";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import MyClass from "./pages/teacher/MyClass";
import Attendance from "./pages/teacher/Attendance";
import Homework from "./pages/teacher/Homework";
import TeacherNotifications from "./pages/teacher/TeacherNotifications";
import ProgressReports from "./pages/teacher/ProgressReports";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SchoolManagement from "./pages/superadmin/SchoolManagement";
import PlatformReports from "./pages/superadmin/PlatformReports";
import PlatformSettings from "./pages/superadmin/PlatformSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<StudentRegistration />} />
          
          {/* Super Admin Routes */}
          <Route path="/superadmin" element={<SuperAdminDashboard />} />
          <Route path="/superadmin/schools" element={<SchoolManagement />} />
          <Route path="/superadmin/reports" element={<PlatformReports />} />
          <Route path="/superadmin/settings" element={<PlatformSettings />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/classes" element={<ClassManagement />} />
          <Route path="/admin/students" element={<StudentManagement />} />
          <Route path="/admin/teachers" element={<TeacherManagement />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/notifications" element={<Notifications />} />
          
          {/* Teacher Routes */}
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/class" element={<MyClass />} />
          <Route path="/teacher/attendance" element={<Attendance />} />
          <Route path="/teacher/homework" element={<Homework />} />
          <Route path="/teacher/notifications" element={<TeacherNotifications />} />
          <Route path="/teacher/reports" element={<ProgressReports />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
