import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export default function SuccessScreen() {
  const router = useRouter();

  const dotTL = useRef(new Animated.Value(0)).current;
  const dotTR = useRef(new Animated.Value(0)).current;
  const dotBL = useRef(new Animated.Value(0)).current;
  const dotBR = useRef(new Animated.Value(0)).current;
  const star1 = useRef(new Animated.Value(0)).current;
  const star2 = useRef(new Animated.Value(0)).current;
  const star3 = useRef(new Animated.Value(0)).current;
  const centralScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const springIn = (anim: Animated.Value, delay: number) =>
      Animated.spring(anim, {
        toValue: 1,
        delay,
        useNativeDriver: true,
        friction: 6,
        tension: 50,
      });

    springIn(dotTL, 100).start();
    springIn(dotTR, 200).start();
    springIn(dotBL, 300).start();
    springIn(dotBR, 400).start();
    springIn(star1, 150).start();
    springIn(star2, 280).start();
    springIn(star3, 350).start();
    springIn(centralScale, 200).start();
  }, [dotTL, dotTR, dotBL, dotBR, star1, star2, star3, centralScale]);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/home');
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.heroWrap}>
        <Animated.View
          style={[
            styles.decorDot,
            styles.dotTL,
            { transform: [{ scale: dotTL }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decorDot,
            styles.dotTR,
            { transform: [{ scale: dotTR }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decorDot,
            styles.dotBL,
            { transform: [{ scale: dotBL }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decorDot,
            styles.dotBR,
            { transform: [{ scale: dotBR }] },
          ]}
        />

        <Animated.Text style={[styles.star, styles.star1, { transform: [{ scale: star1 }] }]}>
          ★
        </Animated.Text>
        <Animated.Text style={[styles.star, styles.star2, { transform: [{ scale: star2 }] }]}>
          ★
        </Animated.Text>
        <Animated.Text style={[styles.star, styles.star3, { transform: [{ scale: star3 }] }]}>
          ★
        </Animated.Text>

        <Animated.View
          style={[
            styles.centralCircle,
            { transform: [{ scale: centralScale }] },
          ]}
        >
          <MaterialCommunityIcons name="check" size={64} color="#FFFFFF" />
        </Animated.View>
      </View>

      <Text style={styles.title}>Cadastro realizado!</Text>
      <Text style={styles.subtitle}>
        Sua conta está pronta! Você será redirecionado para a tela inicial.
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  heroWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0057A8',
  },
  dotTL: { top: 8, left: 16 },
  dotTR: { top: 8, right: 16 },
  dotBL: { bottom: 8, left: 16 },
  dotBR: { bottom: 8, right: 16 },
  star: {
    position: 'absolute',
    fontSize: 20,
    color: '#1E1D1D',
  },
  star1: { top: 24, left: 0 },
  star2: { top: 0, right: 32 },
  star3: { bottom: 32, right: 8 },
  centralCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#0057A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#1E1D1D',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 40,
  },
  subtitle: {
    color: '#999999',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
});
