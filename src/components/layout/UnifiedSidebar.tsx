import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
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
  Users,
  FileText,
  ChevronDown,
  ChevronRight,
  UserPlus,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  readOnly?: UserRole[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Admin sections (ERP-style organization)
const adminNavSections: NavSection[] = [
  {
    title: "",
    items: [
      { 
        label: "Dashboard", 
        href: "/dashboard", 
        icon: LayoutDashboard,
        roles: ["admin"]
      },
    ]
  },
  {
    title: "Academic Management",
    items: [
      { 
        label: "Academic Setup", 
        href: "/dashboard/academic", 
        icon: School,
        roles: ["admin"]
      },
      { 
        label: "Teachers", 
        href: "/dashboard/teachers", 
        icon: Users,
        roles: ["admin"]
      },
      { 
        label: "Students", 
        href: "/dashboard/students", 
        icon: GraduationCap,
        roles: ["admin"]
      },
      { 
        label: "Exit Formalities", 
        href: "/dashboard/exit-formalities", 
        icon: FileText,
        roles: ["admin"]
      },
    ]
  },
  {
    title: "Academic Operations",
    items: [
      { 
        label: "Timetable", 
        href: "/dashboard/timetable", 
        icon: Calendar,
        roles: ["admin"]
      },
      { 
        label: "Attendance", 
        href: "/dashboard/attendance", 
        icon: ClipboardCheck,
        roles: ["admin"]
      },
      { 
        label: "Visitor Management", 
        href: "/dashboard/visitor-management", 
        icon: UserPlus,
        roles: ["admin"]
      },
    ]
  },
  {
    title: "Financial Management",
    items: [
      { 
        label: "Fees", 
        href: "/dashboard/fees", 
        icon: IndianRupee,
        roles: ["admin"]
      },
    ]
  },
  {
    title: "Communication",
    items: [
      { 
        label: "Notifications", 
        href: "/dashboard/notifications", 
        icon: Bell,
        roles: ["admin"]
      },
    ]
  },
  {
    title: "Reports & Analytics",
    items: [
      { 
        label: "Reports", 
        href: "/dashboard/reports", 
        icon: BarChart3,
        roles: ["admin"]
      },
    ]
  },
  {
    title: "Settings",
    items: [
      { 
        label: "Profile", 
        href: "/dashboard/profile", 
        icon: User,
        roles: ["admin"]
      },
    ]
  },
];

// Teacher sections
const teacherNavSections: NavSection[] = [
  {
    title: "",
    items: [
      { 
        label: "Dashboard", 
        href: "/dashboard", 
        icon: LayoutDashboard,
        roles: ["teacher"]
      },
    ]
  },
  {
    title: "My Class",
    items: [
      { 
        label: "My Students", 
        href: "/dashboard/my-students", 
        icon: GraduationCap,
        roles: ["teacher"]
      },
    ]
  },
  {
    title: "Academic Operations",
    items: [
      { 
        label: "Timetable", 
        href: "/dashboard/timetable", 
        icon: Calendar,
        roles: ["teacher"],
        readOnly: ["teacher"]
      },
      { 
        label: "Attendance", 
        href: "/dashboard/attendance", 
        icon: ClipboardCheck,
        roles: ["teacher"]
      },
      { 
        label: "Homework", 
        href: "/dashboard/homework", 
        icon: BookOpen,
        roles: ["teacher"]
      },
      { 
        label: "Visitor Management", 
        href: "/dashboard/visitor-management", 
        icon: UserPlus,
        roles: ["teacher"]
      },
    ]
  },
  {
    title: "Communication",
    items: [
      { 
        label: "Notifications", 
        href: "/dashboard/notifications", 
        icon: Bell,
        roles: ["teacher"]
      },
    ]
  },
  {
    title: "Reports & Analytics",
    items: [
      { 
        label: "Reports", 
        href: "/dashboard/reports", 
        icon: BarChart3,
        roles: ["teacher"]
      },
    ]
  },
  {
    title: "Settings",
    items: [
      { 
        label: "Profile", 
        href: "/dashboard/profile", 
        icon: User,
        roles: ["teacher"]
      },
    ]
  },
];

// Parent sections (flat structure)
const parentNavItems: NavItem[] = [
  { 
    label: "Dashboard", 
    href: "/parent/dashboard", 
    icon: LayoutDashboard,
    roles: ["parent"]
  },
  { 
    label: "Attendance", 
    href: "/parent/dashboard/attendance", 
    icon: Calendar,
    roles: ["parent"]
  },
  { 
    label: "Homework", 
    href: "/parent/dashboard/homework", 
    icon: BookOpen,
    roles: ["parent"]
  },
  { 
    label: "Test Results", 
    href: "/parent/dashboard/results", 
    icon: FileText,
    roles: ["parent"]
  },
  { 
    label: "Fees", 
    href: "/parent/dashboard/fees", 
    icon: IndianRupee,
    roles: ["parent"]
  },
  { 
    label: "Visitor Management", 
    href: "/parent/dashboard/visitor-management", 
    icon: UserPlus,
    roles: ["parent"]
  },
  { 
    label: "Notifications", 
    href: "/parent/dashboard/notifications", 
    icon: Bell,
    roles: ["parent"]
  },
];

export function UnifiedSidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  
  // State for multiple open sections (not accordion - multiple can be open)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  // Get sections based on user role
  const getNavSections = (): NavSection[] | null => {
    if (!user) return null;
    if (user.role === "admin") return adminNavSections;
    if (user.role === "teacher") return teacherNavSections;
    return null;
  };

  const navSections = getNavSections();
  const isParent = user?.role === "parent";

  // Helper function to check if item is active
  const isItemActive = (item: NavItem): boolean => {
    if (item.href.startsWith('/parent/dashboard')) {
      return location.pathname === item.href || 
        (item.href === '/parent/dashboard/attendance' && location.pathname === '/parent/dashboard');
    } else {
      return location.pathname === item.href || 
        (item.href !== "/dashboard" && !item.href.startsWith('/parent') && location.pathname.startsWith(item.href));
    }
  };

  // Generate section key from title
  const getSectionKey = (title: string): string => {
    return title.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '').replace(/\//g, '-');
  };

  // Auto-open section containing the active page on route change
  useEffect(() => {
    if (!navSections) return;

    setOpenSections(prev => {
      const newSet = new Set(prev);
      
      // Find which section contains the currently active page
      for (const section of navSections) {
        if (!section.title) continue; // Skip sections without title
        
        const hasActiveItem = section.items.some(item => {
          if (item.href.startsWith('/parent/dashboard')) {
            return location.pathname === item.href || 
              (item.href === '/parent/dashboard/attendance' && location.pathname === '/parent/dashboard');
          } else {
            return location.pathname === item.href || 
              (item.href !== "/dashboard" && !item.href.startsWith('/parent') && location.pathname.startsWith(item.href));
          }
        });

        if (hasActiveItem) {
          const sectionKey = getSectionKey(section.title);
          newSet.add(sectionKey); // Auto-open section with active item
        }
      }
      
      return newSet;
    });
  }, [location.pathname, navSections]);

  // Handle section click (toggle open/closed, allow multiple sections open)
  const handleSectionClick = (sectionKey: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      // If section is open, close it; otherwise, open it
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  };

  // Check if a section should be open
  const isSectionOpen = (sectionKey: string): boolean => {
    return openSections.has(sectionKey);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <GraduationCap className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-sidebar-foreground">ConventPulse</h1>
          <p className="text-xs text-sidebar-foreground/60 capitalize">
            {user?.role === "admin" ? "School Admin" : user?.role === "teacher" ? "Class Teacher" : "Parent"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {isParent ? (
          // Parent: Flat structure (no sections)
          parentNavItems.map((item) => {
            const isActive = isItemActive(item);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })
        ) : navSections ? (
          // Admin & Teacher: Collapsible section-based structure
          navSections.map((section, sectionIndex) => {
            const sectionItems = section.items.filter(item => 
              user && item.roles.includes(user.role)
            );
            
            if (sectionItems.length === 0) return null;
            
            // Dashboard has no section (not collapsible)
            if (!section.title) {
              return (
                <div key={sectionIndex} className="mb-1">
                  {sectionItems.map((item) => {
                    const isActive = isItemActive(item);
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm",
                          isActive 
                            ? "bg-primary text-primary-foreground" 
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            }

            // Sections with titles support click-only (accordion)
            const sectionKey = getSectionKey(section.title);
            const isOpen = isSectionOpen(sectionKey);

            return (
              <div
                key={sectionIndex}
                className={sectionIndex > 0 ? "mt-1" : ""}
              >
                {/* Section Header */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSectionClick(sectionKey);
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-sidebar-accent transition-all duration-200 group cursor-pointer"
                >
                  <span className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                    {section.title}
                  </span>
                  <div className="transition-transform duration-200">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70" />
                    )}
                  </div>
                </button>
                
                {/* Section Items */}
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-200 ease-in-out",
                    isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="space-y-1 mt-1">
                    {sectionItems.map((item) => {
                      const isActive = isItemActive(item);
                      const isReadOnly = user && item.readOnly?.includes(user.role);
                      
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={(e) => {
                            // Prevent the dropdown from closing when clicking navigation items
                            e.stopPropagation();
                            // Keep the section open - don't change state
                          }}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm ml-2",
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
                  </div>
                </div>
              </div>
            );
          })
        ) : null}
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
