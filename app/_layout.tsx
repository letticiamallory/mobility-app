import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { getToken } from '../services/token.service';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await getToken();

      if (token) {
        router.replace('/home');
        return;
      }

      router.replace('/');
    };

    checkAuth();
  }, [router]);

  return <Stack />;
}
