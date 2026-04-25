import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ImageBackground,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text as PaperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../constants/api';
import { getToken, getUserInfo } from '../services/token.service';

type RecentRoute = {
  id: string;
  origin: string;
  destination: string;
  accessible: boolean;
};

const FAVORITES = [
  { id: 'home', label: 'Casa', subtitle: 'toque para editar', icon: 'home' as const, destination: 'Casa' },
  { id: 'work', label: 'Trabalho', subtitle: 'toque para editar', icon: 'briefcase' as const, destination: 'Trabalho' },
  { id: 'hospital', label: 'Hospital', icon: 'hospital-box' as const, destination: 'Hospital' },
  { id: 'school', label: 'Escola', icon: 'school' as const, destination: 'Escola' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);
  const [loadingRecents, setLoadingRecents] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const userInfo = await getUserInfo();
      if (userInfo.name) setName(userInfo.name);
    };
    loadData();
  }, []);

  useEffect(() => {
    const fetchRecentRoutes = async () => {
      try {
        setLoadingRecents(true);
        const token = await getToken();
        if (!token) {
          setRecentRoutes([]);
          return;
        }

        const response = await fetch(`${API_URL}/routes/recent`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setRecentRoutes([]);
          return;
        }

        const data = await response.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.routes) ? data.routes : [];

        const mapped = list.slice(0, 4).map((item: any, index: number) => ({
          id: String(item?.id ?? index),
          origin: item?.origin ?? item?.route?.origin ?? 'Origem',
          destination: item?.destination ?? item?.route?.destination ?? 'Destino',
          accessible: item?.accessible !== false,
        }));

        setRecentRoutes(mapped);
      } catch {
        setRecentRoutes([]);
      } finally {
        setLoadingRecents(false);
      }
    };

    fetchRecentRoutes();
  }, []);

  const goToDirections = (dest: string, origin?: string) => {
    router.push({
      pathname: '/directions',
      params: {
        destination: dest,
        ...(origin ? { origin } : {}),
      },
    });
  };

  const submitSearch = () => {
    goToDirections(destination.trim() || 'Destino');
  };

  const openUber = async () => {
    await Linking.openURL('https://uber.com');
  };

  const hasRecents = recentRoutes.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      <ScrollView style={styles.safeArea} contentContainerStyle={styles.content}>
        <ImageBackground source={require('../assets/images/city.jpg')} style={styles.header}>
          <View style={styles.headerOverlay} />
          <View style={styles.headerContent}>
            <PaperText style={styles.hello}>Olá, {name || 'Usuário'}!</PaperText>
            <PaperText style={styles.headerTitle}>Para onde você quer ir?</PaperText>

            <TouchableOpacity
              style={styles.searchWrap}
              onPress={() => router.push('/directions')}
              activeOpacity={0.9}
            >
              <TextInput
                style={styles.searchInput}
                placeholder="Digite o destino..."
                placeholderTextColor="#9CA3AF"
                value={destination}
                onChangeText={setDestination}
                onSubmitEditing={submitSearch}
                returnKeyType="search"
                editable={false}
              />
              <View style={styles.searchButton}>
                <MaterialCommunityIcons name="magnify" size={22} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          </View>
        </ImageBackground>

        <View style={styles.sectionHeader}>
          <PaperText style={styles.sectionTitle}>Favoritos</PaperText>
          <TouchableOpacity>
            <PaperText style={styles.sectionLink}>Adicionar</PaperText>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.favoritesScroll}
          contentContainerStyle={styles.favoritesContent}
        >
          {FAVORITES.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.favoriteCard}
              onPress={() => goToDirections(item.destination)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name={item.icon} size={30} color="#0057A8" />
              <PaperText style={styles.favoriteLabel}>{item.label}</PaperText>
              {item.subtitle ? (
                <PaperText style={styles.favoriteSubLabel}>{item.subtitle}</PaperText>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionBlock}>
          <PaperText style={styles.sectionMuted}>Táxi e transporte privado</PaperText>
          <View style={styles.uberCard}>
            <View style={styles.uberLeft}>
              <View style={styles.uberLogo}>
                <PaperText style={styles.uberLogoText}>U</PaperText>
              </View>
              <View>
                <PaperText style={styles.uberTitle}>Pedir um Uber</PaperText>
                <PaperText style={styles.uberSub}>Toque para pedir uma corrida</PaperText>
              </View>
            </View>
            <TouchableOpacity style={styles.uberButton} onPress={openUber}>
              <PaperText style={styles.uberButtonText}>Pedir</PaperText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.recentSection}>
          <PaperText style={styles.sectionTitle}>Viagens recentes</PaperText>
          {!loadingRecents && !hasRecents ? (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="map-search-outline" size={40} color="#CCCCCC" />
              <PaperText style={styles.emptyText}>Nenhuma viagem recente</PaperText>
              <TouchableOpacity style={styles.emptyButton} onPress={() => goToDirections('Destino')}>
                <PaperText style={styles.emptyButtonText}>Buscar rota agora</PaperText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.grid}>
              {recentRoutes.map((route) => (
                <TouchableOpacity
                  key={route.id}
                  style={styles.recentCard}
                  onPress={() => goToDirections(route.destination, route.origin)}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="clock-outline" size={18} color="#AAAAAA" />
                  <PaperText style={styles.recentOrigin}>{route.origin}</PaperText>
                  <PaperText style={styles.recentDestination}>{route.destination}</PaperText>
                  <View style={styles.badge}>
                    <PaperText style={styles.badgeText}>Acessível</PaperText>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/directions')}>
          <MaterialCommunityIcons name="map-marker-path" size={23} color="#0057A8" />
          <PaperText style={styles.navActive}>Direções</PaperText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/home')}>
          <MaterialCommunityIcons name="train" size={23} color="#AAAAAA" />
          <PaperText style={styles.navText}>Estações</PaperText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/home')}>
          <MaterialCommunityIcons name="vector-polyline" size={23} color="#AAAAAA" />
          <PaperText style={styles.navText}>Linhas</PaperText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
          <MaterialCommunityIcons name="account" size={23} color="#AAAAAA" />
          <PaperText style={styles.navText}>Perfil</PaperText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    paddingBottom: 94,
  },
  header: {
    height: 220,
    overflow: 'hidden',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 6,
    fontFamily: 'Agrandir-Regular',
  },
  hello: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 60,
    fontFamily: 'Agrandir-Regular',
  },
  searchWrap: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 48,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1E1D1D',
    fontFamily: 'Agrandir-Regular',
  },
  searchButton: {
    backgroundColor: '#FFFFFF',
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#1E1D1D',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Agrandir-TextBold',
  },
  sectionLink: {
    color: '#0057A8',
    fontSize: 13,
    fontFamily: 'Agrandir-Regular',
  },
  favoritesScroll: {
    marginTop: 12,
  },
  favoritesContent: {
    paddingHorizontal: 16,
    paddingRight: 4,
  },
  favoriteCard: {
    width: 170,
    height: 135,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginRight: 12,
    padding: 14,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  favoriteLabel: {
    color: '#1E1D1D',
    fontSize: 16,
    marginTop: 8,
    fontFamily: 'Agrandir-Regular',
    textAlign: 'center',
  },
  favoriteSubLabel: {
    color: '#999999',
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'Agrandir-Regular',
    textAlign: 'center',
  },
  sectionBlock: {
    marginHorizontal: 16,
    marginTop: 28,
  },
  sectionMuted: {
    color: '#1E1D1D',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    fontFamily: 'Agrandir-TextBold',
  },
  uberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  uberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  uberLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1E1D1D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberLogoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Agrandir-TextBold',
  },
  uberTitle: {
    color: '#1E1D1D',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Agrandir-TextBold',
  },
  uberSub: {
    color: '#999999',
    fontSize: 12,
    fontFamily: 'Agrandir-Regular',
  },
  uberButton: {
    backgroundColor: '#1E1D1D',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Agrandir-Regular',
  },
  recentSection: {
    marginHorizontal: 16,
    marginTop: 28,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
  },
  emptyText: {
    color: '#999999',
    fontSize: 13,
    marginTop: 8,
    fontFamily: 'Agrandir-Regular',
  },
  emptyButton: {
    backgroundColor: '#0057A8',
    borderRadius: 40,
    height: 48,
    paddingHorizontal: 18,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Agrandir-TextBold',
  },
  grid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  recentCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  recentOrigin: {
    color: '#999999',
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'Agrandir-Regular',
  },
  recentDestination: {
    color: '#1E1D1D',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: 'Agrandir-TextBold',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 8,
  },
  badgeText: {
    color: '#16A34A',
    fontSize: 11,
    fontFamily: 'Agrandir-Regular',
  },
  bottomNav: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#EEEEEE',
    height: 64,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navActive: {
    color: '#0057A8',
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'System',
  },
  navText: {
    color: '#AAAAAA',
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'System',
  },
});
