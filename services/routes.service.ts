import { API_URL } from '../constants/api';
import { getToken } from './token.service';

/** Linha retornada por GET /routes/history/:userId */
export type RouteHistoryApiRow = {
  id: number;
  origin?: string;
  destination?: string;
  transport_type?: string;
  accessible?: boolean;
  created_at?: string;
};

export async function fetchUserRouteHistory(
  token: string,
  userId: number,
): Promise<RouteHistoryApiRow[]> {
  const response = await fetch(`${API_URL}/routes/history/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? (data as RouteHistoryApiRow[]) : [];
}

/** Mais recentes primeiro (por data; desempate por id). */
export function sortRouteHistoryNewestFirst(rows: RouteHistoryApiRow[]): RouteHistoryApiRow[] {
  return [...rows].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

export async function searchRoutes(
  origin: string,
  destination: string,
  userId: number,
  transportType: string,
  accompanied?: string,
  timeFilter?: string,
  timeValue?: string,
  routePreference?: string,
) {
  try {
    const token = await getToken();
    const url = `${API_URL}/routes/check`;
    const body = {
      origin,
      destination,
      user_id: userId,
      transport_type: transportType,
      ...(accompanied !== undefined && accompanied !== '' ? { accompanied } : {}),
      ...(timeFilter ? { time_filter: timeFilter } : {}),
      ...(timeValue ? { time_value: timeValue } : {}),
      ...(routePreference ? { route_preference: routePreference } : {}),
    };
    const bodyString = JSON.stringify(body);

    console.log('[searchRoutes] antes do fetch', {
      url,
      token,
      body: bodyString,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token ?? ''}`,
      },
      body: bodyString,
    });

    const httpStatus = response.status;

    console.log('[searchRoutes] após o fetch', {
      status: httpStatus,
      ok: response.ok,
      sucesso: response.ok,
    });

    const text = await response.text();
    let result: unknown = null;
    try {
      result = text ? JSON.parse(text) : null;
    } catch {
      result = null;
    }

    console.log('[searchRoutes] após parse JSON', result);

    if (!response.ok) {
      throw Object.assign(new Error('Erro ao buscar rotas'), { status: httpStatus });
    }

    return result;
  } catch (error) {
    console.error('[searchRoutes] catch', error);
    throw error;
  }
}
