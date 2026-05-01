import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { fetchDiverseRoutes } from '../services/fetch-diverse-routes';
import { getUserInfo } from '../services/token.service';

const PRIMARY = '#0057A8';
const BG = '#F5F5F5';
const CARD = '#FFFFFF';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const TITLE = '#111827';
const LINE = '#94A3B8';

const MAP_FALLBACK = { latitude: -16.7167, longitude: -43.8647 };

function paramOne(v: string | string[] | undefined): string {
  if (v == null) return '';
  return Array.isArray(v) ? (v[0] ?? '') : v;
}

function parseCoord(v: string | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function geocodeAddress(
  address: string,
  key: string,
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const url =
      'https://maps.googleapis.com/maps/api/geocode/json' +
      `?address=${encodeURIComponent(address)}` +
      '&language=pt-BR' +
      `&key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    const json = (await res.json()) as {
      results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
    };
    const loc = json.results?.[0]?.geometry?.location;
    const lat = loc?.lat;
    const lng = loc?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    return { latitude: lat, longitude: lng };
  } catch {
    return null;
  }
}

function formatGeocodeLabel(first: Location.LocationGeocodedAddress | null | undefined): string {
  if (!first) return 'Local atual';
  const parts = [first.street, first.district ?? first.subregion, first.city].filter(Boolean);
  const s = parts.join(', ');
  return s.trim() || 'Local atual';
}

export default function RoutePlanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    destination?: string | string[];
    origin?: string | string[];
    destLat?: string | string[];
    destLng?: string | string[];
  }>();

  const destinationParam = useMemo(() => paramOne(params.destination).trim(), [params.destination]);
  const originParam = useMemo(() => paramOne(params.origin).trim(), [params.origin]);
  const destLatParam = parseCoord(paramOne(params.destLat));
  const destLngParam = parseCoord(paramOne(params.destLng));

  const mapRef = useRef<MapView>(null);
  const [originLabel, setOriginLabel] = useState(originParam);
  const [destLabel, setDestLabel] = useState(destinationParam);
  const [originCoord, setOriginCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destCoord, setDestCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [findRoutesLoading, setFindRoutesLoading] = useState(false);

  const fitBoth = useCallback(() => {
    const o = originCoord;
    const d = destCoord;
    if (!mapRef.current) return;
    if (o && d) {
      mapRef.current.fitToCoordinates([o, d], {
        edgePadding: { top: 56, right: 48, bottom: 48, left: 48 },
        animated: true,
      });
      return;
    }
    const c = d ?? o;
    if (c) {
      mapRef.current.animateToRegion(
        {
          latitude: c.latitude,
          longitude: c.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        },
        280,
      );
    }
  }, [originCoord, destCoord]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      const key = process.env.EXPO_PUBLIC_GOOGLE_API_KEY?.trim();

      if (!destinationParam) {
        if (!cancelled) {
          setLoadError('Destino inválido.');
          setLoading(false);
        }
        return;
      }

      setDestLabel(destinationParam);

      let nextDest: { latitude: number; longitude: number } | null = null;
      if (destLatParam != null && destLngParam != null) {
        nextDest = { latitude: destLatParam, longitude: destLngParam };
      } else if (key) {
        nextDest = await geocodeAddress(destinationParam, key);
      }
      if (cancelled) return;
      if (!nextDest) {
        nextDest = { latitude: MAP_FALLBACK.latitude, longitude: MAP_FALLBACK.longitude };
        if (!destLatParam && !key) {
          setLoadError('Não foi possível localizar o destino no mapa.');
        }
      }
      setDestCoord(nextDest);

      if (originParam) {
        setOriginLabel(originParam);
      }

      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          if (!cancelled) {
            if (!originParam) setOriginLabel('Local atual');
            setOriginCoord(null);
          }
        } else {
          const pos = await Location.getCurrentPositionAsync({});
          const o = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          if (cancelled) return;
          setOriginCoord(o);
          if (!originParam) {
            const rev = await Location.reverseGeocodeAsync({
              latitude: o.latitude,
              longitude: o.longitude,
            });
            if (!cancelled) setOriginLabel(formatGeocodeLabel(rev[0]));
          }
        }
      } catch {
        if (!cancelled && !originParam) setOriginLabel('Local atual');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [destinationParam, destLatParam, destLngParam, originParam]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => fitBoth(), 400);
    return () => clearTimeout(t);
  }, [loading, fitBoth]);

  const canSwapCoords = !!(originCoord && destCoord);

  const handleSwap = useCallback(() => {
    const oLabel = originLabel;
    const dLabel = destLabel;
    setOriginLabel(dLabel);
    setDestLabel(oLabel);
    if (originCoord && destCoord) {
      setOriginCoord(destCoord);
      setDestCoord(originCoord);
    }
    setTimeout(() => fitBoth(), 320);
  }, [originLabel, destLabel, originCoord, destCoord, fitBoth]);

  const goFindRoutes = useCallback(async () => {
    const dest = destLabel.trim() || destinationParam;
    const orig = originLabel.trim() || 'Local atual';
    if (!dest) return;

    setFindRoutesLoading(true);
    let list: unknown[] = [];
    try {
      const { userId } = await getUserInfo();
      if (typeof userId === 'number' && !Number.isNaN(userId)) {
        list = await fetchDiverseRoutes(orig, dest, userId, 'alone');
      }
    } catch {
      list = [];
    } finally {
      setFindRoutesLoading(false);
    }

    const p: Record<string, string> = {
      origin: orig,
      destination: dest,
      routes: encodeURIComponent(JSON.stringify(list)),
    };
    if (originCoord) {
      p.originCoordinate = JSON.stringify({
        latitude: originCoord.latitude,
        longitude: originCoord.longitude,
      });
    }
    if (destCoord) {
      p.destinationCoordinate = JSON.stringify({
        latitude: destCoord.latitude,
        longitude: destCoord.longitude,
      });
    }
    router.push({ pathname: '/route-results', params: p });
  }, [router, originLabel, destLabel, destinationParam, originCoord, destCoord]);

  const lineCoords =
    originCoord && destCoord
      ? [
          { latitude: originCoord.latitude, longitude: originCoord.longitude },
          { latitude: destCoord.latitude, longitude: destCoord.longitude },
        ]
      : [];

  const originDisplay = originLabel.trim() || 'Local atual';
  const destDisplay = destLabel.trim() || destinationParam;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={TITLE} />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.odRow}>
          <View style={styles.leftRail}>
            <View style={styles.originDot} />
            <View style={styles.railLine} />
            <MaterialCommunityIcons name="map-marker" size={22} color={PRIMARY} />
          </View>
          <View style={styles.odTexts}>
            <Text style={styles.odPrimary} numberOfLines={1} ellipsizeMode="tail">
              {originDisplay}
            </Text>
            <View style={styles.odDivider} />
            <Text style={styles.odPrimary} numberOfLines={1} ellipsizeMode="tail">
              {destDisplay}
            </Text>
          </View>
          <View style={styles.rightActions}>
            <TouchableOpacity style={styles.iconGhost} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="tune-variant" size={22} color={MUTED} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.swapCircle, !canSwapCoords && styles.swapDisabled]}
              onPress={canSwapCoords ? handleSwap : undefined}
              disabled={!canSwapCoords}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="swap-vertical" size={22} color={PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconGhost} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="plus" size={22} color={MUTED} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.cta, findRoutesLoading && styles.ctaDisabled]}
        onPress={() => {
          void goFindRoutes();
        }}
        disabled={findRoutesLoading}
        activeOpacity={0.92}
      >
        {findRoutesLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.ctaText}>Encontrar rotas</Text>
        )}
      </TouchableOpacity>

      {loadError ? <Text style={styles.warn}>{loadError}</Text> : null}

      <View style={styles.mapWrap}>
        {destCoord ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            mapType="standard"
            showsUserLocation={false}
            showsMyLocationButton={false}
            initialRegion={{
              latitude: destCoord.latitude,
              longitude: destCoord.longitude,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
            onMapReady={fitBoth}
          >
            {originCoord ? (
              <Marker coordinate={originCoord} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.originMarker} />
              </Marker>
            ) : null}
            <Marker coordinate={destCoord} anchor={{ x: 0.5, y: 1 }}>
              <MaterialCommunityIcons name="map-marker" size={36} color={PRIMARY} />
            </Marker>
            {lineCoords.length === 2 ? (
              <Polyline coordinates={lineCoords} strokeColor={LINE} strokeWidth={4} />
            ) : null}
          </MapView>
        ) : null}

        {loading ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.mapLoadingText}>Preparando o mapa…</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.recenter} onPress={fitBoth} activeOpacity={0.85}>
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={PRIMARY} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: 8,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  odRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  leftRail: {
    width: 28,
    alignItems: 'center',
    paddingTop: 4,
  },
  originDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  railLine: {
    flex: 1,
    width: 2,
    minHeight: 28,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  odTexts: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 8,
  },
  odPrimary: {
    fontSize: 15,
    color: TITLE,
    fontFamily: 'Agrandir-TextBold',
  },
  odDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginVertical: 10,
  },
  rightActions: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    gap: 4,
  },
  iconGhost: {
    padding: 4,
  },
  swapCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF3FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  swapDisabled: {
    opacity: 0.35,
  },
  cta: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Agrandir-TextBold',
  },
  warn: {
    marginHorizontal: 20,
    marginTop: 8,
    fontSize: 13,
    color: '#B45309',
    fontFamily: 'Agrandir-Regular',
  },
  mapWrap: {
    flex: 1,
    marginTop: 12,
    marginHorizontal: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,245,245,0.92)',
  },
  mapLoadingText: {
    marginTop: 10,
    fontSize: 14,
    color: MUTED,
    fontFamily: 'Agrandir-Regular',
  },
  recenter: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  originMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#94A3B8',
  },
});
