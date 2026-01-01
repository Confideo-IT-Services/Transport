import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  FileText,
  Bell,
  BarChart3,
  UserCheck,
  LogOut,
  School,
  CreditCard,
  Palette,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarProps {
  role: "admin" | "teacher" | "superadmin";
  onLogout: () => void;
}

const adminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Classes", href: "/admin/classes", icon: School },
  { label: "Students", href: "/admin/students", icon: GraduationCap },
  { label: "Teachers", href: "/admin/teachers", icon: Users },
  { label: "Reports", href: "/admin/reports", icon: BarChart3 },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
];

const teacherNavItems: NavItem[] = [
  { label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
  { label: "My Class", href: "/teacher/class", icon: Users },
  { label: "Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
  { label: "Homework", href: "/teacher/homework", icon: BookOpen },
  { label: "Notifications", href: "/teacher/notifications", icon: Bell },
  { label: "Progress Reports", href: "/teacher/reports", icon: FileText },
];

const superadminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/superadmin", icon: LayoutDashboard },
  { label: "Schools", href: "/superadmin/schools", icon: School },
  { label: "ID Templates", href: "/superadmin/id-templates", icon: Palette },
  { label: "Generate ID Cards", href: "/superadmin/id-cards", icon: CreditCard },
  { label: "Reports", href: "/superadmin/reports", icon: BarChart3 },
  { label: "Settings", href: "/superadmin/settings", icon: FileText },
];

export function Sidebar({ role, onLogout }: SidebarProps) {
  const location = useLocation();
  const navItems = role === "superadmin" 
    ? superadminNavItems 
    : role === "admin" 
    ? adminNavItems 
    : teacherNavItems;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <GraduationCap className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-sidebar-foreground">AllPulse</h1>
          <p className="text-xs text-muted-foreground capitalize">{role === "superadmin" ? "Super Admin" : role} Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "nav-item",
                isActive && "nav-item-active"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={onLogout}
          className="nav-item w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
