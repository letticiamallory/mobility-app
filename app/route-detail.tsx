import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_HEIGHT = SCREEN_HEIGHT * 0.5;

const COLORS = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  border: '#D0D7DE',
  primary: '#0057A8',
  text: '#1A1A1A',
  textMuted: '#4B5563',
  destPin: '#FF4444',
  error: '#ef4444',
};

export type RouteStage = {
  mode: 'walk' | 'bus' | 'subway';
  instruction: string;
  distance: string;
  duration: string;
  accessible: boolean;
  warning?: string;
  street_view_image?: string;
  points?: { latitude: number; longitude: number }[];
};

export type SerializedRouteDetail = {
  origin: string;
  destination: string;
  totalTime: string;
  originCoordinate: { latitude: number; longitude: number };
  destinationCoordinate: { latitude: number; longitude: number };
  stages: RouteStage[];
};

const FALLBACK_SP = { latitude: -23.55052, longitude: -46.633308 };

const MODE_ICONS: Record<
  RouteStage['mode'],
  keyof typeof MaterialCommunityIcons.glyphMap
> = {
  walk: 'walk',
  bus: 'bus',
  subway: 'subway-variant',
};

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
        accessible: st.accessible !== false,
        warning: st.warning != null ? String(st.warning) : undefined,
        street_view_image:
          st.street_view_image != null ? String(st.street_view_image) : undefined,
        points: Array.isArray(st.points)
          ? (st.points as { latitude: number; longitude: number }[]).filter(
              (p) =>
                typeof p?.latitude === 'number' &&
                typeof p?.longitude === 'number',
            )
          : undefined,
      };
    });
    return {
      origin: String(o.origin ?? ''),
      destination: String(o.destination ?? ''),
      totalTime: String(o.totalTime ?? o.total_time ?? ''),
      originCoordinate: originCoord,
      destinationCoordinate: destCoord,
      stages,
    };
  } catch {
    return null;
  }
}

function buildPolylineCoords(route: SerializedRouteDetail): { latitude: number; longitude: number }[] {
  const fromStages = route.stages.flatMap((s) => s.points ?? []);
  if (fromStages.length >= 2) {
    return fromStages;
  }
  return [route.originCoordinate, route.destinationCoordinate];
}

function mapRegion(route: SerializedRouteDetail) {
  const pts = [
    route.originCoordinate,
    route.destinationCoordinate,
    ...buildPolylineCoords(route),
  ];
  const lats = pts.map((p) => p.latitude);
  const lngs = pts.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const latDelta = Math.max((maxLat - minLat) * 1.35, 0.015);
  const lngDelta = Math.max((maxLng - minLng) * 1.35, 0.015);
  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

export default function RouteDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ route?: string | string[] }>();

  const route = useMemo(() => parseRouteParam(params.route), [params.route]);

  const polylineCoords = useMemo(() => {
    if (!route) return [];
    return buildPolylineCoords(route);
  }, [route]);

  const region = useMemo(() => {
    if (!route) {
      return {
        ...FALLBACK_SP,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }
    return mapRegion(route);
  }, [route]);

  if (!route) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorBox}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.errorText}>Rota invalida ou nao informada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.topMiddle}>
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyLabel}>Origem</Text>
            <Text style={styles.readonlyValue} numberOfLines={2}>
              {route.origin}
            </Text>
          </View>
          <View style={styles.fieldDivider} />
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyLabel}>Destino</Text>
            <Text style={styles.readonlyValue} numberOfLines={2}>
              {route.destination}
            </Text>
          </View>
        </View>

        <View style={styles.totalTimeBox}>
          <Text style={styles.totalTimeLabel}>Total</Text>
          <Text style={styles.totalTimeValue}>{route.totalTime}</Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <MapView style={StyleSheet.absoluteFill} initialRegion={region}>
          <Marker coordinate={route.originCoordinate} title="Origem" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerOrigin} />
          </Marker>
          <Marker
            coordinate={route.destinationCoordinate}
            title="Destino"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.markerDest} />
          </Marker>
          {polylineCoords.length >= 2 && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor={COLORS.primary}
              strokeWidth={4}
            />
          )}
        </MapView>
      </View>

      <ScrollView
        style={styles.stagesScroll}
        contentContainerStyle={styles.stagesContent}
        showsVerticalScrollIndicator={false}
      >
        {route.stages.map((stage, index) => (
          <View key={index} style={styles.stageCard}>
            <View style={styles.stageHeader}>
              <MaterialCommunityIcons
                name={MODE_ICONS[stage.mode]}
                size={28}
                color={COLORS.primary}
              />
              <View style={styles.stageHeaderText}>
                <Text style={styles.stageInstruction}>{stage.instruction}</Text>
                <Text style={styles.stageMeta}>
                  {stage.distance}
                  {stage.distance && stage.duration ? ' · ' : ''}
                  {stage.duration}
                </Text>
              </View>
            </View>

            {stage.accessible === false && (
              <View style={styles.warningBlock}>
                <View style={styles.badgeAtencao}>
                  <Text style={styles.badgeAtencaoText}>Atencao</Text>
                </View>
                {stage.warning ? (
                  <Text style={styles.warningText}>{stage.warning}</Text>
                ) : null}
              </View>
            )}

            {stage.street_view_image ? (
              <Image
                source={{ uri: stage.street_view_image }}
                style={styles.streetView}
                resizeMode="cover"
              />
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  topMiddle: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  readonlyField: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  readonlyLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  readonlyValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  fieldDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  totalTimeBox: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 72,
    paddingRight: 4,
  },
  totalTimeLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  totalTimeValue: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  mapWrap: {
    height: MAP_HEIGHT,
    backgroundColor: COLORS.surface,
  },
  markerOrigin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#E6EDF3',
  },
  markerDest: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.destPin,
    borderWidth: 2,
    borderColor: '#E6EDF3',
  },
  stagesScroll: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  stagesContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  stageCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 10,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stageHeaderText: {
    flex: 1,
  },
  stageInstruction: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  stageMeta: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  warningBlock: {
    gap: 8,
  },
  badgeAtencao: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeAtencaoText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '700',
  },
  warningText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  streetView: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: COLORS.border,
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
