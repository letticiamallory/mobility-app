import { useState } from 'react';
import {
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const STEPS = [
  { id: 1, question: "Como gostaria de ser chamado?", field: 'name', placeholder: 'Seu nome', keyboard: 'default', secure: false },
  { id: 2, question: "Escolha o seu melhor e-mail", field: 'email', placeholder: 'seu@email.com', keyboard: 'email-address', secure: false },
  { id: 3, question: 'Crie uma senha', field: 'password', placeholder: 'Mínimo 6 caracteres, uma maiúscula e um número', keyboard: 'default', secure: true },
];

const DISABILITY_OPTIONS = [
  { label: 'Deficiente visual', value: 'visual' },
  { label: 'Cadeirante', value: 'wheelchair' },
  { label: 'Mobilidade reduzida', value: 'reduced_mobility' },
];

const ACCOMPANIED_OPTIONS = [
  { label: 'Sozinho', value: 'alone' },
  { label: 'Acompanhado', value: 'accompanied' },
  { label: 'Ambos', value: 'both' },
];

export default function RegisterScreen() {
  const [step, setStep] = useState(0);
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
  const handleSubmit = () => console.log('Register:', form);

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

  const renderTextStep = (index: number) => {
    const current = STEPS[index];
    return (
      <View style={styles.stepContainer}>
        {index === 0 && (
          <View style={styles.imageContainer}>
            <Image
              source={require('../assets/images/register-name.png')}
              style={{ width: 300, height: 300 }}
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
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>Continuar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDisabilityStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.question}>Como você se locomove?</Text>
      <View style={styles.optionsContainer}>
        {DISABILITY_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              form.disability_type === option.value && styles.optionButtonActive,
            ]}
            onPress={() => setForm((prev) => ({ ...prev, disability_type: option.value }))}
          >
            <Text
              style={[
                styles.optionText,
                form.disability_type === option.value && styles.optionTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {form.disability_type !== '' && (
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>Continuar</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderAccompaniedStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.question}>Você costuma sair sozinho?</Text>
      <View style={styles.optionsContainer}>
        {ACCOMPANIED_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              form.accompanied === option.value && styles.optionButtonActive,
            ]}
            onPress={() => setForm((prev) => ({ ...prev, accompanied: option.value }))}
          >
            <Text
              style={[
                styles.optionText,
                form.accompanied === option.value && styles.optionTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {form.accompanied !== '' && (
        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Criar conta</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {renderProgressBar()}

      {step > 0 && (
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
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
  question: {
    fontSize: 28,
    fontWeight: '700',
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
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#0057A8',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginBottom: 24,
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