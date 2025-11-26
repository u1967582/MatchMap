import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, LayoutAnimation, UIManager, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Faq = { q: string; a: string };
const FAQS: Faq[] = [
  { 
    q: '¿Qué es MatchMap y para qué sirve?', 
    a: 'MatchMap ayuda a los aficionados a encontrar bares que emiten partidos de fútbol cerca de ellos, y permite a los bares ganar visibilidad los días de partido con un perfil sencillo y actualizable.' 
  },
  { 
    q: '¿Cómo encuentro un bar que emita mi partido?', 
    a: 'Usa el buscador por equipo/competición/fecha o abre el mapa y aplica filtros (proximidad, tipo de local, comida, etc.). Verás los bares disponibles y podrás entrar en su perfil para confirmar horario y detalles del evento.' 
  },
  { 
    q: 'Soy dueño/a de un bar, ¿cómo puedo aparecer en la app?', 
    a: 'Completa el pre-registro y crea tu perfil con dirección, fotos y horarios. Después podrás publicar los partidos que emites y actualizar tu información cuando quieras.' 
  },
  { 
    q: '¿La app es gratuita?', 
    a: 'Para usuarios, sí: buscar, guardar favoritos y dejar reseñas es gratis. Para bares, hay un perfil básico gratuito y opciones de promoción opcionales para destacar en el mapa los días de partido.' 
  },
  { 
    q: '¿Qué pasa con mi privacidad y la ubicación?', 
    a: 'Solo usamos tu ubicación para mostrarte bares cercanos. Puedes desactivarla cuando quieras; la app sigue funcionando con búsqueda manual. No compartimos tus datos personales con terceros sin tu consentimiento.' 
  },
];

export default function SupportScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const router = useRouter();
  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex(prev => (prev === i ? null : i));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBack} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Preguntas Frecuentes</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Encuentra respuestas a las preguntas más comunes sobre MatchMap.
        </Text>

        {FAQS.map((item, i) => (
          <View key={i} style={styles.card}>
            <Pressable onPress={() => toggle(i)} style={styles.cardHeader} android_ripple={{ color: '#0D1A2B' }}>
              <Text style={styles.cardTitle}>{item.q}</Text>
              <Ionicons name={openIndex === i ? 'chevron-up' : 'chevron-down'} size={22} color="#007AFF" />
            </Pressable>
            {openIndex === i && (
              <View style={styles.cardBody}>
                <Text style={styles.cardText}>{item.a}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerBack: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 20,
  },
  lead: {
    color: '#8E8E93',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  card: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
    paddingRight: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  cardBody: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 4,
  },
  cardText: {
    color: '#A3B3CC',
    lineHeight: 22,
    fontSize: 15,
  },
});


