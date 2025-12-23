import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';

interface SupportTicket {
  id: string;
  user_id: string | null;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS = {
  open: '#EF4444',
  in_progress: '#F59E0B',
  resolved: '#10B981',
  closed: '#6B7280',
};

const STATUS_LABELS = {
  open: 'Abierto',
  in_progress: 'En Progreso',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Error Técnico',
  billing: 'Facturación',
  feature_request: 'Sugerencia',
  account: 'Cuenta',
  other: 'Otro',
};

const CATEGORY_ICONS: Record<string, string> = {
  bug: 'bug-outline',
  billing: 'card-outline',
  feature_request: 'bulb-outline',
  account: 'person-outline',
  other: 'chatbubbles-outline',
};

export default function SupportAdminScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set());

  const fetchTickets = useCallback(async () => {
    try {
      console.log('📋 Fetching support tickets...');
      
      let query = supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filter
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching tickets:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} tickets`);
      setTickets(data || []);
    } catch (error: any) {
      console.error('❌ Error:', error);
      Alert.alert('Error', 'No se pudieron cargar los tickets de soporte');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: SupportTicket['status']) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: newStatus })
        .eq('id', ticketId);

      if (error) throw error;

      // Update local state
      setTickets(prevTickets =>
        prevTickets.map(ticket =>
          ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
        )
      );

      Alert.alert('✓ Actualizado', 'Estado del ticket actualizado correctamente');
    } catch (error) {
      console.error('❌ Error updating ticket:', error);
      Alert.alert('Error', 'No se pudo actualizar el ticket');
    }
  };

  const renderStatusOptions = (ticket: SupportTicket) => {
    const statuses: SupportTicket['status'][] = ['open', 'in_progress', 'resolved', 'closed'];
    
    return (
      <View style={styles.statusOptions}>
        {statuses.map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.statusOption,
              ticket.status === status && styles.statusOptionActive,
              { backgroundColor: STATUS_COLORS[status] + '20' },
            ]}
            onPress={() => handleUpdateStatus(ticket.id, status)}
          >
            <Text
              style={[
                styles.statusOptionText,
                ticket.status === status && { color: STATUS_COLORS[status] },
              ]}
            >
              {STATUS_LABELS[status]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const toggleExpanded = (ticketId: string) => {
    setExpandedTickets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  };

  const renderTicket = ({ item }: { item: SupportTicket }) => {
    const isExpanded = expandedTickets.has(item.id);

    return (
      <View style={styles.ticketCard}>
        <TouchableOpacity
          style={styles.ticketHeader}
          onPress={() => toggleExpanded(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.ticketHeaderLeft}>
            <Ionicons
              name={CATEGORY_ICONS[item.category] as any}
              size={20}
              color="#1976D2"
            />
            <View style={styles.ticketHeaderText}>
              <Text style={styles.ticketSubject} numberOfLines={1}>
                {item.subject}
              </Text>
              <Text style={styles.ticketMeta}>
                {CATEGORY_LABELS[item.category] || item.category} • {item.email}
              </Text>
            </View>
          </View>
          <View style={styles.ticketHeaderRight}>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
              <Text style={styles.statusBadgeText}>{STATUS_LABELS[item.status]}</Text>
            </View>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#A3B3CC"
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.ticketBody}>
            <View style={styles.ticketSection}>
              <Text style={styles.ticketLabel}>Mensaje:</Text>
              <Text style={styles.ticketMessage}>{item.message}</Text>
            </View>

            <View style={styles.ticketSection}>
              <Text style={styles.ticketLabel}>Fecha de Creación:</Text>
              <Text style={styles.ticketValue}>
                {new Date(item.created_at).toLocaleString('es-ES', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Text>
            </View>

            {item.user_id && (
              <View style={styles.ticketSection}>
                <Text style={styles.ticketLabel}>User ID:</Text>
                <Text style={styles.ticketValue} numberOfLines={1}>
                  {item.user_id}
                </Text>
              </View>
            )}

            <View style={styles.ticketSection}>
              <Text style={styles.ticketLabel}>Cambiar Estado:</Text>
              {renderStatusOptions(item)}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.filterContainer}>
      {(['all', 'open', 'in_progress', 'resolved'] as const).map((filterOption) => (
        <TouchableOpacity
          key={filterOption}
          style={[styles.filterButton, filter === filterOption && styles.filterButtonActive]}
          onPress={() => setFilter(filterOption)}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === filterOption && styles.filterButtonTextActive,
            ]}
          >
            {filterOption === 'all' ? 'Todos' : STATUS_LABELS[filterOption]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tickets de Soporte</Text>
        <TouchableOpacity onPress={fetchTickets} style={styles.refreshButton}>
          <Ionicons name="reload" size={22} color="#1976D2" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={tickets}
        renderItem={renderTicket}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#6B7280" />
            <Text style={styles.emptyText}>No hay tickets</Text>
            <Text style={styles.emptySubtext}>
              {filter !== 'all' ? 'Cambia el filtro para ver más' : 'No hay tickets de soporte'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1976D2" />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3A4A',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    backgroundColor: '#2A3A4A',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#1976D2',
  },
  filterButtonText: {
    color: '#A3B3CC',
    fontSize: 13,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  ticketCard: {
    backgroundColor: '#2A3A4A',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  ticketHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  ticketHeaderText: {
    flex: 1,
  },
  ticketSubject: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  ticketMeta: {
    color: '#A3B3CC',
    fontSize: 12,
  },
  ticketHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  ticketBody: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#1C2A3A',
  },
  ticketSection: {
    marginBottom: 16,
  },
  ticketLabel: {
    color: '#A3B3CC',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  ticketMessage: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 20,
  },
  ticketValue: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusOptionActive: {
    borderWidth: 2,
  },
  statusOptionText: {
    color: '#A3B3CC',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 8,
  },
});

