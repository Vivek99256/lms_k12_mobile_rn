import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { isApiError } from './src/api/errors';
import { onForbidden, onSignedOut, useAuthStore } from './src/auth/authStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { startOtaChecks } from './src/updates/otaClient';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // No retry when retrying cannot help (expired token, no access, bad request).
      retry: (count, error) => !(isApiError(error) && error.isFinal) && count < 2,
      refetchOnReconnect: true,
    },
  },
});

// Refetch the menu/permissions when the app returns to the foreground.
AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));

// Ending the session must drop every cached server response (menu, dashboards, ...).
onSignedOut(() => queryClient.clear());

// A 403 usually means rights changed in the ERP: re-read the menu and permissions.
onForbidden(() => void queryClient.invalidateQueries({ queryKey: ['bootstrap'] }));

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    void useAuthStore.getState().restore();
    return startOtaChecks();
  }, []);

  // Don't flash system-font text; if loading ever fails the app still renders (fonts fall back).
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
        <StatusBar style="light" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
