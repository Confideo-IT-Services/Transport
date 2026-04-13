import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Bus,
  MapPin,
  ScanLine,
  Bell,
  LogOut,
  ChevronRight,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearTransportSession, isTransportAuthenticated } from "@transport/transportSession";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const nav = [
  { to: "/transport", end: true, label: "Overview", icon: LayoutDashboard },
  { to: "/transport/parents", label: "Parents & children", icon: Users },
  { to: "/transport/drivers", label: "Drivers", icon: UserCircle },
  { to: "/transport/buses", label: "Buses", icon: Bus },
  { to: "/transport/routes", label: "Routes", icon: MapPin },
  { to: "/transport/attendance", label: "Attendance (RFID)", icon: ScanLine },
  { to: "/transport/rfid", label: "RFID tags", icon: ScanLine },
  { to: "/transport/announcements", label: "Announcements", icon: Bell },
];

export default function TransportLayout() {
  const navigate = useNavigate();

  if (!isTransportAuthenticated()) {
    return <Navigate to="/transport/login" replace />;
  }

  const logout = () => {
    clearTransportSession();
    navigate("/transport/login", { replace: true });
  };

  const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 p-2 space-y-0.5">
      {nav.map(({ to, end, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
          <ChevronRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-64 shrink-0 border-r bg-muted/30 flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Bus className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">Transport</p>
            <p className="text-muted-foreground text-xs">Admin console</p>
          </div>
        </div>
        <NavItems />
        <div className="p-2 border-t">
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center gap-3 px-3 sm:px-6 bg-background/80 backdrop-blur-sm">
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <div className="p-4 border-b flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <Bus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm leading-tight">Transport</p>
                    <p className="text-muted-foreground text-xs">Admin console</p>
                  </div>
                </div>
                <NavItems />
                <div className="p-2 border-t">
                  <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" onClick={logout}>
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="text-sm text-muted-foreground truncate">
            Transport operations · <span className="text-foreground font-medium">RDS drivers</span> · map: Amazon Location{" "}
            <span className="hidden sm:inline">
              (<code className="text-xs">Transport/.env</code>)
            </span>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
