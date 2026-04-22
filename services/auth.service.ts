import { API_URL } from '../constants/api';

export async function login(email: string, password: string) {
  const loginUrl = `${API_URL}/auth/login`;
  console.log('[auth.login] Calling URL:', loginUrl);

  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    console.log('HTTP Status:', response.status);
    const text = await response.text();
    console.log('Response body:', text);
    const data = JSON.parse(text);

    console.log('[auth.login] Response status:', response.status);
    console.log('[auth.login] Response ok:', response.ok);

    if (!response.ok) {
      throw new Error('Email ou senha inválidos');
    }

    return data.access_token as string;
  } catch (error) {
    console.error('[auth.login] Login request failed:', error);
    throw error;
  }
}

export async function register(
  name: string,
  email: string,
  password: string,
  disability_type: string,
) {
  const response = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, disability_type }),
  });

  if (!response.ok) {
    throw new Error('Erro ao criar conta');
  }

  return await response.json();
}