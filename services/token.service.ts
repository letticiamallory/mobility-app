import { Platform } from 'react-native';
import { isDevSkipLogin } from '../constants/dev';

const TOKEN_KEY = 'mobility_token';
const USER_ID_KEY = 'mobility_user_id';
const USER_NAME_KEY = 'mobility_user_name';
const USER_EMAIL_KEY = 'mobility_user_email';
const REMEMBER_ME_KEY = 'mobility_remember_me';
const USER_AVATAR_KEY = 'mobility_user_avatar';

/** Placeholder só para ecrãs que exigem `if (token)`; chamadas à API podem falhar até fazeres login real. */
const DEV_PLACEHOLDER_TOKEN = '__dev_skip_login__';

const isWeb = Platform.OS === 'web';

function webGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch {
    /* ignore */
  }
  return null;
}

function webSet(key: string, value: string) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function webRemove(key: string) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (isWeb) return webGet(key);
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string) {
  if (isWeb) {
    webSet(key, value);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string) {
  if (isWeb) {
    webRemove(key);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.deleteItemAsync(key);
}

export async function saveToken(token: string) {
  await secureSet(TOKEN_KEY, token);
}

export async function getToken() {
  const stored = await secureGet(TOKEN_KEY);
  if (stored) return stored;
  if (isDevSkipLogin()) return DEV_PLACEHOLDER_TOKEN;
  return null;
}

export async function removeToken() {
  await secureDelete(TOKEN_KEY);
}

export async function saveUserInfo(userId: number, name: string, email?: string) {
  await secureSet(USER_ID_KEY, String(userId));
  await secureSet(USER_NAME_KEY, name);
  if (email) {
    await secureSet(USER_EMAIL_KEY, email);
  } else {
    await secureDelete(USER_EMAIL_KEY);
  }
}

export async function getUserInfo() {
  const userId = await secureGet(USER_ID_KEY);
  const name = await secureGet(USER_NAME_KEY);
  const email = await secureGet(USER_EMAIL_KEY);

  if (userId || (name && String(name).trim())) {
    return {
      userId: userId ? Number(userId) : null,
      name,
      email,
    };
  }
  if (isDevSkipLogin()) {
    return {
      userId: 1,
      name: 'Desenvolvimento',
      email: 'dev@local.test',
    };
  }
  return {
    userId: null,
    name,
    email,
  };
}

export async function saveRememberMe(enabled: boolean) {
  await secureSet(REMEMBER_ME_KEY, enabled ? '1' : '0');
}

export async function getRememberMe() {
  const value = await secureGet(REMEMBER_ME_KEY);
  if (value === null) return true;
  return value === '1';
}

export async function saveUserAvatar(avatarUri?: string) {
  if (avatarUri && avatarUri.trim()) {
    await secureSet(USER_AVATAR_KEY, avatarUri.trim());
    return;
  }
  await secureDelete(USER_AVATAR_KEY);
}

export async function getUserAvatar() {
  return secureGet(USER_AVATAR_KEY);
}
