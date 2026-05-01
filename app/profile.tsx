import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../constants/api';
import { getToken, getUserAvatar, removeToken } from '../services/token.service';

type MeResponse = {
  name?: string;
  email?: string;
  disability_type?: string;
  accompanied?: string;
};

type ReviewResponseItem = {
  id?: number | string;
  place_name?: string;
  rating?: number;
  comment?: string;
  created_at?: string;
};

function initialsFromName(name?: string) {
  const source = (name || 'U').trim();
  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part[0] || '').toUpperCase())
    .join('');
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<MeResponse>({});
  const [reviews, setReviews] = useState<ReviewResponseItem[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const token = await getToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const savedAvatar = await getUserAvatar();
        setAvatarUri(savedAvatar);
        const meResponse = await fetch(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meResponse.ok) {
          const meData = (await meResponse.json()) as MeResponse;
          setProfile(meData);
        }
      } catch {
        setProfile({});
      }

      try {
        const reviewsResponse = await fetch(`${API_URL}/reviews/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!reviewsResponse.ok) {
          setReviews([]);
          return;
        }
        const data = (await reviewsResponse.json()) as unknown;
        if (Array.isArray(data)) {
          setReviews(data as ReviewResponseItem[]);
        } else {
          setReviews([]);
        }
      } catch {
        setReviews([]);
      }
    };

    loadData();
  }, [router]);

  const initials = useMemo(() => initialsFromName(profile.name), [profile.name]);

  const handleLogout = async () => {
    await removeToken();
    router.replace('/login');
  };

  const openProfileInfo = () => {
    router.push('/profile-info');
  };

  const openAccessibilitySettings = () => {
    router.push({ pathname: '/profile-info', params: { section: 'accessibility' } });
  };

  const openMyReviews = () => {
    router.push('/profile-reviews');
  };

  const openFavorites = () => {
    router.push({ pathname: '/stations', params: { tab: 'favorites' } });
  };

  const openTripHistory = () => {
    router.push('/profile-history');
  };

  const openChangePassword = () => {
    if (!profile.email) {
      Alert.alert('Atenção', 'Não foi possível identificar seu email para alterar a senha.');
      return;
    }
    router.push({ pathname: '/forgot-password', params: { email: profile.email } });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#1E1D1D" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Perfil</Text>
            <View style={styles.headerRightSpacer} />
          </View>

          <View style={styles.profileRow}>
            <View style={styles.initialsCircle}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.initialsText}>{initials}</Text>
              )}
            </View>
            <View style={styles.headerInfoWrap}>
              <Text style={styles.userName}>{profile.name || '-'}</Text>
              <Text style={styles.userEmail}>{profile.email || '-'}</Text>
              <Text style={styles.disabilityType}>{profile.disability_type || '-'}</Text>
            </View>
            <TouchableOpacity style={styles.editButton} onPress={openProfileInfo}>
              <Text style={styles.editButtonText}>Editar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.listGroup}>
          <TouchableOpacity style={styles.listItem} onPress={openProfileInfo}>
            <View style={styles.listItemLeft}>
              <MaterialCommunityIcons name="account-edit" size={22} color="#0057A8" />
              <Text style={styles.listItemText}>Minhas informações</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CCCCCC" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.listItem, styles.noBorder]} onPress={openAccessibilitySettings}>
            <View style={styles.listItemLeft}>
              <MaterialCommunityIcons name="human" size={22} color="#0057A8" />
              <Text style={styles.listItemText}>Acessibilidade</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CCCCCC" />
          </TouchableOpacity>
        </View>

        <View style={styles.groupDivider} />

        <View style={styles.listGroup}>
          <TouchableOpacity style={styles.listItem} onPress={openMyReviews}>
            <View style={styles.listItemLeft}>
              <MaterialCommunityIcons name="star-outline" size={22} color="#0057A8" />
              <Text style={styles.listItemText}>Minhas avaliações</Text>
              {reviews.length > 0 ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{reviews.length}</Text>
                </View>
              ) : null}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CCCCCC" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.listItem} onPress={openFavorites}>
            <View style={styles.listItemLeft}>
              <MaterialCommunityIcons name="heart-outline" size={22} color="#0057A8" />
              <Text style={styles.listItemText}>Favoritos</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CCCCCC" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.listItem, styles.noBorder]} onPress={openTripHistory}>
            <View style={styles.listItemLeft}>
              <MaterialCommunityIcons name="history" size={22} color="#0057A8" />
              <Text style={styles.listItemText}>Histórico de viagens</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CCCCCC" />
          </TouchableOpacity>
        </View>

        <View style={styles.groupDivider} />

        <View style={styles.listGroup}>
          <TouchableOpacity style={styles.listItem} onPress={openChangePassword}>
            <View style={styles.listItemLeft}>
              <MaterialCommunityIcons name="lock-outline" size={22} color="#0057A8" />
              <Text style={styles.listItemText}>Alterar senha</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CCCCCC" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.listItem, styles.noBorder]} onPress={handleLogout}>
            <View style={styles.listItemLeft}>
              <MaterialCommunityIcons name="logout" size={22} color="#EF4444" />
              <Text style={styles.logoutItemText}>Sair</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 24,
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: '#1E1D1D',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerRightSpacer: {
    width: 24,
  },
  initialsCircle: {
    width: 64,
    height: 64,
    backgroundColor: '#EBF3FF',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  initialsText: {
    color: '#0057A8',
    fontSize: 22,
    fontWeight: '700',
  },
  headerInfoWrap: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    color: '#1E1D1D',
    fontSize: 17,
    fontWeight: '700',
  },
  userEmail: {
    color: '#666666',
    fontSize: 13,
    marginTop: 2,
  },
  disabilityType: {
    color: '#0057A8',
    fontSize: 12,
    marginTop: 2,
  },
  editButton: {
    borderWidth: 1,
    borderColor: '#0057A8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#0057A8',
    fontSize: 13,
  },
  listGroup: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listItemText: {
    color: '#1E1D1D',
    fontSize: 15,
  },
  logoutItemText: {
    color: '#EF4444',
    fontSize: 15,
  },
  countBadge: {
    backgroundColor: '#EBF3FF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: '#0057A8',
    fontSize: 11,
    fontWeight: '700',
  },
  groupDivider: {
    height: 8,
    backgroundColor: '#F5F5F5',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
});
