import { CheckCircle2, Circle, TrainFront } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RouteStop } from "@transport/types";

type Status = "covered" | "current" | "upcoming";

function stopStatus(index: number, currentStopIndex: number): Status {
  if (index < currentStopIndex) return "covered";
  if (index === currentStopIndex) return "current";
  return "upcoming";
}

export function RouteCheckpointTimeline({
  stops,
  currentStopIndex,
  busLabel,
}: {
  stops: RouteStop[];
  currentStopIndex: number;
  busLabel?: string;
}) {
  if (stops.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">No checkpoints on this route yet.</p>
    );
  }

  const sorted = [...stops].sort((a, b) => a.order - b.order);

  return (
    <div className="w-full">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
        Checkpoints · covered vs upcoming (metro-style)
      </p>

      <ul className="relative space-y-0">
        {sorted.map((stop, i) => {
          const status = stopStatus(i, currentStopIndex);
          const isLast = i === sorted.length - 1;
          /* Rail below node i is “completed” once the bus has moved past stop i */
          const railComplete = i < currentStopIndex;

          return (
            <li key={stop.id} className="relative flex gap-4 pb-8 last:pb-0">
              {/* Vertical rail */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-[18px] top-10 bottom-0 w-0.5 -translate-x-1/2",
                    railComplete ? "bg-emerald-500" : "bg-muted",
                  )}
                  aria-hidden
                />
              )}

              {/* Station marker */}
              <div
                className={cn(
                  "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2",
                  status === "covered" &&
                    "border-emerald-600 bg-emerald-600 text-white shadow-sm",
                  status === "current" &&
                    "border-emerald-600 bg-background text-emerald-700 ring-4 ring-emerald-600/25",
                  status === "upcoming" && "border-dashed border-muted-foreground/45 bg-muted/40 text-muted-foreground",
                )}
              >
                {status === "covered" && <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />}
                {status === "current" && <TrainFront className="h-4 w-4" />}
                {status === "upcoming" && <Circle className="h-4 w-4" strokeWidth={2} />}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={cn(
                    "font-semibold leading-snug",
                    status === "covered" && "text-emerald-800 dark:text-emerald-300",
                    status === "current" && "text-emerald-700 dark:text-emerald-400",
                    status === "upcoming" && "text-muted-foreground",
                  )}
                >
                  {stop.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {status === "covered" && "Covered — bus has passed this checkpoint"}
                  {status === "current" &&
                    (busLabel
                      ? `${busLabel} is at or departing this stop`
                      : "Bus is at or departing this stop")}
                  {status === "upcoming" && "Yet to cover"}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 pt-4 border-t text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Covered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <TrainFront className="h-3.5 w-3.5 text-emerald-600" /> Current
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Circle className="h-3.5 w-3.5" /> Yet to cover
        </span>
      </div>
    </div>
  );
}
