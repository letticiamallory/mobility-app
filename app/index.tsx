import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RegisterMailIllustration from '../assets/images/registermail.svg';
import RegisterAloneIllustration from '../assets/images/registeralone.svg';
import RegisterMobilityIllustration from '../assets/images/registermobility.svg';
import RegisterNameIllustration from '../assets/images/registername.svg';
import RegisterPasswordIllustration from '../assets/images/registerpassword.svg';
import { login, register } from '../services/auth.service';
import { saveToken, saveUserInfo } from '../services/token.service';

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
      const loginData = await login(payload.email, payload.password);
      await saveToken(loginData.access_token);
      await saveUserInfo(loginData.user_id, loginData.name);
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
          <View
            style={[
              styles.imageContainer,
              index === 0 && styles.imageContainerFirstStep,
              index === 1 && styles.imageContainerEmailStep,
              index === 2 && styles.imageContainerPasswordStep,
            ]}
          >
            {index === 0 ? (
              <RegisterNameIllustration width={320} height={290} />
            ) : index === 1 ? (
              <RegisterMailIllustration width={350} height={330} />
            ) : index === 2 ? (
              <RegisterPasswordIllustration width={320} height={260} />
            ) : (
              <Image
                source={
                  require('../assets/images/register-password.png')
                }
                style={{ width: '100%', height: index === 2 ? 220 : 280 }}
                resizeMode="contain"
              />
            )}
          </View>
        )}
        <Text
          style={[
            styles.question,
            index === 0 && styles.questionFirstStep,
            index === 1 && styles.questionEmailStep,
            index === 2 && styles.questionPasswordStep,
          ]}
        >
          {current.question}
        </Text>
        <TextInput
          style={[styles.input, index === 2 && styles.inputPasswordStep]}
          placeholder={current.placeholder}
          placeholderTextColor="#7D8590"
          keyboardType={current.keyboard as any}
          secureTextEntry={current.secure}
          autoCapitalize="none"
          value={form[current.field as keyof typeof form]}
          onChangeText={(text) =>
            setForm((prev) => ({ ...prev, [current.field]: text }))
          }
          autoFocus
        />
        {index === 2 && (
          <View style={styles.requirementsContainerPasswordStep}>
            {renderPasswordRequirements()}
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.button,
            index === 2 && styles.buttonPasswordStep,
            index === 2 && !isPasswordValid && styles.buttonDisabled,
          ]}
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
        <RegisterMobilityIllustration width={320} height={240} />
      </View>
      <Text style={[styles.question, styles.questionMobilityStep]}>A que grupo você pertence?</Text>
      <View style={styles.optionsContainer}>
        {[
          { label: 'Deficiente visual', value: 'visual' },
          { label: 'Cadeirante', value: 'wheelchair' },
          { label: 'Mobilidade reduzida', value: 'reduced_mobility' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              styles.optionButtonMobilityStep,
              form.disability_type === option.value && styles.optionButtonActiveMobilityStep,
            ]}
            onPress={() => {
              setForm((prev) => ({ ...prev, disability_type: option.value }));
              handleNext();
            }}
          >
            <Text
              style={[
                styles.optionText,
                styles.optionTextMobilityStep,
                form.disability_type === option.value && styles.optionTextActiveMobilityStep,
              ]}
            >
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
        <RegisterAloneIllustration width={320} height={240} />
      </View>
      <Text style={[styles.question, styles.questionAccompaniedStep]}>Geralmente você sai...</Text>
      <View style={styles.optionsContainer}>
        {[
          { label: 'Sozinho', value: 'alone' },
          { label: 'Acompanhado', value: 'accompanied' },
          { label: 'Ambos', value: 'both' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              styles.optionButtonAccompaniedStep,
              form.accompanied === option.value && styles.optionButtonActiveAccompaniedStep,
            ]}
            onPress={() => {
              setForm((prev) => ({ ...prev, accompanied: option.value }));
              handleSubmit(option.value);
            }}
          >
            <Text
              style={[
                styles.optionText,
                styles.optionTextAccompaniedStep,
                form.accompanied === option.value && styles.optionTextActiveAccompaniedStep,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={24}
    >
      <View style={styles.container}>
        {renderProgressBar()}

        {step > 0 ? (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/login')}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
        )}

        {step < STEPS.length
          ? renderTextStep(step)
          : step === STEPS.length
          ? renderDisabilityStep()
          : renderAccompaniedStep()}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#D0D7DE',
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
  imageContainerFirstStep: {
    marginBottom: 28,
  },
  imageContainerEmailStep: {
    marginBottom: 24,
  },
  imageContainerPasswordStep: {
    marginBottom: 20,
  },
  imageContainerSmall: {
    alignItems: 'center',
    marginBottom: 24,
  },
  question: {
    fontSize: 25,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 32,
    lineHeight: 33,
  },
  questionFirstStep: {
    color: '#0057A8',
    marginBottom: 24,
  },
  questionEmailStep: {
    color: '#0057A8',
    marginBottom: 22,
  },
  questionPasswordStep: {
    color: '#0057A8',
    marginBottom: 12,
  },
  questionMobilityStep: {
    color: '#0057A8',
  },
  questionAccompaniedStep: {
    color: '#0057A8',
    fontWeight: '500',
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: '#D0D7DE',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  inputPasswordStep: {
    marginBottom: 8,
  },
  requirementsContainerPasswordStep: {
    marginBottom: 16,
  },
  requirementsContainer: {
    gap: 6,
    marginBottom: 0,
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
  buttonPasswordStep: {
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#FFFFFF',
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
    borderColor: '#D0D7DE',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  optionButtonMobilityStep: {
    borderColor: '#0057A8',
  },
  optionButtonActiveMobilityStep: {
    backgroundColor: '#E6F0FB',
    borderColor: '#0057A8',
  },
  optionButtonAccompaniedStep: {
    borderColor: '#0057A8',
  },
  optionButtonActiveAccompaniedStep: {
    backgroundColor: '#E6F0FB',
    borderColor: '#0057A8',
  },
  optionButtonActive: {
    backgroundColor: '#0057A8',
    borderColor: '#0057A8',
  },
  optionText: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  optionTextMobilityStep: {
    color: '#0057A8',
  },
  optionTextActiveMobilityStep: {
    color: '#0057A8',
  },
  optionTextAccompaniedStep: {
    color: '#0057A8',
  },
  optionTextActiveAccompaniedStep: {
    color: '#0057A8',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
});
