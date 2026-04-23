import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'mobility_token';
const USER_ID_KEY = 'mobility_user_id';
const USER_NAME_KEY = 'mobility_user_name';

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveUserInfo(userId: number, name: string) {
  await SecureStore.setItemAsync(USER_ID_KEY, String(userId));
  await SecureStore.setItemAsync(USER_NAME_KEY, name);
}

export async function getUserInfo() {
  const userId = await SecureStore.getItemAsync(USER_ID_KEY);
  const name = await SecureStore.getItemAsync(USER_NAME_KEY);

  return {
    userId: userId ? Number(userId) : null,
    name,
  };
}