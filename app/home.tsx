import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text as PaperText } from 'react-native-paper';
import { getUserInfo } from '../services/token.service';

const FAVORITES = [
  { id: 'home', label: 'Casa', destination: 'Casa', address: 'Rua principal', icon: 'map-marker' as const },
  { id: 'work', label: 'Trabalho', destination: 'Trabalho', address: 'Av. central', icon: 'map-marker' as const },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const userInfo = await getUserInfo();
      if (userInfo.name) {
        setName(userInfo.name);
      }
    };

    loadData();
  }, []);

  const initials = (name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const goToDirections = (selectedDestination: string) => {
    router.push({
      pathname: '/directions',
      params: { destination: selectedDestination },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topStripe, { height: insets.top }]} />
      <View style={styles.header}>
        <PaperText style={styles.greetingName} accessibilityRole="header">
          Olá, {name || 'Usuario'}!
        </PaperText>
        <PaperText style={styles.subtitle} accessibilityRole="header">
          Para onde você vai hoje?
        </PaperText>
      </View>

      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => goToDirections(destination || 'Destino')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Buscar destino"
      >
        <MaterialCommunityIcons name="magnify" size={22} color="#0057A8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar destino..."
          placeholderTextColor="#7D8590"
          value={destination}
          onChangeText={setDestination}
          editable={false}
          pointerEvents="none"
          autoFocus={false}
          accessibilityLabel="Campo de destino"
          accessibilityHint="Digite o destino para buscar rotas"
        />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        <PaperText style={styles.sectionTitle} accessibilityRole="header">
          Favoritos
        </PaperText>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.favoritesRow}
        >
          {FAVORITES.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.favoriteCard}
              onPress={() => goToDirections(item.destination)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Favorito ${item.label}`}
            >
              <MaterialCommunityIcons name={item.icon} size={22} color="#0057A8" />
              <PaperText style={styles.favoriteText}>{item.label}</PaperText>
              <PaperText style={styles.favoriteSub}>{item.address}</PaperText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          accessibilityRole="button"
          accessibilityLabel="Ir para rotas"
        >
          <MaterialCommunityIcons name="directions" size={24} color="#0057A8" />
          <PaperText style={styles.navLabelActive}>Rotas</PaperText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          accessibilityRole="button"
          accessibilityLabel="Ir para lugares"
        >
          <MaterialCommunityIcons name="map-marker" size={24} color="#8ab3df" />
          <PaperText style={styles.navLabel}>Lugares</PaperText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Ir para perfil"
        >
          <MaterialCommunityIcons name="account" size={24} color="#8ab3df" />
          <PaperText style={styles.navLabel}>Perfil</PaperText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  topStripe: {
    backgroundColor: '#0057A8',
  },
  header: {
    backgroundColor: '#0057A8',
    padding: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greetingName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Agrandir-GrandHeavy',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
    fontFamily: 'Agrandir-Regular',
  },
  searchBar: {
    marginTop: -20,
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    color: '#1E1D1D',
    fontSize: 14,
    fontFamily: 'Agrandir-Regular',
  },
  content: {
    paddingTop: 24,
    paddingBottom: 108,
  },
  sectionTitle: {
    color: '#1E1D1D',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Agrandir-TextBold',
    marginTop: 24,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  favoritesRow: {
    paddingHorizontal: 16,
    gap: 10,
  },
  favoriteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    width: 140,
  },
  favoriteText: {
    color: '#1E1D1D',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    fontFamily: 'Agrandir-TextBold',
  },
  favoriteSub: {
    color: '#666666',
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'Agrandir-Regular',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#D0D7DE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  navLabelActive: {
    color: '#0057A8',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Agrandir-TextBold',
  },
  navLabel: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Agrandir-Regular',
  },
});