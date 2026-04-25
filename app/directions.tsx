import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { searchRoutes } from '../services/routes.service';
import { getToken, getUserInfo } from '../services/token.service';

type RouteLeg = 'walk' | 'bus' | 'subway';

type NormalizedRoute = {
  id: string;
  totalTime: string;
  totalDistance: string;
  totalDuration: string;
  departTime: string;
  arriveTime: string;
  legs: RouteLeg[];
  accessible: boolean;
  description: string;
  origin: string;
  destination: string;
  originCoordinate: { latitude: number; longitude: number };
  destinationCoordinate: { latitude: number; longitude: number };
  stages: {
    mode: string;
    instruction: string;
    distance: string;
    duration: string;
    accessible: boolean;
    warning?: string;
    street_view_image?: string;
    points: { latitude: number; longitude: number }[];
  }[];
};

const DEFAULT_TRANSPORT_TYPE = 'bus';

function normalizeMode(input: string): RouteLeg {
  const s = input.toLowerCase();
  if (s.includes('walk') || s.includes('pe') || s.includes('walking')) return 'walk';
  if (s.includes('metro') || s.includes('subway') || s.includes('train')) return 'subway';
  return 'bus';
}

function parseLegsFromItem(item: Record<string, unknown>): RouteLeg[] {
  const raw = item.legs ?? item.modes ?? item.transport ?? item.transports ?? item.segments;
  const list: string[] = Array.isArray(raw)
    ? (raw as unknown[]).map((x) => String(x).toLowerCase())
    : typeof raw === 'string'
      ? raw.split(/[+,\s]+/).map((s) => s.trim().toLowerCase())
      : [];

  const legs = list.map(normalizeMode);
  return legs.length > 0 ? legs : ['walk', 'bus'];
}

function normalizeRoutes(data: unknown): NormalizedRoute[] {
  if (
    !data ||
    typeof data !== 'object' ||
    !('routes' in data) ||
    !Array.isArray((data as { routes?: unknown }).routes)
  ) {
    return [];
  }

  const payload = data as {
    route?: { origin?: string; destination?: string };
    routes: any[];
  };

  return payload.routes.map((r: any, index: number) => {
    const stages = Array.isArray(r.stages)
      ? r.stages.map((s: any) => ({
          mode: s.mode ?? 'walk',
          instruction: s.instruction ?? '',
          distance: String(s.distance ?? ''),
          duration: String(s.duration ?? ''),
          accessible: s.accessible !== false,
          warning: s.warning ?? undefined,
          street_view_image: s.street_view_image ?? undefined,
          points: Array.isArray(s.points) ? s.points : [],
        }))
      : [];

    const originCoordinate =
      stages?.[0]?.points?.[0] ?? r.originCoordinate ?? { latitude: -16.7, longitude: -43.86 };
    const destinationCoordinate =
      stages?.[stages.length - 1]?.points?.slice(-1)?.[0] ??
      r.destinationCoordinate ?? { latitude: -16.72, longitude: -43.87 };

    const legs = stages.length > 0 ? stages.map((s) => normalizeMode(s.mode)) : parseLegsFromItem(r);

    return {
      id: String(index),
      totalTime: String(r.total_duration ?? r.totalTime ?? '--'),
      totalDistance: String(r.total_distance ?? r.totalDistance ?? '--'),
      totalDuration: String(r.total_duration ?? r.totalDuration ?? '--'),
      departTime: '',
      arriveTime: '',
      legs,
      accessible: stages.length > 0 ? stages.every((s) => s.accessible !== false) : r.accessible !== false,
      description: stages[0]?.instruction ?? 'Rota sugerida pelo Mobility',
      origin: payload.route?.origin ?? '',
      destination: payload.route?.destination ?? '',
      originCoordinate,
      destinationCoordinate,
      stages,
    };
  });
}

const LEG_ICONS: Record<RouteLeg, keyof typeof MaterialCommunityIcons.glyphMap> = {
  walk: 'walk',
  bus: 'bus',
  subway: 'subway-variant',
};

export default function DirectionsScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originLocationLoading, setOriginLocationLoading] = useState(true);
  const [routes, setRoutes] = useState<NormalizedRoute[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentGps, setCurrentGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationCoord, setDestinationCoord] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );

  useEffect(() => {
    const loadCurrentLocation = async () => {
      setOriginLocationLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const currentLocation = await Location.getCurrentPositionAsync({});
        const originPoint = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        };
        setCurrentGps(originPoint);

        const currentAddress = await Location.reverseGeocodeAsync(originPoint);
        let resolvedOrigin: string;
        if (currentAddress.length > 0) {
          const address = currentAddress[0];
          const label = [address.street, address.name, address.city].filter(Boolean).join(', ');
          resolvedOrigin = label || `${originPoint.latitude}, ${originPoint.longitude}`;
        } else {
          resolvedOrigin = `${originPoint.latitude}, ${originPoint.longitude}`;
        }

        setOrigin(resolvedOrigin);
      } finally {
        setOriginLocationLoading(false);
      }
    };

    loadCurrentLocation();
  }, []);

  useEffect(() => {
    const geocodeDestination = async () => {
      const dest = destination.trim();
      if (!dest) {
        setDestinationCoord(null);
        return;
      }
      try {
        const points = await Location.geocodeAsync(dest);
        if (points.length > 0) {
          setDestinationCoord({ latitude: points[0].latitude, longitude: points[0].longitude });
        }
      } catch {
        setDestinationCoord(null);
      }
    };

    geocodeDestination();
  }, [destination]);

  useEffect(() => {
    if (!mapRef.current || !currentGps) return;

    if (destinationCoord) {
      mapRef.current.fitToCoordinates([currentGps, destinationCoord], {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
    } else {
      mapRef.current.animateToRegion(
        {
          latitude: currentGps.latitude,
          longitude: currentGps.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        500,
      );
    }
  }, [currentGps, destinationCoord]);

  const centerOnCurrentLocation = () => {
    if (!currentGps || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: currentGps.latitude,
        longitude: currentGps.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      500,
    );
  };

  const fetchRoutes = useCallback(async () => {
    const dest = destination.trim();
    if (!dest || dest === 'Destino') {
      Alert.alert('Destino', 'Informe o destino para buscar rotas.');
      return;
    }

    const token = await getToken();
    if (!token || !token.trim()) {
      router.replace('/login');
      return;
    }

    const { userId } = await getUserInfo();
    if (typeof userId !== 'number' || Number.isNaN(userId)) {
      setErrorMessage('Sessao invalida. Faca login novamente.');
      return;
    }

    setLoading(true);
    setRoutes(null);
    setErrorMessage('');

    try {
      const raw = await searchRoutes(
        origin.trim() || 'Local atual',
        dest,
        userId,
        DEFAULT_TRANSPORT_TYPE,
      );
      const normalized = normalizeRoutes(raw);
      setRoutes(normalized);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Nao foi possivel carregar as rotas. Tente novamente.';
      setErrorMessage(message);
      setRoutes([]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [destination, origin, router]);

  const hasRoutes = !!routes && routes.length > 0;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: currentGps?.latitude ?? -16.7,
          longitude: currentGps?.longitude ?? -43.86,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {currentGps && (
          <Marker coordinate={currentGps} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.originMarker} />
          </Marker>
        )}
        {destinationCoord && (
          <Marker coordinate={destinationCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.destinationMarker} />
          </Marker>
        )}
        {currentGps && destinationCoord && (
          <Polyline
            coordinates={[currentGps, destinationCoord]}
            strokeColor="#0057A8"
            strokeWidth={3}
            lineDashPattern={[8, 6]}
          />
        )}
      </MapView>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={24} color="#0057A8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.locationButton} onPress={centerOnCurrentLocation}>
        <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#0057A8" />
      </TouchableOpacity>

      <View style={styles.panel}>
        <View style={styles.inputBlock}>
          <View style={styles.pointsColumn}>
            <View style={styles.originDot} />
            <View style={styles.dashedLine} />
            <MaterialCommunityIcons name="map-marker" size={18} color="#FF4444" />
          </View>

          <View style={styles.inputsColumn}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputText}
                placeholder={originLocationLoading ? 'Obtendo localização...' : 'Minha localização'}
                placeholderTextColor="#AAAAAA"
                value={origin}
                editable={false}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputText}
                placeholder="Para onde?"
                placeholderTextColor="#AAAAAA"
                value={destination}
                onChangeText={setDestination}
              />
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.searchButton} onPress={fetchRoutes}>
          <Text style={styles.searchButtonText}>Buscar rotas</Text>
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0057A8" />
          </View>
        )}

        {!loading && !!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        {!loading && routes !== null && routes.length === 0 && (
          <Text style={styles.emptyText}>Nenhuma rota encontrada.</Text>
        )}

        {!loading && hasRoutes && (
          <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsContent}>
            {routes.map((route) => (
              <View key={route.id} style={styles.routeCard}>
                <View style={styles.routeHeader}>
                  <Text style={styles.routeTime}>{route.totalDuration}</Text>
                  <View style={styles.routeIcons}>
                    {route.legs.map((leg, i) => (
                      <MaterialCommunityIcons
                        key={`${route.id}-${leg}-${i}`}
                        name={LEG_ICONS[leg]}
                        size={20}
                        color="#0057A8"
                      />
                    ))}
                  </View>
                </View>

                <Text style={styles.routeMeta}>
                  Distância {route.totalDistance} · Duração {route.totalDuration}
                </Text>

                <View style={styles.badgesRow}>
                  <View style={styles.badgeSuccess}>
                    <Text style={styles.badgeSuccessText}>Acessível</Text>
                  </View>
                  {!route.accessible && (
                    <View style={styles.badgeError}>
                      <Text style={styles.badgeErrorText}>Atenção</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() =>
                    router.push({
                      pathname: '/route-detail',
                      params: { route: JSON.stringify(route) },
                    })
                  }
                >
                  <Text style={styles.detailButtonText}>Ver trajeto �??</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  locationButton: {
    position: 'absolute',
    bottom: 260,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  originMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0057A8',
  },
  destinationMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF4444',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    maxHeight: 430,
  },
  inputBlock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 20,
  },
  pointsColumn: {
    width: 24,
    alignItems: 'center',
  },
  originDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0057A8',
    marginTop: 14,
  },
  dashedLine: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: '#CCCCCC',
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  destinationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF4444',
    marginBottom: 14,
  },
  inputsColumn: {
    flex: 1,
    marginLeft: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    color: '#1E1D1D',
    paddingVertical: 12,
    fontFamily: 'Agrandir-Regular',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
  },
  searchButton: {
    backgroundColor: '#0057A8',
    borderRadius: 40,
    height: 52,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    fontFamily: 'Agrandir-TextBold',
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Agrandir-Regular',
  },
  emptyText: {
    color: '#666666',
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Agrandir-Regular',
  },
  resultsScroll: {
    marginTop: 8,
    maxHeight: 280,
  },
  resultsContent: {
    paddingBottom: 14,
  },
  routeCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeTime: {
    color: '#0057A8',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Agrandir-GrandHeavy',
  },
  routeIcons: {
    flexDirection: 'row',
    gap: 6,
  },
  routeMeta: {
    color: '#666666',
    fontSize: 13,
    marginTop: 4,
    fontFamily: 'Agrandir-Regular',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(34,197,94,0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeSuccessText: {
    color: '#4ADE80',
    fontSize: 12,
    fontFamily: 'Agrandir-Regular',
  },
  badgeError: {
    backgroundColor: 'rgba(239,68,68,0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontFamily: 'Agrandir-Regular',
  },
  detailButton: {
    backgroundColor: '#0057A8',
    borderRadius: 40,
    height: 40,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'Agrandir-TextBold',
  },
});
