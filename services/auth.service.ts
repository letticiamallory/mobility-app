import { API_URL } from '../constants/api';
import { saveUserInfo } from './token.service';

function formatApiErrorBody(data: Record<string, unknown>, status: number): string {
  const m = data.message;
  if (typeof m === 'string' && m.trim()) return m.trim();
  if (Array.isArray(m)) {
    const parts = m
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'message' in item) {
          return String((item as { message: unknown }).message);
        }
        if (item && typeof item === 'object' && 'constraints' in item) {
          const c = (item as { constraints?: Record<string, string> }).constraints;
          if (c && typeof c === 'object') return Object.values(c).join(' ');
        }
        return '';
      })
      .filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  return `HTTP ${status}`;
}

export type LoginResponse = {
  access_token: string;
  user_id: number;
  name: string;
};

export async function login(email: string, password: string) {
  const loginUrl = `${API_URL}/auth/login`;
  console.log('[auth.login] Calling URL:', loginUrl);

  let response: Response;
  try {
    response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    const hint =
      err instanceof TypeError
        ? ' Verifique se o celular/emulador acessa o mesmo IP em constants/api.ts e se o backend está ligado.'
        : '';
    console.error('[auth.login] Fetch failed:', err);
    throw new Error(`Não foi possível conectar ao servidor (${API_URL}).${hint}`);
  }

  const text = await response.text();
  console.log('[auth.login] HTTP Status:', response.status, 'body:', text);

  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      `Resposta inválida do servidor (HTTP ${response.status}). O corpo não é JSON — confira a URL e o backend.`,
    );
  }

  if (!response.ok) {
    const msg = formatApiErrorBody(data, response.status);
    throw new Error(
      msg !== `HTTP ${response.status}`
        ? msg
        : `Login recusado (HTTP ${response.status}). Email ou senha incorretos, ou usuário inexistente.`,
    );
  }

  const token = data.access_token as string | undefined;
  if (!token) {
    throw new Error(
      'O servidor respondeu OK mas sem access_token. Ajuste o backend ou o formato esperado pelo app.',
    );
  }

  const userId = data.user_id as number | undefined;
  const name = (data.name as string | undefined) ?? '';
  if (userId === undefined || userId === null) {
    throw new Error('Resposta do login sem user_id. Verifique o contrato da API.');
  }

  await saveUserInfo(userId, name);
  return data as LoginResponse;
}

export async function register(
  name: string,
  email: string,
  password: string,
  disability_type: string,
  _accompanied?: string,
) {
  const body: Record<string, string> = {
    name,
    email,
    password,
    disability_type,
  };
  // Não enviar `accompanied`: o DTO do backend (POST /users) não declara esse campo e
  // o NestJS responde com erro do tipo "property accompanied should not exist".

  const url = `${API_URL}/users`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const hint =
      err instanceof TypeError
        ? ' Verifique constants/api.ts e se o backend está acessível deste aparelho/emulador.'
        : '';
    console.error('[auth.register] Fetch failed:', err);
    throw new Error(`Não foi possível conectar ao servidor (${API_URL}).${hint}`);
  }

  const text = await response.text();
  console.log('[auth.register] HTTP', response.status, 'body:', text);

  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    if (!response.ok) {
      throw new Error(
        `Cadastro recusado (HTTP ${response.status}). A resposta não é JSON — veja os logs do servidor.`,
      );
    }
  }

  if (!response.ok) {
    const detail = formatApiErrorBody(data, response.status);
    throw new Error(
      detail !== `HTTP ${response.status}`
        ? `Cadastro: ${detail}`
        : `Cadastro recusado (HTTP ${response.status}). Email já em uso ou dados inválidos.`,
    );
  }

  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}