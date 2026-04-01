import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { StyledInput } from '../components/common/StyledInput';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { colors } from '../theme/colors';
import { login } from '../lib/auth/authApi';
import { useAuth } from '../context/AuthContext';

export function LoginScreen() {
  const { onLoginSuccess } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleLogin = async () => {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await login({ username: username.trim(), password });
      onLoginSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.wordmark}>Alfred</Text>
          <Text style={styles.tagline}>Your personal health & wealth assistant</Text>
        </View>

        <View style={styles.form}>
          <StyledInput
            value={username}
            onChangeText={setUsername}
            placeholder="Username or email"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <StyledInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          {loading
            ? <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
            : <PrimaryButton label="Sign in →" onPress={handleLogin} />
          }
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.bg },
  content:  { flexGrow: 1, justifyContent: 'center', padding: 24 },
  hero:     { alignItems: 'center', marginBottom: 48 },
  wordmark: { fontSize: 42, fontWeight: '800', color: colors.accent, letterSpacing: 2 },
  tagline:  { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: 'center' },
  form:     { gap: 12 },
  error:    { color: colors.red, fontSize: 13, textAlign: 'center', marginTop: 4 },
});
