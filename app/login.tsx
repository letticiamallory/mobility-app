import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { login } from '../services/auth.service';
import { saveToken, saveUserInfo } from '../services/token.service';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Atenção', 'Preencha o email e a senha');
      return;
    }

    try {
      setLoading(true);
      const loginData = await login(email, password); // ← chama o backend
      await saveToken(loginData.access_token); // ← salva o token no dispositivo
      await saveUserInfo(loginData.user_id, loginData.name);
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
    <ImageBackground
      source={require('../assets/images/freepik.jpg')}
      style={styles.container}
      resizeMode="cover"
      accessible={false}
    >
      <View style={styles.overlay} />
      <View style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">
          Bem vindo ao
        </Text>
        <Text style={styles.titleHighlight} accessibilityRole="header">
          Mobility
        </Text>

        <Text style={styles.subtitle}>
          Não tem conta?{' '}
          <Text style={styles.link} onPress={() => router.push('/')}>
            Cadastre-se
          </Text>
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite seu email"
          placeholderTextColor="rgba(255,255,255,0.5)"
          underlineColorAndroid="transparent"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Campo de email"
          accessibilityHint="Digite seu email para entrar na conta"
        />

        <Text style={styles.label}>Senha</Text>
        <View style={styles.passwordInputWrap}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Digite sua senha"
            placeholderTextColor="rgba(255,255,255,0.5)"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            accessibilityLabel="Campo de senha"
            accessibilityHint="Digite sua senha de acesso"
          />
          <TouchableOpacity
            onPress={() => setShowPassword((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <MaterialCommunityIcons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.forgotWrap}
          accessibilityRole="button"
          accessibilityLabel="Esqueci minha senha"
        >
          <Text style={styles.forgotLink}>Esqueci minha senha</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={loading ? 'Entrando na conta' : 'Entrar'}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Entrando...' : 'ENTRAR'}
          </Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
  },
  title: {
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'Agrandir-Regular',
    color: '#FFFFFF',
  },
  titleHighlight: {
    fontSize: 38,
    fontWeight: '800',
    fontFamily: 'Agrandir-GrandHeavy',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Agrandir-Regular',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    marginBottom: 24,
  },
  link: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'Agrandir-TextBold',
    textDecorationLine: 'underline',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Agrandir-Regular',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: 'Agrandir-Regular',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 16,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontFamily: 'Agrandir-Regular',
    color: '#FFFFFF',
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotLink: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Agrandir-Regular',
  },
  button: {
    backgroundColor: '#0057A8',
    borderRadius: 40,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Agrandir-TextBold',
  },
});
