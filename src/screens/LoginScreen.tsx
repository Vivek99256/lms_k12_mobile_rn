import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { isApiError, userMessage } from '../api/errors';
import { useAuthStore } from '../auth/authStore';
import { FadeInUp, Floating } from '../components/motion';
import { Button, Field } from '../components/ui';
import { colors, fonts, gradients, radius, shadow, spacing } from '../config/theme';

function Blob({ size, color, style }: { size: number; color: string; style: object }) {
  return <View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

export function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      // 401 from /api-login is "wrong credentials"; its message comes from the server.
      setError(isApiError(e) && e.kind === 'unauthorized' ? e.message || 'Invalid email or password.' : userMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 84, paddingBottom: 84, paddingHorizontal: spacing.lg, overflow: 'hidden' }}
        >
          <Floating amplitude={12} duration={2800} style={{ position: 'absolute', right: -40, top: -20 }}>
            <Blob size={170} color="rgba(255,255,255,0.15)" style={{ position: 'relative' }} />
          </Floating>
          <Floating amplitude={9} duration={2100} style={{ position: 'absolute', right: 40, bottom: 20 }}>
            <Blob size={56} color="rgba(126,217,87,0.85)" style={{ position: 'relative' }} />
          </Floating>
          <Floating amplitude={7} duration={1800} style={{ position: 'absolute', left: 150, top: 70 }}>
            <Blob size={26} color="rgba(255,255,255,0.85)" style={{ position: 'relative' }} />
          </Floating>

          <FadeInUp>
            <Floating amplitude={7} duration={1500}>
              <View
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 28,
                  backgroundColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.lg,
                  transform: [{ rotate: '-8deg' }],
                  ...shadow,
                }}
              >
                <Text style={{ fontSize: 46 }}>🎒</Text>
              </View>
            </Floating>
          </FadeInUp>
          <FadeInUp delay={120}>
            <Text style={{ color: '#fff', fontSize: 34, fontFamily: fonts.bold }}>Teach Connect</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, fontFamily: fonts.medium, marginTop: 6 }}>
              Learning is more fun together ✨
            </Text>
          </FadeInUp>
        </LinearGradient>

        <FadeInUp
          delay={220}
          distance={40}
          style={{
            flex: 1,
            marginTop: -40,
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.lg,
            paddingTop: spacing.xl,
            ...shadow,
          }}
        >
          <Text style={{ fontSize: 24, fontFamily: fonts.bold, color: colors.text }}>Hello again! 👋</Text>
          <Text style={{ color: colors.textMuted, fontFamily: fonts.regular, marginBottom: spacing.lg, marginTop: 4 }}>
            Sign in to pick up where you left off
          </Text>

          <Field
            label="Email"
            placeholder="you@school.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            left={<Ionicons name="mail-outline" size={20} color={colors.textMuted} />}
          />
          <Field
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => canSubmit && void submit()}
            error={error ?? undefined}
            left={<Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />}
          />
          <Pressable
            onPress={() => setShowPw((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showPw ? 'Hide password' : 'Show password'}
            style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 13 }}>{showPw ? 'Hide' : 'Show'} password</Text>
          </Pressable>

          <Button title="Let's go 🚀" onPress={() => void submit()} loading={busy} disabled={!canSubmit} />
        </FadeInUp>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
