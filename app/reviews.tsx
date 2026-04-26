import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_URL } from '../constants/api';
import { getToken } from '../services/token.service';

type ReviewItem = {
  id: number;
  user_name?: string;
  created_at?: string;
  rating: number;
  tags?: string[];
  comment?: string;
  likes?: number;
  liked?: boolean;
};

export default function ReviewsScreen() {
  const router = useRouter();
  const { type, id, name } = useLocalSearchParams<{ type?: string; id?: string; name?: string }>();
  const [averageRating, setAverageRating] = useState(0);
  const [distribution, setDistribution] = useState<Record<string, number>>({});
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      const response = await fetch(`${API_URL}/reviews?type=${type}&id=${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = (await response.json()) as {
        average_rating?: number;
        distribution?: Record<string, number>;
        reviews?: ReviewItem[];
        total?: number;
      };
      setAverageRating(data.average_rating ?? 0);
      setDistribution(data.distribution ?? {});
      setReviews(data.reviews ?? []);
      setTotal(data.total ?? 0);
    };
    load();
  }, [type, id]);

  const handleLike = async (reviewId: number) => {
    const token = await getToken();
    await fetch(`${API_URL}/reviews/${reviewId}/like`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setReviews((prev) =>
      prev.map((item) =>
        item.id === reviewId
          ? {
              ...item,
              liked: !item.liked,
              likes: (item.likes ?? 0) + (item.liked ? -1 : 1),
            }
          : item,
      ),
    );
  };

  const renderReview = ({ item }: { item: ReviewItem }) => {
    const initials = (item.user_name || 'U')
      .split(' ')
      .map((p) => p[0] || '')
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewTop}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.reviewTopText}>
            <Text style={styles.userName}>{item.user_name || 'Usuário'}</Text>
          </View>
          <Text style={styles.reviewDate}>
            {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : ''}
          </Text>
        </View>

        <Text style={styles.stars}>{'★'.repeat(item.rating)}{'☆'.repeat(Math.max(0, 5 - item.rating))}</Text>

        <View style={styles.tagsWrap}>
          {(item.tags || []).map((tag) => (
            <View key={`${item.id}-${tag}`} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.comment}>{item.comment || ''}</Text>

        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.likeBtn} onPress={() => handleLike(item.id)}>
            <MaterialCommunityIcons
              name={item.liked ? 'heart' : 'heart-outline'}
              size={18}
              color="#FF4444"
            />
          </TouchableOpacity>
          <Text style={styles.likesText}>{item.likes ?? 0}</Text>
        </View>
      </View>
    );
  };

  const distRows = useMemo(() => [5, 4, 3, 2, 1], []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E1D1D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{name || 'Avaliações'}</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryLeft}>
          <Text style={styles.avgText}>{averageRating.toFixed(1)}</Text>
          <Text style={styles.starsLarge}>
            {'★'.repeat(Math.round(averageRating))}{'☆'.repeat(5 - Math.round(averageRating))}
          </Text>
          <Text style={styles.totalText}>{total} reviews</Text>
        </View>
        <View style={styles.summaryRight}>
          {distRows.map((star) => {
            const count = distribution[String(star)] ?? 0;
            const widthPct = total > 0 ? (count / total) * 100 : 0;
            return (
              <View key={star} style={styles.distRow}>
                <Text style={styles.distLabel}>{star}★</Text>
                <View style={styles.distTrack}>
                  <View style={[styles.distFill, { width: `${widthPct}%` }]} />
                </View>
                <Text style={styles.distCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <FlatList
        data={reviews}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderReview}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.bottomCta}>
        <TouchableOpacity
          style={styles.writeButton}
          onPress={() => router.push({ pathname: '/write-review', params: { type, id, name } })}
        >
          <Text style={styles.writeButtonText}>Escrever avaliação</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#FFFFFF', padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1E1D1D', flex: 1 },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
  },
  summaryLeft: { width: 120 },
  avgText: { color: '#1E1D1D', fontSize: 48, fontWeight: '800' },
  starsLarge: { color: '#F59E0B', fontSize: 20 },
  totalText: { color: '#999999', fontSize: 13, marginTop: 4 },
  summaryRight: { flex: 1, paddingLeft: 8 },
  distRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  distLabel: { width: 22, color: '#666666', fontSize: 12 },
  distTrack: { flex: 1, backgroundColor: '#F5F5F5', height: 6, borderRadius: 3, marginHorizontal: 8 },
  distFill: { backgroundColor: '#0057A8', height: 6, borderRadius: 3 },
  distCount: { width: 24, textAlign: 'right', color: '#666666', fontSize: 12 },
  listContent: { paddingHorizontal: 16, paddingBottom: 96 },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewTop: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EBF3FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#0057A8', fontWeight: '700' },
  reviewTopText: { flex: 1, marginLeft: 10 },
  userName: { color: '#1E1D1D', fontSize: 14, fontWeight: '600' },
  reviewDate: { color: '#999999', fontSize: 12 },
  stars: { color: '#F59E0B', fontSize: 16, marginTop: 8 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  tagChip: { backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: '#666666', fontSize: 11 },
  comment: { color: '#666666', fontSize: 14, lineHeight: 20, marginTop: 8 },
  footerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  likeBtn: { padding: 2 },
  likesText: { color: '#999999', fontSize: 12, marginLeft: 6 },
  bottomCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  writeButton: { backgroundColor: '#0057A8', borderRadius: 40, height: 52, alignItems: 'center', justifyContent: 'center' },
  writeButtonText: { color: '#FFFFFF', fontWeight: '700' },
});
