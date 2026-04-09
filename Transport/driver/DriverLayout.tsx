import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
import { LayoutDashboard, Map, ScanLine, LogOut, ChevronRight, Bus, Menu, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearDriverSession,
  getDriverSession,
  isDriverAuthenticated,
  resolveDriverBusId,
  resolveDriverDisplayName,
} from "@transport/driverSession";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const nav = [
  { to: "/transport/driver", end: true, label: "Today", icon: LayoutDashboard },
  { to: "/transport/driver/my-route", label: "Route & map", icon: Map },
  { to: "/transport/driver/attendance", label: "Attendance", icon: ScanLine },
  { to: "/transport/driver/settings", label: "Settings", icon: Settings },
];

export default function DriverLayout() {
  const navigate = useNavigate();

  if (!isDriverAuthenticated()) {
    return <Navigate to="/transport/driver/login" replace />;
  }

  const session = getDriverSession();
  const busId = session ? resolveDriverBusId(session) : undefined;
  const resolved = session ? resolveDriverDisplayName(session) : "Driver";
  const displayName = resolved !== "Driver" ? resolved : "Driver";
  const busLabel = session?.busName || (busId ? `Bus (${busId.slice(0, 8)}…)` : "—");
  const busReg = session?.busRegistrationNo || "";

  const logout = () => {
    clearDriverSession();
    navigate("/transport/driver/login", { replace: true });
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
                ? "bg-amber-600/15 text-amber-900 dark:text-amber-300 font-medium"
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white">
            <Bus className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{displayName}</p>
            <p className="text-muted-foreground text-xs truncate">{busLabel}</p>
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white">
                    <Bus className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-tight truncate">{displayName}</p>
                    <p className="text-muted-foreground text-xs truncate">{busLabel}</p>
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
            Driver console · <span className="text-foreground font-medium">{busReg}</span>
            <span className="mx-2">·</span>
            <span className="text-xs">{session?.token ? "Signed in (RDS)" : "Demo / offline"}</span>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
