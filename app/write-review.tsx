import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../constants/api';
import { getToken } from '../services/token.service';

const MAX_COMMENT = 300;

const RATING_LABEL: Record<number, string> = {
  1: 'Ruim',
  2: 'Regular',
  3: 'Bom',
  4: 'Muito bom',
  5: 'Excelente',
};

const REVIEW_TAGS = [
  'Sem rampa',
  'Calçada quebrada',
  'Ônibus acessível',
  'Motorista atencioso',
  'Sem sinal sonoro',
  'Ônibus lotado',
  'Piso irregular',
  'Sem estacionamento',
] as const;

export default function WriteReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { type, id, name, origin, destination } = useLocalSearchParams<{
    type?: string;
    id?: string;
    name?: string;
    origin?: string;
    destination?: string;
  }>();

  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const starScale = useRef(
    [0, 1, 2, 3, 4].map(() => new Animated.Value(1)),
  ).current;

  const targetType = useMemo(() => {
    if (type === 'station' || type === 'line' || type === 'route') return type;
    return 'route';
  }, [type]);

  const routeLabel = useMemo(() => {
    const from = `${origin ?? ''}`.trim();
    const to = `${destination ?? ''}`.trim();
    if (from && to) return `${from} › ${to}`;
    const fallback = `${name ?? ''}`.trim();
    return fallback || 'Origem › Destino';
  }, [destination, name, origin]);

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const animateStar = (index: number) => {
    const value = starScale[index];
    value.setValue(0.8);
    Animated.sequence([
      Animated.spring(value, {
        toValue: 1.2,
        useNativeDriver: true,
        friction: 6,
        tension: 140,
      }),
      Animated.spring(value, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 120,
      }),
    ]).start();
  };

  const handleSelectRating = (value: number) => {
    setRating(value);
    animateStar(value - 1);
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

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={18} color="#1E1D1D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Avaliar trajeto</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 64}
      >
      <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.routeChip}>
          <View style={styles.routeIconCircle}>
            <MaterialCommunityIcons name="map-marker-path" size={14} color="#FFFFFF" />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.routeChipScroll}
            contentContainerStyle={styles.routeChipScrollContent}
          >
            <Text style={styles.routeChipText}>{routeLabel}</Text>
          </ScrollView>
        </View>

        <View style={styles.ratingCard}>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value, idx) => {
              const selected = value <= rating;
              return (
                <TouchableOpacity key={value} onPress={() => handleSelectRating(value)} activeOpacity={0.8}>
                  <Animated.View style={[styles.starButton, { transform: [{ scale: starScale[idx] }] }]}>
                    <MaterialCommunityIcons
                      name={selected ? 'star' : 'star-outline'}
                      size={36}
                      color={selected ? '#F59E0B' : '#E0E0E0'}
                    />
                  </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.ratingText}>{rating ? RATING_LABEL[rating] : 'Selecione uma nota'}</Text>
        </View>

        <Text style={styles.sectionTitle}>O que você observou?</Text>
        <Text style={styles.sectionSubtitle}>Selecione tudo que se aplica</Text>
        <View style={styles.tagsWrap}>
          {REVIEW_TAGS.map((tag) => {
            const selected = tags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tagChip, selected && styles.tagChipSelected]}
                onPress={() => toggleTag(tag)}
                activeOpacity={0.8}
              >
                <View style={[styles.tagDot, selected && styles.tagDotSelected]} />
                <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Conte mais detalhes</Text>
        <View style={styles.textareaWrap}>
          <TextInput
            multiline
            value={comment}
            onChangeText={(text) => setComment(text.slice(0, MAX_COMMENT))}
            style={styles.textarea}
            textAlignVertical="top"
            placeholder="Descreva sua experiência de acessibilidade..."
            placeholderTextColor="#AAAAAA"
          />
          <View style={styles.textareaFooter}>
            <Text style={styles.counterText}>
              {comment.length} / {MAX_COMMENT}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0}
          activeOpacity={0.9}
        >
          <Text style={styles.submitButtonText}>Enviar avaliação</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  keyboardWrap: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EEEEEE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#1E1D1D',
    fontSize: 16,
    fontWeight: '500',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  routeChip: {
    marginTop: 16,
    backgroundColor: '#EBF3FF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  routeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0057A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeChipText: {
    color: '#0057A8',
    fontSize: 12,
    fontWeight: '500',
  },
  routeChipScroll: {
    flex: 1,
  },
  routeChipScrollContent: {
    paddingRight: 8,
  },
  ratingCard: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 0.5,
    borderColor: '#EEEEEE',
    alignItems: 'center',
    rowGap: 10,
  },
  starsRow: {
    flexDirection: 'row',
    columnGap: 10,
  },
  starButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingText: {
    color: '#666666',
    fontSize: 13,
  },
  sectionTitle: {
    marginTop: 16,
    color: '#1E1D1D',
    fontSize: 13,
    fontWeight: '500',
  },
  sectionSubtitle: {
    marginTop: 2,
    marginBottom: 10,
    color: '#999999',
    fontSize: 12,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  tagChipSelected: {
    backgroundColor: '#EBF3FF',
    borderColor: '#0057A8',
  },
  tagDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#CCCCCC',
  },
  tagDotSelected: {
    backgroundColor: '#0057A8',
  },
  tagText: {
    color: '#666666',
    fontSize: 12,
  },
  tagTextSelected: {
    color: '#0057A8',
    fontWeight: '500',
  },
  textareaWrap: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  textarea: {
    height: 100,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    fontSize: 13,
    color: '#1E1D1D',
    textAlignVertical: 'top',
  },
  textareaFooter: {
    borderTopWidth: 0.5,
    borderTopColor: '#EEEEEE',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  counterText: {
    color: '#CCCCCC',
    fontSize: 11,
    textAlign: 'right',
  },
  submitButton: {
    backgroundColor: '#0057A8',
    borderRadius: 40,
    height: 52,
    marginTop: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
});
