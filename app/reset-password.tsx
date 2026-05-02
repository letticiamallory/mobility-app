import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { resetPassword } from '../services/auth.service';
import { ScaledText as Text } from '@/components/ScaledText';
import { ScaledTextInput as TextInput } from '@/components/ScaledTextInput';
import { useAccessibilitySurfaces } from '@/contexts/accessibility-preferences';
import { A11Y_HIT_SLOP } from '@/constants/accessibility';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const sx = useAccessibilitySurfaces();
  const params = useLocalSearchParams<{ email?: string | string[]; resetToken?: string | string[] }>();
  const email = (Array.isArray(params.email) ? params.email[0] : params.email) ?? '';
  const resetToken =
    (Array.isArray(params.resetToken) ? params.resetToken[0] : params.resetToken) ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !resetToken) {
      Alert.alert('Erro', 'Sessão inválida. Solicite um novo código.');
      router.replace('/forgot-password');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Atenção', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Atenção', 'As senhas não coincidem.');
      return;
    }
    try {
      setLoading(true);
      await resetPassword(email, resetToken, newPassword, confirmPassword);
      Alert.alert('Sucesso', 'Sua senha foi redefinida com sucesso.');
      router.replace('/login');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível redefinir sua senha.';
      Alert.alert('Erro', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, sx.fillScreen]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={A11Y_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E1D1D" />
        </TouchableOpacity>

        <Text style={styles.title}>Criar nova senha</Text>
        <Text style={styles.subtitle}>
          Defina uma nova senha para acessar sua conta com segurança.
        </Text>

        <Text style={styles.label}>Nova senha</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Digite a nova senha"
            secureTextEntry
            accessibilityLabel="Nova senha"
            textContentType="newPassword"
            autoComplete="password-new"
          />
        </View>

        <Text style={styles.label}>Confirmar senha</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repita a nova senha"
            secureTextEntry
            accessibilityLabel="Confirmar nova senha"
            textContentType="newPassword"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, loading ? styles.saveBtnDisabled : null]}
          onPress={handleSubmit}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={loading ? 'Salvando nova senha' : 'Salvar nova senha'}
          accessibilityState={{ disabled: loading }}
        >
          <Text style={styles.saveBtnText}>{loading ? 'Salvando...' : 'Salvar nova senha'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 24 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 18 },
  title: { color: '#1E1D1D', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#64748B', fontSize: 14, marginTop: 8, lineHeight: 20 },
  label: { color: '#1E1D1D', fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 6 },
  inputWrap: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  input: { color: '#1E1D1D', fontSize: 14 },
  saveBtn: {
    marginTop: 24,
    backgroundColor: '#0057A8',
    borderRadius: 40,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
