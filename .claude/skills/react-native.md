---
name: react-native
description: This skill should be used when working with React Native components, performance optimization, state management, navigation with Expo Router, and image handling for the MatchMap mobile app.
---

# React Native Skill para MatchMap

## Principios Fundamentales

### 1. Estructura de Componentes
```typescript
// ✅ CORRECTO: Componente funcional con tipos
interface BarCardProps {
  bar: Bar;
  onPress: (barId: string) => void;
  showBoost?: boolean;
}

export function BarCard({ bar, onPress, showBoost = false }: BarCardProps) {
  const handlePress = useCallback(() => {
    onPress(bar.id);
  }, [bar.id, onPress]);

  return (
    <Pressable onPress={handlePress}>
      {/* contenido */}
    </Pressable>
  );
}

// ❌ INCORRECTO: Sin tipos, sin memoización
export function BarCard(props) {
  return (
    <TouchableOpacity onPress={() => props.onPress(props.bar.id)}>
      {/* contenido */}
    </TouchableOpacity>
  );
}
```

### 2. Optimización de Performance
```typescript
// ✅ CORRECTO: FlatList optimizado
<FlatList
  data={bars}
  renderItem={renderBarCard}
  keyExtractor={(item) => item.id}
  removeClippedSubviews
  maxToRenderPerBatch={10}
  windowSize={5}
  initialNumToRender={10}
  getItemLayout={(data, index) => ({
    length: BAR_CARD_HEIGHT,
    offset: BAR_CARD_HEIGHT * index,
    index,
  })}
/>

// ❌ INCORRECTO: ScrollView con map
<ScrollView>
  {bars.map(bar => <BarCard key={bar.id} bar={bar} />)}
</ScrollView>
```

### 3. Manejo de Estados
```typescript
// ✅ CORRECTO: Estados separados y específicos
const [bars, setBars] = useState<Bar[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);

// ❌ INCORRECTO: Un solo objeto de estado
const [state, setState] = useState({ bars: [], loading: false, error: null });
```

### 4. Navegación con Expo Router
```typescript
// ✅ CORRECTO: Deep linking y tipos
// app/bar/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

export default function BarDetailScreen() {
  const params = useLocalSearchParams();
  const { id } = ParamsSchema.parse(params);

  // ...
}

// ❌ INCORRECTO: Sin validación
export default function BarDetailScreen() {
  const { id } = useLocalSearchParams();
  // id podría ser undefined o inválido
}
```

### 5. Manejo de Imágenes
```typescript
// ✅ CORRECTO: Con placeholder y error handling
<Image
  source={{ uri: bar.profile_image_url }}
  style={styles.image}
  placeholder={require('@/assets/placeholder-bar.png')}
  contentFit="cover"
  transition={200}
  onError={(error) => {
    console.error('Error loading image:', error);
  }}
/>

// ❌ INCORRECTO: Sin manejo de errores
<Image source={{ uri: bar.profile_image_url }} style={styles.image} />
```

## Patrones Comunes en MatchMap

### Hook personalizado para Supabase
```typescript
export function useBar(barId: string) {
  const [bar, setBar] = useState<Bar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchBar() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('bars')
          .select('*, bar_images(*), bar_selected_teams(teams(*))')
          .eq('id', barId)
          .single();

        if (error) throw error;
        if (!cancelled) {
          setBar(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchBar();

    return () => {
      cancelled = true;
    };
  }, [barId]);

  return { bar, isLoading, error };
}
```

### Componente de Error Boundary
```typescript
import React from 'react';
import { View, Text, Button } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Something went wrong</Text>
          <Button title="Try again" onPress={() => this.setState({ hasError: false })} />
        </View>
      );
    }

    return this.props.children;
  }
}
```

## Checklist para Nuevos Componentes

- [ ] TypeScript strict activado
- [ ] Props interface definida
- [ ] Manejo de loading/error states
- [ ] Memoización con useMemo/useCallback cuando sea necesario
- [ ] Accesibilidad (accessibilityLabel, accessibilityHint)
- [ ] Responsive design (useWindowDimensions)
- [ ] Error boundary implementado
- [ ] Tests unitarios
