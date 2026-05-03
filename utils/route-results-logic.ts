/**
 * Pure helpers used by route-results and fetch-diverse-routes — fully unit-testable.
 */

export type RouteLogicStage = {
  mode?: string;
  duration?: string | number;
  line_code?: string;
  stop_name?: string;
  departure_minutes?: number | string | Array<number | string>;
  accessible?: boolean;
  warning?: string;
  slope_warning?: boolean;
};

export type RouteLogicItem = {
  total_duration?: string;
  totalDuration?: string;
  totalTime?: string;
  total_distance?: string;
  accessible?: boolean;
  slope_warning?: boolean;
  accompanied?: string;
  companion_mode?: string;
  recommended_for?: string;
  profile?: string;
  search_profile?: 'alone' | 'companied';
  stages?: RouteLogicStage[];
};

export type CompanionTab = 'alone' | 'companied';

export function routeDurationMinutes(route: RouteLogicItem): number {
  const value = `${route.total_duration ?? route.totalDuration ?? route.totalTime ?? ''}`;
  const hours = value.match(/(\d+)\s*h/i);
  const minutes = value.match(/(\d+)\s*min/i);
  const fromLabel = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  if (fromLabel > 0) return fromLabel;
  const onlyNumber = value.match(/\d+/)?.[0];
  return onlyNumber ? Number(onlyNumber) : 0;
}

export function stageDurationMinutes(stage: RouteLogicStage): number {
  const raw = `${stage.duration ?? ''}`;
  const hours = raw.match(/(\d+)\s*h/i);
  const minutes = raw.match(/(\d+)\s*min/i);
  const fromLabel = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  if (fromLabel > 0) return fromLabel;
  const onlyNumber = raw.match(/\d+/)?.[0];
  return onlyNumber ? Number(onlyNumber) : 0;
}

export function normalizeDepartureMinutes(value: RouteLogicStage['departure_minutes']): number | null {
  if (Array.isArray(value)) {
    const firstNumeric = value
      .map((v) => Number(v))
      .find((n) => Number.isFinite(n) && n >= 0);
    return typeof firstNumeric === 'number' ? firstNumeric : null;
  }
  const asNumber = Number(value);
  return Number.isFinite(asNumber) && asNumber >= 0 ? asNumber : null;
}

export function formatClockFromNow(deltaMinutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + deltaMinutes);
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatClockNow(): string {
  const d = new Date();
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatUnixToLocalClock(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function isClock(value?: string): boolean {
  return !!value && /^\d{1,2}:\d{2}$/.test(value.trim());
}

export function addMinutesToClock(clock: string, minutesToAdd: number): string {
  const [h, m] = clock.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setMinutes(d.getMinutes() + minutesToAdd);
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

export function minutesUntilClock(clock: string, now: Date = new Date()): number {
  const [h, m] = clock.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target.getTime() < now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
}

export function isWalkStageMode(mode?: string): boolean {
  const m = `${mode ?? ''}`.toLowerCase();
  return m === 'walk' || m === 'walking';
}

export function normalizeStageMode(mode?: string): 'walk' | 'bus' | 'subway' | 'other' {
  const m = `${mode ?? ''}`.toLowerCase();
  if (m === 'walk' || m === 'walking' || m === 'foot') return 'walk';
  if (m.includes('metro') || m.includes('subway') || m === 'rail') return 'subway';
  if (m.includes('bus') || m.includes('onibus')) return 'bus';
  return 'other';
}

export function routeSignature(route: RouteLogicItem): string {
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

export function routeTransportFamily(
  route: RouteLogicItem,
): 'walk-only' | 'bus-only' | 'subway-only' | 'combined' | 'other' {
  const set = new Set(
    (route.stages ?? [])
      .map((s) => normalizeStageMode(s.mode))
      .filter((m) => m === 'walk' || m === 'bus' || m === 'subway'),
  );
  const hasWalk = set.has('walk');
  const hasBus = set.has('bus');
  const hasSubway = set.has('subway');
  if (hasWalk && !hasBus && !hasSubway) return 'walk-only';
  if (hasBus && !hasWalk && !hasSubway) return 'bus-only';
  if (hasSubway && !hasWalk && !hasBus) return 'subway-only';
  if ((hasBus || hasSubway) && hasWalk) return 'combined';
  if (hasBus && hasSubway) return 'combined';
  return 'other';
}

export function routeCompanionAudience(route: RouteLogicItem): 'alone' | 'companied' | 'both' | null {
  const sp = route.search_profile;
  if (sp === 'alone') return 'alone';
  if (sp === 'companied') return 'companied';
  const rawValues = [
    route.accompanied,
    route.companion_mode,
    route.recommended_for,
    route.profile,
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim().toLowerCase());

  if (rawValues.length === 0) return null;
  const joined = rawValues.join(' ');
  const mentionsBoth =
    joined.includes('both') ||
    joined.includes('ambos') ||
    joined.includes('sozinho e acompanhado');
  const mentionsAlone =
    joined.includes('alone') ||
    joined.includes('solo') ||
    joined.includes('sozinho') ||
    joined.includes('individual');
  const mentionsCompanied =
    joined.includes('companied') ||
    joined.includes('acompanhado') ||
    joined.includes('with companion') ||
    joined.includes('com acompanhante');
  if (mentionsBoth || (mentionsAlone && mentionsCompanied)) return 'both';
  if (mentionsCompanied) return 'companied';
  if (mentionsAlone) return 'alone';
  return null;
}

export function stageNeedsAttention(stage: RouteLogicStage): boolean {
  if (stage.slope_warning === true) return true;
  const w = `${stage.warning ?? ''}`.trim();
  return w.length > 0;
}

export function isCalmRoute(route: RouteLogicItem): boolean {
  if (route.accessible === false) return false;
  if (route.slope_warning === true) return false;
  const stages = route.stages ?? [];
  return !stages.some((s) => stageNeedsAttention(s) || s.accessible === false);
}

export function routeIncidentCount(route: RouteLogicItem): number {
  const stages = route.stages ?? [];
  let incidents = route.slope_warning === true ? 1 : 0;
  for (const stage of stages) {
    if (stage.slope_warning === true) incidents += 1;
    if (stageNeedsAttention(stage)) incidents += 1;
  }
  return incidents;
}

export function routeMatchesCompanionTab(route: RouteLogicItem, tab: CompanionTab): boolean {
  if (route.accessible === false) return false;
  const incidents = routeIncidentCount(route);
  if (tab === 'alone') {
    return incidents === 0 && isCalmRoute(route);
  }
  return incidents <= 2;
}
