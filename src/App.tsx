import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

// Public pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import StudentRegistration from "./pages/register/StudentRegistration";

// Unified Dashboard pages
import UnifiedDashboard from "./pages/dashboard/UnifiedDashboard";
import AcademicSetup from "./pages/dashboard/AcademicSetup";
import Timetable from "./pages/dashboard/Timetable";
import AttendanceModule from "./pages/dashboard/AttendanceModule";
import FeesModule from "./pages/dashboard/FeesModule";
import ReportsModule from "./pages/dashboard/ReportsModule";
import NotificationsModule from "./pages/dashboard/NotificationsModule";
import ProfilePage from "./pages/dashboard/ProfilePage";
import TeacherManagement from "./pages/dashboard/TeacherManagement";
import HomeworkModule from "./pages/dashboard/HomeworkModule";
import StudentManagement from "./pages/dashboard/StudentManagement";

// Super Admin pages
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SchoolManagement from "./pages/superadmin/SchoolManagement";
import PlatformReports from "./pages/superadmin/PlatformReports";
import PlatformSettings from "./pages/superadmin/PlatformSettings";
import SuperAdminLogin from "./pages/superadmin/SuperAdminLogin";
import IDCardTemplate from "./pages/superadmin/IDCardTemplate";
import IDCardGeneration from "./pages/superadmin/IDCardGeneration";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<StudentRegistration />} />
            
            {/* Unified Dashboard Routes (School Admin & Teacher) */}
            <Route path="/dashboard" element={<UnifiedDashboard />} />
            <Route path="/dashboard/academic" element={<AcademicSetup />} />
            <Route path="/dashboard/timetable" element={<Timetable />} />
            <Route path="/dashboard/attendance" element={<AttendanceModule />} />
            <Route path="/dashboard/fees" element={<FeesModule />} />
            <Route path="/dashboard/reports" element={<ReportsModule />} />
            <Route path="/dashboard/notifications" element={<NotificationsModule />} />
            <Route path="/dashboard/profile" element={<ProfilePage />} />
            <Route path="/dashboard/teachers" element={<TeacherManagement />} />
            <Route path="/dashboard/homework" element={<HomeworkModule />} />
            <Route path="/dashboard/students" element={<StudentManagement />} />
            
            {/* Super Admin Routes */}
            <Route path="/superadmin/login" element={<SuperAdminLogin />} />
            <Route path="/superadmin" element={<SuperAdminDashboard />} />
            <Route path="/superadmin/schools" element={<SchoolManagement />} />
            <Route path="/superadmin/reports" element={<PlatformReports />} />
            <Route path="/superadmin/settings" element={<PlatformSettings />} />
            <Route path="/superadmin/id-templates" element={<IDCardTemplate />} />
            <Route path="/superadmin/id-cards" element={<IDCardGeneration />} />
            
            {/* Legacy redirects */}
            <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
            <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />
            <Route path="/teacher" element={<Navigate to="/dashboard" replace />} />
            <Route path="/teacher/*" element={<Navigate to="/dashboard" replace />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
