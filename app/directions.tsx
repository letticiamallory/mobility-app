import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GooglePlacesAutocomplete,
  type GooglePlacesAutocompleteRef,
} from 'react-native-google-places-autocomplete';
import MapView from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
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
};

const DEFAULT_TRANSPORT_TYPE = 'bus';

const COLORS = {
  bg: '#FFFFFF',
  panel: '#1C1C1E',
  surface: '#FFFFFF',
  border: '#D0D7DE',
  primary: '#0057A8',
  text: '#1A1A1A',
  textMuted: '#4B5563',
  pin: '#FF4444',
  success: '#22c55e',
  error: '#ef4444',
  buttonText: '#FFFFFF',
};

function parseLegsFromItem(item: Record<string, unknown>): RouteLeg[] {
  const raw =
    item.legs ??
    item.modes ??
    item.transport ??
    item.transports ??
    item.segments;
  const list: string[] = Array.isArray(raw)
    ? (raw as unknown[]).map((x) => String(x).toLowerCase())
    : typeof raw === 'string'
      ? raw.split(/[+,\s]+/).map((s) => s.trim().toLowerCase())
      : [];

  const legs: RouteLeg[] = [];
  for (const s of list) {
    if (s.includes('walk') || s.includes('pe') || s === 'walking') legs.push('walk');
    else if (s.includes('bus') || s.includes('onibus')) legs.push('bus');
    else if (s.includes('metro') || s.includes('subway') || s.includes('train')) legs.push('subway');
  }
  if (legs.length === 0) legs.push('walk', 'bus');
  return legs;
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
  const mappedRoutes = payload.routes.map((r: any) => ({
    origin: payload.route?.origin ?? '',
    destination: payload.route?.destination ?? '',
    totalTime: r.total_duration,
    totalDistance: String(r.total_distance ?? ''),
    totalDuration: String(r.total_duration ?? ''),
    originCoordinate: r.stages?.[0]?.points?.[0] ?? { latitude: -16.7, longitude: -43.86 },
    destinationCoordinate:
      r.stages?.[r.stages.length - 1]?.points?.slice(-1)[0] ??
      { latitude: -16.72, longitude: -43.87 },
    stages: r.stages.map((s: any) => ({
      mode: s.mode ?? 'walk',
      instruction: s.instruction ?? '',
      distance: s.distance ?? '',
      duration: s.duration ?? '',
      accessible: s.accessible !== false,
      warning: s.warning ?? undefined,
      street_view_image: s.street_view_image ?? undefined,
      points: s.points ?? [],
    })),
  }));

  return mappedRoutes.map((route, index) => ({
    ...route,
    id: String(index),
    departTime: '',
    arriveTime: '',
    legs: route.stages.map((s) => s.mode as RouteLeg),
    accessible: route.stages.every((s) => s.accessible !== false),
    description: route.stages[0]?.instruction ?? 'Rota sugerida pelo Mobility',
  }));
}

const LEG_ICONS: Record<RouteLeg, keyof typeof MaterialCommunityIcons.glyphMap> = {
  walk: 'walk',
  bus: 'bus',
  subway: 'subway-variant',
};

const GOOGLE_PLACES_STYLES = {
  container: { flex: 0, flexGrow: 0 },
  textInputContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    borderRadius: 8,
    paddingHorizontal: 0,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    color: '#1E1D1D',
    fontSize: 13,
    fontWeight: '600' as const,
    height: 52,
    paddingVertical: 0,
    paddingHorizontal: 16,
    marginBottom: 0,
    borderRadius: 8,
  },
  listView: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginTop: 4,
  },
  row: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  separator: {
    backgroundColor: COLORS.border,
    height: StyleSheet.hairlineWidth,
  },
  description: {
    color: COLORS.text,
  },
};

export default function DirectionsScreen() {
  const router = useRouter();

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originLocationLoading, setOriginLocationLoading] = useState(true);
  const [routes, setRoutes] = useState<NormalizedRoute[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentGps, setCurrentGps] = useState<{ latitude: number; longitude: number } | null>(null);

  const originPlacesRef = useRef<GooglePlacesAutocompleteRef>(null);
  const destinationPlacesRef = useRef<GooglePlacesAutocompleteRef>(null);

  useEffect(() => {
    const loadCurrentLocation = async () => {
      setOriginLocationLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        setCurrentGps({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        const currentAddress = await Location.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });

        let resolvedOrigin: string;
        if (currentAddress.length > 0) {
          const address = currentAddress[0];
          const label = [address.street, address.name, address.city].filter(Boolean).join(', ');
          resolvedOrigin = label || `${currentLocation.coords.latitude}, ${currentLocation.coords.longitude}`;
        } else {
          resolvedOrigin = `${currentLocation.coords.latitude}, ${currentLocation.coords.longitude}`;
        }

        setOrigin(resolvedOrigin);
        originPlacesRef.current?.setAddressText(resolvedOrigin);
      } finally {
        setOriginLocationLoading(false);
      }
    };

    loadCurrentLocation();
  }, []);

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
      console.log('[directions] searchRoutes params', {
        origin: origin.trim() || 'Local atual',
        destination: dest,
        user_id: userId,
        transport_type: DEFAULT_TRANSPORT_TYPE,
      });
      const raw = await searchRoutes(
        origin.trim() || 'Local atual',
        dest,
        userId,
        DEFAULT_TRANSPORT_TYPE,
      );
      setRoutes(normalizeRoutes(raw));
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
  }, [origin, destination, router]);

  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
    originPlacesRef.current?.setAddressText(destination);
    destinationPlacesRef.current?.setAddressText(origin);
    setRoutes(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: currentGps?.latitude ?? -16.7,
          longitude: currentGps?.longitude ?? -43.86,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
      </TouchableOpacity>

      <View style={styles.panel}>
        <Text style={styles.panelTitle} accessibilityRole="header">
          Para onde?
        </Text>

        <View style={styles.inputRow}>
          <GooglePlacesAutocomplete
            ref={originPlacesRef}
            placeholder={originLocationLoading ? 'Obtendo localização...' : 'Local atual'}
            fetchDetails
            enablePoweredByContainer={false}
            keyboardShouldPersistTaps="handled"
            query={{
              key: process.env.EXPO_PUBLIC_GOOGLE_API_KEY ?? '',
              language: 'pt-BR',
            }}
            textInputProps={{
              placeholderTextColor: '#7D8590',
              onChangeText: setOrigin,
            }}
            styles={GOOGLE_PLACES_STYLES}
            onPress={(data, details = null) => {
              const addr = details?.formatted_address ?? data.description;
              setOrigin(addr);
            }}
          />
          <MaterialCommunityIcons name="map-marker" size={20} color={COLORS.primary} />
        </View>

        <View style={[styles.inputRow, styles.inputRowTop]}>
          <GooglePlacesAutocomplete
            ref={destinationPlacesRef}
            placeholder="Para onde?"
            fetchDetails
            enablePoweredByContainer={false}
            keyboardShouldPersistTaps="handled"
            currentLocation
            currentLocationLabel="Localização atual"
            nearbyPlacesAPI="GooglePlacesSearch"
            filterReverseGeocodingByTypes={['locality', 'administrative_area_level_3']}
            query={{
              key: process.env.EXPO_PUBLIC_GOOGLE_API_KEY ?? '',
              language: 'pt-BR',
              components: 'country:br',
              ...(currentGps != null
                ? {
                    location: `${currentGps.latitude},${currentGps.longitude}`,
                    radius: 50000,
                  }
                : {}),
            }}
            textInputProps={{
              placeholderTextColor: '#7D8590',
              onChangeText: setDestination,
            }}
            styles={GOOGLE_PLACES_STYLES}
            onPress={(data, details = null) => {
              const formatted =
                typeof details?.formatted_address === 'string'
                  ? details.formatted_address.trim()
                  : '';
              const label = (formatted || String(data.description ?? '').trim()).trim();
              setDestination(label);
              destinationPlacesRef.current?.setAddressText(label);
            }}
          />
          <MaterialCommunityIcons name="map-marker" size={20} color={COLORS.primary} />
        </View>

        <TouchableOpacity
          style={styles.searchButton}
          onPress={fetchRoutes}
          accessibilityRole="button"
          accessibilityLabel="Buscar rotas"
        >
          <Text style={styles.searchButtonText}>Buscar rotas</Text>
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}

        {!loading && errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {!loading && routes !== null && routes.length === 0 && (
          <Text style={styles.emptyText}>Nenhuma rota encontrada.</Text>
        )}

        {!loading && routes !== null && routes.length > 0 && (
          <ScrollView
            style={styles.routesScroll}
            contentContainerStyle={styles.routesScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {routes.map((route) => (
              <TouchableOpacity
                key={route.id}
                style={styles.routeResultCard}
                activeOpacity={0.9}
                onPress={() =>
                  router.push({
                    pathname: '/route-detail',
                    params: { route: JSON.stringify(route) },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Rota de ${route.totalDuration}, ${route.accessible ? 'acessível' : 'com atenção'}. Toque duas vezes para ver detalhes`}
              >
                <View style={styles.routeResultTop}>
                  <View style={styles.routeResultLeft}>
                    <Text style={styles.routeTime}>{route.totalTime}</Text>
                    <Text style={styles.routeTimesSub}>
                      Distância {route.totalDistance} · Duração {route.totalDuration}
                    </Text>
                  </View>
                  <View style={styles.routeIcons}>
                    {route.legs.map((leg, i) => (
                      <MaterialCommunityIcons
                        key={`${route.id}-${leg}-${i}`}
                        name={LEG_ICONS[leg]}
                        size={26}
                        color={COLORS.primary}
                      />
                    ))}
                  </View>
                </View>

                <Text
                  style={[
                    styles.badgeTextSimple,
                    { color: route.accessible ? COLORS.success : COLORS.error },
                  ]}
                >
                  {route.accessible ? 'Acessível' : 'Atenção'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
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
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    backgroundColor: COLORS.panel,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 20,
    maxHeight: '78%',
  },
  panelTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    fontFamily: 'Agrandir-TextBold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingRight: 14,
  },
  inputRowTop: {
    marginTop: 10,
  },
  searchButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  searchButtonText: {
    color: COLORS.buttonText,
    fontWeight: '700',
    fontSize: 15,
    fontFamily: 'Agrandir-TextBold',
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 16,
    fontFamily: 'Agrandir-Regular',
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
    fontWeight: '600',
    fontFamily: 'Agrandir-Regular',
  },
  routesScroll: {
    marginTop: 8,
  },
  routesScrollContent: {
    paddingBottom: 16,
  },
  routeResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  routeResultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  routeResultLeft: {
    flex: 1,
    marginRight: 8,
  },
  routeTime: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Agrandir-GrandHeavy',
  },
  routeTimesSub: {
    color: '#666666',
    fontSize: 13,
    marginTop: 4,
    fontFamily: 'Agrandir-Regular',
  },
  routeIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeTextSimple: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    fontFamily: 'Agrandir-TextBold',
  },
});
