/**
 * Resolve Amazon Location map resource from env (ARN or region + map name).
 * ARN format: arn:aws:geo:REGION:account:map/MapName
 */
export function resolveLocationMapConfig(): { region: string; mapName: string } | null {
  const arn = import.meta.env.VITE_AWS_LOCATION_MAP_ARN as string | undefined;
  if (arn?.trim()) {
    const m = arn.trim().match(/^arn:aws:geo:([^:]+):[0-9]+:map\/(.+)$/);
    if (m) {
      return { region: m[1], mapName: m[2] };
    }
  }
  const region = (import.meta.env.VITE_AWS_LOCATION_REGION as string | undefined)?.trim();
  const mapName = (import.meta.env.VITE_AWS_LOCATION_MAP_NAME as string | undefined)?.trim();
  if (region && mapName) {
    return { region, mapName };
  }
  return null;
}

/** Maps API v2 style preset (Standard, Monochrome, Hybrid, Satellite) — matches API keys with geo-maps GetTile on provider/default. */
export function buildMapsV2StyleDescriptorUrl(region: string, stylePreset: string, apiKey?: string): string {
  const style = stylePreset.trim() || "Standard";
  const path = `https://maps.geo.${region}.amazonaws.com/v2/styles/${encodeURIComponent(style)}/descriptor`;
  if (apiKey) {
    return `${path}?key=${encodeURIComponent(apiKey)}`;
  }
  return path;
}

/**
 * Maps API v0 style descriptor for a named map resource (`/maps/v0/maps/{name}/style-descriptor`).
 * Intended for IAM/Cognito signing; API keys often get 403 here — prefer {@link buildMapsV2StyleDescriptorUrl}.
 */
export function buildMapStyleDescriptorUrl(region: string, mapName: string, apiKey?: string): string {
  const path = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${encodeURIComponent(mapName)}/style-descriptor`;
  if (apiKey) {
    return `${path}?key=${encodeURIComponent(apiKey)}`;
  }
  return path;
}
