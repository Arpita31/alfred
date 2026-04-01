import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

// Contexts — order matters: outer providers must not depend on inner ones
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import { ProfileProvider } from './src/context/ProfileContext';
import { HydrationProvider } from './src/context/HydrationContext';
import { SleepProvider } from './src/context/SleepContext';
import { ActivityProvider } from './src/context/ActivityContext';
import { FinanceProvider } from './src/context/FinanceContext';

import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import TabNavigator from './src/navigation/TabNavigator';
import { LoginScreen } from './src/screens/LoginScreen';
import { colors } from './src/theme/colors';

/** Shown while we check SecureStore for a saved token on cold start. */
function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

/**
 * Auth-gated root: shows LoginScreen until the user has a valid token,
 * then mounts the full provider tree + navigation.
 */
function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <LoginScreen />;

  return (
    // Domain providers are nested inside the auth gate so they only
    // initialise (and make API calls) once the user is signed in.
    <AppProvider>
      <ProfileProvider>
        <HydrationProvider>
          <SleepProvider>
            <ActivityProvider>
              <FinanceProvider>
                <ErrorBoundary label="Navigation">
                  <TabNavigator />
                </ErrorBoundary>
              </FinanceProvider>
            </ActivityProvider>
          </SleepProvider>
        </HydrationProvider>
      </ProfileProvider>
    </AppProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          <ErrorBoundary label="App">
            <AuthGate />
          </ErrorBoundary>
        </AuthProvider>
        <StatusBar style="light" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
