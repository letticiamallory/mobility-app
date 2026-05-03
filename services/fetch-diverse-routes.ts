import { routeDurationMinutes, routeSignature } from '../utils/route-results-logic';
import { ROUTES_FETCH_TIMEOUT_MS, searchRoutes } from './routes.service';

const DEFAULT_TRANSPORT_TYPE = 'bus';

/** Forma mínima compatível com o payload de `routes` em route-results. */
export type FetchedRouteItem = {
  stages?: { mode?: string; line_code?: string; stop_name?: string }[];
  total_duration?: string;
  totalDuration?: string;
  totalTime?: string;
  total_distance?: string;
  accessible?: boolean;
  search_profile?: 'alone' | 'companied';
  accessibility_score?: number;
  [key: string]: unknown;
};

export type DiverseRoutesPayload = {
  alone: FetchedRouteItem[];
  companied: FetchedRouteItem[];
};

function dualFromApiBody(body: Record<string, unknown>): DiverseRoutesPayload {
  const ra = body.routes_alone;
  const rc = body.routes_companied;
  if (Array.isArray(ra) && Array.isArray(rc)) {
    return {
      alone: ra as FetchedRouteItem[],
      companied: rc as FetchedRouteItem[],
    };
  }
  const legacy = Array.isArray(body.routes) ? (body.routes as FetchedRouteItem[]) : [];
  const sp = body.search_profile;
  if (sp === 'alone') return { alone: legacy, companied: [] };
  if (sp === 'companied') return { alone: [], companied: legacy };
  return { alone: legacy, companied: [] };
}

function accessibilitySortKey(route: FetchedRouteItem): number {
  const raw = route.accessibility_score;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/** Mantém a ocorrência com maior `accessibility_score` quando a assinatura colide. */
function dedupeBySignature(routes: FetchedRouteItem[]): FetchedRouteItem[] {
  const bySig = new Map<string, FetchedRouteItem>();
  for (const route of routes) {
    const key = routeSignature(route);
    const prev = bySig.get(key);
    if (!prev) {
      bySig.set(key, route);
      continue;
    }
    if (accessibilitySortKey(route) > accessibilitySortKey(prev)) {
      bySig.set(key, route);
    }
  }
  return Array.from(bySig.values());
}

/** Remove da lista acompanhado qualquer trajeto cuja assinatura já está em “sozinho”. */
function makeDisjoint(alone: FetchedRouteItem[], companied: FetchedRouteItem[]): FetchedRouteItem[] {
  const aloneKeys = new Set(alone.map((r) => routeSignature(r)));
  return companied.filter((r) => !aloneKeys.has(routeSignature(r)));
}

/**
 * Agrega várias respostas de transporte (bus / metro / …): deduplica e mantém abas disjuntas.
 * Ordena por duração total ascendente; desempate = maior `accessibility_score`.
 */
export async function fetchDiverseRoutes(
  originQuery: string,
  destinationQuery: string,
  userId: number,
  accompanied?: string,
  timeFilter?: string,
  timeValue?: string,
  routePreference?: string,
): Promise<DiverseRoutesPayload> {
  const overallController = new AbortController();
  const overallTimer = setTimeout(
    () => overallController.abort(),
    ROUTES_FETCH_TIMEOUT_MS,
  );
  const accompaniedToSend = accompanied && accompanied.trim() ? accompanied : undefined;
  const mergeSettled = (results: PromiseSettledResult<unknown>[]) => {
    const mergedAlone: FetchedRouteItem[] = [];
    const mergedCompanied: FetchedRouteItem[] = [];
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const parsed =
        result.value && typeof result.value === 'object'
          ? (result.value as Record<string, unknown>)
          : {};
      const { alone, companied } = dualFromApiBody(parsed);
      mergedAlone.push(...alone);
      mergedCompanied.push(...companied);
    }
    let aloneOut = dedupeBySignature(mergedAlone);
    let companiedOut = dedupeBySignature(mergedCompanied);
    companiedOut = makeDisjoint(aloneOut, companiedOut);
    const sortByDurationThenAccessibility = (a: FetchedRouteItem, b: FetchedRouteItem) => {
      const durDiff = routeDurationMinutes(a) - routeDurationMinutes(b);
      if (durDiff !== 0) return durDiff;
      return accessibilitySortKey(b) - accessibilitySortKey(a);
    };
    aloneOut.sort(sortByDurationThenAccessibility);
    companiedOut.sort(sortByDurationThenAccessibility);
    return { alone: aloneOut, companied: companiedOut };
  };

  const transportTypes = ['bus', 'subway', 'combined', 'walk'] as const;
  try {
    const allResults = await Promise.allSettled(
      transportTypes.map((transportType) =>
        searchRoutes(
          originQuery,
          destinationQuery,
          userId,
          transportType,
          accompaniedToSend,
          timeFilter,
          timeValue,
          routePreference,
          { signal: overallController.signal },
        ),
      ),
    );
    let merged = mergeSettled(allResults);

    if (
      merged.alone.length === 0 &&
      merged.companied.length === 0 &&
      !overallController.signal.aborted
    ) {
      const fallbackRaw = await searchRoutes(
        originQuery,
        destinationQuery,
        userId,
        DEFAULT_TRANSPORT_TYPE,
        accompaniedToSend,
        timeFilter,
        timeValue,
        routePreference,
        { signal: overallController.signal },
      );
      const parsed =
        fallbackRaw && typeof fallbackRaw === 'object'
          ? (fallbackRaw as Record<string, unknown>)
          : {};
      merged = mergeSettled([{ status: 'fulfilled', value: parsed }]);
    }

    return merged;
  } finally {
    clearTimeout(overallTimer);
  }
}
