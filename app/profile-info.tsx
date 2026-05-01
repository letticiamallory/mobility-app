import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../constants/api';
import { getToken } from '../services/token.service';

type MeResponse = {
  name?: string;
  email?: string;
  disability_type?: string;
  accompanied?: string;
};

const disabilityOptions = [
  { key: 'visual', label: 'Visual' },
  { key: 'wheelchair', label: 'Cadeirante' },
  { key: 'reduced_mobility', label: 'Mobilidade reduzida' },
] as const;

const accompaniedOptions = [
  { key: 'alone', label: 'Sozinho' },
  { key: 'companied', label: 'Acompanhado' },
  { key: 'both', label: 'Ambos' },
] as const;

export default function ProfileInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const startSection = (Array.isArray(params.section) ? params.section[0] : params.section) === 'accessibility'
    ? 'accessibility'
    : 'info';
  const [activeSection, setActiveSection] = useState<'info' | 'accessibility'>(startSection);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MeResponse>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) {
          router.replace('/login');
          return;
        }
        const response = await fetch(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = (await response.json()) as MeResponse;
        if (!cancelled) setForm(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const canSave = useMemo(() => (form.name ?? '').trim().length >= 2, [form.name]);

  const handleSave = async () => {
    if (!canSave) {
      Alert.alert('Atenção', 'Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    try {
      setSaving(true);
      const token = await getToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name?.trim(),
          disability_type: form.disability_type,
          accompanied: form.accompanied,
        }),
      });
      if (!response.ok) {
        Alert.alert('Erro', 'Não foi possível salvar suas informações.');
        return;
      }
      const data = (await response.json()) as MeResponse;
      setForm(data);
      Alert.alert('Sucesso', 'Perfil atualizado.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar suas informações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1E1D1D" />
          </TouchableOpacity>
          <Text style={styles.title}>Minhas informações</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveSection('info')}>
            <Text style={[styles.tabText, activeSection === 'info' ? styles.tabTextActive : null]}>
              Dados
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveSection('accessibility')}>
            <Text style={[styles.tabText, activeSection === 'accessibility' ? styles.tabTextActive : null]}>
              Acessibilidade
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {activeSection === 'info' ? (
            <>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                style={styles.input}
                value={form.name ?? ''}
                onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
                placeholder="Seu nome"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.label}>Email</Text>
              <View style={styles.readonlyInput}>
                <Text style={styles.readonlyText}>{form.email ?? '-'}</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>Tipo de deficiência</Text>
              <View style={styles.optionsWrap}>
                {disabilityOptions.map((opt) => {
                  const selected = form.disability_type === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.optionChip, selected ? styles.optionChipActive : null]}
                      onPress={() => setForm((prev) => ({ ...prev, disability_type: opt.key }))}
                    >
                      <Text style={[styles.optionChipText, selected ? styles.optionChipTextActive : null]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.label}>Preferência de acompanhamento</Text>
              <View style={styles.optionsWrap}>
                {accompaniedOptions.map((opt) => {
                  const selected = (form.accompanied ?? 'both') === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.optionChip, selected ? styles.optionChipActive : null]}
                      onPress={() => setForm((prev) => ({ ...prev, accompanied: opt.key }))}
                    >
                      <Text style={[styles.optionChipText, selected ? styles.optionChipTextActive : null]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || saving || loading) ? styles.saveBtnDisabled : null]}
          disabled={!canSave || saving || loading}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Salvar alterações'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 30 },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#1E1D1D', fontSize: 18, fontWeight: '700' },
  tabs: {
    marginTop: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
  },
  tabBtn: { paddingVertical: 8 },
  tabText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#0057A8' },
  card: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
  },
  label: { color: '#334155', fontSize: 13, fontWeight: '600', marginTop: 6, marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    color: '#1E1D1D',
    marginBottom: 8,
  },
  readonlyInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  readonlyText: { color: '#6B7280', fontSize: 14 },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  optionChipActive: {
    borderColor: '#0057A8',
    backgroundColor: '#EBF3FF',
  },
  optionChipText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  optionChipTextActive: { color: '#0057A8' },
  saveBtn: {
    marginTop: 14,
    marginHorizontal: 16,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#0057A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
