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
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GooglePlacesAutocomplete,
  type GooglePlacesAutocompleteRef,
} from 'react-native-google-places-autocomplete';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchRoutes } from '../services/routes.service';
import { getToken, getUserInfo } from '../services/token.service';

type RouteLeg = 'walk' | 'bus' | 'subway';

type NormalizedRoute = {
  id: string;
  totalTime: string;
  departTime: string;
  arriveTime: string;
  legs: RouteLeg[];
  accessible: boolean;
  description: string;
};

const DEFAULT_TRANSPORT_TYPE = 'bus';

const COLORS = {
  bg: '#FFFFFF',
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
  if (data == null) return [];
  const rawList = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && 'routes' in data
      ? (data as { routes: unknown }).routes
      : typeof data === 'object' && data !== null && 'data' in data
        ? (data as { data: unknown }).data
        : [];

  if (!Array.isArray(rawList)) return [];

  return rawList.map((entry, index) => {
    const item = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const totalTime = String(
      item.total_time ?? item.duration ?? item.totalTime ?? item.time ?? `${30 + index * 5} min`,
    );
    const departTime = String(
      item.departure_time ?? item.depart_time ?? item.departTime ?? item.departure ?? '08:10',
    );
    const arriveTime = String(
      item.arrival_time ?? item.arrive_time ?? item.arriveTime ?? item.arrival ?? '08:42',
    );
    const description = String(
      item.summary ?? item.description ?? item.name ?? item.detail ?? 'Rota sugerida pelo Mobility',
    );
    const accessible = Boolean(item.accessible ?? item.is_accessible ?? item.accessibility);

    return {
      id: String(item.id ?? index),
      totalTime,
      departTime,
      arriveTime,
      legs: parseLegsFromItem(item),
      accessible,
      description,
    };
  });
}

const LEG_ICONS: Record<RouteLeg, keyof typeof MaterialCommunityIcons.glyphMap> = {
  walk: 'walk',
  bus: 'bus',
  subway: 'subway-variant',
};

const GOOGLE_PLACES_STYLES = {
  container: { flex: 0 },
  textInputContainer: {
    backgroundColor: COLORS.surface,
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600' as const,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 0,
  },
  listView: {
    backgroundColor: COLORS.surface,
  },
  row: {
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    paddingHorizontal: 4,
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
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Nao foi possivel carregar as rotas. Tente novamente.';
      setErrorMessage(message);
      setRoutes([]);
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.routeCard}>
          <View style={styles.timelineColumn}>
            <MaterialCommunityIcons name="circle-outline" size={20} color={COLORS.textMuted} />
            <View style={styles.timelineDash} />
            <MaterialCommunityIcons name="map-marker" size={20} color={COLORS.pin} />
          </View>

          <View style={styles.inputsColumn}>
            <GooglePlacesAutocomplete
              ref={originPlacesRef}
              placeholder={
                originLocationLoading ? 'Obtendo localização...' : 'Local atual'
              }
              fetchDetails
              enablePoweredByContainer={false}
              keyboardShouldPersistTaps="handled"
              query={{
                key: process.env.EXPO_PUBLIC_GOOGLE_API_KEY ?? '',
                language: 'pt-BR',
              }}
              textInputProps={{
                placeholderTextColor: COLORS.textMuted,
                onChangeText: setOrigin,
              }}
              styles={GOOGLE_PLACES_STYLES}
              onPress={(data, details = null) => {
                const addr = details?.formatted_address ?? data.description;
                setOrigin(addr);
              }}
            />
            <View style={styles.inputDivider} />
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
                placeholderTextColor: COLORS.textMuted,
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
          </View>

          <TouchableOpacity style={styles.swapButton} onPress={handleSwap}>
            <MaterialCommunityIcons name="swap-vertical" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionDivider} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.searchButton} onPress={fetchRoutes}>
          <MaterialCommunityIcons name="magnify" size={20} color={COLORS.buttonText} />
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

        {!loading &&
          routes !== null &&
          routes.map((route) => (
            <View key={route.id} style={styles.routeResultCard}>
              <View style={styles.routeResultTop}>
                <View style={styles.routeResultLeft}>
                  <Text style={styles.routeTime}>{route.totalTime}</Text>
                  <Text style={styles.routeTimesSub}>
                    Saida {route.departTime} · Chegada {route.arriveTime}
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

              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: route.accessible ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: route.accessible ? COLORS.success : COLORS.error },
                  ]}
                >
                  {route.accessible ? 'Acessivel' : 'Atencao'}
                </Text>
              </View>

              <Text style={styles.routeDescription}>{route.description}</Text>
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
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
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
    marginBottom: 10,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 100,
  },
  timelineColumn: {
    width: 28,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
  },
  timelineDash: {
    flex: 1,
    width: 1,
    minHeight: 20,
    marginVertical: 4,
    borderStyle: 'dashed',
    borderLeftWidth: 1.5,
    borderLeftColor: COLORS.border,
  },
  inputsColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  inputDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  swapButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  pillRow: {
    marginBottom: 20,
  },
  pill: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  pillTextActive: {
    color: COLORS.buttonText,
  },
  searchButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  searchButtonText: {
    color: COLORS.buttonText,
    fontWeight: '700',
    fontSize: 15,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
    fontWeight: '600',
  },
  routeResultCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
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
    fontSize: 26,
    fontWeight: '800',
  },
  routeTimesSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  routeIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  routeDescription: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
