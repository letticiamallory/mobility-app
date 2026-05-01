import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../constants/api';
import { getToken } from '../services/token.service';

type MyReview = {
  id: number;
  type?: string;
  rating?: number;
  comment?: string | null;
  created_at?: string;
};

export default function ProfileReviewsScreen() {
  const router = useRouter();
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const response = await fetch(`${API_URL}/reviews/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setReviews([]);
        return;
      }
      const data = (await response.json()) as unknown;
      setReviews(Array.isArray(data) ? (data as MyReview[]) : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const handleDelete = async (reviewId: number) => {
    try {
      const token = await getToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const response = await fetch(`${API_URL}/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        Alert.alert('Erro', 'Não foi possível excluir a avaliação.');
        return;
      }
      setReviews((prev) => prev.filter((item) => item.id !== reviewId));
    } catch {
      Alert.alert('Erro', 'Não foi possível excluir a avaliação.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E1D1D" />
        </TouchableOpacity>
        <Text style={styles.title}>Minhas avaliações</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={reviews}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={loadReviews}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="star-outline" size={36} color="#9CA3AF" />
            <Text style={styles.emptyText}>Você ainda não fez avaliações.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowTop}>
              <Text style={styles.cardTitle}>
                {item.type ? `Tipo: ${item.type}` : 'Avaliação'}
              </Text>
              <Text style={styles.ratingText}>{'★'.repeat(Math.max(0, Number(item.rating ?? 0)))}</Text>
            </View>
            <Text style={styles.commentText}>{item.comment?.trim() || 'Sem comentário.'}</Text>
            <View style={styles.rowBottom}>
              <Text style={styles.dateText}>
                {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '-'}
              </Text>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#1E1D1D', fontSize: 18, fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 28, gap: 10 },
  emptyWrap: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyText: { color: '#6B7280', fontSize: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cardTitle: { color: '#334155', fontSize: 13, fontWeight: '700' },
  ratingText: { color: '#F59E0B', fontSize: 14 },
  commentText: { color: '#1E293B', fontSize: 14, marginTop: 8 },
  dateText: { color: '#94A3B8', fontSize: 12 },
  deleteText: { color: '#DC2626', fontSize: 13, fontWeight: '600' },
});
