import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Bus,
  MapPin,
  ScanLine,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearTransportSession, isTransportAuthenticated } from "@transport/transportSession";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/transport", end: true, label: "Overview", icon: LayoutDashboard },
  { to: "/transport/parents", label: "Parents & children", icon: Users },
  { to: "/transport/drivers", label: "Drivers", icon: UserCircle },
  { to: "/transport/buses", label: "Buses", icon: Bus },
  { to: "/transport/routes", label: "Routes", icon: MapPin },
  { to: "/transport/attendance", label: "Attendance (RFID)", icon: ScanLine },
  { to: "/transport/rfid", label: "RFID tags", icon: ScanLine },
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

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 shrink-0 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Bus className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">Transport</p>
            <p className="text-muted-foreground text-xs">Admin console</p>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
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
        <div className="p-2 border-t">
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center px-6 bg-background/80 backdrop-blur-sm">
          <div className="text-sm text-muted-foreground">
            Transport operations · <span className="text-foreground font-medium">RDS drivers</span> · map: Amazon
            Location (<code className="text-xs">Transport/.env</code>)
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
