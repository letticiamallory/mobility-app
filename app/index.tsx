import { useRouter } from 'expo-router'; // ← nova linha
import { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter(); // ← nova linha

  const handleLogin = () => {
    console.log('Login:', { email, password });
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
          <Text style={styles.link} onPress={() => router.push('/register')}> {/* ← atualizado */}
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

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>LOGIN</Text>
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
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});