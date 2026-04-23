import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text as PaperText } from 'react-native-paper';
import { getUserInfo } from '../services/token.service';

const FAVORITES = [
  { id: 'home', label: 'Casa', destination: 'Casa', icon: 'home' as const },
  { id: 'work', label: 'Trabalho', destination: 'Trabalho', icon: 'briefcase' as const },
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
        <View style={styles.headerTopRow}>
          <View>
            <PaperText style={styles.greetingPrefix}>Olá,</PaperText>
            <PaperText style={styles.greetingName}>{name || 'Usuario'}</PaperText>
            <PaperText style={styles.subtitle}>Para onde você quer ir hoje?</PaperText>
          </View>
          <View style={styles.avatar}>
            <PaperText style={styles.avatarText}>{initials}</PaperText>
          </View>
        </View>

        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => goToDirections(destination || 'Destino')}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="magnify" size={22} color="#0057A8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar destino"
            placeholderTextColor="#7D8590"
            value={destination}
            onChangeText={setDestination}
            editable={false}
            pointerEvents="none"
            autoFocus={false}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionHeader}>
          <PaperText style={styles.sectionTitle}>Favoritos</PaperText>
          <TouchableOpacity>
            <PaperText style={styles.addLink}>Adicionar</PaperText>
          </TouchableOpacity>
        </View>

        <View style={styles.favoritesCard}>
          {FAVORITES.map((item, index) => (
            <View key={item.id}>
              <TouchableOpacity
                style={styles.favoriteRow}
                onPress={() => goToDirections(item.destination)}
              >
                <MaterialCommunityIcons name={item.icon} size={22} color="#0057A8" />
                <View style={styles.favoriteTextBlock}>
                  <PaperText style={styles.favoriteText}>{item.label}</PaperText>
                  <PaperText style={styles.favoriteSub}>Toque para editar</PaperText>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#7D8590" />
              </TouchableOpacity>
              {index < FAVORITES.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <MaterialCommunityIcons name="directions" size={24} color="#0057A8" />
          <PaperText style={styles.navLabelActive}>Rotas</PaperText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <MaterialCommunityIcons name="map-marker" size={24} color="#8ab3df" />
          <PaperText style={styles.navLabel}>Lugares</PaperText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
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
    backgroundColor: '#FFFFFF',
  },
  topStripe: {
    backgroundColor: '#0057A8',
  },
  header: {
    backgroundColor: '#0057A8',
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 32,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greetingPrefix: {
    color: '#E6EDF3',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  greetingName: {
    color: '#E6EDF3',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 36,
  },
  subtitle: {
    color: '#DCE6F5',
    fontSize: 15,
    marginTop: 10,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D0D7DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#0057A8',
    fontSize: 20,
    fontWeight: '700',
  },
  searchBar: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D0D7DE',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#0D1117',
    fontSize: 16,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 108,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '700',
  },
  addLink: {
    color: '#0057A8',
    fontSize: 14,
    fontWeight: '600',
  },
  favoritesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D0D7DE',
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 14,
  },
  favoriteTextBlock: {
    flex: 1,
    gap: 4,
  },
  favoriteText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
  favoriteSub: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 14,
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
  },
  navLabel: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
});