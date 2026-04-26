import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/api';
import { getToken } from '../services/token.service';

type Station = {
  id: string;
  name: string;
  address: string;
  distance: string;
  distanceNum: number;
  accessible: boolean;
  lines: string[];
  nextBus: string | null;
  lat: number;
  lng: number;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_CENTER = { latitude: -16.7167, longitude: -43.8647 };

const MOCK_STATIONS: Station[] = [
  { id: '1', name: 'Terminal Central', address: 'Praça Dr. Carlos Versiani, Centro', distance: '200m', distanceNum: 200, accessible: true, lines: ['1501', '1701', '2201', '6201'], nextBus: '09:15', lat: -16.729, lng: -43.8617 },
  { id: '2', name: 'Parada Ibituruna', address: 'Av. Deputado Esteves Rodrigues, Ibituruna', distance: '1,2km', distanceNum: 1200, accessible: true, lines: ['5801', '6901'], nextBus: '09:22', lat: -16.7089, lng: -43.8723 },
  { id: '3', name: 'Parada Montes Claros Shopping', address: 'Av. Donato Quintino, Cidade Nova', distance: '2,1km', distanceNum: 2100, accessible: true, lines: ['2603', '3301'], nextBus: '09:30', lat: -16.7445, lng: -43.8534 },
  { id: '4', name: 'Parada Unimontes', address: 'Av. Rui Braga, Vila Mauricéia', distance: '3,4km', distanceNum: 3400, accessible: true, lines: ['6901', '7101'], nextBus: '09:18', lat: -16.7012, lng: -43.8456 },
  { id: '5', name: 'Parada Hospital Aroldo Tourinho', address: 'Av. Silvio Menicucci, Funcionários', distance: '1,8km', distanceNum: 1800, accessible: true, lines: ['4601', '5801'], nextBus: '09:45', lat: -16.7234, lng: -43.8789 },
  { id: '6', name: 'Parada Parque Cândido Portinari', address: 'Av. Osmane Barbosa, JK', distance: '2,5km', distanceNum: 2500, accessible: false, lines: ['2201', '3301'], nextBus: null, lat: -16.7167, lng: -43.8345 },
  { id: '7', name: 'Parada Rodoviária', address: 'Praça Presidente Tancredo Neves, Canelas', distance: '3,0km', distanceNum: 3000, accessible: true, lines: ['1601', '5601'], nextBus: '09:50', lat: -16.7389, lng: -43.8678 },
  { id: '8', name: 'Parada UFMG', address: 'Av. Universitária, Universitário', distance: '4,2km', distanceNum: 4200, accessible: true, lines: ['2201', '5101'], nextBus: '10:00', lat: -16.6978, lng: -43.8512 },
];

function parseStations(data: unknown): Station[] {
  if (!Array.isArray(data)) return [];
  return data.map((raw, index) => {
    const row = raw as Record<string, unknown>;
    return {
      id: String(row.id ?? `s-${index}`),
      name: String(row.name ?? 'Estação'),
      address: String(row.address ?? '-'),
      distance: String(row.distance ?? '-'),
      distanceNum: Number(row.distanceNum ?? row.distance ?? 0) || 0,
      accessible: Boolean(row.accessible),
      lines: Array.isArray(row.lines) ? row.lines.map((line) => String(line)) : [],
      nextBus: row.nextBus ? String(row.nextBus) : null,
      lat: typeof row.lat === 'number' ? row.lat : typeof row.latitude === 'number' ? row.latitude : MAP_CENTER.latitude,
      lng: typeof row.lng === 'number' ? row.lng : typeof row.longitude === 'number' ? row.longitude : MAP_CENTER.longitude,
    };
  });
}

export default function StationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stations, setStations] = useState<Station[]>([]);
  const [filtered, setFiltered] = useState<Station[]>([]);
  const [selectedTab, setSelectedTab] = useState<'around' | 'favorites'>('around');
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [reviewStats, setReviewStats] = useState<Record<string, { average: number; total: number }>>({});

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  useEffect(() => {
    AsyncStorage.getItem('favorite_stations').then((data) => {
      if (data) setFavorites(JSON.parse(data) as string[]);
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const current = await Location.getCurrentPositionAsync({});
          setUserLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
        }

        const lat = userLocation?.latitude ?? MAP_CENTER.latitude;
        const lng = userLocation?.longitude ?? MAP_CENTER.longitude;
        const response = await fetch(`${API_URL}/stations/nearby?lat=${lat}&lng=${lng}`);
        const data = response.ok ? ((await response.json()) as unknown) : [];
        const parsed = parseStations(data);
        if (parsed.length > 0) {
          setStations(parsed);
          setIsDemo(false);
        } else {
          setStations(MOCK_STATIONS);
          setIsDemo(true);
        }
      } catch {
        setStations(MOCK_STATIONS);
        setIsDemo(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    const loadRatings = async () => {
      if (!stations.length) return;
      try {
        const token = await getToken();
        const entries = await Promise.all(
          stations.map(async (station) => {
            try {
              const response = await fetch(`${API_URL}/reviews?type=station&id=${station.id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              const data = (await response.json()) as { average_rating?: number; total?: number };
              return [station.id, { average: data.average_rating ?? 0, total: data.total ?? 0 }] as const;
            } catch {
              return [station.id, { average: 0, total: 0 }] as const;
            }
          }),
        );
        setReviewStats(Object.fromEntries(entries));
      } catch {
        setReviewStats({});
      }
    };
    loadRatings();
  }, [stations]);

  useEffect(() => {
    let next = [...stations];
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      next = next.filter(
        (station) =>
          station.name.toLowerCase().includes(s) || station.address.toLowerCase().includes(s),
      );
    }
    if (selectedTab === 'favorites') {
      next = next.filter((station) => favorites.includes(station.id));
    } else {
      next = [...next].sort((a, b) => a.distanceNum - b.distanceNum);
    }
    setFiltered(next);
  }, [stations, search, selectedTab, favorites]);

  const toggleFavorite = async (id: string) => {
    const newFavs = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    setFavorites(newFavs);
    await AsyncStorage.setItem('favorite_stations', JSON.stringify(newFavs));
  };

  const openSheet = (station: Station) => {
    setSelectedStation(station);
    mapRef.current?.animateToRegion(
      {
        latitude: station.lat,
        longitude: station.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      400,
    );
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 70,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setSelectedStation(null));
  };

  const stationSchedules = useMemo(() => {
    if (!selectedStation?.nextBus) return ['Sem horário previsto'];
    return [
      selectedStation.nextBus,
      '10:10',
      '10:40',
      '11:10',
      '11:40',
      '12:10',
      '12:40',
      '13:10',
    ];
  }, [selectedStation]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Estações</Text>
          {isDemo ? (
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>Demo</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#AAAAAA" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar estação..."
            placeholderTextColor="#AAAAAA"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close" size={20} color="#AAAAAA" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: MAP_CENTER.latitude,
          longitude: MAP_CENTER.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {userLocation ? <Marker coordinate={userLocation} pinColor="#0057A8" /> : null}
        {filtered.map((station) => (
          <Marker
            key={station.id}
            coordinate={{ latitude: station.lat, longitude: station.lng }}
            onPress={() => openSheet(station)}
          >
            <View
              style={[
                styles.stationPin,
                {
                  backgroundColor:
                    selectedStation?.id === station.id ? '#0057A8' : station.accessible ? '#0057A8' : '#999999',
                },
              ]}
            >
              <MaterialCommunityIcons name="bus" size={14} color="#FFFFFF" />
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={styles.tabsRow}>
        <TouchableOpacity style={styles.tabButton} onPress={() => setSelectedTab('around')}>
          <Text style={[styles.tabText, selectedTab === 'around' && styles.tabTextActive]}>Ao redor</Text>
          <View style={[styles.tabLine, selectedTab === 'around' && styles.tabLineActive]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabButton} onPress={() => setSelectedTab('favorites')}>
          <Text style={[styles.tabText, selectedTab === 'favorites' && styles.tabTextActive]}>Favoritas</Text>
          <View style={[styles.tabLine, selectedTab === 'favorites' && styles.tabLineActive]} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyText}>Carregando estações...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openSheet(item)}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="bus" size={22} color="#0057A8" />
              </View>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardAddress}>{item.address}</Text>
                <View style={styles.linesWrap}>
                  {item.lines.map((line) => (
                    <View key={`${item.id}-${line}`} style={styles.lineChip}>
                      <Text style={styles.lineChipText}>{line}</Text>
                    </View>
                  ))}
                </View>
                {item.nextBus ? <Text style={styles.nextText}>Próximo: {item.nextBus}</Text> : null}
                {(reviewStats[item.id]?.total ?? 0) > 0 ? (
                  <View style={styles.ratingRow}>
                    <Text style={styles.ratingStars}>
                      {'★'.repeat(Math.round(reviewStats[item.id].average))}
                      {'☆'.repeat(5 - Math.round(reviewStats[item.id].average))}
                    </Text>
                    <Text style={styles.ratingValue}>{reviewStats[item.id].average.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.distanceText}>{item.distance}</Text>
                <TouchableOpacity onPress={() => toggleFavorite(item.id)} style={styles.favoriteBtn}>
                  <MaterialCommunityIcons
                    name={favorites.includes(item.id) ? 'heart' : 'heart-outline'}
                    size={18}
                    color="#FF4444"
                  />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={!!selectedStation} transparent animationType="slide" onRequestClose={closeSheet}>
        <TouchableOpacity style={styles.modalOverlay} onPress={closeSheet} activeOpacity={1} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{selectedStation?.name}</Text>
          <Text style={styles.sheetAddress}>{selectedStation?.address}</Text>

          {selectedStation ? (
            <MapView
              style={styles.sheetMap}
              initialRegion={{
                latitude: selectedStation.lat,
                longitude: selectedStation.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker coordinate={{ latitude: selectedStation.lat, longitude: selectedStation.lng }} />
            </MapView>
          ) : null}

          <View style={styles.sheetLinesWrap}>
            {selectedStation?.lines.map((line) => (
              <TouchableOpacity
                key={`sheet-${line}`}
                style={styles.sheetLineChip}
                onPress={() => router.push({ pathname: '/lines', params: { search: line } })}
              >
                <Text style={styles.sheetLineChipText}>{line}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.scheduleGrid}>
            {stationSchedules.map((time, idx) => (
              <View key={`${time}-${idx}`} style={styles.scheduleCell}>
                <Text style={styles.scheduleCellText}>{time}</Text>
              </View>
            ))}
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewText}>
              Nota média: {(selectedStation ? reviewStats[selectedStation.id]?.average : 0)?.toFixed(1) ?? '0.0'}
            </Text>
            <TouchableOpacity
              onPress={() =>
                selectedStation &&
                router.push({
                  pathname: '/reviews',
                  params: { type: 'station', id: selectedStation.id, name: selectedStation.name },
                })
              }
            >
              <Text style={styles.reviewLink}>
                Ver avaliações ({selectedStation ? reviewStats[selectedStation.id]?.total ?? 0 : 0})
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                if (!selectedStation) return;
                closeSheet();
                router.push({ pathname: '/directions', params: { destination: selectedStation.name } });
              }}
            >
              <Text style={styles.primaryBtnText}>Como chegar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => selectedStation && toggleFavorite(selectedStation.id)}
            >
              <Text style={styles.secondaryBtnText}>Favoritar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingBottom: 12 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#1E1D1D', fontSize: 22, fontWeight: '800' },
  demoBadge: { backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  demoBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  searchBar: { backgroundColor: '#F5F5F5', borderRadius: 14, height: 44, marginTop: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  searchInput: { flex: 1, marginLeft: 8, color: '#1E1D1D', fontSize: 14 },
  map: { height: 220, width: '100%' },
  stationPin: { borderRadius: 20, padding: 6, borderWidth: 2, borderColor: '#FFFFFF' },
  tabsRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  tabButton: { paddingHorizontal: 20, paddingTop: 10, alignItems: 'center' },
  tabText: { color: '#999999', fontSize: 13 },
  tabTextActive: { color: '#1E1D1D', fontWeight: '700' },
  tabLine: { marginTop: 8, width: 32, height: 3, backgroundColor: 'transparent', borderRadius: 2 },
  tabLineActive: { backgroundColor: '#0057A8' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#999999' },
  listContent: { padding: 16, paddingBottom: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, flexDirection: 'row', alignItems: 'flex-start' },
  iconCircle: { width: 44, height: 44, backgroundColor: '#EBF3FF', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardMain: { flex: 1, marginLeft: 12 },
  cardTitle: { color: '#1E1D1D', fontSize: 15, fontWeight: '700' },
  cardAddress: { color: '#999999', fontSize: 12, marginTop: 2 },
  linesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  lineChip: { backgroundColor: '#F5F5F5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  lineChipText: { color: '#1E1D1D', fontSize: 11, fontWeight: '600' },
  nextText: { color: '#22c55e', fontSize: 12, marginTop: 6, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  ratingStars: { color: '#F59E0B', fontSize: 12 },
  ratingValue: { color: '#666666', fontSize: 12, fontWeight: '600' },
  cardRight: { alignItems: 'flex-end', marginLeft: 8 },
  distanceText: { color: '#0057A8', fontSize: 14, fontWeight: '700' },
  favoriteBtn: { marginTop: 10 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 28 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { color: '#1E1D1D', fontSize: 18, fontWeight: '700' },
  sheetAddress: { color: '#666666', fontSize: 14, marginTop: 4 },
  sheetMap: { height: 120, borderRadius: 12, marginTop: 12 },
  sheetLinesWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  sheetLineChip: { backgroundColor: '#0057A8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  sheetLineChipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  scheduleGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  scheduleCell: { width: '23%', backgroundColor: '#F5F5F5', borderRadius: 8, paddingVertical: 8, margin: 4, alignItems: 'center' },
  scheduleCellText: { color: '#1E1D1D', fontSize: 13 },
  reviewRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewText: { color: '#1E1D1D', fontSize: 14, fontWeight: '600' },
  reviewLink: { color: '#0057A8', fontSize: 13, fontWeight: '700' },
  buttonsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  primaryBtn: { flex: 1, height: 52, borderRadius: 40, backgroundColor: '#0057A8', alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryBtn: { flex: 1, height: 52, marginLeft: 12, borderRadius: 40, borderWidth: 1, borderColor: '#0057A8', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: '#0057A8', fontWeight: '700' },
});
