// deno-lint-ignore-file no-explicit-any
import { assertEquals } from 'jsr:@std/assert@1';
import { createFakeSupabase, op, quiet } from '../_shared/fakeSupabase.ts';
import { chunk, createHandler, STATUS_MAP } from './handler.ts';

const COMP = { id: 'comp-uuid', name: 'LaLiga', gender: 'male', scope: 'national', api_football_id: 140, api_football_season: 2025 };

const TEAMS = [
  { team: { id: 1, name: 'Betis', code: 'BET', logo: 'b.png' } },
  { team: { id: 2, name: 'Sevilla', code: null, logo: null } },
];

const fixture = (o: any = {}) => ({
  fixture: { id: 1001, date: '2026-03-14T20:00:00+00:00', venue: { name: 'Villamarín' }, status: { short: 'NS' } },
  league: { round: 'Regular Season - 27', group: undefined },
  teams: { home: { id: 1, name: 'Betis' }, away: { id: 2, name: 'Sevilla' } },
  goals: { home: null, away: null },
  ...o,
});

function setup({
  competitions = [COMP] as any[],
  fixtures = [fixture()] as any[],
  apiErrors = null as any,
  secret = 'cron-secret',
} = {}) {
  const fake = createFakeSupabase({
    rpc: (fn) => (fn === 'get_cron_secret' ? { data: secret } : {}),
    respond: (c) => {
      if (c.table === 'competitions') return { data: competitions };
      if (c.table === 'teams') {
        const rows = op(c, 'upsert')!.args[0];
        return { data: rows.map((r: any) => ({ id: `uuid-${r.api_football_id}`, api_football_id: r.api_football_id })) };
      }
      return { data: null };
    },
  });
  const requested: string[] = [];
  const fetchMock = (async (url: string, init: any) => {
    requested.push(url);
    assertEquals(init.headers['x-apisports-key'], 'api-key');
    const response = url.includes('/teams') ? TEAMS : fixtures;
    return new Response(JSON.stringify({ errors: apiErrors ?? [], response }));
  }) as any;
  const handler = createHandler({ supabase: fake.client, fetch: fetchMock, apiKey: 'api-key', sleep: async () => {} });
  return { ...fake, handler, requested };
}

const req = (secret = 'cron-secret', query = '') =>
  new Request(`http://localhost/sync-football${query}`, { method: 'POST', headers: { 'x-cron-secret': secret } });

const matchRows = (calls: any[]) => {
  const upsert = calls.find((c) => c.table === 'matches')!;
  return op(upsert, 'upsert')!.args[0];
};

Deno.test('chunk y STATUS_MAP', () => {
  assertEquals(chunk([1, 2, 3], 2), [[1, 2], [3]]);
  assertEquals(STATUS_MAP['FT'], 'finished');
  assertEquals(STATUS_MAP['1H'], 'live');
  assertEquals(STATUS_MAP['PST'], 'postponed');
});

Deno.test('401 sin el secreto del cron', async () => {
  const { handler, requested } = setup();
  assertEquals((await quiet(() => handler(req('mal')))).status, 401);
  assertEquals(requested.length, 0);
});

Deno.test('sincroniza equipos y partidos de la temporada de la competición', async () => {
  const { handler, calls, requested } = setup();
  const res = await quiet(() => handler(req()));
  assertEquals(res.status, 200);
  assertEquals(requested, [
    'https://v3.football.api-sports.io/teams?league=140&season=2025',
    'https://v3.football.api-sports.io/fixtures?league=140&season=2025',
  ]);

  const teamUpsert = calls.find((c) => c.table === 'teams')!;
  assertEquals(op(teamUpsert, 'upsert')!.args[0][0], {
    name: 'Betis', short_name: 'BET', logo_url: 'b.png', gender: 'male', api_football_id: 1,
  });

  const [m] = matchRows(calls);
  assertEquals(m.home_team_id, 'uuid-1');
  assertEquals(m.away_team_id, 'uuid-2');
  assertEquals(m.season, '2025/2026');
  assertEquals(m.matchday, 27);
  assertEquals(m.status, 'scheduled');
  assertEquals(m.stadium, 'Villamarín');
  assertEquals(m.api_football_fixture_id, 1001);
  assertEquals(m.date, '2026-03-14');
  assertEquals(m.time, '21:00'); // 20:00 UTC = 21:00 Madrid (CET)
});

Deno.test('date y time están ambos en hora de Madrid (partidos de madrugada, p.ej. Mundial en América)', async () => {
  // 22:30 UTC del 3 de julio = 00:30 del 4 de julio en Madrid (CEST)
  const { handler, calls } = setup({
    fixtures: [fixture({ fixture: { id: 7, date: '2026-07-03T22:30:00+00:00', status: { short: 'NS' } } })],
  });
  await quiet(() => handler(req()));
  const [m] = matchRows(calls);
  assertEquals(m.time, '00:30');
  assertEquals(m.date, '2026-07-04');
});

Deno.test('competiciones de ámbito mundial usan temporada de un solo año', async () => {
  const { handler, calls } = setup({ competitions: [{ ...COMP, scope: 'world', api_football_season: 2026 }] });
  await quiet(() => handler(req()));
  assertEquals(matchRows(calls)[0].season, '2026');
});

Deno.test('omite partidos con equipos desconocidos', async () => {
  const { handler, calls } = setup({
    fixtures: [fixture(), fixture({ fixture: { id: 2, date: '2026-03-14T20:00:00Z', status: { short: 'FT' } }, teams: { home: { id: 1 }, away: { id: 999 } } })],
  });
  const res = await quiet(() => handler(req()));
  const { results } = await res.json();
  assertEquals(matchRows(calls).length, 1);
  assertEquals(results[0].fixtures_skipped, 1);
});

Deno.test('un error de la API (p.ej. temporada no permitida en el plan free) se reporta por competición', async () => {
  const { handler } = setup({ apiErrors: { plan: 'Free plans do not have access to this season' } });
  const res = await quiet(() => handler(req()));
  assertEquals(res.status, 200);
  const { results } = await res.json();
  assertEquals(results[0].error.includes('Free plans'), true);
});

Deno.test('?leagueId filtra la competición', async () => {
  const { handler, calls } = setup();
  await quiet(() => handler(req('cron-secret', '?leagueId=140')));
  const comp = calls.find((c) => c.table === 'competitions')!;
  assertEquals(op(comp, 'eq')!.args, ['api_football_id', 140]);
});

Deno.test('400 si no hay competiciones configuradas', async () => {
  const { handler } = setup({ competitions: [] });
  assertEquals((await quiet(() => handler(req()))).status, 400);
});
