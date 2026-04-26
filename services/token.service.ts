import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'mobility_token';
const USER_ID_KEY = 'mobility_user_id';
const USER_NAME_KEY = 'mobility_user_name';
const USER_EMAIL_KEY = 'mobility_user_email';

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveUserInfo(userId: number, name: string, email?: string) {
  await SecureStore.setItemAsync(USER_ID_KEY, String(userId));
  await SecureStore.setItemAsync(USER_NAME_KEY, name);
  if (email) {
    await SecureStore.setItemAsync(USER_EMAIL_KEY, email);
  } else {
    await SecureStore.deleteItemAsync(USER_EMAIL_KEY);
  }
}

export async function getUserInfo() {
  const userId = await SecureStore.getItemAsync(USER_ID_KEY);
  const name = await SecureStore.getItemAsync(USER_NAME_KEY);
  const email = await SecureStore.getItemAsync(USER_EMAIL_KEY);

  return {
    userId: userId ? Number(userId) : null,
    name,
    email,
  };
}