import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import * as RevenueCatService from '~/utils/revenuecat';
import { supabase } from '~/utils/supabase';

interface RevenueCatContextType {
  customerInfo: CustomerInfo | null;
  isLoading: boolean;
  hasActiveBoost: boolean;
  refreshCustomerInfo: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  showPaywall: () => void;
  showCustomerCenter: () => void;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveBoost, setHasActiveBoost] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize RevenueCat
  useEffect(() => {
    const initialize = async () => {
      try {
        // ⚠️ TEMPORARILY DISABLED: RevenueCat initialization
        // Reason: Invalid API key causing login failures in Android
        // TODO: Re-enable when valid API key is obtained
        console.log('⚠️ RevenueCat temporarily disabled');

        // Get current user
        // const { data: { user } } = await supabase.auth.getUser();

        // Initialize RevenueCat with user ID if available
        // await RevenueCatService.initializeRevenueCat(user?.id);

        // Fetch initial customer info
        // const info = await RevenueCatService.getCustomerInfo();
        // setCustomerInfo(info);

        // Check boost entitlement
        // const boostActive = await RevenueCatService.hasActiveBoost();
        // setHasActiveBoost(boostActive);
      } catch (error) {
        console.error('Failed to initialize RevenueCat:', error);
        // ⚠️ IMPORTANT: Mark as initialized EVEN IF IT FAILS
        // This allows the app to continue functioning without RevenueCat blocking it
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // Refresh customer info
  const refreshCustomerInfo = useCallback(async () => {
    try {
      const info = await RevenueCatService.getCustomerInfo();
      setCustomerInfo(info);

      const boostActive = await RevenueCatService.hasActiveBoost();
      setHasActiveBoost(boostActive);
    } catch (error) {
      console.error('Failed to refresh customer info:', error);
    }
  }, []);

  // Purchase package
  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { customerInfo: newCustomerInfo } = await RevenueCatService.purchasePackage(pkg);
      setCustomerInfo(newCustomerInfo);

      // Refresh boost status
      const boostActive = await RevenueCatService.hasActiveBoost();
      setHasActiveBoost(boostActive);

      return true;
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error('Purchase failed:', error);
      }
      return false;
    }
  }, []);

  // Restore purchases
  const restorePurchases = useCallback(async () => {
    try {
      const restoredInfo = await RevenueCatService.restorePurchases();
      setCustomerInfo(restoredInfo);

      const boostActive = await RevenueCatService.hasActiveBoost();
      setHasActiveBoost(boostActive);
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      throw error;
    }
  }, []);

  // Placeholder for paywall - will be implemented separately
  const showPaywall = useCallback(() => {
    console.log('Show paywall - to be implemented');
  }, []);

  // Placeholder for customer center - will be implemented separately
  const showCustomerCenter = useCallback(() => {
    console.log('Show customer center - to be implemented');
  }, []);

  const value: RevenueCatContextType = {
    customerInfo,
    isLoading,
    hasActiveBoost,
    refreshCustomerInfo,
    purchasePackage,
    restorePurchases,
    showPaywall,
    showCustomerCenter,
  };

  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C2A3A' }}>
        <ActivityIndicator size="large" color="#1976D2" />
        <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 16 }}>Iniciando MatchMap...</Text>
      </View>
    );
  }

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  }
  return context;
}
