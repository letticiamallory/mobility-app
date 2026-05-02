import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScaledText as Text } from '@/components/ScaledText';
import { ScaledTextInput as TextInput } from '@/components/ScaledTextInput';
import {
  useAccessibilityPreferences,
  useAccessibilitySurfaces,
} from '@/contexts/accessibility-preferences';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { login } from '../services/auth.service';
import { API_URL } from '../constants/api';
import {
  GOOGLE_WEB_CLIENT_ID,
  googlePayloadFromIdToken,
  isExpoGo,
  signInWithGoogleNative,
} from '../services/google-auth.service';
import {
  clearAllMobilityStorage,
  getRememberMe,
  getStoredTokenOnly,
  saveRememberMe,
  saveToken,
  saveUserInfo,
} from '../services/token.service';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LoginScreenInner />
    </>
  );
}

function LoginScreenInner() {
  const { highContrast, colors } = useAccessibilityPreferences();
  const sx = useAccessibilitySurfaces();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const router = useRouter();
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  const [googleRequest, , googlePromptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    clientId: GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (__DEV__ && googleRequest && isExpoGo()) {
      console.log(
        '[Google / Expo Go] Cadastre esta URL em Google Cloud → OAuth Web client → Authorized redirect URIs:',
        googleRequest.redirectUri
      );
    }
  }, [googleRequest]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remember = await getRememberMe();
      if (cancelled) return;
      setRememberMe(remember);
      if (!remember) return;
      // Só JWT guardado — getToken() em dev devolve placeholder e redirecionava sem login real.
      const token = await getStoredTokenOnly();
      if (cancelled) return;
      if (token) {
        if (__DEV__) console.log('[login] Auto-redirect /home: token já existia no dispositivo');
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
      if (__DEV__) {
        console.log('[login/email] Antes da API', { email: emailTrimmed, apiUrl: API_URL });
      }
      const loginData = await login(emailTrimmed, password);
      if (__DEV__) {
        console.log('[login/email] Resposta OK do auth.login', {
          user_id: loginData.user_id,
          has_token: !!loginData.access_token,
        });
      }
      await saveRememberMe(rememberMe);
      await saveToken(loginData.access_token);
      await saveUserInfo(loginData.user_id, loginData.name, emailTrimmed.toLowerCase());
      if (__DEV__) console.log('[login/email] Token e sessão gravados; navegando /home');
      router.replace('/home');
    } catch (error) {
      if (__DEV__) console.log('[login/email] Falha', error);
      const message =
        error instanceof Error ? error.message : 'Não foi possível entrar. Tente de novo.';
      Alert.alert('Erro', message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      let googleData: {
        email: string;
        name: string;
        googleId: string;
        token: string;
      };

      if (isExpoGo()) {
        if (!googleRequest) {
          throw new Error('Login Google ainda não está pronto. Tente de novo em um instante.');
        }
        const result = await googlePromptAsync();
        if (result.type === 'cancel' || result.type === 'dismiss') return;
        if (result.type !== 'success') {
          const err =
            result.type === 'error'
              ? String(result.params?.error_description ?? result.error ?? 'Falha no login Google')
              : 'Falha no login Google';
          throw new Error(err);
        }
        const idToken =
          result.params.id_token ?? result.authentication?.idToken ?? '';
        if (!idToken) {
          throw new Error(
            'Não foi possível obter o token do Google. Verifique o redirect URI no Google Cloud Console (veja o log [Google / Expo Go]).'
          );
        }
        googleData = googlePayloadFromIdToken(idToken);
      } else {
        googleData = await signInWithGoogleNative();
      }

      if (!googleData.email || !googleData.googleId || !googleData.token) {
        throw new Error('Não foi possível obter os dados da conta Google.');
      }

      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googleData),
      });

      const data = (await response.json()) as {
        access_token?: string;
        user_id?: number;
        name?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? 'Falha no login com Google');
      if (!data.access_token || !data.user_id || !data.name) {
        throw new Error('Resposta inválida no login com Google.');
      }

      await saveRememberMe(true);
      await saveToken(data.access_token);
      await saveUserInfo(data.user_id, data.name, googleData.email);
      router.replace('/home');
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loginScreenBg = highContrast ? { backgroundColor: colors.screenBackground } : null;

  return (
    <SafeAreaView style={[styles.container, loginScreenBg]} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={[styles.container, loginScreenBg]}
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
          <View style={[styles.card, sx.fillCard]}>
            <Image
              source={require('../assets/images/mobility_m_blue.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.routeDotsRow}>
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
                testID="input-email"
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
                  testID="input-senha"
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

              <TouchableOpacity style={styles.signupRow} onPress={() => router.push('/register')} activeOpacity={0.8}>
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

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.googleSignInButton,
                  (loading || (isExpoGo() && !googleRequest)) && styles.googleSignInButtonDisabled,
                ]}
                onPress={handleGoogleLogin}
                disabled={loading || (isExpoGo() && !googleRequest)}
                accessibilityRole="button"
                accessibilityLabel="Conectar-se com o Google"
              >
                <Image
                  source={{ uri: 'https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png' }}
                  style={styles.googleSignInIcon}
                  resizeMode="contain"
                />
                <Text style={styles.googleSignInLabel}>Conectar-se com o Google</Text>
              </TouchableOpacity>

              <Text style={styles.termsText}>
                Ao entrar, você concorda com os termos{'\n'}e condições.
              </Text>

              {__DEV__ ? (
                <TouchableOpacity
                  style={styles.devClearBtn}
                  onPress={async () => {
                    await clearAllMobilityStorage();
                    if (__DEV__) console.log('[login/dev] SecureStore + AsyncStorage limpos');
                    Alert.alert('Dev', 'Armazenamento limpo. Tente entrar de novo.');
                  }}
                >
                  <Text style={styles.devClearText}>Limpar dados (dev)</Text>
                </TouchableOpacity>
              ) : null}
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
    paddingTop: 12,
    paddingBottom: 28,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  card: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    marginTop: 8,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  routeDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    marginBottom: 24,
    gap: 6,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 28,
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
  /** Padrão alinhado às diretrizes “Sign in with Google” (fundo claro, G colorido, texto localizado). */
  googleSignInButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#747775',
    backgroundColor: '#FFFFFF',
    marginBottom: 24,
    gap: 12,
  },
  googleSignInButtonDisabled: {
    opacity: 0.55,
  },
  googleSignInIcon: {
    width: 20,
    height: 20,
  },
  googleSignInLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F1F1F',
    letterSpacing: 0.15,
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
  devClearBtn: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  devClearText: {
    fontSize: 12,
    color: '#888',
    textDecorationLine: 'underline',
  },
});
