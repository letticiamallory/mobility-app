import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { login } from '../services/auth.service'; // ← nova linha
import { saveToken } from '../services/token.service'; // ← nova linha

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
      const token = await login(email, password); // ← chama o backend
      await saveToken(token); // ← salva o token no dispositivo
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
        <Image
          source={require('../assets/images/guidedDog.png')}
          style={styles.illustration}
          resizeMode="contain"
        />
      </View>

      <View style={styles.form}>
        <Text style={styles.title}>
          Bem vindo ao{'\n'}
          <Text style={styles.titleHighlight}>Mobility</Text>
        </Text>
        <Text style={styles.subtitle}>
          Não tem conta?{' '}
          <Text style={styles.link} onPress={() => router.push('/register')}>
            Cadastre-se
          </Text>
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite seu email"
          placeholderTextColor="#aab8cc"
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
          placeholderTextColor="#aab8cc"
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
    color: '#333',
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
    color: '#666',
    marginBottom: 24,
    marginTop: 8,
  },
  link: {
    color: '#0057A8',
    fontWeight: '500',
  },
  label: {
    fontSize: 13,
    color: '#444',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D0E2F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1a1a2e',
    backgroundColor: '#F4F8FF',
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
    backgroundColor: '#D0E2F5',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});