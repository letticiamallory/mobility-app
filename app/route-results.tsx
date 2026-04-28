import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import {
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Stage = {
  mode?: string;
  distance?: string;
  duration?: string | number;
  line_code?: string;
  instruction?: string;
  stop_name?: string;
  departure_time?: string;
  arrival_time?: string;
  departureTime?: string;
  arrivalTime?: string;
  departure_minutes?: number | string | Array<number | string>;
  street_view_image?: string;
  points?: { latitude: number; longitude: number }[];
  accessible?: boolean;
  warning?: string;
  slope_warning?: boolean;
};

type RouteItem = {
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
  uber_deeplink?: string;
  departTime?: string;
  arriveTime?: string;
  stages?: Stage[];
};

const uberDeepLink = 'uber://?action=setPickup';

function collectStageDetailImages(stage: Stage): string[] {
  const raw = stage as unknown as Record<string, unknown>;
  const urls: string[] = [];
  const pushIfUrl = (value: unknown) => {
    if (typeof value !== 'string') return;
    const v = value.trim();
    if (/^https?:\/\//i.test(v)) urls.push(v);
  };

  pushIfUrl(stage.street_view_image);
  pushIfUrl(raw.image_url);
  pushIfUrl(raw.imageUrl);
  pushIfUrl(raw.photo_url);
  pushIfUrl(raw.photoUrl);
  pushIfUrl(raw.preview_image);

  const listKeys = [
    'street_view_images',
    'slope_images',
    'slope_photos',
    'warning_images',
    'images',
    'photos',
  ] as const;
  for (const key of listKeys) {
    const arr = raw[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) pushIfUrl(item);
  }

  return urls.filter((u, i, a) => a.indexOf(u) === i);
}

const getLineColor = (code: string): string => {
  const colors = [
    '#E53935', '#FB8C00', '#43A047', '#1E88E5',
    '#8E24AA', '#00897B', '#F4511E', '#D81B60',
    '#6D4C41', '#546E7A', '#039BE5', '#7CB342',
    '#FFB300', '#3949AB', '#00ACC1', '#E91E63',
  ];
  const hash = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

type DetailLatLng = { latitude: number; longitude: number };

function normalizeStageModeForDetail(mode?: string): 'walk' | 'bus' | 'subway' {
  const m = `${mode ?? ''}`.toLowerCase();
  if (m === 'walk' || m === 'walking' || m === 'foot') return 'walk';
  if (m.includes('metro') || m.includes('subway') || m === 'rail') return 'subway';
  return 'bus';
}

function serializeRouteDetail(
  route: RouteItem,
  ctx: {
    origin: string;
    destination: string;
    originCoordinate: DetailLatLng;
    destinationCoordinate: DetailLatLng;
  },
): string {
  const stages = (route.stages ?? []).map((s) => {
    const pts = Array.isArray(s.points)
      ? (s.points as { latitude?: number; longitude?: number }[])
          .filter(
            (p) =>
              typeof p?.latitude === 'number' &&
              typeof p?.longitude === 'number' &&
              Number.isFinite(p.latitude) &&
              Number.isFinite(p.longitude),
          )
          .map((p) => ({ latitude: p.latitude as number, longitude: p.longitude as number }))
      : [];
    return {
      mode: normalizeStageModeForDetail(s.mode),
      instruction: String(s.instruction ?? ''),
      distance: String(s.distance ?? ''),
      duration: String(s.duration ?? ''),
      departure_minutes: s.departure_minutes,
      accessible: s.accessible !== false,
      warning: s.warning != null && String(s.warning).trim() ? String(s.warning) : undefined,
      street_view_image: s.street_view_image,
      slope_warning: s.slope_warning === true,
      segment_images: collectStageDetailImages(s),
      line_code: s.line_code != null && String(s.line_code).trim() ? String(s.line_code) : undefined,
      points: pts.length > 0 ? pts : undefined,
    };
  });

  return JSON.stringify({
    origin: ctx.origin,
    destination: ctx.destination,
    totalTime: String(route.total_duration ?? route.totalDuration ?? route.totalTime ?? ''),
    originCoordinate: ctx.originCoordinate,
    destinationCoordinate: ctx.destinationCoordinate,
    stages,
  });
}

/** Coordenadas de extremidade a partir dos pontos da rota (quando GPS/param não estiverem no estado). */
function detailCoordinateFallbacks(route: RouteItem): {
  origin: DetailLatLng;
  destination: DetailLatLng;
} {
  const stages = route.stages ?? [];
  const first = stages.find((s) => Array.isArray(s.points) && s.points.length > 0)?.points?.[0];
  const lastStage = [...stages].reverse().find((s) => Array.isArray(s.points) && s.points.length > 0);
  const last = lastStage?.points?.[(lastStage.points?.length ?? 1) - 1];
  return {
    origin:
      first &&
      typeof first.latitude === 'number' &&
      typeof first.longitude === 'number'
        ? { latitude: first.latitude, longitude: first.longitude }
        : { latitude: -16.7, longitude: -43.86 },
    destination:
      last &&
      typeof last.latitude === 'number' &&
      typeof last.longitude === 'number'
        ? { latitude: last.latitude, longitude: last.longitude }
        : { latitude: -16.72, longitude: -43.87 },
  };
}

function routeDurationMinutes(route: RouteItem): number {
  const value = `${route.total_duration ?? route.totalDuration ?? route.totalTime ?? ''}`;
  const hours = value.match(/(\d+)\s*h/i);
  const minutes = value.match(/(\d+)\s*min/i);
  const fromLabel = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  if (fromLabel > 0) return fromLabel;
  const onlyNumber = value.match(/\d+/)?.[0];
  return onlyNumber ? Number(onlyNumber) : 0;
}

function stageDurationMinutes(stage: Stage): number {
  const raw = `${stage.duration ?? ''}`;
  const hours = raw.match(/(\d+)\s*h/i);
  const minutes = raw.match(/(\d+)\s*min/i);
  const fromLabel = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  if (fromLabel > 0) return fromLabel;
  const onlyNumber = raw.match(/\d+/)?.[0];
  return onlyNumber ? Number(onlyNumber) : 0;
}

function normalizeDepartureMinutes(value: Stage['departure_minutes']): number | null {
  if (Array.isArray(value)) {
    const firstNumeric = value
      .map((v) => Number(v))
      .find((n) => Number.isFinite(n) && n >= 0);
    return typeof firstNumeric === 'number' ? firstNumeric : null;
  }
  const asNumber = Number(value);
  return Number.isFinite(asNumber) && asNumber >= 0 ? asNumber : null;
}

function formatClockFromNow(deltaMinutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + deltaMinutes);
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatClockNow(): string {
  const d = new Date();
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

function isClock(value?: string): boolean {
  return !!value && /^\d{1,2}:\d{2}$/.test(value.trim());
}

function addMinutesToClock(clock: string, minutesToAdd: number): string {
  const [h, m] = clock.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setMinutes(d.getMinutes() + minutesToAdd);
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

function minutesUntilClock(clock: string): number {
  const [h, m] = clock.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target.getTime() < now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
}

function isWalkStageMode(mode?: string): boolean {
  const m = `${mode ?? ''}`.toLowerCase();
  return m === 'walk' || m === 'walking';
}

function hasRepeatedTransitSequence(stages: Stage[]): boolean {
  for (let i = 1; i < stages.length; i += 1) {
    const prevMode = `${stages[i - 1]?.mode ?? ''}`.toLowerCase();
    const currMode = `${stages[i]?.mode ?? ''}`.toLowerCase();
    const bothTransit =
      (prevMode === 'bus' || prevMode === 'subway') &&
      (currMode === 'bus' || currMode === 'subway');
    if (bothTransit && prevMode === currMode) return true;
  }
  return false;
}

type CompanionTab = 'alone' | 'companied';

function routeCompanionAudience(route: RouteItem): 'alone' | 'companied' | 'both' | null {
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

function isCalmRoute(route: RouteItem): boolean {
  if (route.accessible === false) return false;
  if (route.slope_warning === true) return false;
  const stages = route.stages ?? [];
  return !stages.some((s) => stageNeedsAttention(s) || s.accessible === false);
}

function stageNeedsAttention(stage: Stage): boolean {
  if (stage.slope_warning === true) return true;
  const w = `${stage.warning ?? ''}`.trim();
  return w.length > 0;
}

function pickExplicitImageUrl(stage: Record<string, unknown> | null | undefined): string | undefined {
  if (!stage || typeof stage !== 'object') return undefined;
  const keys = [
    'street_view_image',
    'streetViewImage',
    'streetview_url',
    'image_url',
    'imageUrl',
    'thumbnail_url',
    'thumbnailUrl',
    'photo_url',
    'photoUrl',
    'map_image',
    'preview_image',
    'picture',
    'url',
    'map_url',
    'mapUrl',
  ];
  for (const k of keys) {
    const v = stage[k];
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return undefined;
}

function toFiniteLatLng(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const la = typeof lat === 'number' ? lat : Number(lat);
  const lo = typeof lng === 'number' ? lng : Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  return { lat: la, lng: lo };
}

function firstLatLng(stage: Record<string, unknown> | null | undefined): { lat: number; lng: number } | null {
  if (!stage || typeof stage !== 'object') return null;
  const pts = stage.points;
  if (Array.isArray(pts) && pts.length > 0) {
    for (const x of pts) {
      if (typeof x !== 'object' || x == null) continue;
      const o = x as { latitude?: unknown; longitude?: unknown };
      const ll = toFiniteLatLng(o.latitude, o.longitude);
      if (ll) return ll;
    }
  }
  const ll1 = toFiniteLatLng(stage.lat, stage.lng);
  if (ll1) return ll1;
  const ll2 = toFiniteLatLng(stage.latitude, stage.longitude);
  if (ll2) return ll2;
  return null;
}

/** Mapa estático só como fallback (não é “foto do lugar”, é visão de cima com pin). */
function staticMapPreviewFromCoords(lat: number, lng: number): string | undefined {
  const key = process.env.EXPO_PUBLIC_GOOGLE_API_KEY?.trim();
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=400x300&scale=2&maptype=roadmap&markers=color:0x0057A8%7C${lat},${lng}&key=${key}`;
}

/** Foto da rua (Street View) no ponto — é o que parece “foto do local”. */
function streetViewFromCoords(lat: number, lng: number): string | undefined {
  const key = process.env.EXPO_PUBLIC_GOOGLE_API_KEY?.trim();
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&source=outdoor&pitch=0&fov=80&key=${key}`;
}

type PreviewPair = { primary: string; fallback?: string };

function previewFromCoords(lat: number, lng: number): PreviewPair | null {
  const street = streetViewFromCoords(lat, lng);
  const map = staticMapPreviewFromCoords(lat, lng);
  if (street && map) return { primary: street, fallback: map };
  if (street) return { primary: street };
  if (map) return { primary: map };
  return null;
}

/** Fallback quando a API não manda foto nas etapas: coordenadas do deep link Uber da própria rota. */
function coordsFromUberDeeplink(link: unknown): { lat: number; lng: number } | null {
  if (typeof link !== 'string') return null;
  const decoded = (() => {
    try {
      return decodeURIComponent(link);
    } catch {
      return link;
    }
  })();
  for (const candidate of [link, decoded]) {
    const latM =
      candidate.match(/pickup\[latitude\]=([^&]+)/i) ??
      candidate.match(/pickup%5Blatitude%5D=([^&]+)/i);
    const lngM =
      candidate.match(/pickup\[longitude\]=([^&]+)/i) ??
      candidate.match(/pickup%5Blongitude%5D=([^&]+)/i);
    if (!latM?.[1] || !lngM?.[1]) continue;
    const lat = Number(latM[1]);
    const lng = Number(lngM[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
    return { lat, lng };
  }
  return null;
}

function resolveStagePreview(stage?: Stage | null): PreviewPair | null {
  const raw = stage as Record<string, unknown> | undefined;
  const direct = pickExplicitImageUrl(raw);
  if (direct) return { primary: direct };
  const ll = firstLatLng(raw);
  if (!ll) return null;
  return previewFromCoords(ll.lat, ll.lng);
}

/** Próxima etapa: 2+ etapas → imagem da etapa seguinte; só caminhada → etapa única. */
function nextStagePreviewUris(stages: Stage[]): PreviewPair | null {
  const list = stages ?? [];
  if (list.length >= 2) {
    const a = resolveStagePreview(list[1]);
    if (a) return a;
    const b = resolveStagePreview(list[0]);
    if (b) return b;
    for (let i = 2; i < list.length; i += 1) {
      const c = resolveStagePreview(list[i]);
      if (c) return c;
    }
    return null;
  }
  if (list.length === 1) return resolveStagePreview(list[0]);
  return null;
}

const JOURNEY_RAIL_W = 14;

/** Um único SVG: ponto + trilho + seta (sem três Views separadas). */
function JourneyTimelineConnector({ height }: { height: number }) {
  const mid = JOURNEY_RAIL_W / 2;
  const dotR = 3.5;
  const dotCY = dotR + 2;
  const lineTop = dotCY + dotR + 1.5;
  const arrowBaseY = height - 7;
  const arrowTipY = height - 1;
  if (height < lineTop + 10) {
    return (
      <Svg width={JOURNEY_RAIL_W} height={height} viewBox={`0 0 ${JOURNEY_RAIL_W} ${height}`}>
        <Circle cx={mid} cy={Math.max(dotR + 1, height * 0.22)} r={Math.min(dotR, height * 0.14)} fill="#9CA3AF" />
      </Svg>
    );
  }
  return (
    <Svg width={JOURNEY_RAIL_W} height={height} viewBox={`0 0 ${JOURNEY_RAIL_W} ${height}`}>
      <Circle cx={mid} cy={dotCY} r={dotR} fill="#9CA3AF" />
      <Line
        x1={mid}
        y1={lineTop}
        x2={mid}
        y2={arrowBaseY}
        stroke="#D1D5DB"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d={`M ${mid - 4} ${arrowBaseY} L ${mid + 4} ${arrowBaseY} L ${mid} ${arrowTipY} Z`} fill="#9CA3AF" />
    </Svg>
  );
}

function JourneyTimelineRail() {
  const [h, setH] = useState(44);
  return (
    <View
      style={{ width: JOURNEY_RAIL_W, alignSelf: 'stretch' }}
      onLayout={(e) => {
        const next = Math.round(e.nativeEvent.layout.height);
        if (next > 0) setH((prev) => (prev === next ? prev : next));
      }}
    >
      <JourneyTimelineConnector height={h} />
    </View>
  );
}

const ROUTE_THUMB = { width: 96, height: 72, radius: 12, marginTop: 10 } as const;

function RouteStageThumbnail({ primaryUri, fallbackUri }: { primaryUri?: string; fallbackUri?: string }) {
  const [phase, setPhase] = useState<'primary' | 'fallback' | 'failed'>('primary');

  useEffect(() => {
    setPhase('primary');
  }, [primaryUri, fallbackUri]);

  const uri = phase === 'fallback' ? fallbackUri : primaryUri;

  if (phase === 'failed' || !uri) {
    return (
      <View
        style={{
          width: ROUTE_THUMB.width,
          height: ROUTE_THUMB.height,
          borderRadius: ROUTE_THUMB.radius,
          marginTop: ROUTE_THUMB.marginTop,
          backgroundColor: '#EEF2F6',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialCommunityIcons name="image-off-outline" size={30} color="#9CA3AF" />
      </View>
    );
  }

  return (
    <ExpoImage
      recyclingKey={uri}
      source={{ uri }}
      style={{
        width: ROUTE_THUMB.width,
        height: ROUTE_THUMB.height,
        borderRadius: ROUTE_THUMB.radius,
        marginTop: ROUTE_THUMB.marginTop,
        backgroundColor: '#E5E7EB',
      }}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => {
        setPhase((p) => {
          if (p === 'primary' && fallbackUri) return 'fallback';
          return 'failed';
        });
      }}
    />
  );
}

function formatWaitTime(totalMinutes: number): string {
  if (totalMinutes <= 59) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
}

function extractPlaceName(stage: Stage): string {
  const normalizePlace = (value: string) =>
    value
      .replace(/->|→/g, ' ')
      .replace(/^\d+\s*/g, '')
      .replace(/\b(linha|line)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  const stop = `${stage.stop_name ?? ''}`.trim();
  if (stop) {
    const shortStop = stop.split(',')[0]?.split(' - ')[0]?.trim() ?? stop;
    return normalizePlace(shortStop);
  }

  const instruction = `${stage.instruction ?? ''}`.trim();
  if (!instruction) return '';

  const parenthesized = instruction.match(/\(([^)]+)\)/)?.[1] ?? '';
  const source = parenthesized || instruction;
  const cleaned = source.replace(/\s+/g, ' ').trim();
  const routeLike = cleaned
    .split(/via/i)[0]
    .split(/->|→/)[0]
    .split(',')[0]
    .split(' - ')[0]
    .trim();
  const matchAte = routeLike.match(/\bat[eé]\s+(.+)$/i)?.[1]?.trim();
  const matchPara = routeLike.match(/\bpara\s+(.+)$/i)?.[1]?.trim();
  const candidate = matchAte || matchPara || routeLike;
  const firstPlace = candidate.split('/')[0]?.trim() ?? candidate;
  return normalizePlace(firstPlace);
}

export default function RouteResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    origin?: string | string[];
    destination?: string | string[];
    routes?: string | string[];
    originCoordinate?: string | string[];
    destinationCoordinate?: string | string[];
  }>();
  const routesParam = useLocalSearchParams().routes;
  console.log('[route-results] routes param:', routesParam?.toString().slice(0, 200));

  const originFromParams = useMemo(
    () => (Array.isArray(params.origin) ? params.origin[0] : params.origin) ?? '',
    [params.origin],
  );
  const destinationFromParams = useMemo(
    () => (Array.isArray(params.destination) ? params.destination[0] : params.destination) ?? '',
    [params.destination],
  );

  const originCoordParam = useMemo(() => {
    try {
      const raw = Array.isArray(params.originCoordinate) ? params.originCoordinate[0] : params.originCoordinate;
      if (!raw || typeof raw !== 'string') return null;
      const o = JSON.parse(raw) as { latitude?: unknown; longitude?: unknown };
      return toFiniteLatLng(o.latitude, o.longitude);
    } catch {
      return null;
    }
  }, [params.originCoordinate]);

  const destCoordParam = useMemo(() => {
    try {
      const raw = Array.isArray(params.destinationCoordinate)
        ? params.destinationCoordinate[0]
        : params.destinationCoordinate;
      if (!raw || typeof raw !== 'string') return null;
      const o = JSON.parse(raw) as { latitude?: unknown; longitude?: unknown };
      return toFiniteLatLng(o.latitude, o.longitude);
    } catch {
      return null;
    }
  }, [params.destinationCoordinate]);

  type LatLng = { lat: number; lng: number };
  const [headerOrigin, setHeaderOrigin] = useState(originFromParams);
  const [headerDestination, setHeaderDestination] = useState(destinationFromParams);
  /** Uma parada opcional entre origem e destino (`null` = nenhuma). */
  const [middleStop, setMiddleStop] = useState<string | null>(null);
  const [activeOriginCoord, setActiveOriginCoord] = useState<LatLng | null>(null);
  const [activeDestCoord, setActiveDestCoord] = useState<LatLng | null>(null);
  const [activeCompanionTab, setActiveCompanionTab] = useState<CompanionTab>('alone');

  useEffect(() => {
    setHeaderOrigin(originFromParams);
    setHeaderDestination(destinationFromParams);
    setMiddleStop(null);
    setActiveOriginCoord(originCoordParam);
    setActiveDestCoord(destCoordParam);
  }, [originFromParams, destinationFromParams, originCoordParam, destCoordParam]);

  const handleSwapLocations = () => {
    setHeaderOrigin(headerDestination);
    setHeaderDestination(headerOrigin);
    setActiveOriginCoord(activeDestCoord);
    setActiveDestCoord(activeOriginCoord);
  };

  const handleAddWaypoint = () => {
    if (middleStop === null) setMiddleStop('');
  };

  const handleRemoveMiddleStop = () => {
    setMiddleStop(null);
  };

  const routes = useMemo(() => {
    try {
      return JSON.parse(decodeURIComponent(routesParam as string)) ?? [];
    } catch {
      console.log('[route-results] erro ao parsear routes');
      return [];
    }
  }, [routesParam]);

  console.log('[route-results] routes parsed:', routes?.length);

  const filteredRoutes = useMemo(() => {
    return (routes as RouteItem[]).filter((route) => {
      if (!isCalmRoute(route)) return false;
      const audience = routeCompanionAudience(route);
      if (!audience || audience === 'both') return true;
      return audience === activeCompanionTab;
    });
  }, [routes, activeCompanionTab]);

  const mostAccessibleRoute = useMemo(() => {
    const accessibleRoutes = filteredRoutes.filter((route) => {
      const allStagesAccessible = (route.stages ?? []).every((stage: any) => stage?.accessible !== false);
      return route.accessible === true && allStagesAccessible;
    });
    if (accessibleRoutes.length === 0) return null;
    return [...accessibleRoutes].sort(
      (a, b) => routeDurationMinutes(a) - routeDurationMinutes(b),
    )[0];
  }, [filteredRoutes]);

  const formatDurationLabel = (route: RouteItem) => {
    const mins = routeDurationMinutes(route);
    if (mins > 0) return `${mins} min`;
    const raw = `${route.total_duration ?? route.totalDuration ?? route.totalTime ?? ''}`.trim();
    const cleaned = raw
      .replace(/estimado/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return '-- min';
    if (/\bmin\b/i.test(cleaned) || /\bh\b/i.test(cleaned)) return cleaned;
    const onlyNumber = cleaned.match(/\d+/)?.[0];
    return onlyNumber ? `${onlyNumber} min` : `${cleaned} min`;
  };

  const formatTripDurationDisplay = (totalMinutes: number, route: RouteItem) => {
    const mins = totalMinutes > 0 ? totalMinutes : routeDurationMinutes(route);
    if (mins > 59) return formatWaitTime(mins);
    if (mins > 0) return `${mins} min`;
    return formatDurationLabel(route);
  };

  const renderRouteCard = (route: RouteItem, key: string, featured = false) => {
    const orderedStages = (route.stages ?? []).filter((s) => {
      const m = `${s.mode ?? ''}`.toLowerCase();
      return isWalkStageMode(s.mode) || m === 'bus' || m === 'subway';
    });
    const firstTransitStage = orderedStages.find((s) => s.mode === 'bus' || s.mode === 'subway');
    const lastTransitStage = [...orderedStages].reverse().find((s) => s.mode === 'bus' || s.mode === 'subway');
    const routeMinutesFromLabel = routeDurationMinutes(route);
    const stageMinutesSum = orderedStages.reduce((acc, s) => acc + stageDurationMinutes(s), 0);
    const totalMinutes = routeMinutesFromLabel > 0 ? routeMinutesFromLabel : stageMinutesSum;
    const firstTransitDepartureMinutes = normalizeDepartureMinutes(firstTransitStage?.departure_minutes);
    const rawDepartureTime =
      firstTransitStage?.departure_time ??
      firstTransitStage?.departureTime ??
      route.departTime;
    const departureTime = isClock(rawDepartureTime)
      ? rawDepartureTime!.trim()
      : typeof firstTransitDepartureMinutes === 'number'
        ? formatClockFromNow(firstTransitDepartureMinutes)
        : formatClockNow();
    const rawArrivalTime = lastTransitStage?.arrival_time ?? lastTransitStage?.arrivalTime ?? route.arriveTime;
    const arrivalTime = isClock(rawArrivalTime)
      ? rawArrivalTime!.trim()
      : addMinutesToClock(departureTime, totalMinutes > 0 ? totalMinutes : 0);
    const stageCount = orderedStages.length;
    const showRailUnderline = hasRepeatedTransitSequence(
      orderedStages.length > 0 ? orderedStages : [{ mode: 'walk' }],
    );
    const hasInaccessibleStage = orderedStages.some((s) => s.accessible === false);
    const accessibilityStatus =
      hasInaccessibleStage || route.accessible === false
        ? { label: 'Não acessível', bg: '#FEE2E2', fg: '#DC2626' }
        : { label: 'Acessível', bg: '#DCFCE7', fg: '#16A34A' };
    const hasAttentionSegments =
      route.slope_warning === true || orderedStages.some((s) => stageNeedsAttention(s));
    const summaryPlaces = orderedStages
      .map((s) => extractPlaceName(s))
      .filter(Boolean)
      .filter((name, idx, arr) => idx === 0 || name.toLowerCase() !== arr[idx - 1]?.toLowerCase())
      .slice(0, 3);

    const rawStages = (route.stages ?? []) as Stage[];
    let nextStepPreview = nextStagePreviewUris(rawStages);
    if (!nextStepPreview) {
      const uberLl = coordsFromUberDeeplink((route as RouteItem).uber_deeplink);
      if (uberLl) nextStepPreview = previewFromCoords(uberLl.lat, uberLl.lng);
    }
    if (!nextStepPreview && activeDestCoord) {
      nextStepPreview = previewFromCoords(activeDestCoord.lat, activeDestCoord.lng);
    }
    if (!nextStepPreview && activeOriginCoord) {
      nextStepPreview = previewFromCoords(activeOriginCoord.lat, activeOriginCoord.lng);
    }

    return (
      <View
        key={key}
        style={[
          styles.routeCard,
          featured
            ? { borderColor: '#0057A8', borderWidth: 1.5, borderLeftWidth: 4, borderLeftColor: '#0057A8' }
            : null,
        ]}
      >
        {featured ? (
          <View style={{ backgroundColor: '#0057A8', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 }}>
            <MaterialCommunityIcons name="wheelchair-accessibility" size={13} color="white" />
            <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>Rota mais acessível</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ width: 112, alignItems: 'center' }}>
            <Text
              style={{
                color: '#1E1D1D',
                fontSize: 18,
                fontWeight: '800',
                textAlign: 'center',
                lineHeight: 22,
              }}
              numberOfLines={2}
            >
              {formatTripDurationDisplay(totalMinutes, route)}
            </Text>
            <View
              style={{
                marginTop: 4,
                width: '100%',
                minHeight: 46,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
                <JourneyTimelineRail />
                <View style={{ justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '600', textAlign: 'left' }}>
                    {departureTime}
                  </Text>
                  <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '600', textAlign: 'left' }}>
                    {arrivalTime}
                  </Text>
                </View>
              </View>
            </View>
            <RouteStageThumbnail
              primaryUri={nextStepPreview?.primary}
              fallbackUri={nextStepPreview?.fallback}
            />
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <ScrollView
              horizontal
              nestedScrollEnabled
              directionalLockEnabled
              scrollEnabled
              keyboardShouldPersistTaps="always"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <MaterialCommunityIcons name="walk" size={17} color="#6B7280" />
              <Text style={{ color: '#374151', fontSize: 18, fontWeight: '700' }}>{stageCount}</Text>
              <MaterialCommunityIcons name="chevron-right" size={13} color="#CCCCCC" />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, position: 'relative', paddingBottom: 6 }}>
                {showRailUnderline ? (
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 2,
                      backgroundColor: '#1E88E5',
                      borderRadius: 2,
                    }}
                  />
                ) : null}
                {(orderedStages.length > 0 ? orderedStages : [{ mode: 'walk' }]).map((stage, i, arr) => (
                  <View key={`${key}-stage-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {isWalkStageMode(stage.mode) ? (
                      <MaterialCommunityIcons name="walk" size={17} color="#6B7280" />
                    ) : (
                      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <MaterialCommunityIcons
                            name={stage.mode === 'subway' ? 'subway-variant' : 'bus'}
                            size={11}
                            color="#1E1D1D"
                          />
                          <Text style={{ color: '#1E1D1D', fontSize: 10.5, fontWeight: '700' }}>
                            {stage.line_code ?? stage.mode}
                          </Text>
                        </View>
                        <View
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: 2.5,
                            backgroundColor: getLineColor(stage.line_code ?? stage.mode ?? 'line'),
                          }}
                        />
                      </View>
                    )}
                    {i < arr.length - 1 ? (
                      <MaterialCommunityIcons name="chevron-right" size={13} color="#CCCCCC" />
                    ) : null}
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <MaterialCommunityIcons
                name={firstTransitStage?.mode === 'subway' ? 'subway-variant' : 'bus'}
                size={12}
                color="#22c55e"
              />
              <Text style={{ color: '#22c55e', fontSize: 12 }}>
                {(() => {
                  if (firstTransitStage) {
                    const minutes = normalizeDepartureMinutes(firstTransitStage.departure_minutes);
                    const explicitDeparture = firstTransitStage.departure_time ?? firstTransitStage.departureTime;
                    const departureClock = isClock(explicitDeparture)
                      ? explicitDeparture!.trim()
                      : departureTime;
                    const minutesLeft = typeof minutes === 'number'
                      ? minutes
                      : minutesUntilClock(departureClock);
                    return `Sai às ${departureClock} · em ${formatWaitTime(minutesLeft)}`;
                  }
                  return `Sai às ${departureTime}`;
                })()}
              </Text>
            </View>

            <ScrollView
              horizontal
              nestedScrollEnabled
              directionalLockEnabled
              scrollEnabled
              keyboardShouldPersistTaps="always"
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 2 }}
              contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 20 }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
            >
              {summaryPlaces.length > 0 ? summaryPlaces.map((place, idx) => (
                <View key={`${key}-place-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: '#6B7280', fontSize: 12 }} numberOfLines={1}>
                    {place}
                  </Text>
                  {idx < summaryPlaces.length - 1 ? (
                    <MaterialCommunityIcons name="chevron-right" size={12} color="#9CA3AF" />
                  ) : null}
                </View>
              )) : (
                <Text style={{ color: '#6B7280', fontSize: 12 }}>Trajeto direto</Text>
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <View
                style={{
                  backgroundColor: accessibilityStatus.bg,
                  borderRadius: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <MaterialCommunityIcons name="wheelchair-accessibility" size={11} color={accessibilityStatus.fg} />
                <Text style={{ color: accessibilityStatus.fg, fontSize: 11, fontWeight: '600' }}>
                  {accessibilityStatus.label}
                </Text>
              </View>
              {hasAttentionSegments ? (
                <View
                  style={{
                    backgroundColor: '#FEF9C3',
                    borderRadius: 10,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    borderWidth: 1,
                    borderColor: '#FACC15',
                  }}
                >
                  <MaterialCommunityIcons name="alert" size={12} color="#A16207" />
                  <Text style={{ color: '#A16207', fontSize: 11, fontWeight: '700' }}>Atenção</Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => {
                const fb = detailCoordinateFallbacks(route);
                const originCoordinate =
                  activeOriginCoord != null
                    ? { latitude: activeOriginCoord.lat, longitude: activeOriginCoord.lng }
                    : fb.origin;
                const destinationCoordinate =
                  activeDestCoord != null
                    ? { latitude: activeDestCoord.lat, longitude: activeDestCoord.lng }
                    : fb.destination;
                router.push({
                  pathname: '/route-detail',
                  params: {
                    route: serializeRouteDetail(route, {
                      origin: headerOrigin,
                      destination: headerDestination,
                      originCoordinate,
                      destinationCoordinate,
                    }),
                  },
                });
              }}
              style={{
                marginTop: 8,
                backgroundColor: '#EEF2FF',
                borderRadius: 14,
                paddingHorizontal: 10,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="map-search-outline" size={13} color="#0057A8" />
                <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600' }}>Analisar trechos</Text>
              </View>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#0057A8', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="arrow-right" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerOriginDestWrap}>
          <View style={styles.headerOriginDestBlock}>
            <View style={styles.headerIconsColumn}>
              <View style={styles.headerLeadIconRow}>
                <TouchableOpacity onPress={() => router.back()}>
                  <MaterialCommunityIcons name="arrow-left" size={22} color="#0057A8" />
                </TouchableOpacity>
              </View>
              {middleStop !== null ? (
                <View style={styles.headerLeadIconRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={16} color="#6B7280" />
                </View>
              ) : null}
              <View style={styles.headerLeadIconRow}>
                <MaterialCommunityIcons name="map-marker" size={18} color="#FF6B00" />
              </View>
            </View>
            <View
              style={[
                styles.headerFieldsColumn,
                middleStop !== null ? styles.headerFieldsColumnWithStop : null,
              ]}
            >
              <View style={styles.field}>
                <Text numberOfLines={1} style={styles.fieldText}>{headerOrigin}</Text>
              </View>
              {middleStop !== null ? (
                <View style={styles.headerStopRow}>
                  <TextInput
                    style={[styles.field, styles.headerWaypointInput, { flex: 1, minWidth: 0 }]}
                    value={middleStop}
                    onChangeText={setMiddleStop}
                    placeholder="Adicione uma parada"
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity
                    onPress={handleRemoveMiddleStop}
                    accessibilityRole="button"
                    accessibilityLabel="Remover parada"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="close-circle-outline" size={22} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={styles.field}>
                <Text numberOfLines={1} style={styles.fieldText}>{headerDestination}</Text>
              </View>
            </View>
          </View>

          <View style={styles.headerSwapOverlay} pointerEvents="box-none">
            <TouchableOpacity style={styles.swap} onPress={handleSwapLocations}>
              <MaterialCommunityIcons name="swap-vertical" size={18} color="#0057A8" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerActionsOverlay} pointerEvents="box-none">
            <TouchableOpacity>
              <MaterialCommunityIcons name="tune" size={20} color="#0057A8" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerPlusBtn, middleStop !== null ? styles.headerPlusBtnDisabled : null]}
              onPress={handleAddWaypoint}
              disabled={middleStop !== null}
            >
              <MaterialCommunityIcons name="plus" size={18} color="#0057A8" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={styles.pill}><Text style={styles.pillText}>Sair agora ▼</Text></View>
            <View style={styles.pill}><Text style={styles.pillText}>Ordenar ▼</Text></View>
          </View>
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <Text style={styles.sectionTitleMuted}>Táxi e transporte privado</Text>
        <TouchableOpacity onPress={() => Linking.openURL(uberDeepLink)} style={styles.uberCard}>
          <View style={styles.uberBadge}><Text style={styles.uberBadgeText}>Uber</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#1E1D1D', fontSize: 14, fontWeight: '600' }}>Partida em ~4 min</Text>
            <Text style={{ color: '#22c55e', fontSize: 12, marginTop: 2 }}>🌱 CO2e estimado: 2,4 kg</Text>
          </View>
          <View style={styles.uberButton}><Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Pedir</Text></View>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={{ color: '#1E1D1D', fontSize: 15, fontWeight: '700' }}>Rotas sugeridas</Text>
          <TouchableOpacity style={styles.mapButton}>
            <MaterialCommunityIcons name="map" size={14} color="white" />
            <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Ver</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.companionTabsWrap}>
          <TouchableOpacity
            style={[
              styles.companionTabBtn,
              activeCompanionTab === 'alone' ? styles.companionTabBtnActive : null,
            ]}
            onPress={() => setActiveCompanionTab('alone')}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.companionTabText,
                activeCompanionTab === 'alone' ? styles.companionTabTextActive : null,
              ]}
            >
              Sozinho
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.companionTabBtn,
              activeCompanionTab === 'companied' ? styles.companionTabBtnActive : null,
            ]}
            onPress={() => setActiveCompanionTab('companied')}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.companionTabText,
                activeCompanionTab === 'companied' ? styles.companionTabTextActive : null,
              ]}
            >
              Acompanhado
            </Text>
          </TouchableOpacity>
        </View>

        {mostAccessibleRoute ? renderRouteCard(mostAccessibleRoute, 'most-accessible', true) : null}

        {filteredRoutes.length === 0 ? (
          <Text style={styles.emptyRoutesText}>Nenhum trajeto tranquilo para este perfil.</Text>
        ) : null}
        {filteredRoutes.map((route, index) => renderRouteCard(route, `route-${index}`))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerOriginDestWrap: { position: 'relative' },
  /** Ícones à esquerda + coluna única de campos: origem e destino com a mesma largura de barra. */
  headerOriginDestBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerIconsColumn: { width: 26, gap: 8 },
  headerLeadIconRow: { height: 40, alignItems: 'center', justifyContent: 'center' },
  headerFieldsColumn: { flex: 1, marginRight: 60, gap: 8, minWidth: 0 },
  /** Com parada, afasta coluna do overlay de troca (swap ~78px da borda). */
  headerFieldsColumnWithStop: { marginRight: 82 },
  headerWaypointInput: {
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
    color: '#1E1D1D',
    textAlignVertical: 'center',
  },
  headerStopRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 6 },
  headerPlusBtnDisabled: { opacity: 0.4 },
  headerSwapOverlay: {
    position: 'absolute',
    right: 44,
    top: 0,
    bottom: 0,
    width: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionsOverlay: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    width: 36,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerPlusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 10, height: 40, justifyContent: 'center' },
  fieldText: { color: '#1E1D1D', fontSize: 13 },
  swap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#0057A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: { backgroundColor: '#F5F5F5', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  pillText: { color: '#666666', fontSize: 12 },
  sectionTitleMuted: { color: '#999999', fontSize: 13, marginHorizontal: 16, marginTop: 16 },
  uberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uberBadge: { backgroundColor: '#000', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  uberBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  uberButton: { backgroundColor: '#000', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  mapButton: {
    backgroundColor: '#0057A8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  companionTabsWrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#EEF2F7',
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    gap: 6,
  },
  companionTabBtn: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companionTabBtnActive: {
    backgroundColor: '#0057A8',
  },
  companionTabText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '700',
  },
  companionTabTextActive: {
    color: '#FFFFFF',
  },
  emptyRoutesText: {
    marginHorizontal: 16,
    marginBottom: 10,
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
