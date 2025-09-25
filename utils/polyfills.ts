import { LogBox, NativeModules } from 'react-native';

export function installNativeEventEmitterWorkaround(): void {
  const modules: Record<string, unknown> = NativeModules as unknown as Record<string, unknown>;
  Object.keys(modules).forEach((moduleName) => {
    const nativeModule = (modules as any)[moduleName];
    if (nativeModule && typeof nativeModule === 'object') {
      if (nativeModule.addListener == null) {
        nativeModule.addListener = () => {};
      }
      if (nativeModule.removeListeners == null) {
        nativeModule.removeListeners = () => {};
      }
    }
  });

  LogBox.ignoreLogs([
    '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.',
    '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
  ]);
}


