import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Image as ExpoImage } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export type RouteStage = {
  mode: 'walk' | 'bus' | 'subway';
  instruction: string;
  distance: string;
  duration: string;
  departure_minutes?: number | string | Array<number | string>;
  accessible: boolean;
  warning?: string;
  street_view_image?: string;
  segment_images?: string[];
  slope_warning?: boolean;
  line_code?: string;
  points?: { latitude: number; longitude: number }[];
};

export type SerializedRouteDetail = {
  origin: string;
  destination: string;
  totalTime: string;
  originCoordinate: { latitude: number; longitude: number };
  destinationCoordinate: { latitude: number; longitude: number };
  stages: RouteStage[];
  /** Tarifa estimada, ex.: "9,30" ou "R$ 9,30" — opcional. */
  price?: string;
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type LatLng = { latitude: number; longitude: number };

const COLORS = {
  bg: '#FFFFFF',
  primary: '#0057A8',
  text: '#1E1D1D',
  textMuted: '#6B7280',
  lineGrey: '#CCCCCC',
  orangeOrigin: '#FF6B00',
  redDest: '#EF4444',
  badgeBg: '#1E1D1D',
  greenOnTime: '#16A34A',
  orangeLate: '#EA580C',
  yellowCard: '#FEF3C7',
  yellowBorder: '#FDE68A',
  yellowText: '#92400E',
  transitLine: '#22c55e',
  walkLine: '#F97316',
  purpleTip: '#7C3AED',
  purpleTipBg: '#EDE9FE',
};

const LINE_PALETTE = [
  '#E53935', '#FB8C00', '#43A047', '#1E88E5',
  '#8E24AA', '#00897B', '#F4511E', '#D81B60',
];

function getLineAccentColor(code: string): string {
  const hash = code.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return LINE_PALETTE[hash % LINE_PALETTE.length];
}

function toMinutes(duration: string): number {
  const h = duration.match(/(\d+)\s*h/i);
  const m = duration.match(/(\d+)\s*min/i);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

function stripEstimado(text: string): string {
  return text.replace(/\bestimado\b/gi, '').replace(/\s+/g, ' ').trim();
}

/** Duração total só em minutos para o topo do card (sem "estimado"). */
function formatTotalTripMinutesLabel(totalTimeRaw: string): string {
  const cleaned = stripEstimado(totalTimeRaw);
  const mins = toMinutes(cleaned);
  if (mins > 0) return `${mins} min`;
  return '—';
}

function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function extractLineCode(stage: RouteStage): string {
  if (stage.line_code?.trim()) return stage.line_code.trim();
  const first = stage.instruction.trim().split(/\s+/)[0];
  return first && /^[\w.]/.test(first) ? first : '---';
}

function extractBoardingPlace(instruction: string): string {
  const raw = instruction.trim();
  if (!raw) return 'Embarque';
  const withoutArrow = raw.split(/->|→/)[0]?.trim() ?? raw;
  const withoutDestination = withoutArrow.split('/')[0]?.trim() ?? withoutArrow;
  const place = withoutDestination.split('|')[0]?.trim() ?? withoutDestination;
  return place || 'Embarque';
}

/** Mesma paleta/hash que `getLineColor` em route-results (faixa sob o código da linha). */
function getRouteCardLineStripeColor(code: string): string {
  const colors = [
    '#E53935', '#FB8C00', '#43A047', '#1E88E5',
    '#8E24AA', '#00897B', '#F4511E', '#D81B60',
    '#6D4C41', '#546E7A', '#039BE5', '#7CB342',
    '#FFB300', '#3949AB', '#00ACC1', '#E91E63',
  ];
  const hash = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function isWalkStageMode(mode?: string): boolean {
  const m = `${mode ?? ''}`.toLowerCase();
  return m === 'walk' || m === 'walking';
}

function stopCountLabel(stage: RouteStage): string {
  const n = stage.points?.length;
  if (n != null && n > 1) return `${n}`;
  return '--';
}

function normalizeDepartureMinutes(
  value: RouteStage['departure_minutes'],
): number | null {
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
  d.setMinutes(d.getMinutes() + Math.max(0, deltaMinutes));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Pontos para polyline (origem → pontos das etapas → destino). */
function buildPolylineCoords(route: SerializedRouteDetail): LatLng[] {
  const out: LatLng[] = [];
  const push = (lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    out.push({ latitude: lat, longitude: lng });
  };

  push(route.originCoordinate.latitude, route.originCoordinate.longitude);

  for (const s of route.stages) {
    if (Array.isArray(s.points)) {
      for (const p of s.points) {
        if (typeof p?.latitude === 'number' && typeof p?.longitude === 'number') {
          push(p.latitude, p.longitude);
        }
      }
    }
  }

  push(route.destinationCoordinate.latitude, route.destinationCoordinate.longitude);

  const deduped: LatLng[] = [];
  for (const p of out) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.latitude !== p.latitude || prev.longitude !== p.longitude) {
      deduped.push(p);
    }
  }
  return deduped;
}

/** Trechos de caminhada (laranja no mapa): cada etapa walk com ≥2 pontos. */
function buildWalkStagePolylines(route: SerializedRouteDetail): LatLng[][] {
  const polys: LatLng[][] = [];
  for (const s of route.stages) {
    if (s.mode !== 'walk' || !s.points?.length) continue;
    const pts = s.points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    if (pts.length >= 2) polys.push(pts);
  }
  return polys;
}

/** Polyline principal de ônibus/metrô (verde): origem + pontos de etapas não-walk + destino. */
function buildTransitPolyline(route: SerializedRouteDetail): LatLng[] {
  const out: LatLng[] = [];
  const push = (c: LatLng) => {
    const last = out[out.length - 1];
    if (!last || last.latitude !== c.latitude || last.longitude !== c.longitude) out.push(c);
  };
  push({
    latitude: route.originCoordinate.latitude,
    longitude: route.originCoordinate.longitude,
  });
  for (const s of route.stages) {
    if (s.mode === 'walk') continue;
    if (Array.isArray(s.points)) {
      for (const p of s.points) {
        if (typeof p.latitude === 'number' && typeof p.longitude === 'number') {
          push({ latitude: p.latitude, longitude: p.longitude });
        }
      }
    }
  }
  push({
    latitude: route.destinationCoordinate.latitude,
    longitude: route.destinationCoordinate.longitude,
  });
  return out;
}

/** Região para MapView a partir dos pontos da rota. */
function mapRegion(coords: LatLng[]): MapRegion | null {
  if (coords.length === 0) return null;
  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;
  for (const c of coords) {
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLng = Math.min(minLng, c.longitude);
    maxLng = Math.max(maxLng, c.longitude);
  }
  const lat = (minLat + maxLat) / 2;
  const lng = (minLng + maxLng) / 2;
  const latSpan = Math.max(0.008, (maxLat - minLat) * 1.35);
  const lngSpan = Math.max(0.008, (maxLng - minLng) * 1.35);
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: latSpan,
    longitudeDelta: lngSpan,
  };
}

function formatPriceDisplay(raw?: string): string {
  if (!raw?.trim()) return 'R$ —';
  const t = raw.trim();
  if (/^r\$/i.test(t)) return t;
  return `R$ ${t}`;
}

function parseRouteParam(raw: string | string[] | undefined): SerializedRouteDetail | null {
  if (raw == null) return null;
  const str = Array.isArray(raw) ? raw[0] : raw;
  if (!str) return null;
  try {
    const decoded = decodeURIComponent(str);
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    const stagesRaw = o.stages;
    if (!Array.isArray(stagesRaw)) return null;
    const originCoord = o.originCoordinate as SerializedRouteDetail['originCoordinate'];
    const destCoord = o.destinationCoordinate as SerializedRouteDetail['destinationCoordinate'];
    if (
      !originCoord ||
      typeof originCoord.latitude !== 'number' ||
      typeof originCoord.longitude !== 'number' ||
      !destCoord ||
      typeof destCoord.latitude !== 'number' ||
      typeof destCoord.longitude !== 'number'
    ) {
      return null;
    }
    const stages: RouteStage[] = stagesRaw.map((s) => {
      const st = s as Record<string, unknown>;
      const mode = (st.mode === 'bus' || st.mode === 'subway' || st.mode === 'walk'
        ? st.mode
        : 'walk') as RouteStage['mode'];
      return {
        mode,
        instruction: String(st.instruction ?? ''),
        distance: String(st.distance ?? ''),
        duration: String(st.duration ?? ''),
        departure_minutes:
          st.departure_minutes != null
            ? (st.departure_minutes as RouteStage['departure_minutes'])
            : undefined,
        accessible: st.accessible !== false,
        warning: st.warning != null ? String(st.warning) : undefined,
        slope_warning: st.slope_warning === true,
        line_code: st.line_code != null ? String(st.line_code) : undefined,
        street_view_image:
          st.street_view_image != null ? String(st.street_view_image) : undefined,
        segment_images: Array.isArray(st.segment_images)
          ? (st.segment_images as unknown[])
              .filter((x) => typeof x === 'string' && /^https?:\/\//i.test(x.trim()))
              .map((x) => String(x).trim())
          : undefined,
        points: Array.isArray(st.points)
          ? (st.points as { latitude: number; longitude: number }[]).filter(
              (p) =>
                typeof p?.latitude === 'number' &&
                typeof p?.longitude === 'number',
            )
          : undefined,
      };
    });
    const priceRaw = o.price ?? o.ticket_price ?? o.fare;
    return {
      origin: String(o.origin ?? ''),
      destination: String(o.destination ?? ''),
      totalTime: String(o.totalTime ?? o.total_time ?? ''),
      originCoordinate: originCoord,
      destinationCoordinate: destCoord,
      stages,
      price: priceRaw != null ? String(priceRaw) : undefined,
    };
  } catch {
    return null;
  }
}

const GUTTER = 28;

const FALLBACK_WALK_STAGE: RouteStage = {
  mode: 'walk',
  instruction: '',
  distance: '',
  duration: '',
  accessible: true,
};

export default function RouteDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ route?: string | string[] }>();
  const mapRef = useRef<MapView>(null);

  const route = useMemo(() => parseRouteParam(params.route), [params.route]);

  const polylineCoords = useMemo(() => (route ? buildPolylineCoords(route) : []), [route]);
  const transitPoly = useMemo(() => (route ? buildTransitPolyline(route) : []), [route]);
  const walkPolylines = useMemo(() => (route ? buildWalkStagePolylines(route) : []), [route]);
  const region = useMemo(() => mapRegion(polylineCoords), [polylineCoords]);

  const orderedStages = useMemo(() => {
    if (!route) return [] as RouteStage[];
    return route.stages.filter((s) => {
      const m = `${s.mode ?? ''}`.toLowerCase();
      return isWalkStageMode(s.mode) || m === 'bus' || m === 'subway';
    });
  }, [route]);

  const [isReading, setIsReading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [expandedWalk, setExpandedWalk] = useState<Record<number, boolean>>({});
  const [expandedRide, setExpandedRide] = useState<Record<number, boolean>>({});
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const windowH = Dimensions.get('window').height;
  const sheetCollapsedTop = windowH * 0.36;
  const sheetExpandedTop = Math.max(insets.top + 48, windowH * 0.1);
  /** Altura do footer: paddingTop 12 + linha ~52 (botão play) + paddingBottom seguro. */
  const footerBand = 12 + 52 + Math.max(insets.bottom, 12);

  const sheetTopAnim = useRef(new Animated.Value(sheetCollapsedTop)).current;
  const sheetDragStart = useRef(sheetCollapsedTop);

  const panResponder = useMemo(() => {
    const clamp = (v: number) =>
      Math.min(Math.max(v, sheetExpandedTop), sheetCollapsedTop);
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 0.5,
      onPanResponderGrant: () => {
        sheetTopAnim.stopAnimation((v) => {
          sheetDragStart.current = v;
        });
      },
      onPanResponderMove: (_, g) => {
        const next = clamp(sheetDragStart.current + g.dy);
        sheetTopAnim.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const current = clamp(sheetDragStart.current + g.dy);
        const mid = (sheetExpandedTop + sheetCollapsedTop) / 2;
        let snap: number;
        if (g.vy > 1.2) snap = sheetCollapsedTop;
        else if (g.vy < -1.2) snap = sheetExpandedTop;
        else snap = current < mid ? sheetExpandedTop : sheetCollapsedTop;
        Animated.spring(sheetTopAnim, {
          toValue: snap,
          useNativeDriver: false,
          friction: 7,
          tension: 72,
        }).start(() => {
          sheetDragStart.current = snap;
        });
      },
    });
  }, [sheetCollapsedTop, sheetExpandedTop, sheetTopAnim]);

  const readRoute = () => {
    if (!route) return;
    if (isReading) {
      Speech.stop();
      setIsReading(false);
      return;
    }
    setIsReading(true);
    const instructions = route.stages
      .map(
        (s, i) =>
          `Etapa ${i + 1}: ${s.instruction}. Distância: ${s.distance}. Duração: ${s.duration}.`,
      )
      .join(' ');
    Speech.speak(instructions, {
      language: 'pt-BR',
      onDone: () => setIsReading(false),
      onError: () => setIsReading(false),
    });
  };

  const departureDate = useMemo(() => new Date(), [route]);
  const arrivalDate = useMemo(
    () =>
      new Date(
        departureDate.getTime() + toMinutes(stripEstimado(route?.totalTime ?? '')) * 60000,
      ),
    [departureDate, route?.totalTime],
  );
  const departureTime = formatClock(departureDate);
  const arrivalTime = formatClock(arrivalDate);

  useEffect(() => {
    if (!route) return;
    AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (enabled && route) readRoute();
    });
  }, [route]);

  useEffect(() => {
    setElapsedMinutes(0);
    const id = setInterval(() => {
      setElapsedMinutes((m) => m + 1);
    }, 60000);
    return () => clearInterval(id);
  }, [route]);

  useEffect(() => {
    if (!mapRef.current || polylineCoords.length < 2) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(polylineCoords, {
        edgePadding: { top: 56, right: 20, bottom: 72, left: 20 },
        animated: true,
      });
    }, 350);
    return () => clearTimeout(t);
  }, [route, polylineCoords]);

  const handleStartNavigation = () => {
    readRoute();
  };

  const fitMap = () => {
    if (mapRef.current && polylineCoords.length >= 2) {
      mapRef.current.fitToCoordinates(polylineCoords, {
        edgePadding: { top: 56, right: 20, bottom: 72, left: 20 },
        animated: true,
      });
    }
  };

  const toggleWalk = (index: number) => {
    Haptics.selectionAsync();
    setExpandedWalk((p) => ({ ...p, [index]: !p[index] }));
  };

  const toggleRide = (index: number) => {
    Haptics.selectionAsync();
    setExpandedRide((p) => ({ ...p, [index]: !p[index] }));
  };

  if (!route) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorBox}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar">
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.errorText}>Rota invalida ou nao informada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initialRegion =
    region ?? {
      latitude: route.originCoordinate.latitude,
      longitude: route.originCoordinate.longitude,
      latitudeDelta: 0.045,
      longitudeDelta: 0.045,
    };

  const transitEtaMinutes = (stage: RouteStage) => {
    const apiMinutes = normalizeDepartureMinutes(stage.departure_minutes);
    if (typeof apiMinutes === 'number') {
      return `${Math.max(0, apiMinutes - elapsedMinutes)}`;
    }
    const m = toMinutes(stage.duration);
    return m > 0 ? `${Math.max(0, m - elapsedMinutes)}` : '—';
  };

  const transitLegCount = route.stages.filter(
    (s) => s.mode === 'bus' || s.mode === 'subway',
  ).length;

  const stageCount = orderedStages.length;
  const railStages = orderedStages.length > 0 ? orderedStages : [FALLBACK_WALK_STAGE];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.flex1}>
        <View style={styles.mapLayer} pointerEvents="box-none">
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            showsUserLocation={false}
            showsTraffic={showTraffic}
            mapType="standard"
          >
            {transitPoly.length >= 2 ? (
              <Polyline
                coordinates={transitPoly}
                strokeColor={COLORS.transitLine}
                strokeWidth={5}
              />
            ) : null}
            {walkPolylines.map((wp, i) => (
              <Polyline
                key={`walk-${i}`}
                coordinates={wp}
                strokeColor={COLORS.walkLine}
                strokeWidth={3}
              />
            ))}
            <Marker coordinate={route.originCoordinate} title="Origem" pinColor={COLORS.orangeOrigin} />
            <Marker coordinate={route.destinationCoordinate} title="Destino" pinColor={COLORS.redDest} />
          </MapView>

          <TouchableOpacity
            style={[styles.mapFabBack, { top: Math.max(insets.top, 8) }]}
            onPress={() => router.back()}
            accessibilityLabel="Voltar"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mapFabGps, { top: Math.max(insets.top, 8) }]}
            onPress={fitMap}
            accessibilityLabel="Centralizar mapa"
          >
            <MaterialCommunityIcons name="crosshairs-gps" size={22} color={COLORS.primary} />
          </TouchableOpacity>

          <View style={[styles.mapFloatRow, { bottom: footerBand + 12 }]}>
            <TouchableOpacity
              style={styles.pillTraffic}
              onPress={() => setShowTraffic((v) => !v)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="car-outline" size={18} color="#FFFFFF" />
              <Text style={styles.pillTrafficText}>Mostrar trânsito</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pillStart} activeOpacity={0.85} onPress={handleStartNavigation}>
              <MaterialCommunityIcons name="navigation-variant" size={18} color="#FFFFFF" />
              <Text style={styles.pillStartText}>Começar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View
          style={[
            styles.sheet,
            {
              top: sheetTopAnim,
              bottom: footerBand,
            },
          ]}
        >
          <View style={styles.sheetColumn}>
            <View style={styles.sheetHandleZone} {...panResponder.panHandlers}>
              <View style={styles.sheetHandleBar} />
            </View>

            <View style={styles.sheetSummaryMain}>
              <View style={styles.summaryTop}>
                <View style={styles.summaryHeaderSide} />
                <View style={styles.summaryHeaderCenter}>
                  <View style={styles.summaryHeaderTextBlock}>
                    <Text style={styles.summaryHeaderPart}>
                      {formatTotalTripMinutesLabel(route.totalTime ?? '')}
                    </Text>
                    <Text style={styles.summaryHeaderSep}> | </Text>
                    <Text style={styles.summaryHeaderPart}>
                      Horário de chegada: {arrivalTime}
                    </Text>
                  </View>
                </View>
                <View style={styles.summaryHeaderSide}>
                  <TouchableOpacity
                    style={styles.favStarBtn}
                    onPress={() => setIsFavorite((v) => !v)}
                    accessibilityLabel={isFavorite ? 'Remover favorito' : 'Favoritar'}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialCommunityIcons
                      name={isFavorite ? 'star' : 'star-outline'}
                      size={26}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.routeStagesFrame}>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  directionalLockEnabled
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  contentContainerStyle={styles.routeCardStagesScrollContent}
                >
                  <MaterialCommunityIcons name="walk" size={17} color="#6B7280" />
                  <Text style={styles.routeCardStageCount}>{stageCount}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={13} color="#CCCCCC" />
                  <View style={styles.routeCardRailWrap}>
                    <View style={styles.routeCardRailUnderline} />
                    {railStages.map((stage, i, arr) => {
                      const lineLabel = extractLineCode(stage);
                      return (
                        <View key={`rail-${i}`} style={styles.routeCardRailItem}>
                          {isWalkStageMode(stage.mode) ? (
                            <MaterialCommunityIcons name="walk" size={17} color="#6B7280" />
                          ) : (
                            <View style={styles.routeCardLinePill}>
                              <View style={styles.routeCardLinePillRow}>
                                <MaterialCommunityIcons
                                  name={stage.mode === 'subway' ? 'subway-variant' : 'bus'}
                                  size={11}
                                  color="#1E1D1D"
                                />
                                <Text style={styles.routeCardLinePillText} numberOfLines={1}>
                                  {stage.line_code?.trim() ? stage.line_code.trim() : lineLabel}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.routeCardLineStripe,
                                  { backgroundColor: getRouteCardLineStripeColor(lineLabel) },
                                ]}
                              />
                            </View>
                          )}
                          {i < arr.length - 1 ? (
                            <MaterialCommunityIcons name="chevron-right" size={13} color="#CCCCCC" />
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </View>

            <View style={styles.timeWindowBar}>
              <TouchableOpacity
                style={[styles.timeWindowThird, styles.timeWindowLeft]}
                activeOpacity={0.7}
                accessibilityLabel="Ver horários anteriores"
              >
                <MaterialCommunityIcons name="chevron-left" size={20} color={COLORS.primary} />
                <Text style={styles.timeWindowLabel}>Antes</Text>
              </TouchableOpacity>
              <View style={[styles.timeWindowThird, styles.timeWindowCenter]}>
                <Text style={styles.timeWindowRange} numberOfLines={1}>
                  {departureTime} - {arrivalTime}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.timeWindowThird, styles.timeWindowRight]}
                activeOpacity={0.7}
                accessibilityLabel="Ver horários posteriores"
              >
                <Text style={styles.timeWindowLabel}>Depois</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.sheetBodyScroll}
              contentContainerStyle={styles.sheetBodyContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <View style={styles.timelineBlock}>
            {/* Origem */}
            <View style={styles.timelineRow}>
              <View style={styles.gutter}>
                <View style={styles.originDotRing} />
                <View
                  style={[
                    styles.vline,
                    {
                      flex: 1,
                      minHeight: 10,
                      backgroundColor:
                        route.stages[0]?.mode === 'walk'
                          ? COLORS.lineGrey
                          : getLineAccentColor(extractLineCode(route.stages[0])),
                    },
                  ]}
                />
              </View>
              <View style={styles.rowMain}>
                <Text style={styles.titleBold} numberOfLines={2}>
                  {route.origin || 'Origem'}
                </Text>
                <View style={styles.timeColRight}>
                  <Text style={styles.timeRight}>{departureTime}</Text>
                </View>
              </View>
            </View>

            {route.stages.map((stage, index) => {
              const isWalk = stage.mode === 'walk';
              const isTransit = stage.mode === 'bus' || stage.mode === 'subway';
              const nextIsWalk = route.stages[index + 1]?.mode === 'walk';
              const nextStage = route.stages[index + 1];
              const prevStage = route.stages[index - 1];
              const lineCode = extractLineCode(stage);
              const accent = getLineAccentColor(lineCode);
              const walkOpen = !!expandedWalk[index];
              const rideOpen = !!expandedRide[index];
              const punctualText = stage.accessible
                ? 'A hora de chegada é pontual'
                : 'Verifique horários e acessibilidade neste trecho';
              const punctualColor = stage.accessible ? COLORS.greenOnTime : COLORS.orangeLate;
              const walkBadge = stage.accessible === false
                ? {
                    label: 'Não acessível',
                    icon: 'wheelchair-accessibility' as const,
                    bg: '#FEE2E2',
                    fg: '#DC2626',
                  }
                : stage.slope_warning === true || !!stage.warning?.trim()
                  ? {
                      label: 'Atenção',
                      icon: 'alert' as const,
                      bg: '#FEF9C3',
                      fg: '#A16207',
                    }
                  : {
                      label: 'Acessível',
                      icon: 'wheelchair-accessibility' as const,
                      bg: '#DCFCE7',
                      fg: '#16A34A',
                    };
              const prevTransitAccent =
                prevStage && (prevStage.mode === 'bus' || prevStage.mode === 'subway')
                  ? getLineAccentColor(extractLineCode(prevStage))
                  : null;
              const nextTransitAccent =
                nextStage && (nextStage.mode === 'bus' || nextStage.mode === 'subway')
                  ? getLineAccentColor(extractLineCode(nextStage))
                  : null;
              const prevIsSameTransitLine =
                !!prevStage &&
                (prevStage.mode === 'bus' || prevStage.mode === 'subway') &&
                extractLineCode(prevStage) === lineCode;
              const stemUpColor =
                isTransit
                  ? accent
                  : prevTransitAccent ??
                    (index === 0 || prevStage?.mode === 'walk' ? COLORS.lineGrey : COLORS.primary);
              const lineAfterColor =
                isTransit
                  ? accent
                  : nextTransitAccent ?? (nextIsWalk ? COLORS.lineGrey : COLORS.primary);

              if (isWalk) {
                const walkImages = (
                  stage.segment_images?.length
                    ? stage.segment_images
                    : stage.street_view_image
                      ? [stage.street_view_image]
                      : []
                ).filter((u, i, arr) => arr.indexOf(u) === i);
                return (
                  <View key={`s-${index}`}>
                    <View style={styles.timelineRow}>
                      <View style={styles.gutter}>
                        <View
                          style={[
                            styles.vline,
                            { backgroundColor: COLORS.lineGrey, flex: 1, minHeight: 10 },
                          ]}
                        />
                        <View style={styles.walkIconOnLine}>
                          <MaterialCommunityIcons name="walk" size={20} color="#6B7280" />
                        </View>
                        <View
                          style={[
                            styles.vline,
                            { backgroundColor: COLORS.lineGrey, flex: 1, minHeight: 10 },
                          ]}
                        />
                      </View>
                      <View style={[styles.blockMain, styles.walkBlockMain]}>
                        <View style={styles.stageDivider} />
                        <TouchableOpacity
                          style={styles.expandHead}
                          onPress={() => toggleWalk(index)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.walkHeadInfo}>
                            <Text style={styles.walkText}>
                              Caminhe {stage.distance || '—'} | {stage.duration || '—'}
                            </Text>
                            <View style={[styles.walkBadge, { backgroundColor: walkBadge.bg }]}>
                              <MaterialCommunityIcons name={walkBadge.icon} size={12} color={walkBadge.fg} />
                              <Text style={[styles.walkBadgeText, { color: walkBadge.fg }]}>
                                {walkBadge.label}
                              </Text>
                            </View>
                          </View>
                          <MaterialCommunityIcons
                            name={walkOpen ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color={COLORS.primary}
                          />
                        </TouchableOpacity>
                        {walkOpen && walkImages.length > 0 ? (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.photoScroll}
                          >
                            {walkImages.map((uri, photoIdx) => (
                              <ExpoImage
                                key={`walk-photo-${index}-${photoIdx}`}
                                source={{ uri }}
                                style={styles.photoThumb}
                                contentFit="cover"
                              />
                            ))}
                          </ScrollView>
                        ) : null}
                        {!stage.accessible && stage.warning ? (
                          <View style={styles.warningCard}>
                            <MaterialCommunityIcons name="alert" size={18} color="#CA8A04" />
                            <Text style={styles.warningText}>{stage.warning}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              }

              if (isTransit) {
                const destName =
                  stage.instruction.split(/\s+/).slice(1).join(' ').trim() || stage.instruction;
                const boardingPlace = extractBoardingPlace(stage.instruction);
                const minutesToBus = transitEtaMinutes(stage);
                const minutesNumeric = Number(minutesToBus);
                const busPassClock = Number.isFinite(minutesNumeric)
                  ? formatClockFromNow(minutesNumeric)
                  : '--:--';

                return (
                  <View key={`s-${index}`}>
                    <View style={styles.timelineRow}>
                      <View style={styles.gutter}>
                        <View
                          style={[
                            styles.vline,
                            prevIsSameTransitLine ? styles.vlineTransit : null,
                            {
                              backgroundColor: prevIsSameTransitLine
                                ? accent
                                : prevTransitAccent ?? COLORS.lineGrey,
                              minHeight: 8,
                            },
                          ]}
                        />
                        <View style={[styles.transitCircle, { backgroundColor: accent }]}>
                          <MaterialCommunityIcons
                            name={stage.mode === 'subway' ? 'subway-variant' : 'bus'}
                            size={18}
                            color="#FFFFFF"
                          />
                        </View>
                        <View
                          style={[
                            styles.vline,
                            styles.vlineTransit,
                            { backgroundColor: lineAfterColor, flex: 1, minHeight: 10 },
                          ]}
                        />
                      </View>
                      <View style={styles.blockMain}>
                        <View style={styles.stageDivider} />
                        <View style={styles.transitTop}>
                          <View style={styles.transitTitleBlock}>
                            <View style={styles.transitHeaderRow}>
                              <View style={styles.routeCardLinePill}>
                                <View style={styles.routeCardLinePillRow}>
                                  <MaterialCommunityIcons
                                    name={stage.mode === 'subway' ? 'subway-variant' : 'bus'}
                                    size={11}
                                    color="#1E1D1D"
                                  />
                                  <Text style={styles.routeCardLinePillText} numberOfLines={1}>
                                    {lineCode}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.routeCardLineStripe,
                                    { backgroundColor: getRouteCardLineStripeColor(lineCode) },
                                  ]}
                                />
                              </View>
                              <Text style={styles.transitAddressText} numberOfLines={2}>
                                {boardingPlace}
                              </Text>
                              {stage.accessible ? (
                                <MaterialCommunityIcons
                                  name="wheelchair-accessibility"
                                  size={18}
                                  color={COLORS.greenOnTime}
                                />
                              ) : null}
                            </View>
                            {transitLegCount > 1 ? (
                              <Text style={[styles.punctual, { color: punctualColor }]}>
                                {punctualText}
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.transitRightCol}>
                            {stage.street_view_image ? (
                              <ExpoImage
                                source={{ uri: stage.street_view_image }}
                                style={styles.thumb56}
                                contentFit="cover"
                              />
                            ) : (
                              <View style={[styles.thumb56, styles.thumbPlaceholder]} />
                            )}
                            <View style={styles.etaBoxUnderThumb}>
                              <MaterialCommunityIcons name="wifi" size={14} color={COLORS.greenOnTime} />
                              <Text style={styles.etaMin}>{transitEtaMinutes(stage)}</Text>
                              <Text style={styles.etaMinSuffix}>min</Text>
                            </View>
                            <Text style={styles.busPassText}>
                              {`Passa em ${minutesToBus} min • ${busPassClock}`}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.badgeRow}>
                        </View>

                      </View>
                    </View>
                  </View>
                );
              }

              return null;
            })}

            <View style={styles.timelineRow}>
              <View style={styles.gutter}>
                <View
                  style={[
                    styles.vline,
                    {
                      flex: 1,
                      minHeight: 10,
                      backgroundColor:
                        route.stages[route.stages.length - 1]?.mode === 'walk'
                          ? COLORS.lineGrey
                          : getLineAccentColor(
                              extractLineCode(route.stages[route.stages.length - 1]),
                            ),
                    },
                  ]}
                />
                <View style={styles.destDot} />
              </View>
              <View style={styles.rowMain}>
                <Text style={styles.titleBold} numberOfLines={3}>
                  {route.destination}
                </Text>
                <View style={styles.timeColRight}>
                  <Text style={styles.timeRight}>{arrivalTime}</Text>
                  <Text style={styles.timeSubRight}>Chegada</Text>
                </View>
              </View>
            </View>
              </View>
            </ScrollView>
          </View>
        </Animated.View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={styles.btnPlay}
            onPress={handleStartNavigation}
            accessibilityLabel={isReading ? 'Parar' : 'Ouvir rota'}
          >
            <MaterialCommunityIcons name={isReading ? 'stop' : 'play'} size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPill} activeOpacity={0.88}>
            <MaterialCommunityIcons name="ticket" size={18} color="#FFFFFF" />
            <Text style={styles.btnPillText}>Passagens</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPill} activeOpacity={0.88}>
            <MaterialCommunityIcons name="bus-clock" size={18} color="#FFFFFF" />
            <Text style={[styles.btnPillText, styles.btnPillTextSmall]} numberOfLines={2}>
              Localização em tempo real
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E5E7EB',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  sheetColumn: {
    flex: 1,
  },
  sheetHandleZone: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  sheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  sheetSummaryMain: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  sheetBodyScroll: {
    flex: 1,
  },
  sheetBodyContent: {
    paddingBottom: 16,
  },
  routeStagesFrame: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  routeCardStagesScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 12,
    paddingVertical: 2,
  },
  timeWindowBar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  timeWindowThird: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeWindowLeft: {
    justifyContent: 'flex-start',
    gap: 4,
  },
  timeWindowCenter: {
    justifyContent: 'center',
  },
  timeWindowRight: {
    justifyContent: 'flex-end',
    gap: 4,
  },
  timeWindowLabel: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  timeWindowRange: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  routeCardStageCount: {
    color: '#374151',
    fontSize: 18,
    fontWeight: '700',
  },
  stageDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    marginBottom: 10,
  },
  routeCardRailWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    paddingBottom: 6,
  },
  routeCardRailUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: '#1E88E5',
    borderRadius: 2,
  },
  routeCardRailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeCardLinePill: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  routeCardLinePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  routeCardLinePillText: {
    color: '#1E1D1D',
    fontSize: 10.5,
    fontWeight: '700',
    maxWidth: 120,
  },
  routeCardLineStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2.5,
  },
  mapFabBack: {
    position: 'absolute',
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  mapFabGps: {
    position: 'absolute',
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  mapFloatRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  pillTraffic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.purpleTip,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    elevation: 3,
  },
  pillTrafficText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pillStart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    elevation: 3,
  },
  pillStartText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  summaryHeaderSide: {
    width: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHeaderCenter: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryHeaderTextBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHeaderPart: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  summaryHeaderSep: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  favStarBtn: {
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineBlock: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  gutter: {
    width: GUTTER,
    alignItems: 'center',
  },
  vline: {
    width: 2,
    alignSelf: 'center',
    borderRadius: 1,
  },
  vlineTransit: {
    width: 6,
    borderRadius: 3,
  },
  originDotRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: COLORS.orangeOrigin,
    backgroundColor: '#FFFFFF',
  },
  destDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.redDest,
  },
  walkIconOnLine: {
    marginVertical: 0,
    backgroundColor: 'transparent',
    padding: 2,
  },
  transitCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 16,
    paddingLeft: 8,
  },
  timeColRight: {
    alignItems: 'flex-end',
  },
  timeRight: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  timeSubRight: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  blockMain: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 20,
  },
  walkBlockMain: {
    minHeight: 84,
  },
  titleBold: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 21,
  },
  expandHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  walkHeadInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  walkText: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  walkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  walkBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  photoScroll: {
    marginTop: 10,
  },
  photoThumb: {
    width: 120,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    marginRight: 8,
  },
  warningCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: COLORS.yellowCard,
    borderWidth: 1,
    borderColor: COLORS.yellowBorder,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.yellowText,
    lineHeight: 18,
  },
  transitTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  transitRightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  transitTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  transitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  transitAddressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.text,
    lineHeight: 21,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  codeGrey: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  thumb56: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  thumbPlaceholder: {},
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  lineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  lineBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  lineBadgeStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  destPreview: {
    flex: 1,
    minWidth: 80,
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  etaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  etaBoxUnderThumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  busPassText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  etaMin: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.greenOnTime,
  },
  etaMinSuffix: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.greenOnTime,
  },
  etaClock: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  punctual: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  rideSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  rideSummaryText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  rideSummaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceTag: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  rideExpand: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  rideExpandText: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  btnPlay: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  btnPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  btnPillTextSmall: {
    fontSize: 11,
    lineHeight: 14,
  },
  errorBox: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
});
