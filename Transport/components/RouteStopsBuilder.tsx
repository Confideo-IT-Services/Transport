import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown, Loader2, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchPlaceDetails, fetchPlacesAutocomplete, type PlaceSuggestion } from "@transport/lib/transportApi";

export type RouteStopInput = {
  name: string;
  lat: number;
  lng: number;
};

type Props = {
  stops: RouteStopInput[];
  onChange: (stops: RouteStopInput[]) => void;
  disabled?: boolean;
};

export function RouteStopsBuilder({ stops, onChange, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingPick, setLoadingPick] = useState(false);
  const [openList, setOpenList] = useState(false);
  const [jsonFallback, setJsonFallback] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debounced.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoadingSuggest(true);
    fetchPlacesAutocomplete(debounced)
      .then((s) => {
        if (!cancelled) {
          setSuggestions(s);
          setOpenList(true);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setSuggestions([]);
          const msg = e instanceof Error ? e.message : "Autocomplete failed";
          toast.error(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSuggest(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpenList(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const addStop = useCallback(
    async (s: PlaceSuggestion) => {
      setLoadingPick(true);
      setOpenList(false);
      setQuery("");
      setSuggestions([]);
      try {
        const d = await fetchPlaceDetails(s.placeId);
        onChange([...stops, { name: d.name, lat: d.lat, lng: d.lng }]);
      } catch {
        toast.error("Could not load coordinates for that place. Try another result.");
      } finally {
        setLoadingPick(false);
      }
    },
    [onChange, stops],
  );

  const removeAt = (index: number) => {
    onChange(stops.filter((_, i) => i !== index));
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonFallback) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
      const next = parsed.map((x: { name?: string; lat?: number; lng?: number }) => ({
        name: String(x.name || ""),
        lat: Number(x.lat),
        lng: Number(x.lng),
      }));
      if (next.some((s) => !s.name || Number.isNaN(s.lat) || Number.isNaN(s.lng))) throw new Error("invalid");
      onChange(next);
      toast.success("Stops replaced from JSON");
    } catch {
      toast.error('Invalid JSON. Use: [{"name":"…","lat":0,"lng":0}, …]');
    }
  };

  return (
    <div className="space-y-4">
      <div ref={wrapRef} className="relative space-y-2">
        <Label>Add stop (search)</Label>
        <div className="relative">
          <Input
            placeholder="Type area name — e.g. Jubilee Hills, Ameerpet…"
            value={query}
            disabled={disabled || loadingPick}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenList(true);
            }}
            onFocus={() => suggestions.length > 0 && setOpenList(true)}
            autoComplete="off"
          />
          {loadingSuggest && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {openList && suggestions.length > 0 && (
          <ul
            className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md"
            role="listbox"
          >
            {suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent",
                    loadingPick && "opacity-50 pointer-events-none",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void addStop(s)}
                >
                  <span className="font-medium">{s.title}</span>
                  {s.subtitle ? <span className="text-xs text-muted-foreground">{s.subtitle}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Suggestions use Amazon Location Places (Hyderabad bias). Live bus tracking will use a Tracker later.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Stops in order (morning 1 → N)</Label>
        {stops.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stops yet. Search and pick above.</p>
        ) : (
          <ol className="space-y-2">
            {stops.map((s, i) => (
              <li
                key={`${s.lat}-${s.lng}-${i}`}
                className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-xs font-semibold text-emerald-800">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 font-medium">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{s.name}</span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  disabled={disabled}
                  onClick={() => removeAt(i)}
                  aria-label={`Remove stop ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4" />
          Advanced: paste JSON stops
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <Textarea
            className="font-mono text-xs min-h-[100px]"
            placeholder='[{"name":"School","lat":17.38,"lng":78.48}]'
            value={jsonFallback}
            onChange={(e) => setJsonFallback(e.target.value)}
            disabled={disabled}
          />
          <Button type="button" variant="secondary" size="sm" onClick={applyJson} disabled={disabled}>
            Replace stops from JSON
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
