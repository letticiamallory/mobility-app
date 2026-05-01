import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { login } from '../services/auth.service';
import {
  getRememberMe,
  getToken,
  saveRememberMe,
  saveToken,
  saveUserInfo,
} from '../services/token.service';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const router = useRouter();
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remember = await getRememberMe();
      if (cancelled) return;
      setRememberMe(remember);
      if (!remember) return;
      const token = await getToken();
      if (cancelled) return;
      if (token) {
        router.replace('/home');
      }
    })();

    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      ]);

    Animated.loop(
      Animated.parallel([
        pulse(dot1, 0),
        pulse(dot2, 200),
        pulse(dot3, 400),
      ])
    ).start();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogin = async () => {
    const emailTrimmed = email.trim();
    if (!emailTrimmed || !password) {
      Alert.alert('Atenção', 'Preencha o email e a senha');
      return;
    }

    try {
      setLoading(true);
      const loginData = await login(emailTrimmed, password); // ← chama o backend
      await saveRememberMe(rememberMe);
      await saveToken(loginData.access_token); // ← salva o token no dispositivo
      await saveUserInfo(loginData.user_id, loginData.name, emailTrimmed.toLowerCase());
      router.replace('/home'); // ← vai pra tela principal
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível entrar. Tente de novo.';
      Alert.alert('Erro', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.card}>
            <Image
              source={require('../assets/images/mobility_m_blue.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: -35, marginBottom: 24, gap: 6 }}>
              <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#0057A8', opacity: dot1 }} />
              <View style={{ width: 36, height: 2, backgroundColor: '#E0E0E0', borderRadius: 1 }} />
              <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0057A8', opacity: dot2 }} />
              <View style={{ width: 36, height: 2, backgroundColor: '#E0E0E0', borderRadius: 1 }} />
              <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#0057A8', opacity: dot3 }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF', position: 'absolute', top: 3, left: 3 }} />
              </Animated.View>
            </View>

            <View style={styles.formWrap}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Insira seu email"
                placeholderTextColor="#AAAAAA"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.fieldLabel}>Senha</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Insira sua senha"
                  placeholderTextColor="#AAAAAA"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#1E1D1D"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.rememberRow}>
                <TouchableOpacity
                  style={styles.rememberWrap}
                  activeOpacity={0.8}
                  onPress={() => setRememberMe((v) => !v)}
                >
                  <View style={styles.checkBox}>
                    {rememberMe ? (
                      <MaterialCommunityIcons name="check" size={14} color="#0057A8" />
                    ) : null}
                  </View>
                  <Text style={styles.rememberText}>Lembrar-me</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/forgot-password')} activeOpacity={0.8}>
                  <Text style={styles.forgotText}>Esqueci minha senha</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={styles.buttonText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.signupRow} onPress={() => router.push('/')} activeOpacity={0.8}>
                <Text style={styles.signupText}>
                  Não tem conta? <Text style={styles.signupLink}>Registre-se</Text>
                </Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <View style={styles.withCircle}>
                  <Text style={styles.withText}>Com</Text>
                </View>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <TouchableOpacity activeOpacity={0.85} style={[styles.socialIconOnly, styles.socialGoogle]}>
                  <Image
                    source={{ uri: 'https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png' }}
                    style={styles.socialLogoImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} style={[styles.socialIconOnly, styles.socialApple]}>
                  <MaterialCommunityIcons name="apple" size={28} color="#111827" />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} style={[styles.socialIconOnly, styles.socialEmail]}>
                  <Image
                    source={{ uri: 'https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png' }}
                    style={styles.socialLogoImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.termsText}>
                Ao entrar, você concorda com os termos{'\n'}e condições.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2FF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  card: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    height: 796,
    marginTop: -30,
    paddingTop: 34,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginTop: 22,
    marginBottom: 36,
  },
  formWrap: {
    width: '100%',
  },
  fieldLabel: {
    color: '#1E1D1D',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 52,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1E1D1D',
    marginBottom: 12,
  },
  passwordInputWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#1E1D1D',
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 36,
  },
  rememberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#0057A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberText: {
    color: '#0057A8',
    fontSize: 22 * 0.6,
  },
  forgotText: {
    color: '#0057A8',
    fontSize: 12,
  },
  button: {
    backgroundColor: '#0057A8',
    borderRadius: 26,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  signupRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  signupText: {
    color: '#666666',
    fontSize: 13,
    textAlign: 'center',
  },
  signupLink: {
    color: '#0057A8',
    fontWeight: '600',
  },
  dividerRow: {
    marginTop: 24,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  withCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#1E1D1D',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  withText: { color: '#1E1D1D', fontSize: 20 * 0.6 },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 26,
    marginBottom: 24,
  },
  socialIconOnly: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  socialGoogle: { backgroundColor: '#FFFDFD' },
  socialApple: { backgroundColor: '#F9FAFB' },
  socialEmail: { backgroundColor: '#F8FBFF' },
  socialLogoImage: {
    width: 28,
    height: 28,
  },
  termsText: {
    color: '#1E1D1D',
    fontSize: 28 * 0.45,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: -12,
    marginBottom: 32,
  },
  title: {
    display: 'none',
  },
});
