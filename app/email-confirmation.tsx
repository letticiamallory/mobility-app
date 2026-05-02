import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ForgotPasswordSvg from '../assets/images/undraw_forgot-password_nttj (1).svg';
import { API_URL } from '../constants/api';

export default function EmailConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;
  const [userEmail, setUserEmail] = useState((emailParam ?? '').trim());
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendLeftSeconds, setResendLeftSeconds] = useState(0);
  const inputsRef = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    setUserEmail((emailParam ?? '').trim());
  }, [emailParam]);

  const handleDigitChange = (text: string, index: number) => {
    const char = text.slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);

    if (char && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    event: { nativeEvent: { key: string } },
    index: number,
  ) => {
    if (event.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleConfirm = async () => {
    const email = userEmail.trim();
    const code = digits.join('');
    if (!email) return Alert.alert('Atenção', 'Email inválido para confirmação.');
    if (code.length < 6) return Alert.alert('Atenção', 'Digite o código completo');

    try {
      setConfirming(true);
      const response = await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Falha ao verificar');
      router.replace('/success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao verificar.';
      Alert.alert('Erro', message);
    } finally {
      setConfirming(false);
    }
  };

  const handleResend = async () => {
    if (resendLeftSeconds > 0) return; // evita clique duplo durante cooldown

    try {
      setResending(true);
      const response = await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      Alert.alert('Código reenviado!', 'Verifique sua caixa de entrada.');

      // Inicia cooldown de 60 segundos
      setResendLeftSeconds(60);
      const interval = setInterval(() => {
        setResendLeftSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E1D1D" />
        </TouchableOpacity>
        <View style={styles.illustrationWrap}>
          <ForgotPasswordSvg width={260} height={200} />
        </View>

        <Text style={styles.title}>Verifique seu email</Text>
        <Text style={styles.subtitle}>Enviamos um código de confirmação para</Text>
        <Text style={styles.email}>{userEmail}</Text>

        <View style={styles.codeRow}>
          {digits.map((digit, index) => {
            const isFocused = focusedIndex === index;
            return (
              <TextInput
                key={`digit-${index}`}
                ref={(ref) => {
                  inputsRef.current[index] = ref;
                }}
                style={[styles.codeInput, isFocused && styles.codeInputFocused]}
                value={digit}
                onChangeText={(text) => handleDigitChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                onFocus={() => setFocusedIndex(index)}
                onBlur={() => setFocusedIndex((prev) => (prev === index ? null : prev))}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
              />
            );
          })}
        </View>

        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} disabled={confirming}>
          <Text style={styles.confirmText}>{confirming ? 'Validando...' : 'Confirmar'}</Text>
        </TouchableOpacity>

        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Não recebeu? </Text>
          <TouchableOpacity onPress={handleResend} disabled={resendLeftSeconds > 0 || resending}>
            <Text
              style={{
                color: resendLeftSeconds > 0 ? '#AAAAAA' : '#0057A8',
                fontSize: 13,
              }}
            >
              {resending
                ? 'Enviando...'
                : resendLeftSeconds > 0
                  ? `Reenviar em ${resendLeftSeconds}s`
                  : 'Reenviar código'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 132,
    paddingBottom: 24,
    alignItems: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  illustrationWrap: {
    width: 260,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#1E1D1D',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 0,
    fontFamily: 'Agrandir-TextBold',
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Agrandir-Regular',
  },
  email: {
    color: '#0057A8',
    fontWeight: '600',
    marginTop: 4,
    fontFamily: 'Agrandir-TextBold',
  },
  codeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 28,
  },
  codeInput: {
    width: 44,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    fontSize: 22,
    fontWeight: '600',
    color: '#1E1D1D',
  },
  codeInputFocused: {
    borderColor: '#0057A8',
  },
  confirmButton: {
    backgroundColor: '#0057A8',
    borderRadius: 40,
    height: 52,
    width: '100%',
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    fontFamily: 'Agrandir-TextBold',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  resendText: {
    color: '#666666',
    fontSize: 13,
    fontFamily: 'Agrandir-Regular',
  },
});
