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
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  bg: '#FFFFFF',
  primary: '#0057A8',
  text: '#1E1D1D',
  textMuted: '#999999',
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

function toMinutes(duration: string): number {
  const h = duration.match(/(\d+)\s*h/i);
  const m = duration.match(/(\d+)\s*min/i);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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

export default function RouteDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ route?: string | string[]; id?: string; name?: string }>();
  const [isReading, setIsReading] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

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

  const departureDate = useMemo(() => new Date(), [route]);
  const arrivalDate = useMemo(
    () => new Date(departureDate.getTime() + toMinutes(route?.totalTime ?? '') * 60000),
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
    if (currentStageIndex > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [currentStageIndex]);

  const handleStartNavigation = () => {
    readRoute();
  };

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
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="#0057A8" />
            </TouchableOpacity>
            <Text style={{ color: '#1E1D1D', fontSize: 18, fontWeight: '800' }}>{route.totalTime}</Text>
            <Text style={{ color: '#999999', fontSize: 13 }}>Chegada: {arrivalTime}</Text>
          </View>
          <TouchableOpacity
            style={{ backgroundColor: '#0057A8', borderRadius: 20, padding: 8 }}
            onPress={() => setIsFavorite((v) => !v)}
          >
            <MaterialCommunityIcons name={isFavorite ? 'star' : 'star-outline'} size={18} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {route.stages.map((stage, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {stage.mode === 'walk' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <MaterialCommunityIcons name="walk" size={16} color="#666666" />
                    <Text style={{ color: '#666666', fontSize: 12 }}>{stage.distance}</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: '#1E1D1D', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <MaterialCommunityIcons name={stage.mode === 'subway' ? 'subway-variant' : 'bus'} size={12} color="white" />
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>
                        {stage.instruction?.split(' ')?.[0] ?? '---'}
                      </Text>
                    </View>
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, backgroundColor: '#0057A8' }} />
                  </View>
                )}
                {i < route.stages.length - 1 ? (
                  <MaterialCommunityIcons name="chevron-right" size={14} color="#CCCCCC" />
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialCommunityIcons name="chevron-left" size={18} color="#0057A8" />
            <Text style={{ color: '#0057A8', fontSize: 13 }}>Antes</Text>
          </TouchableOpacity>
          <Text style={{ color: '#1E1D1D', fontSize: 13, fontWeight: '600' }}>
            {departureTime} - {arrivalTime}
          </Text>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#0057A8', fontSize: 13 }}>Após</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#0057A8" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
          <View style={{ width: 40, alignItems: 'center' }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#FF6B00', borderWidth: 3, borderColor: '#FF6B00' }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#1E1D1D', fontSize: 15, fontWeight: '700' }}>{route.origin}</Text>
            <Text style={{ color: '#999999', fontSize: 12, marginTop: 2 }}>Saia às {departureTime}</Text>
          </View>
          <Text style={{ color: '#1E1D1D', fontSize: 14, fontWeight: '600' }}>{departureTime}</Text>
        </View>

        {route.stages.map((stage, index) => (
          <View key={index}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 40, alignItems: 'center' }}>
                <View style={{ width: 2, flex: 1, backgroundColor: stage.mode === 'walk' ? '#CCCCCC' : '#0057A8', minHeight: 20 }} />
              </View>
              <View style={{ flex: 1 }} />
            </View>

            {stage.mode === 'walk' ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 4 }}>
                <View style={{ width: 40, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="walk" size={20} color="#666666" />
                </View>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity onPress={() => setCurrentStageIndex(index)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: '#666666', fontSize: 14 }}>
                      Caminhe {stage.distance} | {stage.duration}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={16} color="#0057A8" />
                  </TouchableOpacity>
                  {stage.street_view_image ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      <Image
                        source={{ uri: stage.street_view_image }}
                        style={{ width: 120, height: 80, borderRadius: 8, marginRight: 8 }}
                        resizeMode="cover"
                      />
                    </ScrollView>
                  ) : null}
                  {!stage.accessible && stage.warning ? (
                    <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginTop: 8, flexDirection: 'row', gap: 8 }}>
                      <MaterialCommunityIcons name="alert" size={16} color="#F59E0B" />
                      <Text style={{ color: '#92400E', fontSize: 13, flex: 1 }}>{stage.warning}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={{ marginVertical: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ width: 40, alignItems: 'center' }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#0057A8', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name={stage.mode === 'subway' ? 'subway-variant' : 'bus'} size={16} color="white" />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#1E1D1D', fontSize: 15, fontWeight: '700' }} numberOfLines={2}>
                          {stage.instruction}
                        </Text>
                        {stage.accessible ? (
                          <MaterialCommunityIcons name="wheelchair-accessibility" size={14} color="#16A34A" style={{ marginTop: 2 }} />
                        ) : null}
                      </View>
                      {stage.street_view_image ? (
                        <Image
                          source={{ uri: stage.street_view_image }}
                          style={{ width: 56, height: 56, borderRadius: 8, marginLeft: 12 }}
                          resizeMode="cover"
                        />
                      ) : null}
                    </View>

                    <View style={{ marginTop: 10, gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ backgroundColor: '#1E1D1D', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <MaterialCommunityIcons name={stage.mode === 'subway' ? 'subway-variant' : 'bus'} size={12} color="white" />
                              <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>
                                {stage.instruction?.split(' ')?.[0] ?? '---'}
                              </Text>
                            </View>
                            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, backgroundColor: '#0057A8' }} />
                          </View>
                          <Text style={{ color: '#666666', fontSize: 13 }} numberOfLines={1}>
                            {stage.instruction}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <MaterialCommunityIcons name="wifi" size={13} color="#22c55e" />
                            <Text style={{ color: '#22c55e', fontSize: 16, fontWeight: '800' }}>--</Text>
                            <Text style={{ color: '#22c55e', fontSize: 11 }}>min</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={{ color: '#22c55e', fontSize: 12 }}>
                        A hora de chegada é pontual
                      </Text>
                    </View>

                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
                      <Text style={{ color: '#666666', fontSize: 13 }}>Viaje -- pontos | {stage.duration}</Text>
                      <MaterialCommunityIcons name="chevron-down" size={16} color="#0057A8" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        ))}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
          <View style={{ width: 40, alignItems: 'center' }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#FF4444', borderWidth: 3, borderColor: '#FF4444' }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#1E1D1D', fontSize: 15, fontWeight: '700' }}>{route.destination}</Text>
            <Text style={{ color: '#999999', fontSize: 12, marginTop: 2 }}>Chegada às {arrivalTime}</Text>
          </View>
          <Text style={{ color: '#1E1D1D', fontSize: 14, fontWeight: '600' }}>{arrivalTime}</Text>
        </View>
      </ScrollView>

      <View style={{ backgroundColor: '#FFFFFF', padding: 16, borderTopWidth: 1, borderTopColor: '#EEEEEE', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TouchableOpacity
          onPress={handleStartNavigation}
          style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center', shadowColor: '#22c55e', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 }}
        >
          <MaterialCommunityIcons name={isReading ? 'stop' : 'play'} size={26} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={{ flex: 1, backgroundColor: '#0057A8', borderRadius: 24, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="ticket" size={16} color="white" />
          <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>Passagens</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ flex: 1, backgroundColor: '#0057A8', borderRadius: 24, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="bus-clock" size={16} color="white" />
          <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Tempo real</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
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
