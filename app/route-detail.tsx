import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
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
const MAP_HEIGHT = SCREEN_HEIGHT * 0.6;
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.45;

const COLORS = {
  bg: '#FFFFFF',
  panel: '#1C1C1E',
  card: '#262626',
  primary: '#0057A8',
  text: '#FFFFFF',
  textMuted: '#999999',
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
  const [isReading, setIsReading] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  const route = useMemo(() => parseRouteParam(params.route), [params.route]);

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

  useEffect(() => {
    if (!route) return;
    AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (enabled && route) readRoute();
    });
  }, [route]);

  useEffect(() => {
    if (currentStageIndex > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [currentStageIndex]);

  if (!route) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorBox}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.errorText}>Rota invalida ou nao informada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.mapArea}>
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

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.voiceButton}
        onPress={readRoute}
        accessibilityLabel="Ouvir instruções da rota"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name={isReading ? 'stop' : 'volume-high'}
          size={24}
          color="#0057A8"
        />
      </TouchableOpacity>

      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <View style={styles.routeTextRow}>
            <Text numberOfLines={1} style={styles.headerPlace} accessibilityRole="header">
              {route.origin}
            </Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={COLORS.textMuted} />
            <Text numberOfLines={1} style={styles.headerPlace} accessibilityRole="header">
              {route.destination}
            </Text>
          </View>
          <Text style={styles.totalTimeValue}>{route.totalTime}</Text>
        </View>

        <ScrollView
          style={styles.stagesScroll}
          contentContainerStyle={styles.stagesContent}
          showsVerticalScrollIndicator={false}
        >
          {route.stages.map((stage, index) => (
            <TouchableOpacity
              key={index}
              style={styles.stageCard}
              activeOpacity={0.95}
              onPress={() => setCurrentStageIndex(index)}
              accessibilityRole="button"
              accessibilityLabel={`Etapa ${index + 1} da rota`}
            >
              <View style={styles.stageHeader}>
                <MaterialCommunityIcons
                  name={MODE_ICONS[stage.mode]}
                  size={26}
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
                    <Text style={styles.badgeAtencaoText}>Atenção</Text>
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
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  mapArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: MAP_HEIGHT,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  voiceButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PANEL_HEIGHT,
    backgroundColor: COLORS.panel,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  routeTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  headerPlace: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    fontFamily: 'Agrandir-Regular',
  },
  totalTimeValue: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'Agrandir-GrandHeavy',
  },
  markerOrigin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerDest: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.destPin,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stagesScroll: {
    flex: 1,
  },
  stagesContent: {
    paddingBottom: 18,
  },
  stageCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
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
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    fontFamily: 'Agrandir-TextBold',
  },
  stageMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 6,
    fontFamily: 'Agrandir-Regular',
  },
  warningBlock: {
    gap: 8,
    marginTop: 10,
  },
  badgeAtencao: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.error,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeAtencaoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Agrandir-TextBold',
  },
  warningText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Agrandir-Regular',
  },
  streetView: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    backgroundColor: '#3B3B3B',
    marginTop: 10,
  },
  errorBox: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontFamily: 'Agrandir-Regular',
  },
});
