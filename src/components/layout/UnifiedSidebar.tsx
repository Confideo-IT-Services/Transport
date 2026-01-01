import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  Calendar,
  Bell,
  BarChart3,
  LogOut,
  User,
  IndianRupee,
  School,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  readOnly?: UserRole[];
}

const navItems: NavItem[] = [
  { 
    label: "Dashboard", 
    href: "/dashboard", 
    icon: LayoutDashboard,
    roles: ["admin", "teacher"]
  },
  { 
    label: "Academic Setup", 
    href: "/dashboard/academic", 
    icon: School,
    roles: ["admin", "teacher"],
    readOnly: ["teacher"]
  },
  { 
    label: "Timetable", 
    href: "/dashboard/timetable", 
    icon: Calendar,
    roles: ["admin", "teacher"],
    readOnly: ["teacher"]
  },
  { 
    label: "Attendance", 
    href: "/dashboard/attendance", 
    icon: ClipboardCheck,
    roles: ["admin", "teacher"]
  },
  { 
    label: "Fees", 
    href: "/dashboard/fees", 
    icon: IndianRupee,
    roles: ["admin", "teacher"],
    readOnly: ["teacher"]
  },
  { 
    label: "Reports", 
    href: "/dashboard/reports", 
    icon: BarChart3,
    roles: ["admin", "teacher"]
  },
  { 
    label: "Notifications", 
    href: "/dashboard/notifications", 
    icon: Bell,
    roles: ["admin", "teacher"]
  },
  { 
    label: "Profile", 
    href: "/dashboard/profile", 
    icon: User,
    roles: ["admin", "teacher"]
  },
];

export function UnifiedSidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const filteredNavItems = navItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <GraduationCap className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-sidebar-foreground">AllPulse</h1>
          <p className="text-xs text-sidebar-foreground/60 capitalize">
            {user?.role === "admin" ? "School Admin" : "Class Teacher"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
          const isReadOnly = user && item.readOnly?.includes(user.role);
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
              {isReadOnly && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-foreground/60">
                  View
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {user?.name.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.name}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {user?.schoolName}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
