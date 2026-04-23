import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RegisterIllustration from '../assets/images/register.svg';
import { login } from '../services/auth.service'; // ← nova linha
import { saveToken, saveUserInfo } from '../services/token.service'; // ← nova linha

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // ← nova linha
  const router = useRouter();

  const handleLogin = async () => { // ← atualizado
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
      Alert.alert('Erro', 'Email ou senha inválidos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>

      <View style={styles.topSection}>
        <RegisterIllustration width={320} height={260} />
      </View>

      <View style={styles.form}>
        <Text style={styles.title}>
          Bem vindo ao{'\n'}
          <Text style={styles.titleHighlight}>Mobility</Text>
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
          placeholderTextColor="#7D8590"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.passwordRow}>
          <Text style={styles.label}>Senha</Text>
          <Text style={styles.link}>Esqueci minha senha</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Digite sua senha"
          placeholderTextColor="#7D8590"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Entrando...' : 'LOGIN'}
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topSection: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  illustration: {
    width: 400,
    height: 330,
  },
  form: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
    lineHeight: 28,
  },
  titleHighlight: {
    fontSize: 40,
    fontWeight: '700',
    color: '#0057A8',
    lineHeight: 45,
  },
  subtitle: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 24,
    marginTop: 8,
  },
  link: {
    color: '#0057A8',
    fontWeight: '500',
  },
  label: {
    fontSize: 13,
    color: '#1a1a1a',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D0D7DE',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  button: {
    backgroundColor: '#0057A8',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
