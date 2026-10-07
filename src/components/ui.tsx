import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, gradients, radius, shadow, spacing } from '../config/theme';

/** Scrollable page with optional pull-to-refresh and keyboard avoidance. */
export function Page({
  children,
  onRefresh,
  refreshing = false,
  padded = true,
}: {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  padded?: boolean;
}) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[padded && { padding: spacing.md }, { flexGrow: 1, paddingBottom: 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <View style={[styles.stateIcon, { backgroundColor: colors.dangerSoft }]}>
        <Text style={{ fontSize: 26 }}>⚠️</Text>
      </View>
      <Text style={styles.errorTitle}>Couldn't load this</Text>
      <Text style={[styles.muted, { textAlign: 'center' }]}>{message}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.center}>
      <View style={styles.stateIcon}>
        <Text style={{ fontSize: 26 }}>✨</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={[styles.muted, { textAlign: 'center' }]}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const off = disabled || loading;
  const primary = variant === 'primary';
  const body = loading ? (
    <ActivityIndicator color={primary ? '#fff' : colors.primary} />
  ) : (
    <Text style={[styles.buttonText, !primary && { color: colors.primary }]}>{title}</Text>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [primary && shadow, { opacity: pressed ? 0.85 : off ? 0.55 : 1 }]}
    >
      {primary ? (
        <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
          {body}
        </LinearGradient>
      ) : (
        <View style={[styles.button, styles.buttonSecondary]}>{body}</View>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  left,
  ...props
}: TextInputProps & { label: string; error?: string; left?: React.ReactNode }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          focused && { borderColor: colors.primary, backgroundColor: '#fff' },
          !!error && { borderColor: colors.danger },
        ]}
      >
        {left}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#94a3b8"
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.regular },
  errorTitle: { color: colors.danger, fontSize: 17, fontFamily: fonts.semibold },
  emptyTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.semibold },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow,
  },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  buttonSecondary: { backgroundColor: colors.primarySoft },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: fonts.semibold },
  label: { color: colors.text, fontSize: 13, fontFamily: fonts.medium, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: '#f8fafc',
    gap: spacing.sm,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, fontFamily: fonts.regular, paddingVertical: 12 },
  fieldError: { color: colors.danger, fontSize: 13, fontFamily: fonts.regular, marginTop: spacing.xs },
});
