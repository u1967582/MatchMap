jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-url-polyfill/auto', () => ({}));

// Desde Worklets 0.7 (Expo SDK 55) importar Reanimated en Jest lanza
// "Native part of Worklets doesn't seem to be initialized": se usan los mocks
// oficiales de ambas librerías.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// Reanimated 4.7 (SDK 58): con el preset nativo de jest-expo, su mock carga
// `initializers.native.ts`, que llama a `setCSSEventHandler` sobre JSReanimated y
// lanza. Se sustituye por un inicializador vacío (la versión web no hace nada útil
// en tests).
jest.mock('react-native-reanimated/src/initializers', () => ({
  initializeReanimatedModule: () => {},
}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-toast-message', () => {
  const MockToast: any = () => null;
  MockToast.show = jest.fn();
  MockToast.hide = jest.fn();
  return {
    __esModule: true,
    default: MockToast,
  };
});

// EAS Observe es nativo: en tests solo se comprueba que se llama.
jest.mock('expo-observe', () => {
  const markInteractive = jest.fn();
  const Observe = {
    configure: jest.fn(),
    reportError: jest.fn(),
    logEvent: jest.fn(),
    dispatchEvents: jest.fn(() => Promise.resolve()),
  };
  return {
    __esModule: true,
    Observe,
    default: Observe,
    ObserveRoot: { wrap: (Component: unknown) => Component },
    ObserveErrorBoundary: ({ children }: { children: unknown }) => children,
    ObserveInteractiveMarker: () => null,
    useObserve: () => ({ markInteractive }),
  };
});

jest.mock('expo-router', () => {
  // Instancia única y estable: los tests pueden importar `useRouter` y llamarlo
  // para obtener las mismas referencias jest.fn() que usa el componente bajo test.
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  };
  return {
    useRouter: jest.fn(() => mockRouter),
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    useFocusEffect: jest.fn(),
    useNavigation: jest.fn(() => ({
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    })),
    Link: 'Link',
    Stack: { Screen: 'Stack.Screen' },
    Redirect: 'Redirect',
    router: mockRouter,
  };
});
