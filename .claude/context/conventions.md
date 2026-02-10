# Convenciones de Código - MatchMap

## Naming Conventions

### Archivos
```
PascalCase: Components y Screens
- BarCard.tsx
- MapScreen.tsx
- Button.tsx

camelCase: Hooks, utils, services
- useBars.ts
- formatDate.ts
- supabaseClient.ts

kebab-case: Folders y assets
- components/bar-card/
- assets/images/logo-icon.png
```

### Variables y Funciones
```typescript
// camelCase para variables y funciones
const userLocation = { lat: 0, lng: 0 };
function fetchBars() { }

// PascalCase para componentes y clases
function BarCard() { }
class ApiService { }

// SCREAMING_SNAKE_CASE para constantes
const API_TIMEOUT = 5000;
const MAX_RETRIES = 3;
```

### TypeScript Types/Interfaces
```typescript
// PascalCase con descriptive names
interface BarCardProps { }
type UserRole = 'customer' | 'bar_owner';
type BarFilters = { };

// Usar 'I' prefix solo para interfaces grandes
interface IComplexService { }
```

## File Structure

### Component File
```typescript
// BarCard.tsx
import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

// 1. Types
interface BarCardProps {
  bar: Bar;
  onPress: (barId: string) => void;
  showBoost?: boolean;
}

// 2. Component
export const BarCard = memo(({ bar, onPress, showBoost = false }: BarCardProps) => {
  // 2.1 Hooks
  const theme = useTheme();
  
  // 2.2 Handlers
  const handlePress = useCallback(() => {
    onPress(bar.id);
  }, [bar.id, onPress]);
  
  // 2.3 Render
  return (
    <Pressable style={styles.container} onPress={handlePress}>
      {/* content */}
    </Pressable>
  );
});

// 3. Styles
const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
  },
});

// 4. Display name (for debugging)
BarCard.displayName = 'BarCard';
```

### Hook File
```typescript
// useBars.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Bar } from '@/types/supabase';

// 1. Types
interface UseBarsOptions {
  city?: string;
  limit?: number;
}

interface UseBarsReturn {
  bars: Bar[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// 2. Hook
export function useBars(options: UseBarsOptions = {}): UseBarsReturn {
  const [bars, setBars] = useState<Bar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchBars = useCallback(async () => {
    try {
      setIsLoading(true);
      // fetch logic
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [options]);
  
  useEffect(() => {
    fetchBars();
  }, [fetchBars]);
  
  return { bars, isLoading, error, refetch: fetchBars };
}
```

## TypeScript Standards

### Strict Mode
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Type vs Interface
```typescript
// ✅ Use type for unions, primitives, tuples
type Status = 'active' | 'inactive';
type Coordinates = [number, number];
type ID = string;

// ✅ Use interface for object shapes (can be extended)
interface Bar {
  id: string;
  name: string;
  location: Coordinates;
}

// Extending
interface BarWithBoost extends Bar {
  boost: Boost;
}
```

### Generics
```typescript
// ✅ Descriptive single letters or words
function fetchData<T>(url: string): Promise<T> { }
function createStore<State, Action>(reducer: Reducer<State, Action>) { }

// ❌ Avoid non-descriptive generics
function doSomething<A, B, C>() { }
```

## Comments

### When to Comment
```typescript
// ✅ Complex logic that isn't obvious
// Calculate distance using Haversine formula for accurate geo proximity
const distance = haversineDistance(point1, point2);

// ✅ TODO/FIXME/NOTE
// TODO: Optimize this query when we have 10k+ bars
// FIXME: Handle edge case when user denies location
// NOTE: This must run before app initialization

// ✅ Public API documentation
/**
 * Fetches bars near a given location
 * @param lat - Latitude coordinate
 * @param lng - Longitude coordinate
 * @param radius - Search radius in kilometers (default: 5)
 * @returns Promise with array of bars
 */
export async function fetchNearbyBars(lat: number, lng: number, radius = 5) { }

// ❌ Don't comment obvious code
// Set the user name
setUserName(name);

// ❌ Don't leave commented code (use git)
// const oldImplementation = () => { }
```

## Error Handling

### Pattern Standard
```typescript
// ✅ Always handle errors explicitly
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  if (error instanceof NetworkError) {
    // Handle network errors
    showToast('No internet connection');
  } else if (error instanceof AuthError) {
    // Handle auth errors
    router.push('/auth/login');
  } else {
    // Unknown errors
    console.error('Unexpected error:', error);
    Sentry.captureException(error);
  }
  throw error; // or return default value
}

// ❌ Don't silently catch errors
try {
  await riskyOperation();
} catch (error) {
  // nothing
}

// ❌ Don't catch and log only
try {
  await riskyOperation();
} catch (error) {
  console.log(error); // what now?
}
```

## Async/Await vs Promises

### Prefer async/await
```typescript
// ✅ Async/await is more readable
async function loadUserData() {
  const user = await fetchUser();
  const bars = await fetchUserBars(user.id);
  return { user, bars };
}

// ❌ Promise chains when async/await is clearer
function loadUserData() {
  return fetchUser()
    .then(user => fetchUserBars(user.id)
      .then(bars => ({ user, bars }))
    );
}

// ✅ But use Promise.all for parallel
async function loadDashboard() {
  const [user, bars, reviews] = await Promise.all([
    fetchUser(),
    fetchBars(),
    fetchReviews(),
  ]);
}
```

## React Native Specific

### StyleSheet
```typescript
// ✅ Use StyleSheet.create
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});

// ❌ Don't use inline styles for static values
<View style={{ padding: 16 }} />

// ✅ Inline styles OK for dynamic values
<View style={{ opacity: isVisible ? 1 : 0 }} />
```

### Platform-specific Code
```typescript
// ✅ Use Platform.select for simple cases
const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.select({
      ios: 20,
      android: 0,
    }),
  },
});

// ✅ Use Platform.OS for conditional logic
if (Platform.OS === 'ios') {
  // iOS-specific code
}

// ✅ Use separate files for complex platform code
// BarCard.ios.tsx
// BarCard.android.tsx
```

## Imports Order
```typescript
// 1. React & React Native
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 2. Third-party libraries
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';

// 3. Internal modules (absolute imports)
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { useBars } from '@/hooks/useBars';
import type { Bar } from '@/types/supabase';

// 4. Relative imports
import { BarCard } from './BarCard';
import { formatDate } from '../utils';

// 5. Types (if not inline)
import type { ComponentProps } from './types';
```

## Testing Conventions

### File Naming
```
Component.test.tsx   - Unit tests
Component.spec.tsx   - Integration tests
e2e/login.test.ts    - E2E tests
```

### Test Structure
```typescript
describe('BarCard', () => {
  // Setup
  const mockBar = createMockBar();
  const mockOnPress = jest.fn();
  
  beforeEach(() => {
    mockOnPress.mockClear();
  });
  
  // Tests grouped by feature
  describe('rendering', () => {
    it('displays bar name', () => { });
    it('displays bar rating', () => { });
  });
  
  describe('interactions', () => {
    it('calls onPress when tapped', () => { });
  });
  
  describe('edge cases', () => {
    it('handles missing image', () => { });
  });
});
```

## Git Conventions

### Commit Messages
```bash
# Format: <type>(<scope>): <subject>

feat(map): add cluster markers for nearby bars
fix(auth): resolve Google OAuth redirect on Android
refactor(hooks): simplify useBars implementation
docs(readme): update setup instructions
test(bars): add tests for BarCard component
chore(deps): update expo to 52.0.0

# Body (optional): explain what and why
# Footer (optional): reference issues
Closes #123
```

### Branch Naming
```bash
feature/boost-system
bugfix/google-oauth-android
refactor/bar-components
hotfix/critical-crash
release/v1.2.3
```

## Performance Best Practices

### Memoization
```typescript
// ✅ Memoize callbacks passed as props
const handlePress = useCallback(() => {
  onPress(bar.id);
}, [bar.id, onPress]);

// ✅ Memoize expensive computations
const sortedBars = useMemo(() => {
  return bars.sort((a, b) => b.rating - a.rating);
}, [bars]);

// ✅ Memoize components that rarely change
export const BarCard = memo(({ bar, onPress }: BarCardProps) => {
  // component logic
}, (prevProps, nextProps) => {
  return prevProps.bar.id === nextProps.bar.id;
});
```

### List Rendering
```typescript
// ✅ Always use FlatList for long lists
<FlatList
  data={bars}
  renderItem={({ item }) => <BarCard bar={item} />}
  keyExtractor={(item) => item.id}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={5}
/>

// ❌ Never use ScrollView + map for >20 items
<ScrollView>
  {bars.map(bar => <BarCard key={bar.id} bar={bar} />)}
</ScrollView>
```

## Accessibility

### Always Include Accessibility Props
```typescript
// ✅ Buttons and pressable elements
<Pressable
  onPress={handlePress}
  accessibilityLabel="View bar details"
  accessibilityRole="button"
  accessibilityHint="Opens the bar profile page"
>
  <Text>View Bar</Text>
</Pressable>

// ✅ Images
<Image
  source={{ uri: bar.imageUrl }}
  alt={`${bar.name} bar photo`}
  accessibilityLabel={`Photo of ${bar.name}`}
/>

// ✅ Form inputs
<TextInput
  placeholder="Search bars"
  accessibilityLabel="Search for bars"
  accessibilityHint="Enter bar name or location"
/>
```

---

**Estas convenciones son living document**. Si encuentras un mejor approach, propón el cambio y actualizamos el doc.
