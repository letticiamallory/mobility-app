import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { login, register } from '../services/auth.service';
import { saveToken } from '../services/token.service';

const STEPS = [
  { id: 1, question: "Como gostaria de ser chamado?", field: 'name', placeholder: 'Seu nome', keyboard: 'default', secure: false },
  { id: 2, question: "Escolha o seu melhor e-mail", field: 'email', placeholder: 'seu@email.com', keyboard: 'email-address', secure: false },
  { id: 3, question: 'Crie uma senha', field: 'password', placeholder: 'Digite sua senha', keyboard: 'default', secure: true },
];

export default function RegisterScreen() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    disability_type: '',
    accompanied: '',
  });

  const totalSteps = STEPS.length + 2;

  const handleNext = () => setStep((prev) => prev + 1);
  const handleBack = () => setStep((prev) => prev - 1);
  const handleSubmit = async (accompanied: string) => {
    const payload = { ...form, accompanied };

    try {
      await register(
        payload.name,
        payload.email,
        payload.password,
        payload.disability_type,
      );
      const token = await login(payload.email, payload.password);
      await saveToken(token);
      router.replace('/home');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível concluir o cadastro');
    }
  };

  const hasMinLength = form.password.length >= 6;
  const hasUpperCase = /[A-Z]/.test(form.password);
  const hasNumber = /[0-9]/.test(form.password);
  const isPasswordValid = hasMinLength && hasUpperCase && hasNumber;

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View
          key={i}
          style={[styles.progressDot, i <= step && styles.progressDotActive]}
        />
      ))}
    </View>
  );

  const renderPasswordRequirements = () => (
    <View style={styles.requirementsContainer}>
      <View style={styles.requirementRow}>
        <Text style={hasMinLength ? styles.checkIcon : styles.crossIcon}>
          {hasMinLength ? '✓' : '✗'}
        </Text>
        <Text style={[styles.requirementText, hasMinLength && styles.requirementMet]}>
          Mínimo 6 caracteres
        </Text>
      </View>
      <View style={styles.requirementRow}>
        <Text style={hasUpperCase ? styles.checkIcon : styles.crossIcon}>
          {hasUpperCase ? '✓' : '✗'}
        </Text>
        <Text style={[styles.requirementText, hasUpperCase && styles.requirementMet]}>
          Pelo menos uma letra maiúscula
        </Text>
      </View>
      <View style={styles.requirementRow}>
        <Text style={hasNumber ? styles.checkIcon : styles.crossIcon}>
          {hasNumber ? '✓' : '✗'}
        </Text>
        <Text style={[styles.requirementText, hasNumber && styles.requirementMet]}>
          Pelo menos um número
        </Text>
      </View>
    </View>
  );

  const renderTextStep = (index: number) => {
    const current = STEPS[index];
    return (
      <View style={styles.stepContainer}>
        {(index === 0 || index === 1 || index === 2) && (
          <View style={styles.imageContainer}>
            <Image
              source={
                index === 0
                  ? require('../assets/images/register-name.png')
                  : index === 1
                  ? require('../assets/images/register-email.png')
                  : require('../assets/images/register-password.png')
              }
              style={{ width: '100%', height: index === 2 ? 220 : 280 }}
              resizeMode="contain"
            />
          </View>
        )}
        <Text style={styles.question}>{current.question}</Text>
        <TextInput
          style={styles.input}
          placeholder={current.placeholder}
          placeholderTextColor="#aab8cc"
          keyboardType={current.keyboard as any}
          secureTextEntry={current.secure}
          autoCapitalize="none"
          value={form[current.field as keyof typeof form]}
          onChangeText={(text) =>
            setForm((prev) => ({ ...prev, [current.field]: text }))
          }
          autoFocus
        />
        {index === 2 && renderPasswordRequirements()}
        <TouchableOpacity
          style={[styles.button, index === 2 && !isPasswordValid && styles.buttonDisabled]}
          onPress={index === 2 && !isPasswordValid ? undefined : handleNext}
        >
          <Text style={styles.buttonText}>Continuar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDisabilityStep = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.imageContainerSmall}>
        <Image
          source={require('../assets/images/register-disability.jpeg')}
          style={{ width: '100%', height: 235 }}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.question}>Como você se locomove?</Text>
      <View style={styles.optionsContainer}>
        {[
          { label: 'Deficiente visual', value: 'visual' },
          { label: 'Cadeirante', value: 'wheelchair' },
          { label: 'Mobilidade reduzida', value: 'reduced_mobility' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.optionButton, form.disability_type === option.value && styles.optionButtonActive]}
            onPress={() => {
              setForm((prev) => ({ ...prev, disability_type: option.value }));
              handleNext();
            }}
          >
            <Text style={[styles.optionText, form.disability_type === option.value && styles.optionTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderAccompaniedStep = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.imageContainerSmall}>
        <Image
          source={require('../assets/images/register-accompanied.png')}
          style={{ width: '100%', height: 230 }}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.question, { fontWeight: '500' }]}>Você costuma sair sozinho?</Text>
      <View style={styles.optionsContainer}>
        {[
          { label: 'Sozinho', value: 'alone' },
          { label: 'Acompanhado', value: 'accompanied' },
          { label: 'Ambos', value: 'both' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.optionButton, form.accompanied === option.value && styles.optionButtonActive]}
            onPress={() => {
              setForm((prev) => ({ ...prev, accompanied: option.value }));
              handleSubmit(option.value);
            }}
          >
            <Text style={[styles.optionText, form.accompanied === option.value && styles.optionTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {renderProgressBar()}

      {step > 0 ? (
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.backButton} />
      )}

      {step < STEPS.length
        ? renderTextStep(step)
        : step === STEPS.length
        ? renderDisabilityStep()
        : renderAccompaniedStep()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 28,
    paddingTop: 60,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 40,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0E2F5',
  },
  progressDotActive: {
    backgroundColor: '#0057A8',
  },
  stepContainer: {
    flex: 1,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  imageContainerSmall: {
    alignItems: 'center',
    marginBottom: 24,
  },
  question: {
    fontSize: 28,
    fontWeight: '600',
    color: '#0057A8',
    marginBottom: 32,
    lineHeight: 36,
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: '#D0E2F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a1a2e',
    backgroundColor: '#F4F8FF',
    marginBottom: 12,
  },
  requirementsContainer: {
    gap: 6,
    marginBottom: 24,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIcon: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '700',
  },
  crossIcon: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '700',
  },
  requirementText: {
    fontSize: 13,
    color: '#ef4444',
  },
  requirementMet: {
    color: '#22c55e',
  },
  button: {
    backgroundColor: '#0057A8',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    backgroundColor: '#D0E2F5',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginBottom: 24,
    height: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: '#0057A8',
    fontWeight: '500',
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  optionButton: {
    height: 56,
    borderWidth: 1.5,
    borderColor: '#D0E2F5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F8FF',
  },
  optionButtonActive: {
    backgroundColor: '#0057A8',
    borderColor: '#0057A8',
  },
  optionText: {
    fontSize: 15,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#ffffff',
  },
});