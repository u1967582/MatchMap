// ============================================================
// supabase/functions/send-match-notifications/index.ts
// ============================================================
// Edge Function que revisa qué usuarios tienen a su equipo favorito
// jugando dentro de las próximas ~2 horas y les envía un push
// personalizado invitándoles a buscar un bar donde verlo.
//
// Pensada para dispararse cada 15 minutos vía GitHub Actions
// (.github/workflows/notify-favorite-team-matches.yml), igual que
// sync-football. El dedupe real de envíos vive en la tabla
// match_notifications_sent (unique user_id+match_id), así que es seguro
// que el cron corra más de una vez dentro de la ventana de la RPC.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPA_URL = Deno.env.get('SUPABASE_URL')!
const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPA_URL, SUPA_KEY)

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send'
const EXPO_PUSH_CHUNK_SIZE = 100

interface PendingRow {
  user_id: string
  match_id: string
  push_token_id: string
  expo_push_token: string
  favorite_team_id: string
  favorite_team_name: string
  opponent_name: string
  is_home: boolean
  datetime_utc: string
  competition_name: string
}

interface ExpoMessage {
  to: string
  title: string
  body: string
  sound: string
  channelId: string
  data: { matchId: string; type: 'favorite_team_match' }
}

interface ExpoTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

// ── Copy: variantes con tono de hincha, no corporativo ──────────
const COPY_VARIANTS: Array<
  (ctx: { team: string; opponent: string; time: string }) => { title: string; body: string }
> = [
  (c) => ({
    title: `¡El ${c.team} juega en 2 horas! ⚽`,
    body: 'Todavía estás a tiempo de encontrar un bar con ambiente para verlo. Échale un vistazo al mapa.',
  }),
  (c) => ({
    title: `${c.team} vs ${c.opponent} en 2 horas`,
    body: '¿Ya sabes dónde lo vas a ver? Mira qué bares cerca de ti lo están dando.',
  }),
  (c) => ({
    title: `Faltan 2 horas para el ${c.team} ⏰`,
    body: 'Busca un sitio con buen ambiente antes de que se llenen las mesas.',
  }),
  (c) => ({
    title: 'Hoy juega tu equipo 🔴',
    body: `El ${c.team} sale a las ${c.time}. Encuentra el bar perfecto para verlo con la peña.`,
  }),
  (c) => ({
    title: `${c.team} en 2 horas, ¿dónde lo vas a ver?`,
    body: 'Todavía puedes hacerte con sitio en uno de los bares que lo emiten cerca de ti.',
  }),
]

function pickCopy(row: PendingRow): { title: string; body: string } {
  const time = new Date(row.datetime_utc).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  })

  const ctx = { team: row.favorite_team_name, opponent: row.opponent_name, time }
  const variant = COPY_VARIANTS[Math.floor(Math.random() * COPY_VARIANTS.length)]
  return variant(ctx)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

async function sendExpoPushChunk(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const res = await fetch(EXPO_PUSH_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  })

  if (!res.ok) {
    throw new Error(`Expo Push API HTTP ${res.status}`)
  }

  const json = await res.json()
  return (json.data ?? []) as ExpoTicket[]
}

Deno.serve(async (_req) => {
  try {
    console.log('=== send-match-notifications START ===')

    const { data: rows, error: rpcError } = await supabase.rpc(
      'fn_get_pending_match_notifications'
    )

    if (rpcError) {
      throw new Error(`Error en fn_get_pending_match_notifications: ${rpcError.message}`)
    }

    const pending = (rows ?? []) as PendingRow[]

    if (pending.length === 0) {
      console.log('Sin notificaciones pendientes.')
      return new Response(
        JSON.stringify({
          success: true,
          results: { matches: 0, users_notified: 0, push_messages_sent: 0, tokens_removed: 0 },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Agrupar por (user_id, match_id): un usuario puede tener varios
    // dispositivos/tokens, pero solo debe marcarse una vez en
    // match_notifications_sent.
    const groups = new Map<string, PendingRow[]>()
    for (const row of pending) {
      const key = `${row.user_id}::${row.match_id}`
      const list = groups.get(key) ?? []
      list.push(row)
      groups.set(key, list)
    }

    const messages: ExpoMessage[] = []
    // Mapea el índice del mensaje dentro de `messages` a su fila de origen,
    // para poder resolver el ticket correspondiente tras el envío.
    const messageRows: PendingRow[] = []

    for (const groupRows of groups.values()) {
      const { title, body } = pickCopy(groupRows[0])
      for (const row of groupRows) {
        messages.push({
          to: row.expo_push_token,
          title,
          body,
          sound: 'default',
          channelId: 'default',
          data: { matchId: row.match_id, type: 'favorite_team_match' },
        })
        messageRows.push(row)
      }
    }

    const messageChunks = chunk(messages, EXPO_PUSH_CHUNK_SIZE)
    const rowChunks = chunk(messageRows, EXPO_PUSH_CHUNK_SIZE)

    let pushMessagesSent = 0
    let tokensRemoved = 0
    const notifiedPairs = new Set<string>()

    for (let i = 0; i < messageChunks.length; i++) {
      const msgs = messageChunks[i]
      const rowsForChunk = rowChunks[i]

      let tickets: ExpoTicket[]
      try {
        tickets = await sendExpoPushChunk(msgs)
      } catch (err: any) {
        console.error(`Error enviando chunk ${i}: ${err.message}`)
        // No marcamos estos pares como notificados: el próximo cron
        // (15 min después) reintenta dentro de la ventana de 30 min.
        continue
      }

      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j]
        const row = rowsForChunk[j]

        if (ticket.status === 'ok') {
          pushMessagesSent++
          notifiedPairs.add(`${row.user_id}::${row.match_id}`)
        } else {
          console.error(
            `Ticket error para token ${row.expo_push_token}: ${ticket.message ?? 'unknown'}`
          )
          if (ticket.details?.error === 'DeviceNotRegistered') {
            const { error: delError } = await supabase
              .from('push_tokens')
              .delete()
              .eq('id', row.push_token_id)
            if (!delError) tokensRemoved++
          }
          // Aunque falle el envío a este token concreto, si el resto de
          // tokens del mismo usuario+partido sí funcionaron, el par ya
          // quedará marcado por esos. Si TODOS los tokens de este par
          // fallan, no se marca aquí, así que el próximo cron reintenta.
        }
      }
    }

    const sentRows = [...notifiedPairs].map((key) => {
      const [user_id, match_id] = key.split('::')
      return { user_id, match_id }
    })

    if (sentRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('match_notifications_sent')
        .upsert(sentRows, { onConflict: 'user_id,match_id', ignoreDuplicates: true })

      if (upsertError) {
        console.error(`Error marcando match_notifications_sent: ${upsertError.message}`)
      }
    }

    const results = {
      matches: new Set(pending.map((r) => r.match_id)).size,
      users_notified: notifiedPairs.size,
      push_messages_sent: pushMessagesSent,
      tokens_removed: tokensRemoved,
    }

    console.log('=== send-match-notifications END ===')
    console.log(JSON.stringify(results, null, 2))

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Fatal:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
