import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text as PaperText } from 'react-native-paper';
import { API_URL } from '../constants/api';
import { getToken, removeToken } from '../services/token.service';

type MeResponse = {
  name?: string;
  email?: string;
  disability_type?: string;
  accompanied?: string;
};

function accompaniedLabel(value?: string) {
  if (value === 'alone') return 'Sozinho';
  if (value === 'accompanied') return 'Acompanhado';
  if (value === 'both') return 'Ambos';
  return '-';
}

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<MeResponse>({});

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setError('');
        const token = await getToken();
        if (!token) {
          router.replace('/login');
          return;
        }

        const response = await fetch(`${API_URL}/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Nao foi possivel carregar o perfil.');
        }

        const data = (await response.json()) as MeResponse;
        setProfile(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar perfil.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const initials = useMemo(() => {
    const name = (profile.name || 'U').trim();
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }, [profile.name]);

  const handleLogout = async () => {
    await removeToken();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <PaperText style={styles.avatarInitials}>{initials}</PaperText>
          </View>
          <PaperText style={styles.nameText}>{profile.name || '-'}</PaperText>
          <PaperText style={styles.disabilityHeaderText}>{profile.disability_type || '-'}</PaperText>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0057A8" style={styles.loader} />
        ) : error ? (
          <PaperText style={styles.errorText}>{error}</PaperText>
        ) : (
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <MaterialCommunityIcons name="email-outline" size={22} color="#0057A8" />
              <View style={styles.infoTextBlock}>
                <PaperText style={styles.infoLabel}>Email</PaperText>
                <PaperText style={styles.infoValue}>{profile.email || '-'}</PaperText>
              </View>
            </View>

            <View style={styles.infoCard}>
              <MaterialCommunityIcons name="wheelchair-accessibility" size={22} color="#0057A8" />
              <View style={styles.infoTextBlock}>
                <PaperText style={styles.infoLabel}>Tipo de deficiência</PaperText>
                <PaperText style={styles.infoValue}>{profile.disability_type || '-'}</PaperText>
              </View>
            </View>

            <View style={styles.infoCard}>
              <MaterialCommunityIcons name="account-group-outline" size={22} color="#0057A8" />
              <View style={styles.infoTextBlock}>
                <PaperText style={styles.infoLabel}>Acompanhamento</PaperText>
                <PaperText style={styles.infoValue}>{accompaniedLabel(profile.accompanied)}</PaperText>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <PaperText style={styles.logoutText}>Sair</PaperText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    backgroundColor: '#0057A8',
    padding: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  nameText: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabilityHeaderText: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
  },
  loader: {
    marginTop: 28,
  },
  errorText: {
    marginTop: 24,
    marginHorizontal: 24,
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoSection: {
    marginTop: 20,
    paddingHorizontal: 24,
  },
  infoCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoTextBlock: {
    flex: 1,
  },
  infoLabel: {
    color: '#666666',
    fontSize: 13,
  },
  infoValue: {
    color: '#1E1D1D',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  logoutButton: {
    marginTop: 32,
    marginHorizontal: 24,
    backgroundColor: '#ef4444',
    borderRadius: 40,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
