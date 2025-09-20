import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, LayoutAnimation, UIManager, Platform, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// NOTE: We will dynamically import expo-mail-composer inside the handler

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Faq = { q: string; a: string };
const FAQS: Faq[] = [
  { q: '¿Cómo recupero mi contraseña?', a: 'Ve a “Iniciar sesión” → “Olvidé mi contraseña”. Te enviaremos un email con un enlace. Si el botón del email no abre la app, revisa que el enlace diga matchmap://reset.' },
  { q: '¿Cómo encuentro bares con partidos de mi equipo?', a: 'En Buscar bares, usa el filtro “Equipo” y elige tu equipo. Verás bares con eventos futuros de ese equipo.' },
  { q: '¿Cómo activo las auto-emisiones en mi bar?', a: 'En Automatización, selecciona competiciones completas o equipos concretos. Al subir nuevos partidos se crearán eventos automáticamente.' },
  { q: '¿Cómo edito mis preferencias de notificaciones?', a: 'Ajustes → Notificaciones. Puedes activar o desactivar avisos de nuevos eventos y cambios de horario.' },
  { q: '¿Cómo reporto un problema con una reseña?', a: 'Abre la reseña, pulsa “Reportar” y describe el problema. Nuestro equipo revisará el contenido.' },
];

async function openSupportEmail() {
  const subject = 'Soporte MatchMap';
  const body = 'Describe tu problema aquí...\n\nVersión de la app: \nDispositivo: ';
  const email = 'support@matchmapapp.com';

  try {
    // Use require to avoid Metro dynamic import issues
    // Handle both default and namespace exports
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-mail-composer');
    const MailComposer = (mod && mod.default) ? mod.default : mod;
    if (MailComposer && typeof MailComposer.isAvailableAsync === 'function') {
      const isAvailable = await MailComposer.isAvailableAsync();
      if (isAvailable && typeof MailComposer.composeAsync === 'function') {
        await MailComposer.composeAsync({ recipients: [email], subject, body });
        return;
      }
    }
  } catch (e) {
    console.warn('MailComposer not available, using mailto fallback', e);
  }

  const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  await Linking.openURL(url);
}

export default function SupportScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const router = useRouter();
  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex(prev => (prev === i ? null : i));
  };

  const footer = useMemo(() => (
    <Pressable onPress={openSupportEmail} style={styles.footerButton} android_ripple={{ color: '#1C3A66' }}>
      <View style={styles.footerButtonContent}>
        <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
        <Text style={styles.footerButtonText}>Contactar con soporte</Text>
      </View>
    </Pressable>
  ), []);

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBack} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Ayuda y soporte</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Resuelve dudas frecuentes o escríbenos a <Text style={styles.leadStrong}>support@matchmapapp.com</Text>.
        </Text>

        {FAQS.map((item, i) => (
          <View key={i} style={styles.card}>
            <Pressable onPress={() => toggle(i)} style={styles.cardHeader} android_ripple={{ color: '#1f2937' }}>
              <Text style={styles.cardTitle}>{item.q}</Text>
              <Ionicons name={openIndex === i ? 'chevron-up' : 'chevron-down'} size={20} color="#A3B3CC" />
            </Pressable>
            {openIndex === i && (
              <View style={styles.cardBody}>
                <Text style={styles.cardText}>{item.a}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        {footer}
      </View>
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
    borderBottomColor: '#2A3A4A',
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
    paddingBottom: 24,
    paddingTop: 16,
  },
  lead: {
    color: '#A3B3CC',
    marginBottom: 16,
  },
  leadStrong: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  card: {
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#1A2332',
    borderWidth: 1,
    borderColor: '#2A3A4A',
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  cardText: {
    color: '#A3B3CC',
    lineHeight: 20,
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#2A3A4A',
  },
  footerButton: {
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  footerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});


