import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../constants/api';
import { getToken, removeToken } from '../services/token.service';

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

type FontSizeOption = 'A' | 'AA' | 'AAA';

function transportLabel(value?: string) {
  if (value === 'alone') return 'Sozinho';
  if (value === 'accompanied') return 'Acompanhado';
  if (value === 'both') return 'Ambos';
  return '-';
}

function initialsFromName(name?: string) {
  const source = (name || 'U').trim();
  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part[0] || '').toUpperCase())
    .join('');
}

function starsFromRating(rating?: number) {
  const safe = Math.max(0, Math.min(5, Math.round(rating ?? 0)));
  return '★'.repeat(safe) + '☆'.repeat(5 - safe);
}

function formattedDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<MeResponse>({});
  const [reviews, setReviews] = useState<ReviewResponseItem[]>([]);
  const [readAloud, setReadAloud] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState<FontSizeOption>('AA');

  useEffect(() => {
    const loadData = async () => {
      const token = await getToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
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

          <View style={styles.initialsCircle}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{profile.name || '-'}</Text>
          <Text style={styles.disabilityType}>{profile.disability_type || '-'}</Text>

          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>Editar perfil</Text>
          </TouchableOpacity>

          <View style={styles.headerDivider} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Minhas informações</Text>

          <View style={styles.infoItem}>
            <MaterialCommunityIcons
              name="email-outline"
              size={20}
              color="#0057A8"
              style={styles.infoIcon}
            />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile.email || '-'}</Text>
          </View>

          <View style={styles.infoItem}>
            <MaterialCommunityIcons
              name="wheelchair-accessibility"
              size={20}
              color="#0057A8"
              style={styles.infoIcon}
            />
            <Text style={styles.infoLabel}>Deficiência</Text>
            <Text style={styles.infoValue}>{profile.disability_type || '-'}</Text>
          </View>

          <View style={[styles.infoItem, styles.noBorder]}>
            <MaterialCommunityIcons name="bus" size={20} color="#0057A8" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Transporte</Text>
            <Text style={styles.infoValue}>{transportLabel(profile.accompanied)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acessibilidade</Text>

          <View style={styles.accessibilityRow}>
            <View style={styles.accessibilityLeft}>
              <MaterialCommunityIcons name="volume-high" size={20} color="#0057A8" />
              <Text style={styles.accessibilityText}>Leitura por voz</Text>
            </View>
            <Switch
              value={readAloud}
              onValueChange={setReadAloud}
              trackColor={{ true: '#0057A8' }}
            />
          </View>

          <View style={styles.accessibilityRow}>
            <View style={styles.accessibilityLeft}>
              <MaterialCommunityIcons name="contrast-circle" size={20} color="#0057A8" />
              <Text style={styles.accessibilityText}>Alto contraste</Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={setHighContrast}
              trackColor={{ true: '#0057A8' }}
            />
          </View>

          <View style={[styles.accessibilityRow, styles.noBorder]}>
            <Text style={styles.accessibilityText}>Tamanho da fonte</Text>
            <View style={styles.fontButtonsWrap}>
              {(['A', 'AA', 'AAA'] as FontSizeOption[]).map((option) => {
                const selected = fontSize === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.fontButton, selected && styles.fontButtonSelected]}
                    onPress={() => setFontSize(option)}
                  >
                    <Text style={[styles.fontButtonText, selected && styles.fontButtonTextSelected]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Minhas avaliações</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Ver todas</Text>
            </TouchableOpacity>
          </View>

          {reviews.length === 0 ? (
            <View style={styles.emptyReviewWrap}>
              <MaterialCommunityIcons name="star-outline" size={36} color="#CCCCCC" />
              <Text style={styles.emptyReviewText}>Nenhuma avaliação ainda</Text>
            </View>
          ) : (
            reviews.map((review, index) => (
              <View key={String(review.id ?? index)} style={styles.reviewCard}>
                <Text style={styles.reviewPlace}>{review.place_name || 'Local não informado'}</Text>
                <Text style={styles.reviewStars}>{starsFromRating(review.rating)}</Text>
                <Text style={styles.reviewComment}>{review.comment || 'Sem comentário.'}</Text>
                <Text style={styles.reviewDate}>{formattedDate(review.created_at)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta</Text>

          <TouchableOpacity style={styles.accountItem}>
            <View style={styles.accountItemLeft}>
              <MaterialCommunityIcons name="lock-outline" size={20} color="#1E1D1D" />
              <Text style={styles.accountItemText}>Alterar senha</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CCCCCC" />
          </TouchableOpacity>

          <View style={styles.accountDivider} />

          <TouchableOpacity style={styles.accountItem} onPress={handleLogout}>
            <View style={styles.accountItemLeft}>
              <MaterialCommunityIcons name="logout" size={20} color="#FF4444" />
              <Text style={styles.logoutItemText}>Sair</Text>
            </View>
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
    padding: 24,
    paddingTop: 16,
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
    width: 72,
    height: 72,
    backgroundColor: '#EBF3FF',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 20,
  },
  initialsText: {
    color: '#0057A8',
    fontSize: 26,
    fontWeight: '700',
  },
  userName: {
    color: '#1E1D1D',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
  disabilityType: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  editButton: {
    borderWidth: 1,
    borderColor: '#0057A8',
    borderRadius: 40,
    paddingHorizontal: 20,
    height: 36,
    marginTop: 16,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#0057A8',
    fontSize: 13,
    fontWeight: '600',
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginTop: 24,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    padding: 20,
  },
  sectionTitle: {
    color: '#1E1D1D',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoIcon: {
    marginRight: 12,
  },
  infoLabel: {
    color: '#999999',
    fontSize: 12,
  },
  infoValue: {
    color: '#1E1D1D',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flexShrink: 1,
  },
  accessibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  accessibilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accessibilityText: {
    color: '#1E1D1D',
    fontSize: 14,
    marginLeft: 12,
  },
  fontButtonsWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  fontButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fontButtonSelected: {
    backgroundColor: '#0057A8',
  },
  fontButtonText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  fontButtonTextSelected: {
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAllText: {
    color: '#0057A8',
    fontSize: 13,
  },
  emptyReviewWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  emptyReviewText: {
    color: '#999999',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  reviewCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  reviewPlace: {
    color: '#1E1D1D',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewStars: {
    color: '#F59E0B',
    fontSize: 16,
    marginTop: 4,
  },
  reviewComment: {
    color: '#666666',
    fontSize: 13,
    marginTop: 4,
  },
  reviewDate: {
    color: '#AAAAAA',
    fontSize: 11,
    marginTop: 6,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  accountItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountItemText: {
    color: '#1E1D1D',
    fontSize: 14,
    marginLeft: 12,
  },
  accountDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  logoutItemText: {
    color: '#FF4444',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
});
