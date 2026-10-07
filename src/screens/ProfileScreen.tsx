import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as Updates from 'expo-updates';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../auth/authStore';
import { Button, Card, Page } from '../components/ui';
import { colors, fonts, gradients, radius, spacing } from '../config/theme';

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const initials = (user?.name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const rows: [React.ComponentProps<typeof Ionicons>['name'], string, string][] = [
    ['mail-outline', 'Email', user?.email ?? ''],
    ['shield-checkmark-outline', 'Role', user?.userProfileName ?? ''],
    ['business-outline', 'School', user?.schoolName ?? ''],
    ['phone-portrait-outline', 'App version', Constants.expoConfig?.version ?? ''],
    ['cloud-download-outline', 'Update', Updates.isEnabled ? (Updates.updateId ?? 'embedded').slice(0, 8) : 'off'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        <SafeAreaView edges={['top']} style={{ alignItems: 'center', paddingVertical: spacing.lg + 4, gap: 6 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 30, fontFamily: fonts.bold }}>{initials}</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 20, fontFamily: fonts.bold }}>{user?.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: fonts.regular }}>{user?.userProfileName}</Text>
        </SafeAreaView>
      </LinearGradient>
      <Page>
        <View style={{ gap: spacing.lg }}>
          <Card>
            {rows.map(([icon, k, v], i) => (
              <View
                key={k}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: 12,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular }}>{k}</Text>
                  <Text style={{ color: colors.text, fontFamily: fonts.semibold }} numberOfLines={1}>
                    {v}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
          <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
        </View>
      </Page>
    </View>
  );
}
