import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Agrandir-Regular': require('../assets/fonts/PPAgrandir-Regular.otf'),
    'Agrandir-GrandHeavy': require('../assets/fonts/PPAgrandir-GrandHeavy.otf'),
    'Agrandir-TextBold': require('../assets/fonts/PPAgrandirText-Bold.otf'),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <Stack>
        <Stack.Screen name="profile" />
      </Stack>
      <Redirect href={'/splash' as any} />
    </>
  );
}
