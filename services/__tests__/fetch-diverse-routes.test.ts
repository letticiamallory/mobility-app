jest.mock('../../constants/api', () => ({
  API_URL: 'http://127.0.0.1:3000',
}));

jest.mock('../token.service', () => ({
  getToken: jest.fn().mockResolvedValue('mock-token'),
}));

jest.mock('../routes.service', () => ({
  searchRoutes: jest.fn(),
}));

import { searchRoutes } from '../routes.service';
import { fetchDiverseRoutes } from '../fetch-diverse-routes';

const searchRoutesMock = searchRoutes as jest.MockedFunction<typeof searchRoutes>;

describe('fetchDiverseRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deduplica rotas com a mesma assinatura (modo + linha + parada)', async () => {
    const sameRoute = {
      total_duration: '10 min',
      total_distance: '1 km',
      stages: [{ mode: 'bus', line_code: '100', stop_name: 'A' }],
    };
    searchRoutesMock.mockResolvedValue({
      route: { id: 1 },
      routes: [sameRoute],
    });

    const out = await fetchDiverseRoutes('Origem', 'Dest', 1, 'alone');
    expect(out).toHaveLength(1);
    expect(searchRoutesMock.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('faz fallback para bus quando nenhum transporte retorna rotas', async () => {
    const fallback = {
      total_duration: '5 min',
      stages: [{ mode: 'walk' }],
    };
    let n = 0;
    searchRoutesMock.mockImplementation(async () => {
      n += 1;
      if (n === 5) {
        return { route: { id: 1 }, routes: [fallback] };
      }
      return { route: { id: 1 }, routes: [] };
    });

    const out = await fetchDiverseRoutes('O', 'D', 2, 'companied');
    expect(out).toEqual([fallback]);
    expect(n).toBe(5);
  });

  it('repassa accompanied, time_filter e route_preference ao searchRoutes', async () => {
    searchRoutesMock.mockResolvedValue({ route: { id: 1 }, routes: [] });
    await fetchDiverseRoutes('A', 'B', 3, 'alone', 'set_departure_time', '08:00', 'less_walking');
    const first = searchRoutesMock.mock.calls[0];
    expect(first[4]).toBe('alone');
    expect(first[5]).toBe('set_departure_time');
    expect(first[6]).toBe('08:00');
    expect(first[7]).toBe('less_walking');
  });

  it('ignora lotes rejeitados no Promise.allSettled sem lançar', async () => {
    searchRoutesMock.mockImplementation(async (_o, _d, _u, type: string) => {
      if (type === 'subway') {
        throw new Error('rede fora');
      }
      return { route: { id: 1 }, routes: [{ total_duration: '1 min', stages: [{ mode: 'bus' }] }] };
    });
    const out = await fetchDiverseRoutes('O', 'D', 1, 'alone');
    expect(out.length).toBeGreaterThanOrEqual(1);
  });

  it('payload sem routes[] tratado como vazio no merge', async () => {
    searchRoutesMock.mockResolvedValue({ route: { id: 1 } });
    let out = await fetchDiverseRoutes('O', 'D', 1, 'alone');
    expect(out).toEqual([]);
    searchRoutesMock.mockResolvedValue({ routes: null });
    out = await fetchDiverseRoutes('O', 'D', 1, 'alone');
    expect(out).toEqual([]);
  });

  it('dedup mantém primeira ocorrência da assinatura', async () => {
    const dup = { total_duration: '5 min', total_distance: '1 km', stages: [{ mode: 'bus', line_code: '1' }] };
    let n = 0;
    searchRoutesMock.mockImplementation(async () => {
      n += 1;
      return { routes: [dup, dup] };
    });
    const out = await fetchDiverseRoutes('O', 'D', 1, 'alone');
    expect(out).toHaveLength(1);
    expect(n).toBeGreaterThanOrEqual(1);
  });
});
