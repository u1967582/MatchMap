jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-url-polyfill/auto', () => ({}));

jest.mock('react-native-toast-message', () => {
  const MockToast: any = () => null;
  MockToast.show = jest.fn();
  MockToast.hide = jest.fn();
  return {
    __esModule: true,
    default: MockToast,
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
