import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MailSvg from '../assets/images/mail.svg';
import { getUserInfo } from '../services/token.service';

export default function EmailConfirmationScreen() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('seu email');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputsRef = useRef<Array<TextInput | null>>([]);

  const entryTranslateY = useRef(new Animated.Value(40)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const info = await getUserInfo();
      if (info?.name) setUserEmail(info.name);
    })();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(entryTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 60,
      }),
      Animated.spring(entryOpacity, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 60,
      }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatY, {
            toValue: -8,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(floatY, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });
  }, [entryOpacity, entryTranslateY, floatY]);

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

  const handleConfirm = () => {
    const code = digits.join('');
    if (code.length < 6) return;
    router.replace('/success');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View
          style={[
            styles.illustrationWrap,
            {
              opacity: entryOpacity,
              transform: [{ translateY: entryTranslateY }, { translateY: floatY }],
            },
          ]}
        >
          <MailSvg width={260} height={200} />
        </Animated.View>

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

        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmText}>Confirmar</Text>
        </TouchableOpacity>

        <Text style={styles.resendText}>
          Não recebeu? <Text style={styles.resendHighlight}>Reenviar código</Text>
        </Text>
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
    paddingTop: 40,
    alignItems: 'center',
  },
  illustrationWrap: {
    width: 260,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#1E1D1D',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 24,
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
  resendText: {
    color: '#666666',
    fontSize: 13,
    marginTop: 16,
    fontFamily: 'Agrandir-Regular',
  },
  resendHighlight: {
    color: '#0057A8',
    fontWeight: '600',
    fontFamily: 'Agrandir-TextBold',
  },
});
