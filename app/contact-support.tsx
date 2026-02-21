import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { AppText } from '~/components/ds';

type SupportCategory = 'technical' | 'account' | 'payment' | 'feature' | 'other';
type TabType = 'new' | 'my-tickets';

interface CategoryOption {
  id: SupportCategory;
  label: string;
  icon: string;
  description: string;
}

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

const CATEGORIES: CategoryOption[] = [
  {
    id: 'technical',
    label: 'Problema Técnico',
    icon: 'bug-outline',
    description: 'Errores, fallos o problemas de funcionamiento',
  },
  {
    id: 'account',
    label: 'Cuenta y Perfil',
    icon: 'person-outline',
    description: 'Gestión de cuenta, perfil o configuración',
  },
  {
    id: 'payment',
    label: 'Pagos y Boost',
    icon: 'card-outline',
    description: 'Facturación, suscripciones o boosts',
  },
  {
    id: 'feature',
    label: 'Sugerencia',
    icon: 'bulb-outline',
    description: 'Nueva funcionalidad o mejora',
  },
  {
    id: 'other',
    label: 'Otro',
    icon: 'chatbubbles-outline',
    description: 'Consulta general',
  },
];

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

export default function ContactSupportScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('my-tickets');
  
  // Form states
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Tickets states
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set());

  // Get user email on mount
  useEffect(() => {
    const getUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setEmail(user.email);
      }
    };
    getUserEmail();
  }, []);

  // Fetch tickets when tab changes to my-tickets
  useEffect(() => {
    if (activeTab === 'my-tickets') {
      fetchMyTickets();
    }
  }, [activeTab]);

  const fetchMyTickets = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTickets(data || []);
    } catch (error) {
      console.error('❌ Error fetching tickets:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyTickets();
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedCategory) {
      Alert.alert('Error', 'Por favor selecciona una categoría');
      return;
    }
    if (!subject.trim()) {
      Alert.alert('Error', 'Por favor ingresa un asunto');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Error', 'Por favor describe tu consulta');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu email');
      return;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Map frontend categories to backend-friendly values
      const categoryMap: Record<SupportCategory, string> = {
        technical: 'bug',
        account: 'account',
        payment: 'billing',
        feature: 'feature_request',
        other: 'other',
      };

      // Insert ticket into database
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user?.id || null,
          email: email.trim().toLowerCase(),
          category: categoryMap[selectedCategory],
          subject: subject.trim(),
          message: message.trim(),
          status: 'open',
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error inserting support ticket:', error);
        throw error;
      }

      console.log('✅ Support ticket created:', data);

      Alert.alert(
        '✓ Mensaje Enviado',
        'Hemos recibido tu consulta. Te responderemos lo antes posible a ' + email,
        [
          {
            text: 'OK',
            onPress: () => {
              // Clear form
              setSelectedCategory(null);
              setSubject('');
              setMessage('');
              // Switch to tickets tab
              setActiveTab('my-tickets');
              fetchMyTickets();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Error submitting support ticket:', error);
      
      // Provide specific error messages
      const errorMessage = error?.message || 'No se pudo enviar tu mensaje. Por favor intenta de nuevo.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Hace menos de 1 hora';
    } else if (diffInHours < 24) {
      return `Hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
    } else if (diffInHours < 48) {
      return 'Hace 1 día';
    } else if (diffInHours < 168) {
      return `Hace ${Math.floor(diffInHours / 24)} días`;
    } else {
      return date.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short', 
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
      });
    }
  };

  const getStatusMessage = (status: SupportTicket['status']) => {
    switch (status) {
      case 'open':
        return 'Tu ticket ha sido recibido y será revisado pronto';
      case 'in_progress':
        return 'Nuestro equipo está trabajando en tu consulta';
      case 'resolved':
        return 'Tu consulta ha sido resuelta';
      case 'closed':
        return 'Este ticket ha sido cerrado';
      default:
        return '';
    }
  };

  const renderTicket = ({ item }: { item: SupportTicket }) => {
    const isExpanded = expandedTickets.has(item.id);
    const messagePreview = item.message.length > 100 
      ? item.message.substring(0, 100) + '...' 
      : item.message;

    return (
      <View style={styles.ticketCard}>
        <TouchableOpacity
          style={styles.ticketHeader}
          onPress={() => toggleExpanded(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.ticketHeaderTop}>
            <View style={styles.ticketHeaderLeft}>
              <Ionicons
                name={CATEGORY_ICONS[item.category] as any}
                size={22}
                color="#1976D2"
              />
              <View style={styles.ticketHeaderText}>
                <AppText style={styles.ticketSubject} numberOfLines={1}>
                  {item.subject}
                </AppText>
                <AppText style={styles.ticketCategory}>
                  {CATEGORY_LABELS[item.category] || item.category}
                </AppText>
              </View>
            </View>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#A3B3CC"
            />
          </View>

          {/* Status Badge */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
              <View style={[styles.statusDot, { backgroundColor: '#FFFFFF' }]} />
              <AppText style={styles.statusBadgeText}>{STATUS_LABELS[item.status]}</AppText>
            </View>
            <AppText style={styles.ticketDate}>{formatDate(item.created_at)}</AppText>
          </View>

          {/* Message Preview */}
          {!isExpanded && (
            <AppText style={styles.messagePreview} numberOfLines={2}>
              {messagePreview}
            </AppText>
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.ticketBody}>
            {/* Status Message */}
            <View style={[styles.statusMessage, { backgroundColor: STATUS_COLORS[item.status] + '15' }]}>
              <Ionicons 
                name="information-circle" 
                size={20} 
                color={STATUS_COLORS[item.status]} 
              />
              <AppText style={[styles.statusMessageText, { color: STATUS_COLORS[item.status] }]}>
                {getStatusMessage(item.status)}
              </AppText>
            </View>

            {/* Full Message */}
            <View style={styles.ticketSection}>
              <AppText style={styles.ticketLabel}>Tu Consulta:</AppText>
              <AppText style={styles.ticketMessage}>{item.message}</AppText>
            </View>

            {/* Metadata */}
            <View style={styles.metadataRow}>
              <View style={styles.metadataItem}>
                <Ionicons name="mail-outline" size={16} color="#6B7280" />
                <AppText style={styles.metadataText}>{item.email}</AppText>
              </View>
              <View style={styles.metadataItem}>
                <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                <AppText style={styles.metadataText}>
                  {new Date(item.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </AppText>
              </View>
            </View>

            {/* Last Updated */}
            {item.updated_at !== item.created_at && (
              <AppText style={styles.updatedText}>
                Última actualización: {formatDate(item.updated_at)}
              </AppText>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderNewTicketForm = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color="#1976D2" />
          <AppText style={styles.infoText}>
            Nuestro equipo responde en menos de 48 horas
          </AppText>
        </View>

        {/* Category Selection */}
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>¿En qué podemos ayudarte?</AppText>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryCard,
                  selectedCategory === category.id && styles.categoryCardActive,
                ]}
                onPress={() => setSelectedCategory(category.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={category.icon as any}
                  size={28}
                  color={selectedCategory === category.id ? '#1976D2' : '#A3B3CC'}
                />
                <AppText
                  style={[
                    styles.categoryLabel,
                    selectedCategory === category.id && styles.categoryLabelActive,
                  ]}
                >
                  {category.label}
                </AppText>
                <AppText style={styles.categoryDescription}>{category.description}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Contact Form */}
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Detalles de tu Consulta</AppText>

          {/* Email */}
          <View style={styles.inputGroup}>
            <AppText style={styles.inputLabel}>Email de Contacto</AppText>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#A3B3CC" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor="#6B7280"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Subject */}
          <View style={styles.inputGroup}>
            <AppText style={styles.inputLabel}>Asunto *</AppText>
            <View style={styles.inputContainer}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#A3B3CC"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Breve descripción del problema"
                placeholderTextColor="#6B7280"
                value={subject}
                onChangeText={(text) => {
                  if (text.length <= 200) {
                    setSubject(text);
                  }
                }}
                maxLength={200}
              />
            </View>
          </View>

          {/* Message */}
          <View style={styles.inputGroup}>
            <AppText style={styles.inputLabel}>Mensaje *</AppText>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe tu consulta con el mayor detalle posible..."
                placeholderTextColor="#6B7280"
                value={message}
                onChangeText={(text) => {
                  if (text.length <= 1000) {
                    setMessage(text);
                  }
                }}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={1000}
              />
            </View>
            <AppText style={styles.charCount}>{message.length} / 1000</AppText>
          </View>
        </View>

        {/* Quick Contact Options */}
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Otras Formas de Contacto</AppText>
          <View style={styles.quickContactCard}>
            <Ionicons name="mail" size={20} color="#A3B3CC" />
            <AppText style={styles.quickContactText}>support@matchmap.com</AppText>
          </View>
          <View style={styles.quickContactCard}>
            <Ionicons name="time-outline" size={20} color="#A3B3CC" />
            <AppText style={styles.quickContactText}>Lun - Vie: 9:00 - 18:00 CET</AppText>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <AppText style={styles.submitButtonText}>Enviando...</AppText>
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFFFFF" />
              <AppText style={styles.submitButtonText}>Enviar Mensaje</AppText>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderMyTickets = () => (
    <View style={{ flex: 1 }}>
      <FlatList
        data={tickets}
        renderItem={renderTicket}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          tickets.length > 0 ? (
            <View style={styles.ticketsHeader}>
              <Ionicons name="time-outline" size={18} color="#1976D2" />
              <AppText style={styles.ticketsHeaderText}>
                Respondemos en menos de 48 horas
              </AppText>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={64} color="#6B7280" />
            <AppText style={styles.emptyText}>No tienes tickets</AppText>
            <AppText style={styles.emptySubtext}>
              ¿Necesitas ayuda? Crea tu primer ticket de soporte
            </AppText>
            <TouchableOpacity
              style={styles.createTicketButton}
              onPress={() => setActiveTab('new')}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <AppText style={styles.createTicketButtonText}>Crear Ticket</AppText>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={[
          styles.ticketsListContent,
          tickets.length === 0 && styles.ticketsListEmpty,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1976D2" />
        }
      />
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
        <AppText style={styles.headerTitle}>Soporte</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-tickets' && styles.tabActive]}
          onPress={() => setActiveTab('my-tickets')}
        >
          <Ionicons 
            name="chatbubbles-outline" 
            size={20} 
            color={activeTab === 'my-tickets' ? '#1976D2' : '#A3B3CC'} 
          />
          <AppText style={[styles.tabText, activeTab === 'my-tickets' && styles.tabTextActive]}>
            Mis Tickets
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'new' && styles.tabActive]}
          onPress={() => setActiveTab('new')}
        >
          <Ionicons 
            name="add-circle-outline" 
            size={20} 
            color={activeTab === 'new' ? '#1976D2' : '#A3B3CC'} 
          />
          <AppText style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>
            Nuevo Ticket
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'new' ? renderNewTicketForm() : renderMyTickets()}
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
  headerSpacer: {
    width: 32,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1C2A3A',
    borderBottomWidth: 1,
    borderBottomColor: '#2A3A4A',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1976D2',
  },
  tabText: {
    color: '#A3B3CC',
    fontSize: 15,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#1976D2',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A5F',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#2A3A4A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryCardActive: {
    backgroundColor: '#1E3A5F',
    borderColor: '#1976D2',
  },
  categoryLabel: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: '#FFFFFF',
  },
  categoryDescription: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A3A4A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  textAreaContainer: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  quickContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A3A4A',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  quickContactText: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1C2A3A',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A3A4A',
  },
  submitButton: {
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#1976D2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#4A5568',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Tickets styles
  ticketsListContent: {
    padding: 16,
    paddingBottom: 32,
  },
  ticketsListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  ticketsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  ticketsHeaderText: {
    color: '#E5E7EB',
    fontSize: 13,
  },
  ticketCard: {
    backgroundColor: '#2A3A4A',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  ticketHeader: {
    padding: 16,
  },
  ticketHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ticketHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  ticketHeaderText: {
    flex: 1,
  },
  ticketSubject: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ticketCategory: {
    color: '#A3B3CC',
    fontSize: 13,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  ticketDate: {
    color: '#6B7280',
    fontSize: 12,
  },
  messagePreview: {
    color: '#A3B3CC',
    fontSize: 14,
    lineHeight: 20,
  },
  ticketBody: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#1C2A3A',
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  statusMessageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  ticketSection: {
    marginBottom: 16,
  },
  ticketLabel: {
    color: '#A3B3CC',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  ticketMessage: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 20,
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 8,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metadataText: {
    color: '#6B7280',
    fontSize: 12,
  },
  updatedText: {
    color: '#6B7280',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
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
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  createTicketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
    gap: 8,
  },
  createTicketButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
