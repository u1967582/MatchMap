// ============================================================
// PASO 3: supabase/functions/sync-football/index.ts
// ============================================================
// Edge Function que sincroniza equipos y partidos desde
// API-Football hacia tu Supabase.
//
// CÓMO CREAR ESTE ARCHIVO:
//   1. Desde la raíz de tu proyecto ejecuta:
//      supabase functions new sync-football
//   2. Abre supabase/functions/sync-football/index.ts
//   3. Reemplaza TODO el contenido con este código
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Variables de entorno ─────────────────────────────────────
// Estas se configuran en el PASO 4, no las pongas aquí en duro
const API_KEY  = Deno.env.get('API_FOOTBALL_KEY')!
const SUPA_URL = Deno.env.get('SUPABASE_URL')!
const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const SEASON = '2025'  // ← año de inicio de la temporada actual

const supabase = createClient(SUPA_URL, SUPA_KEY)

// ── Mapeo de status API-Football → tu esquema ────────────────
// Valores confirmados de la documentación de API-Football v3
const STATUS_MAP: Record<string, string> = {
  'NS':   'scheduled',   // Not Started
  'TBD':  'scheduled',   // Time To Be Defined
  '1H':   'live',        // First Half
  'HT':   'live',        // Half Time
  '2H':   'live',        // Second Half
  'ET':   'live',        // Extra Time
  'BT':   'live',        // Break Time
  'P':    'live',        // Penalty in progress
  'SUSP': 'postponed',   // Suspended
  'INT':  'live',        // Interrupted
  'FT':   'finished',    // Full Time
  'AET':  'finished',    // After Extra Time
  'PEN':  'finished',    // After Penalties
  'PST':  'postponed',   // Postponed
  'CANC': 'cancelled',   // Cancelled
  'ABD':  'cancelled',   // Abandoned
  'AWD':  'finished',    // Technical Loss
  'WO':   'finished',    // WalkOver
  'LIVE': 'live',        // In Progress (genérico)
}

// ── Helper: llamada a la API-Football ───────────────────────
async function apiFetch(path: string) {
  const url = `https://v3.football.api-sports.io${path}`

  const res = await fetch(url, {
    headers: { 'x-apisports-key': API_KEY },
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${path}`)
  }

  const json = await res.json()

  // API-Football devuelve errores dentro del JSON aunque HTTP sea 200
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API error: ${JSON.stringify(json.errors)}`)
  }

  return json.response as any[]
}

// ── Sincronizar equipos de una liga ─────────────────────────
async function syncTeams(leagueId: number, gender: string): Promise<number> {
  console.log(`[teams] league=${leagueId} gender=${gender}`)

  const response = await apiFetch(`/teams?league=${leagueId}&season=${SEASON}`)

  if (!response?.length) {
    console.warn(`[teams] No results for league ${leagueId}`)
    return 0
  }

  let count = 0
  for (const item of response) {
    const t = item.team

    const { error } = await supabase
      .from('teams')
      .upsert(
        {
          name:            t.name,
          short_name:      t.code ?? null,
          logo_url:        t.logo ?? null,
          gender:          gender,
          api_football_id: t.id,
          // created_at lo gestiona Supabase automáticamente
        },
        { onConflict: 'api_football_id' }
      )

    if (error) {
      console.error(`[teams] Error team ${t.name} (${t.id}): ${error.message}`)
    } else {
      count++
    }
  }

  console.log(`[teams] ✅ league=${leagueId}: ${count}/${response.length} ok`)
  return count
}

// ── Sincronizar partidos de una liga ────────────────────────
async function syncFixtures(
  leagueId: number,
  competitionUUID: string,
  competitionName: string
): Promise<{ synced: number; skipped: number }> {
  console.log(`[fixtures] league=${leagueId}`)

  const response = await apiFetch(`/fixtures?league=${leagueId}&season=${SEASON}`)

  if (!response?.length) {
    console.warn(`[fixtures] No results for league ${leagueId}`)
    return { synced: 0, skipped: 0 }
  }

  let synced = 0
  let skipped = 0

  for (const item of response) {
    const { fixture, league, teams, goals } = item

    // Buscar los UUID de los equipos en tu base de datos
    // usando el api_football_id que syncTeams ya habrá insertado
    const { data: homeTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('api_football_id', teams.home.id)
      .maybeSingle()

    const { data: awayTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('api_football_id', teams.away.id)
      .maybeSingle()

    if (!homeTeam || !awayTeam) {
      // Puede pasar en fases previas (rondas de clasificación con equipos
      // de otras ligas). No es un error crítico, solo se omite.
      console.warn(
        `[fixtures] Teams not found for fixture ${fixture.id}: ` +
        `home=${teams.home.name}(${teams.home.id}) ` +
        `away=${teams.away.name}(${teams.away.id})`
      )
      skipped++
      continue
    }

    // Parsear la fecha que devuelve la API (ISO 8601 con timezone)
    // Ejemplo: "2025-09-20T20:00:00+02:00"
    const fixtureDate = new Date(fixture.date)

    // date → YYYY-MM-DD (tu columna es tipo date)
    const dateStr = fixtureDate.toISOString().split('T')[0]

    // time → HH:MM en hora de Madrid (tu columna es tipo time)
    const timeStr = fixtureDate.toLocaleTimeString('es-ES', {
      hour:     '2-digit',
      minute:   '2-digit',
      timeZone: 'Europe/Madrid',
    })

    // matchday: API-Football devuelve strings como "Regular Season - 5"
    // o "Group Stage - 1". Extraemos el número del final.
    const roundStr   = league.round ?? ''
    const roundMatch = roundStr.match(/(\d+)\s*$/)
    const matchday   = roundMatch ? parseInt(roundMatch[1]) : null

    const { error } = await supabase
      .from('matches')
      .upsert(
        {
          competition_id:           competitionUUID,
          old_competition:          competitionName,
          season:                   `${SEASON}/${parseInt(SEASON) + 1}`,
          matchday:                 matchday,
          date:                     dateStr,
          time:                     timeStr,
          datetime_utc:             fixture.date,          // timestamptz
          home_team_id:             homeTeam.id,
          away_team_id:             awayTeam.id,
          home_score:               goals?.home ?? null,
          away_score:               goals?.away ?? null,
          stadium:                  fixture.venue?.name ?? null,
          status:                   STATUS_MAP[fixture.status?.short] ?? 'scheduled',
          api_football_fixture_id:  fixture.id,
          // created_at lo gestiona Supabase automáticamente
        },
        { onConflict: 'api_football_fixture_id' }
      )

    if (error) {
      console.error(`[fixtures] Error fixture ${fixture.id}: ${error.message}`)
      skipped++
    } else {
      synced++
    }
  }

  console.log(
    `[fixtures] ✅ league=${leagueId}: ${synced} synced, ${skipped} skipped`
  )
  return { synced, skipped }
}

// ── Handler principal ────────────────────────────────────────
Deno.serve(async (_req) => {
  try {
    console.log('=== sync-football START ===')

    // Obtener solo las competiciones que tienen api_football_id asignado
    // (las que configuraste en el PASO 2)
    const { data: competitions, error: compError } = await supabase
      .from('competitions')
      .select('id, name, gender, api_football_id')
      .not('api_football_id', 'is', null)

    if (compError) {
      throw new Error(`Error fetching competitions: ${compError.message}`)
    }

    if (!competitions?.length) {
      return new Response(
        JSON.stringify({
          error: 'No competitions with api_football_id found. Run PASO 2 SQL first.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Competitions to sync: ${competitions.length}`)

    const results = []

    for (const comp of competitions) {
      const gender = comp.gender === 'female' ? 'female' : 'male'

      try {
        // 1. Primero los equipos (fixtures dependen de que existan)
        const teamsCount = await syncTeams(comp.api_football_id, gender)

        // Pausa corta para no golpear la API
        await new Promise((r) => setTimeout(r, 600))

        // 2. Luego los partidos
        const { synced, skipped } = await syncFixtures(
          comp.api_football_id,
          comp.id,
          comp.name
        )

        results.push({
          competition: comp.name,
          api_football_id: comp.api_football_id,
          teams: teamsCount,
          fixtures_synced: synced,
          fixtures_skipped: skipped,
        })

        // Pausa entre competiciones (respetar rate limit free tier)
        await new Promise((r) => setTimeout(r, 1200))

      } catch (err: any) {
        console.error(`Error on ${comp.name}: ${err.message}`)
        results.push({
          competition: comp.name,
          api_football_id: comp.api_football_id,
          error: err.message,
        })
        // Continúa con la siguiente competición aunque falle una
      }
    }

    console.log('=== sync-football END ===')
    console.log(JSON.stringify(results, null, 2))

    return new Response(
      JSON.stringify({ success: true, season: SEASON, results }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('Fatal:', err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})