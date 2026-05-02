/**
 * Em __DEV__, permite abrir a home sem login e evita redirecionamentos por falta de token.
 * Coloque no `.env`: EXPO_PUBLIC_SKIP_LOGIN=0 para testar login real de novo.
 * Em builds de produção (__DEV__ === false) isto nunca fica activo.
 */
export function isDevSkipLogin(): boolean {
  if (!__DEV__) return false;
  const raw =
    typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SKIP_LOGIN != null
      ? String(process.env.EXPO_PUBLIC_SKIP_LOGIN).trim().toLowerCase()
      : '';
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}
