import { searchRoutes } from './routes.service';

const DEFAULT_TRANSPORT_TYPE = 'bus';

/** Forma mínima compatível com o payload de `routes` em route-results. */
export type FetchedRouteItem = {
  stages?: { mode?: string; line_code?: string; stop_name?: string }[];
  total_duration?: string;
  totalDuration?: string;
  totalTime?: string;
  total_distance?: string;
  accessible?: boolean;
  [key: string]: unknown;
};

function normalizeStageMode(mode?: string): 'walk' | 'bus' | 'subway' | 'other' {
  const m = `${mode ?? ''}`.toLowerCase();
  if (m === 'walk' || m === 'walking' || m === 'foot') return 'walk';
  if (m.includes('metro') || m.includes('subway') || m === 'rail') return 'subway';
  if (m.includes('bus') || m.includes('onibus')) return 'bus';
  return 'other';
}

function routeSignature(route: FetchedRouteItem): string {
  const modes = (route.stages ?? [])
    .map((s) => {
      const mode = normalizeStageMode(s.mode);
      const line = `${s.line_code ?? ''}`.trim().toLowerCase();
      const stop = `${s.stop_name ?? ''}`.trim().toLowerCase();
      return `${mode}:${line}:${stop}`;
    })
    .join('|');
  const duration = `${route.total_duration ?? route.totalDuration ?? route.totalTime ?? ''}`.trim().toLowerCase();
  const distance = `${route.total_distance ?? ''}`.trim().toLowerCase();
  return `${duration}::${distance}::${modes}`;
}

export async function fetchDiverseRoutes(
  originQuery: string,
  destinationQuery: string,
  userId: number,
  accompanied: string,
  timeFilter?: string,
  timeValue?: string,
  routePreference?: string,
): Promise<FetchedRouteItem[]> {
  const mergeSettled = (results: PromiseSettledResult<unknown>[]) => {
    const merged: FetchedRouteItem[] = [];
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const parsed =
        result.value && typeof result.value === 'object' ? (result.value as Record<string, unknown>) : {};
      const list = Array.isArray(parsed.routes) ? (parsed.routes as FetchedRouteItem[]) : [];
      merged.push(...list);
    }
    return merged;
  };

  const fastTypes = ['bus', 'subway', 'combined'] as const;
  const fastResults = await Promise.allSettled(
    fastTypes.map((transportType) =>
      searchRoutes(
        originQuery,
        destinationQuery,
        userId,
        transportType,
        accompanied,
        timeFilter,
        timeValue,
        routePreference,
      ),
    ),
  );
  let merged = mergeSettled(fastResults);

  const walkResults = await Promise.allSettled([
    searchRoutes(
      originQuery,
      destinationQuery,
      userId,
      'walk',
      accompanied,
      timeFilter,
      timeValue,
      routePreference,
    ),
  ]);
  merged = merged.concat(mergeSettled(walkResults));

  if (merged.length === 0) {
    const fallbackRaw = await searchRoutes(
      originQuery,
      destinationQuery,
      userId,
      DEFAULT_TRANSPORT_TYPE,
      accompanied,
      timeFilter,
      timeValue,
      routePreference,
    );
    const parsed =
      fallbackRaw && typeof fallbackRaw === 'object' ? (fallbackRaw as Record<string, unknown>) : {};
    return Array.isArray(parsed.routes) ? (parsed.routes as FetchedRouteItem[]) : [];
  }
  const bySignature = new Map<string, FetchedRouteItem>();
  for (const route of merged) {
    const key = routeSignature(route);
    if (!bySignature.has(key)) bySignature.set(key, route);
  }
  return Array.from(bySignature.values());
}
