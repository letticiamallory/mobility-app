/**
 * Smoke test: mesma agregação que fetchDiverseRoutes (4× POST /routes/check) + merge/makeDisjoint.
 * Lê token e user id de mobility-api/.env (AUTH_LETTICIA_*).
 *
 * Uso (API rodando): npx tsx scripts/od-smoke-parque-ibirapuera.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { routeDurationMinutes, routeSignature } from '../utils/route-results-logic';

type FetchedRouteItem = {
  stages?: { mode?: string; line_code?: string; stop_name?: string }[];
  total_duration?: string;
  totalDuration?: string;
  totalTime?: string;
  total_distance?: string;
  accessible?: boolean;
  search_profile?: 'alone' | 'companied';
  accessibility_score?: number;
  route_id?: number;
  [key: string]: unknown;
};

function loadMobilityApiEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, '../../mobility-api/.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function dualFromApiBody(body: Record<string, unknown>): {
  alone: FetchedRouteItem[];
  companied: FetchedRouteItem[];
} {
  const ra = body.routes_alone;
  const rc = body.routes_companied;
  if (Array.isArray(ra) || Array.isArray(rc)) {
    return {
      alone: Array.isArray(ra) ? (ra as FetchedRouteItem[]) : [],
      companied: Array.isArray(rc) ? (rc as FetchedRouteItem[]) : [],
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

function makeDisjoint(alone: FetchedRouteItem[], companied: FetchedRouteItem[]): FetchedRouteItem[] {
  const aloneKeys = new Set(alone.map((r) => routeSignature(r)));
  return companied.filter((r) => !aloneKeys.has(routeSignature(r)));
}

async function postCheck(
  base: string,
  token: string,
  userId: number,
  transportType: string,
  origin: string,
  destination: string,
): Promise<Record<string, unknown>> {
  const body = {
    origin,
    destination,
    user_id: userId,
    transport_type: transportType,
  };
  const r = await fetch(`${base}/routes/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`HTTP ${r.status}: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Resposta não-JSON: ${text.slice(0, 200)}`);
  }
}

function mergeLikeClient(results: Record<string, unknown>[]): {
  alone: FetchedRouteItem[];
  companied: FetchedRouteItem[];
  companiedBeforeDisjoint: FetchedRouteItem[];
} {
  const mergedAlone: FetchedRouteItem[] = [];
  const mergedCompanied: FetchedRouteItem[] = [];
  for (const parsed of results) {
    const { alone, companied } = dualFromApiBody(parsed);
    mergedAlone.push(...alone);
    mergedCompanied.push(...companied);
  }
  let aloneOut = dedupeBySignature(mergedAlone);
  let companiedOut = dedupeBySignature(mergedCompanied);
  const companiedBeforeDisjoint = companiedOut;
  companiedOut = makeDisjoint(aloneOut, companiedOut);
  const sortByDurationThenAccessibility = (a: FetchedRouteItem, b: FetchedRouteItem) => {
    const durDiff = routeDurationMinutes(a) - routeDurationMinutes(b);
    if (durDiff !== 0) return durDiff;
    return accessibilitySortKey(b) - accessibilitySortKey(a);
  };
  aloneOut.sort(sortByDurationThenAccessibility);
  companiedOut.sort(sortByDurationThenAccessibility);
  return { alone: aloneOut, companied: companiedOut, companiedBeforeDisjoint };
}

async function main() {
  const env = loadMobilityApiEnv();
  const port = env.PORT ?? '3000';
  const base = `http://127.0.0.1:${port}`;
  const token = env.AUTH_LETTICIA_BYPASS_TOKEN?.trim();
  const userId = Number.parseInt(env.AUTH_LETTICIA_USER_ID ?? '1', 10);
  if (!token) {
    console.error('Defina AUTH_LETTICIA_BYPASS_TOKEN em mobility-api/.env');
    process.exit(1);
  }

  const origin = 'Shopping Parque da Cidade, São Paulo';
  const destination = 'Shopping Ibirapuera, São Paulo';
  const transports = ['bus', 'subway', 'combined', 'walk'] as const;

  console.log('OD:', origin, '→', destination);
  console.log('API:', base, 'user_id:', userId);
  console.log('');

  const bodies: Record<string, unknown>[] = [];
  for (const t of transports) {
    process.stdout.write(`  ${t}… `);
    try {
      const parsed = await postCheck(base, token, userId, t, origin, destination);
      bodies.push(parsed);
      const { alone, companied } = dualFromApiBody(parsed);
      console.log(`alone=${alone.length} companied=${companied.length}`);
    } catch (e) {
      console.log('ERRO', (e as Error).message);
    }
  }

  const merged = mergeLikeClient(bodies);
  const dropped =
    merged.companiedBeforeDisjoint.length - merged.companied.length;

  console.log('');
  console.log('Após merge + dedupe + makeDisjoint (como o app):');
  console.log('  alone:', merged.alone.length);
  console.log('  companied:', merged.companied.length);
  console.log('  acompanhado removido por makeDisjoint (mesma assinatura que sozinho):', dropped);

  /** Critério de produto: ≥ 3 em cada aba. */
  const aloneOk = merged.alone.length >= 3;
  const companiedOk = merged.companied.length >= 3;
  console.log('');
  console.log('Critérios de produto:');
  console.log('  alone ≥ 3:', aloneOk ? 'OK' : 'FALHA');
  console.log('  companied ≥ 3:', companiedOk ? 'OK' : 'FALHA');
  if (!aloneOk || !companiedOk) {
    console.log('');
    console.log(
      '⚠ Reinicie a API para aplicar as novas faixas (70-100 / 40-69) e o top-N (3 / aba).',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
