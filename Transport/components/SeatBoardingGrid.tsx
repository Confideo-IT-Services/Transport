import { cn } from "@/lib/utils";
import type { SeatBoardingState } from "@transport/types";

export function SeatBoardingGrid({ seats }: { seats: SeatBoardingState[] }) {
  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
      }}
    >
      {seats.map((s) => (
        <div
          key={s.seatNumber}
          title={s.childName ? `${s.childName}` : `Seat ${s.seatNumber}`}
          className={cn(
            "aspect-square rounded-md border text-xs font-medium flex flex-col items-center justify-center p-1 text-center leading-tight",
            s.boarded
              ? "bg-emerald-600/20 border-emerald-600/50 text-emerald-900 dark:text-emerald-100"
              : "bg-red-500/10 border-red-400/40 text-red-800 dark:text-red-300",
          )}
        >
          <span className="opacity-70">{s.seatNumber}</span>
          {s.boarded && s.childName && (
            <span className="truncate w-full text-[10px] font-normal opacity-90">{s.childName}</span>
          )}
        </div>
      ))}
    </div>
  );
}
