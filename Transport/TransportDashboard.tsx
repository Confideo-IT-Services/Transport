import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCircle, Bus, ScanLine } from "lucide-react";
import { getBuses, getParents, getDrivers } from "@transport/mock/mockStore";

export default function TransportDashboard() {
  const parents = getParents().length;
  const drivers = getDrivers().length;
  const buses = getBuses().length;

  const cards = [
    {
      title: "Parents & children",
      description: "Register bus travel, assign children to buses.",
      href: "/transport/parents",
      icon: Users,
      stat: `${parents} registered`,
    },
    {
      title: "Drivers",
      description: "Add drivers and assign bus + route.",
      href: "/transport/drivers",
      icon: UserCircle,
      stat: `${drivers} drivers`,
    },
    {
      title: "Buses & routes",
      description: "Fleet, routes, pickup/drop, live position (mock).",
      href: "/transport/buses",
      icon: Bus,
      stat: `${buses} buses`,
    },
    {
      title: "Attendance (RFID)",
      description: "Per-bus seat board status (green / red).",
      href: "/transport/attendance",
      icon: ScanLine,
      stat: "RFID scan UI",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transport overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage parents, drivers, buses, routes, and RFID boarding from this console.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, description, href, icon: Icon, stat }) => (
          <Link key={href} to={href} className="block group">
            <Card className="h-full transition-shadow hover:shadow-md border-emerald-600/15 hover:border-emerald-600/30">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="rounded-lg bg-emerald-600/10 p-2 text-emerald-700 dark:text-emerald-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs text-muted-foreground">{stat}</span>
                </div>
                <CardTitle className="text-lg group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                  {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Open →</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Drivers use a separate app:{" "}
        <Link to="/transport/driver/login" className="text-emerald-700 dark:text-emerald-400 underline font-medium">
          Open driver login
        </Link>
      </p>
    </div>
  );
}
