/**
 * URL do mobility-api. Em desenvolvimento costuma ser HTTP na LAN.
 * - Celular físico: IP da máquina que roda o Nest (mesma Wi‑Fi), ex. http://192.168.x.x:3000
 * - Emulador Android → host: http://10.0.2.2:3000
 * Sobrescreva sem editar código: EXPO_PUBLIC_API_URL no .env (reinicie o bundler).
 */
const fromEnv =
  typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL
    ? String(process.env.EXPO_PUBLIC_API_URL).trim()
    : '';

export const API_URL = fromEnv || 'http://192.168.15.7:3000';