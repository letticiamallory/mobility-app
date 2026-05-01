import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_URL } from '../constants/api';
import { getToken } from '../services/token.service';
import { REVIEW_QUICK_TAGS } from '../mocks/review-tags';

const RATING_LABEL: Record<number, string> = {
  1: 'Ruim',
  2: 'Regular',
  3: 'Bom',
  4: 'Muito bom',
  5: 'Excelente',
};

export default function WriteReviewScreen() {
  const router = useRouter();
  const { type, id, name } = useLocalSearchParams<{
    type?: string;
    id?: string;
    name?: string;
  }>();

  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  const targetType = useMemo(() => {
    if (type === 'station' || type === 'line' || type === 'route') return type;
    return 'route';
  }, [type]);

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmit = async () => {
    if (!rating) return Alert.alert('Atenção', 'Selecione uma nota');
    try {
      const token = await getToken();
      await fetch(`${API_URL}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: targetType,
          [`${targetType}_id`]: id,
          rating,
          comment,
          tags,
        }),
      });
      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar a avaliação.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1E1D1D" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Avaliar</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.subtitle}>Você está avaliando:</Text>
        <Text style={styles.targetName}>{name || 'Item'}</Text>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity key={value} onPress={() => setRating(value)}>
              <MaterialCommunityIcons
                name="star"
                size={48}
                color={value <= rating ? '#F59E0B' : '#E0E0E0'}
              />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingText}>{rating ? RATING_LABEL[rating] : 'Selecione uma nota'}</Text>

        <Text style={styles.sectionTitle}>O que você observou?</Text>
        <View style={styles.tagsWrap}>
          {REVIEW_QUICK_TAGS.map((tag) => {
            const selected = tags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tagChip, selected && styles.tagChipSelected]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Conte mais detalhes</Text>
        <TextInput
          multiline
          value={comment}
          onChangeText={setComment}
          style={styles.input}
          textAlignVertical="top"
        />

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Enviar avaliação</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 24, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 32 },
  headerTitle: { color: '#1E1D1D', fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 32 },
  subtitle: { color: '#999999', fontSize: 13, marginTop: 12 },
  targetName: { color: '#0057A8', fontSize: 14, fontWeight: '600', marginTop: 4 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  ratingText: { textAlign: 'center', color: '#666666', marginTop: 8, fontSize: 14 },
  sectionTitle: { color: '#1E1D1D', fontSize: 15, fontWeight: '600', marginTop: 24 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tagChip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagChipSelected: { backgroundColor: '#0057A8' },
  tagText: { color: '#666666', fontSize: 13 },
  tagTextSelected: { color: '#FFFFFF' },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    height: 120,
    fontSize: 14,
    color: '#1E1D1D',
    marginTop: 12,
  },
  submitButton: {
    backgroundColor: '#0057A8',
    borderRadius: 40,
    height: 52,
    marginTop: 24,
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700' },
});
