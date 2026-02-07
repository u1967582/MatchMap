import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import {
  AppText,
  AppButton,
  AppInput,
  AppCard,
  AppChip,
  Divider,
  EmptyState,
  ErrorState,
  SkeletonCard,
  SkeletonList,
  toast,
  colors,
  spacing,
} from '~/components/ds';

export default function DSPreview() {
  const [inputValue, setInputValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [chipA, setChipA] = useState(false);
  const [chipB, setChipB] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showSection, setShowSection] = useState<
    'components' | 'skeleton' | 'empty' | 'error' | 'newcolors'
  >('components');

  const handleLoadingButton = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <AppText variant="h2">Design System Preview</AppText>
        <AppText variant="body" style={styles.gap}>
          Pantalla temporal para verificar componentes del DS.
        </AppText>

        <Divider />

        {/* Section Switcher */}
        <AppText variant="label" style={styles.sectionLabel}>Secciones</AppText>
        <View style={styles.chipRow}>
          <AppChip
            label="Componentes"
            selected={showSection === 'components'}
            onPress={() => setShowSection('components')}
          />
          <AppChip
            label="Skeleton"
            selected={showSection === 'skeleton'}
            onPress={() => setShowSection('skeleton')}
          />
          <AppChip
            label="Empty"
            selected={showSection === 'empty'}
            onPress={() => setShowSection('empty')}
          />
          <AppChip
            label="Error"
            selected={showSection === 'error'}
            onPress={() => setShowSection('error')}
          />
          <AppChip
            label="New Colors"
            selected={showSection === 'newcolors'}
            onPress={() => setShowSection('newcolors')}
          />
        </View>

        <Divider />

        {/* Components Section */}
        {showSection === 'components' && (
          <>
            {/* Typography */}
            <AppText variant="label" style={styles.sectionLabel}>Typography</AppText>
            <AppText variant="h1">Heading 1</AppText>
            <AppText variant="h2">Heading 2</AppText>
            <AppText variant="title">Title</AppText>
            <AppText variant="subtitle">Subtitle</AppText>
            <AppText variant="body">Body text — color secundario por defecto</AppText>
            <AppText variant="caption">Caption — texto muted</AppText>
            <AppText variant="label">Label — semibold secundario</AppText>

            <Divider />

            {/* Buttons */}
            <AppText variant="label" style={styles.sectionLabel}>Buttons</AppText>
            <View style={styles.buttonGroup}>
              <AppButton text="Primary" onPress={() => toast.success('Primary pulsado')} />
              <AppButton text="Secondary" variant="secondary" onPress={() => toast.info('Secondary pulsado')} />
              <AppButton text="Outline" variant="outline" onPress={() => toast.warning('Outline pulsado')} />
              <AppButton text="Dark" variant="dark" onPress={() => toast.error('Dark pulsado')} />
              <AppButton text="Ghost" variant="ghost" onPress={() => {}} />
              <AppButton text="Loading..." variant="primary" loading={loading} onPress={handleLoadingButton} />
              <AppButton text="Disabled" variant="primary" disabled onPress={() => {}} />
            </View>

            <Divider />

            {/* Inputs */}
            <AppText variant="label" style={styles.sectionLabel}>Inputs</AppText>
            <AppInput
              label="Nombre"
              placeholder="Escribe tu nombre"
              value={inputValue}
              onChangeText={setInputValue}
              helperText="Este es un helper text"
            />
            <AppInput
              label="Password"
              placeholder="Tu contraseña"
              value={passwordValue}
              onChangeText={setPasswordValue}
              secureTextEntry
            />
            <AppInput
              label="Con error"
              placeholder="Email"
              value=""
              onChangeText={() => {}}
              error="El email no es válido"
            />

            <Divider />

            {/* Cards */}
            <AppText variant="label" style={styles.sectionLabel}>Cards</AppText>
            <AppCard onPress={() => toast.info('Card pulsada')}>
              <View style={styles.cardContent}>
                <AppText variant="title">Bar Ejemplo</AppText>
                <AppText variant="body">Toca la card para ver el press animation</AppText>
              </View>
            </AppCard>
            <AppCard>
              <View style={styles.cardContent}>
                <AppText variant="title">Card sin press</AppText>
                <AppText variant="caption">Esta card no es pressable</AppText>
              </View>
            </AppCard>

            <Divider />

            {/* Chips */}
            <AppText variant="label" style={styles.sectionLabel}>Chips</AppText>
            <View style={styles.chipRow}>
              <AppChip icon="⚽" label="Fútbol" selected={chipA} onPress={() => setChipA(!chipA)} />
              <AppChip icon="🍕" label="Comida" selected={chipB} onPress={() => setChipB(!chipB)} />
              <AppChip label="Sin icono" selected={false} onPress={() => {}} />
            </View>

            <Divider />

            {/* Toasts */}
            <AppText variant="label" style={styles.sectionLabel}>Toasts</AppText>
            <View style={styles.buttonGroup}>
              <AppButton text="Toast Success" variant="primary" onPress={() => toast.success('Guardado', 'Los cambios se han guardado correctamente')} />
              <AppButton text="Toast Error" variant="dark" onPress={() => toast.error('Error', 'No se pudo completar la acción')} />
              <AppButton text="Toast Info" variant="secondary" onPress={() => toast.info('Info', 'Nuevo partido disponible')} />
              <AppButton text="Toast Warning" variant="outline" onPress={() => toast.warning('Aviso', 'Límite casi alcanzado')} />
            </View>
          </>
        )}

        {/* Skeleton Section */}
        {showSection === 'skeleton' && (
          <>
            <AppText variant="label" style={styles.sectionLabel}>Skeleton Cards</AppText>
            <SkeletonList count={3} />
          </>
        )}

        {/* Empty State Section */}
        {showSection === 'empty' && (
          <EmptyState
            icon="search"
            title="No se encontraron bares"
            subtitle="Intenta cambiar los filtros o buscar en otra zona"
            actionLabel="Limpiar filtros"
            onAction={() => toast.info('Filtros limpiados')}
          />
        )}

        {/* Error State Section */}
        {showSection === 'error' && (
          <ErrorState
            onRetry={() => toast.success('Reintentando...')}
          />
        )}

        {/* New DS Colors Section */}
        {showSection === 'newcolors' && (
          <>
            <AppText variant="label" style={styles.sectionLabel}>New DS Colors (Paso 1)</AppText>

            {/* bg.match */}
            <View style={[styles.colorSwatch, { backgroundColor: colors.bg.match }]}>
              <AppText variant="caption" color={colors.text.primary}>colors.bg.match</AppText>
              <AppText variant="caption" color={colors.text.secondary}>#1E3A5F</AppText>
            </View>

            {/* brand.primaryDark */}
            <View style={[styles.colorSwatch, { backgroundColor: colors.brand.primaryDark }]}>
              <AppText variant="caption" color={colors.text.primary}>colors.brand.primaryDark</AppText>
              <AppText variant="caption" color={colors.text.secondary}>#1565C0</AppText>
            </View>

            {/* text.light */}
            <View style={[styles.colorSwatch, { backgroundColor: colors.bg.card }]}>
              <AppText variant="caption" color={colors.text.light}>colors.text.light (sobre bg.card)</AppText>
              <AppText variant="caption" color={colors.text.secondary}>#E5E7EB</AppText>
            </View>

            {/* status.destructive */}
            <View style={[styles.colorSwatch, { backgroundColor: colors.status.destructive }]}>
              <AppText variant="caption" color={colors.text.primary}>colors.status.destructive</AppText>
              <AppText variant="caption" color={colors.text.primary}>#FF6B6B</AppText>
            </View>

            <Divider />

            <AppText variant="label" style={styles.sectionLabel}>Tags Colors</AppText>

            {/* tags.category */}
            <View style={[styles.colorSwatch, { backgroundColor: colors.tags.category }]}>
              <AppText variant="caption" color={colors.text.primary}>colors.tags.category</AppText>
              <AppText variant="caption" color={colors.text.secondary}>#5A8FBF (azul crema)</AppText>
            </View>

            {/* tags.food */}
            <View style={[styles.colorSwatch, { backgroundColor: colors.tags.food }]}>
              <AppText variant="caption" color={colors.text.primary}>colors.tags.food</AppText>
              <AppText variant="caption" color={colors.text.secondary}>#D89B6A (naranja crema)</AppText>
            </View>

            {/* tags.tv */}
            <View style={[styles.colorSwatch, { backgroundColor: colors.tags.tv }]}>
              <AppText variant="caption" color={colors.text.primary}>colors.tags.tv</AppText>
              <AppText variant="caption" color={colors.text.secondary}>#7FB894 (verde crema)</AppText>
            </View>

            {/* tags.feature */}
            <View style={[styles.colorSwatch, { backgroundColor: colors.tags.feature }]}>
              <AppText variant="caption" color={colors.text.primary}>colors.tags.feature</AppText>
              <AppText variant="caption" color={colors.text.secondary}>#B084B8 (morado crema)</AppText>
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    padding: spacing.lg,
  },
  gap: {
    marginTop: spacing.xs,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  buttonGroup: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardContent: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  bottomSpacer: {
    height: 40,
  },
  colorSwatch: {
    padding: spacing.lg,
    borderRadius: 8,
    marginBottom: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
});
