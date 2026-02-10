#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const server = new Server(
  {
    name: 'matchmap-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Lista de herramientas disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_active_boosts',
      description: 'Obtiene todos los boosts activos con información de los bares',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'validate_bar_setup',
      description: 'Valida que un bar tenga toda la información necesaria',
      inputSchema: {
        type: 'object',
        properties: {
          bar_id: {
            type: 'string',
            description: 'UUID del bar a validar',
          },
        },
        required: ['bar_id'],
      },
    },
    {
      name: 'get_user_favorites',
      description: 'Obtiene los bares favoritos de un usuario',
      inputSchema: {
        type: 'object',
        properties: {
          user_id: {
            type: 'string',
            description: 'UUID del usuario',
          },
        },
        required: ['user_id'],
      },
    },
    {
      name: 'get_upcoming_matches',
      description: 'Obtiene los próximos partidos con eventos en bares',
      inputSchema: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Número de días a futuro (default: 7)',
            default: 7,
          },
          competition_id: {
            type: 'string',
            description: 'Filtrar por competición (opcional)',
          },
        },
      },
    },
    {
      name: 'analyze_bar_performance',
      description: 'Analiza el rendimiento de un bar (reviews, favoritos, boosts)',
      inputSchema: {
        type: 'object',
        properties: {
          bar_id: {
            type: 'string',
            description: 'UUID del bar',
          },
        },
        required: ['bar_id'],
      },
    },
    {
      name: 'check_rls_policies',
      description: 'Verifica que las políticas RLS estén correctamente configuradas',
      inputSchema: {
        type: 'object',
        properties: {
          table_name: {
            type: 'string',
            description: 'Nombre de la tabla a verificar',
          },
        },
        required: ['table_name'],
      },
    },
  ],
}));

// Implementación de herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_active_boosts': {
        const { data, error } = await supabase
          .from('bar_boosts')
          .select(`
            *,
            bars (
              id,
              name,
              city,
              rating,
              review_count
            ),
            users (
              id,
              username
            )
          `)
          .eq('status', 'active')
          .gte('end_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total: data.length,
                boosts: data,
              }, null, 2),
            },
          ],
        };
      }

      case 'validate_bar_setup': {
        const { bar_id } = args;

        const [bar, images, menu, teams, competitions, features] = await Promise.all([
          supabase.from('bars').select('*').eq('id', bar_id).single(),
          supabase.from('bar_images').select('id').eq('bar_id', bar_id),
          supabase.from('bar_menus').select('id').eq('bar_id', bar_id),
          supabase.from('bar_selected_teams').select('id').eq('bar_id', bar_id),
          supabase.from('bar_selected_competitions').select('id').eq('bar_id', bar_id),
          supabase.from('bar_selected_features').select('id').eq('bar_id', bar_id),
        ]);

        const validation = {
          basic_info: {
            complete: !!(bar.data?.name && bar.data?.description && bar.data?.phone),
            missing: [],
          },
          images: {
            has_profile: !!bar.data?.profile_image_url,
            has_cover: !!bar.data?.cover_image_url,
            gallery_count: images.data?.length || 0,
          },
          menu: {
            has_menu: (menu.data?.length || 0) > 0,
            count: menu.data?.length || 0,
          },
          sports: {
            has_teams: (teams.data?.length || 0) > 0,
            teams_count: teams.data?.length || 0,
            has_competitions: (competitions.data?.length || 0) > 0,
            competitions_count: competitions.data?.length || 0,
          },
          features: {
            has_features: (features.data?.length || 0) > 0,
            features_count: features.data?.length || 0,
          },
        };

        if (!bar.data?.name) validation.basic_info.missing.push('name');
        if (!bar.data?.description) validation.basic_info.missing.push('description');
        if (!bar.data?.phone) validation.basic_info.missing.push('phone');

        const completeness = [
          validation.basic_info.complete,
          validation.images.has_profile,
          validation.images.has_cover,
          validation.menu.has_menu,
          validation.sports.has_teams,
          validation.sports.has_competitions,
          validation.features.has_features,
        ].filter(Boolean).length / 7 * 100;

        return {
          content: [
            {
              type: 'text',
              text: `Bar Setup Completeness: ${completeness.toFixed(0)}%\n\n${JSON.stringify(validation, null, 2)}`,
            },
          ],
        };
      }

      case 'get_user_favorites': {
        const { user_id } = args;

        const { data, error } = await supabase
          .from('favorites')
          .select(`
            id,
            created_at,
            bars (
              id,
              name,
              city,
              rating,
              review_count,
              profile_image_url
            )
          `)
          .eq('user_id', user_id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total: data.length,
                favorites: data,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_upcoming_matches': {
        const { days = 7, competition_id } = args;

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);

        let query = supabase
          .from('matches')
          .select(`
            *,
            home_team:teams!matches_home_team_id_fkey(id, name, logo_url),
            away_team:teams!matches_away_team_id_fkey(id, name, logo_url),
            competition:competitions(id, name),
            events(
              id,
              bar:bars(id, name, city)
            )
          `)
          .gte('date', new Date().toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0])
          .order('date', { ascending: true });

        if (competition_id) {
          query = query.eq('competition_id', competition_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total: data.length,
                matches_with_events: data.filter(m => m.events.length > 0).length,
                matches: data,
              }, null, 2),
            },
          ],
        };
      }

      case 'analyze_bar_performance': {
        const { bar_id } = args;

        const [bar, reviews, favorites, boosts] = await Promise.all([
          supabase.from('bars').select('*').eq('id', bar_id).single(),
          supabase.from('reviews').select('rating, created_at').eq('bar_id', bar_id),
          supabase.from('favorites').select('id').eq('bar_id', bar_id),
          supabase.from('bar_boosts').select('*').eq('bar_id', bar_id).order('created_at', { ascending: false }),
        ]);

        const analysis = {
          bar_info: {
            name: bar.data?.name,
            rating: bar.data?.rating,
            review_count: bar.data?.review_count,
            is_active: bar.data?.is_active,
          },
          reviews: {
            total: reviews.data?.length || 0,
            average_rating: reviews.data?.length
              ? (reviews.data.reduce((sum, r) => sum + r.rating, 0) / reviews.data.length).toFixed(2)
              : 0,
            recent_reviews: reviews.data?.slice(0, 5),
          },
          engagement: {
            favorites_count: favorites.data?.length || 0,
          },
          boosts: {
            total: boosts.data?.length || 0,
            active: boosts.data?.filter(b => b.status === 'active').length || 0,
            expired: boosts.data?.filter(b => b.status === 'expired').length || 0,
            current_boost: boosts.data?.find(b => b.status === 'active') || null,
          },
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(analysis, null, 2),
            },
          ],
        };
      }

      case 'check_rls_policies': {
        const { table_name } = args;

        const { data, error } = await supabase.rpc('get_rls_policies', {
          p_table_name: table_name
        });

        if (error) {
          // Si no existe la función, dar información básica
          const { data: policies } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', table_name);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  table: table_name,
                  note: 'Para análisis completo, crear función get_rls_policies en Supabase',
                  basic_info: policies,
                }, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                table: table_name,
                policies: data,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);

console.error('MatchMap MCP server running on stdio');
