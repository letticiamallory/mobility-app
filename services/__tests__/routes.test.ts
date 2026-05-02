jest.mock('../../constants/api', () => ({
  API_URL: 'http://127.0.0.1:3000',
}));

jest.mock('../token.service', () => ({
  getToken: jest.fn().mockResolvedValue('mock-token'),
}));

import { searchRoutes } from '../routes.service';

global.fetch = jest.fn() as jest.Mock;

describe('searchRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve enviar accompanied corretamente', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          route: { id: 1 },
          routes: [
            { total_duration: '10 minutos', accessible: true, stages: [] },
          ],
        }),
    });

    await searchRoutes(
      'Ibituruna',
      'Shopping',
      1,
      'bus',
      'alone',
    );

    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody.accompanied).toBe('alone');
  });

  it('deve retornar rotas quando API responde com sucesso', async () => {
    const mockRoutes = [
      { total_duration: '10 minutos', accessible: true, stages: [] },
      { total_duration: '15 minutos', accessible: false, stages: [] },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ route: { id: 1 }, routes: mockRoutes }),
    });

    const result = (await searchRoutes(
      'Ibituruna',
      'Shopping',
      1,
      'bus',
    )) as { routes: Array<{ accessible: boolean }> };

    expect(result.routes).toHaveLength(2);
    expect(result.routes[0].accessible).toBe(true);
  });

  it('deve lançar erro quando API falha', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ message: 'Erro interno' }),
    });

    await expect(
      searchRoutes('Ibituruna', 'Shopping', 1, 'bus'),
    ).rejects.toThrow('Erro ao buscar rotas');
  });
});
