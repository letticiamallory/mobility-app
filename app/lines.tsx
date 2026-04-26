import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/api';
import { getToken } from '../services/token.service';

type LineItem = {
  id: string;
  type: 'bus' | 'metro';
  code: string;
  name: string;
  origin: string;
  destination: string;
  via: string | null;
  accessible: boolean;
  operator: string;
  color: string;
  schedules: string[];
};

const MOCK_LINES: LineItem[] = [
  { id: '1', type: 'bus', code: '1501', name: 'Vila Atlantida / Vila Analia', origin: 'Vila Atlantida', destination: 'Vila Analia', via: null, accessible: true, operator: 'MOC BUS', color: '#0057A8', schedules: ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'] },
  { id: '2', type: 'bus', code: '1701', name: 'Castelo Branco / Sao Geraldo', origin: 'Castelo Branco', destination: 'Sao Geraldo', via: null, accessible: true, operator: 'MOC BUS', color: '#0057A8', schedules: ['05:45', '06:15', '07:00', '08:00', '09:00', '10:00', '12:00', '14:00', '17:30', '18:30'] },
  { id: '3', type: 'bus', code: '2201', name: 'UFMG / Centro', origin: 'UFMG', destination: 'Centro (Prefeitura)', via: 'JK e Planalto', accessible: true, operator: 'MOC BUS', color: '#0057A8', schedules: ['06:00', '06:30', '07:00', '07:30', '08:00', '09:00', '10:00', '12:00', '13:00', '17:00', '18:00', '19:00'] },
  { id: '4', type: 'bus', code: '2603', name: 'Jaragua II / Santo Amaro', origin: 'Jaragua II', destination: 'Santo Amaro', via: null, accessible: true, operator: 'MOC BUS', color: '#0057A8', schedules: ['06:00', '07:00', '08:00', '10:00', '12:00', '14:00', '17:00', '18:00'] },
  { id: '5', type: 'bus', code: '3301', name: 'Jardim Primavera / Centro', origin: 'Jardim Primavera', destination: 'Centro (Prefeitura)', via: 'Aeroporto', accessible: false, operator: 'MOC BUS', color: '#0057A8', schedules: ['06:00', '07:00', '09:00', '12:00', '15:00', '17:00', '18:00'] },
  { id: '6', type: 'bus', code: '4601', name: 'Independencia / N. S. das Gracas', origin: 'Independencia', destination: 'Nossa Senhora das Gracas', via: null, accessible: true, operator: 'MOC BUS', color: '#0057A8', schedules: ['05:30', '06:30', '07:30', '09:00', '12:00', '15:00', '17:00', '18:30'] },
  { id: '7', type: 'bus', code: '5801', name: 'Vila Sion II / Vila Mauriceia', origin: 'Vila Sion II', destination: 'Vila Mauriceia', via: 'Santa Rita e Ibituruna', accessible: true, operator: 'MOC BUS', color: '#0057A8', schedules: ['06:00', '07:00', '08:00', '10:00', '12:00', '14:00', '17:00', '18:00', '19:00'] },
  { id: '8', type: 'bus', code: '6201', name: 'Renascenca / Centro', origin: 'Renascenca', destination: 'Centro', via: null, accessible: true, operator: 'MOC BUS', color: '#0057A8', schedules: ['05:45', '06:15', '07:15', '09:00', '12:00', '15:00', '17:15', '18:15'] },
  { id: '9', type: 'bus', code: '6901', name: 'Maracana / Vila Oliveira', origin: 'Maracana', destination: 'Vila Oliveira', via: 'Unimontes', accessible: true, operator: 'MOC BUS', color: '#0057A8', schedules: ['06:00', '07:00', '08:00', '10:00', '12:00', '14:00', '17:00', '18:00'] },
  { id: '10', type: 'bus', code: '7101', name: 'Major Prates / Vila Sao Francisco', origin: 'Major Prates', destination: 'Vila Sao Francisco de Assis', via: null, accessible: true, operator: 'MOC BUS', color: '#0057A8', schedules: ['06:00', '07:00', '09:00', '12:00', '15:00', '17:00', '18:00'] },
];

const TABS = ['todos', 'favoritos', 'recentes', 'acessiveis'] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  todos: 'Todos',
  favoritos: 'Favoritos',
  recentes: 'Recentes',
  acessiveis: 'Acessíveis',
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

function nextSchedule(schedules: string[]) {
  if (!schedules.length) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (const value of schedules) {
    const [h, m] = value.split(':').map(Number);
    const total = h * 60 + m;
    if (total >= nowMinutes) return value;
  }
  return schedules[0];
}

function lineCoordinates(code: string) {
  const baseLat = -16.7167;
  const baseLng = -43.8647;
  const parsed = parseInt(code, 10) || 1;
  const offset = (parsed % 6) * 0.005 + 0.004;
  return {
    origin: { latitude: baseLat - offset, longitude: baseLng - offset / 2 },
    destination: { latitude: baseLat + offset / 2, longitude: baseLng + offset },
  };
}

function normalizeLine(raw: Record<string, unknown>, index: number): LineItem {
  return {
    id: String(raw.id ?? `line-${index}`),
    type: raw.type === 'metro' ? 'metro' : 'bus',
    code: String(raw.code ?? raw.number ?? '-'),
    name: String(raw.name ?? 'Linha'),
    origin: String(raw.origin ?? '-'),
    destination: String(raw.destination ?? '-'),
    via: raw.via ? String(raw.via) : null,
    accessible: Boolean(raw.accessible),
    operator: String(raw.operator ?? 'MOC BUS'),
    color: String(raw.color ?? '#0057A8'),
    schedules: Array.isArray(raw.schedules) ? raw.schedules.map((v) => String(v)) : [],
  };
}

export default function LinesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [filtered, setFiltered] = useState<LineItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<(typeof TABS)[number]>('todos');
  const [selectedLine, setSelectedLine] = useState<LineItem | null>(null);
  const [recentLines, setRecentLines] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [reviewStats, setReviewStats] = useState<Record<string, { average: number; total: number }>>({});

  useEffect(() => {
    Promise.all([AsyncStorage.getItem('recent_lines'), AsyncStorage.getItem('favorite_lines')]).then(
      ([recents, favs]) => {
        if (recents) setRecentLines(JSON.parse(recents) as string[]);
        if (favs) setFavorites(JSON.parse(favs) as string[]);
      },
    );
  }, []);

  useEffect(() => {
    const loadLines = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const response = await fetch(`${API_URL}/lines`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = response.ok ? ((await response.json()) as unknown) : [];
        if (Array.isArray(data) && data.length > 0) {
          setLines(data.map((item, index) => normalizeLine(item as Record<string, unknown>, index)));
          setIsDemo(false);
        } else {
          setLines(MOCK_LINES);
          setIsDemo(true);
        }
      } catch {
        setLines(MOCK_LINES);
        setIsDemo(true);
      } finally {
        setLoading(false);
      }
    };
    loadLines();
  }, []);

  useEffect(() => {
    const loadRatings = async () => {
      if (!lines.length) return;
      try {
        const token = await getToken();
        const entries = await Promise.all(
          lines.map(async (line) => {
            try {
              const response = await fetch(`${API_URL}/reviews?type=line&id=${line.id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              const data = (await response.json()) as { average_rating?: number; total?: number };
              return [line.id, { average: data.average_rating ?? 0, total: data.total ?? 0 }] as const;
            } catch {
              return [line.id, { average: 0, total: 0 }] as const;
            }
          }),
        );
        setReviewStats(Object.fromEntries(entries));
      } catch {
        setReviewStats({});
      }
    };
    loadRatings();
  }, [lines]);

  useEffect(() => {
    let result = lines;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.code.includes(search) ||
          l.name.toLowerCase().includes(s) ||
          l.origin.toLowerCase().includes(s) ||
          l.destination.toLowerCase().includes(s),
      );
    }
    if (activeFilter === 'favoritos') result = result.filter((l) => favorites.includes(l.id));
    if (activeFilter === 'recentes') result = result.filter((l) => recentLines.includes(l.id));
    if (activeFilter === 'acessiveis') result = result.filter((l) => l.accessible);
    setFiltered(result);
  }, [search, activeFilter, lines, favorites, recentLines]);

  const handleSelectLine = async (line: LineItem) => {
    setSelectedLine(line);
    setModalVisible(true);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 70,
    }).start();
    const newRecents = [line.id, ...recentLines.filter((id) => id !== line.id)].slice(0, 5);
    setRecentLines(newRecents);
    await AsyncStorage.setItem('recent_lines', JSON.stringify(newRecents));
  };

  const toggleFavorite = async (id: string) => {
    const newFavs = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(newFavs);
    await AsyncStorage.setItem('favorite_lines', JSON.stringify(newFavs));
  };

  const closeModal = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setModalVisible(false));
  };

  const recentsData = useMemo(
    () => recentLines.map((id) => lines.find((line) => line.id === id)).filter(Boolean) as LineItem[],
    [recentLines, lines],
  );

  const sections = useMemo(
    () => [
      {
        title: 'Metrô',
        subtitle: 'Metrô',
        icon: 'subway-variant' as const,
          type: 'metro' as const,
        data: filtered.filter((l) => l.type === 'metro'),
      },
      {
        title: 'MOC BUS',
        subtitle: 'Ônibus',
        icon: 'bus' as const,
          type: 'bus' as const,
        data: filtered.filter((l) => l.type === 'bus'),
      },
    ],
    [filtered],
  );

  const selectedIsFavorite = selectedLine ? favorites.includes(selectedLine.id) : false;
  const selectedNext = selectedLine ? nextSchedule(selectedLine.schedules) : null;
  const selectedCoords = selectedLine ? lineCoordinates(selectedLine.code) : null;

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Linhas</Text>
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
            placeholder="Pesquise uma linha..."
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

      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const active = activeFilter === tab;
          return (
            <TouchableOpacity key={tab} style={styles.tabButton} onPress={() => setActiveFilter(tab)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{TAB_LABELS[tab]}</Text>
              <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
            </TouchableOpacity>
          );
        })}
      </View>

      {(activeFilter === 'todos' || activeFilter === 'recentes') && recentsData.length > 0 ? (
        <View style={styles.recentsWrap}>
          <Text style={styles.recentsTitle}>Recentes</Text>
          {recentsData.map((item) => (
            <TouchableOpacity
              key={`recent-${item.id}`}
              style={styles.recentItem}
              onPress={() => handleSelectLine(item)}
            >
              <View style={styles.recentIconCircle}>
                <MaterialCommunityIcons name="bus" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.recentText}>
                {item.code} - {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyText}>Carregando linhas...</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: '#FFFFFF',
                borderTopWidth: 1,
                borderTopColor: '#EEEEEE',
                borderBottomWidth: 1,
                borderBottomColor: '#EEEEEE',
                marginTop: 8,
                width: '100%',
                alignSelf: 'stretch',
              }}
            >
              <MaterialCommunityIcons
                name={section.type === 'metro' ? 'subway-variant' : 'bus'}
                size={18}
                color="#1E1D1D"
              />
              <Text style={{ color: '#1E1D1D', fontSize: 14, fontWeight: '700', marginLeft: 8 }}>
                {section.type === 'metro' ? 'Metrô' : 'Ônibus'}
              </Text>
            </View>
          )}
          renderSectionFooter={({ section }) =>
            section.type === 'metro' && section.data.length === 0 ? (
              <View style={styles.metroEmptyWrap}>
                <MaterialCommunityIcons name="subway-variant" size={32} color="#CCCCCC" />
                <Text style={styles.metroEmptyText}>
                  Nenhuma linha de metrô{'\n'}encontrada na sua região
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.lineItem} onPress={() => handleSelectLine(item)}>
              <View style={styles.lineCodeBadge}>
                <View style={styles.lineCodeRow}>
                  <MaterialCommunityIcons name="bus" size={13} color="#1E1D1D" />
                  <Text style={styles.lineCodeText}>{item.code}</Text>
                </View>
                <View style={[styles.lineCodeBottomBar, { backgroundColor: getLineColor(item.code) }]} />
              </View>
              <View style={styles.lineMain}>
                <View style={styles.lineTitleRow}>
                  <Text style={styles.lineName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.accessible ? (
                    <MaterialCommunityIcons
                      name="wheelchair-accessibility"
                      size={14}
                      color="#16A34A"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="wheelchair-accessibility"
                      size={14}
                      color="#EF4444"
                    />
                  )}
                </View>
                {item.via ? <Text style={styles.lineVia}>Via {item.via}</Text> : null}
                {nextSchedule(item.schedules) ? (
                  <Text style={styles.nextBusText}>Próximo: {nextSchedule(item.schedules)}</Text>
                ) : null}
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
              <MaterialCommunityIcons name="chevron-right" size={18} color="#CCCCCC" />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.sectionContent}
          stickySectionHeadersEnabled={false}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.handle} />
          <View style={styles.sheetTop}>
            <View style={[styles.sheetCodeBadge, { backgroundColor: getLineColor(selectedLine?.code || '0') }]}>
              <Text style={styles.sheetCodeText}>{selectedLine?.code}</Text>
            </View>
            <TouchableOpacity onPress={() => selectedLine && toggleFavorite(selectedLine.id)}>
              <MaterialCommunityIcons
                name={selectedIsFavorite ? 'heart' : 'heart-outline'}
                size={24}
                color="#FF4444"
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sheetName, { color: getLineColor(selectedLine?.code || '0') }]}>
            {selectedLine?.name}
          </Text>
          <View style={styles.routeRow}>
            <MaterialCommunityIcons name="map-marker" size={16} color="#0057A8" />
            <Text style={styles.routeText}>{selectedLine?.origin}</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color="#AAAAAA" />
            <Text style={styles.routeText}>{selectedLine?.destination}</Text>
          </View>
          {selectedLine?.via ? (
            <View style={styles.viaRow}>
              <MaterialCommunityIcons name="road-variant" size={14} color="#AAAAAA" />
              <Text style={styles.viaText}>Via {selectedLine.via}</Text>
            </View>
          ) : null}

          <View style={styles.badgesRow}>
            <View style={selectedLine?.accessible ? styles.badgeOk : styles.badgeNo}>
              <Text style={selectedLine?.accessible ? styles.badgeOkText : styles.badgeNoText}>
                {selectedLine?.accessible ? 'Acessível' : 'Não acessível'}
              </Text>
            </View>
            <View style={styles.badgeOperator}>
              <Text style={styles.badgeOperatorText}>MOC BUS</Text>
            </View>
            {selectedNext ? (
              <View style={styles.badgeNext}>
                <Text style={styles.badgeNextText}>Próximo: {selectedNext}</Text>
              </View>
            ) : null}
          </View>

          {selectedCoords ? (
            <MapView
              style={styles.miniMap}
              initialRegion={{
                latitude: (selectedCoords.origin.latitude + selectedCoords.destination.latitude) / 2,
                longitude: (selectedCoords.origin.longitude + selectedCoords.destination.longitude) / 2,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
              }}
            >
              <Marker coordinate={selectedCoords.origin} title="Origem" />
              <Marker coordinate={selectedCoords.destination} title="Destino" />
            </MapView>
          ) : null}

          <View style={styles.reviewsRow}>
            <Text style={styles.reviewsText}>
              Nota média: {(selectedLine ? reviewStats[selectedLine.id]?.average : 0)?.toFixed(1) ?? '0.0'}
            </Text>
            <TouchableOpacity
              onPress={() =>
                selectedLine &&
                router.push({
                  pathname: '/reviews',
                  params: { type: 'line', id: selectedLine.id, name: selectedLine.name },
                })
              }
            >
              <Text style={styles.reviewsLink}>
                Ver avaliações ({selectedLine ? reviewStats[selectedLine.id]?.total ?? 0 : 0})
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.scheduleTitle}>Horários</Text>
          <View style={styles.scheduleGrid}>
            {(selectedLine?.schedules || []).map((time, idx) => (
              <View
                key={`${time}-${idx}`}
                style={[styles.scheduleCell, selectedNext === time && styles.scheduleCellNext]}
              >
                <Text style={styles.scheduleCellText}>{time}</Text>
              </View>
            ))}
          </View>

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                const destination = selectedLine?.destination || 'Destino';
                closeModal();
                router.push({ pathname: '/directions', params: { destination } });
              }}
            >
              <Text style={styles.primaryBtnText}>Traçar rota</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => selectedLine && toggleFavorite(selectedLine.id)}
            >
              <MaterialCommunityIcons
                name={selectedIsFavorite ? 'heart' : 'heart-outline'}
                size={20}
                color="#0057A8"
              />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#1E1D1D', fontSize: 22, fontWeight: '800' },
  demoBadge: { backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  demoBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  searchBar: { backgroundColor: '#F5F5F5', borderRadius: 16, height: 48, marginTop: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8, color: '#1E1D1D' },
  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEEEEE', backgroundColor: '#FFFFFF' },
  tabButton: { paddingHorizontal: 16, paddingTop: 12, alignItems: 'center' },
  tabText: { color: '#999999', fontSize: 13 },
  tabTextActive: { color: '#1E1D1D', fontWeight: '700' },
  tabIndicator: { marginTop: 10, width: 30, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  tabIndicatorActive: { backgroundColor: '#0057A8' },
  recentsWrap: { backgroundColor: '#FFFFFF' },
  recentsTitle: { color: '#999999', fontSize: 13, fontWeight: '600', marginBottom: 4, paddingHorizontal: 20, paddingTop: 8 },
  recentItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  recentIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0057A8', alignItems: 'center', justifyContent: 'center' },
  recentText: { color: '#1E1D1D', fontSize: 14, marginLeft: 12 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#999999' },
  sectionContent: { paddingBottom: 24 },
  sectionHeader: { backgroundColor: '#F5F5F5', paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#666666', fontSize: 12, fontWeight: '600' },
  sectionType: { color: '#999999', fontSize: 12 },
  metroEmptyWrap: { padding: 20, alignItems: 'center' },
  metroEmptyText: { color: '#999999', fontSize: 13, marginTop: 8, textAlign: 'center' },
  lineItem: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', flexDirection: 'row', alignItems: 'center' },
  lineCodeBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  lineCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lineCodeBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  lineCodeText: { color: '#1E1D1D', fontSize: 13, fontWeight: '700' },
  lineMain: { flex: 1, marginLeft: 12, paddingTop: 0 },
  lineTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6 },
  lineName: { color: '#1E1D1D', fontSize: 14, fontWeight: '500' },
  lineVia: { color: '#999999', fontSize: 12, marginTop: 0 },
  nextBusText: { color: '#22c55e', fontSize: 12, marginTop: 1, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 6 },
  ratingStars: { color: '#F59E0B', fontSize: 12 },
  ratingValue: { color: '#666666', fontSize: 12, fontWeight: '600' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 26 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 20 },
  sheetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetCodeBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  sheetCodeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sheetName: { color: '#1E1D1D', fontSize: 20, fontWeight: '700', marginTop: 8 },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 },
  routeText: { color: '#666666', fontSize: 14 },
  viaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  viaText: { color: '#999999', fontSize: 13 },
  badgesRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  badgeOk: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOkText: { color: '#16A34A', fontSize: 12 },
  badgeNo: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeNoText: { color: '#EF4444', fontSize: 12 },
  badgeOperator: { backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOperatorText: { color: '#666666', fontSize: 12 },
  badgeNext: { backgroundColor: '#EBF3FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeNextText: { color: '#0057A8', fontSize: 12, fontWeight: '600' },
  miniMap: { height: 120, borderRadius: 12, marginTop: 12 },
  reviewsRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewsText: { color: '#1E1D1D', fontSize: 14, fontWeight: '600' },
  reviewsLink: { color: '#0057A8', fontSize: 13, fontWeight: '700' },
  scheduleTitle: { marginTop: 14, color: '#1E1D1D', fontSize: 15, fontWeight: '700' },
  scheduleGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  scheduleCell: { width: '22%', backgroundColor: '#F5F5F5', borderRadius: 8, paddingVertical: 8, margin: 4, alignItems: 'center' },
  scheduleCellNext: { backgroundColor: '#EBF3FF' },
  scheduleCellText: { color: '#1E1D1D', fontSize: 13, textAlign: 'center' },
  buttonsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  primaryBtn: { flex: 1, height: 52, borderRadius: 40, backgroundColor: '#0057A8', alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryBtn: { width: 52, height: 52, borderRadius: 40, borderWidth: 1, borderColor: '#0057A8', marginLeft: 12, alignItems: 'center', justifyContent: 'center' },
});
