import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { callAuto } from '../api/client';
import { userMessage } from '../api/errors';
import { useAuthStore } from '../auth/authStore';
import { DataView } from '../components/DataView';
import { Floating, Skeleton, Wave } from '../components/motion';
import { QuickActions, TileList } from '../components/TileList';
import { Card, ErrorState } from '../components/ui';
import { colors, fonts, gradients, radius, shadow, spacing } from '../config/theme';
import { useBootstrap } from '../hooks/useBootstrap';
import { dashboardEndpoint } from '../utils/helpers';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Dashboard({ roleName }: { roleName: string }) {
  const q = useQuery({
    queryKey: ['dashboard', roleName],
    queryFn: () => callAuto(dashboardEndpoint(roleName)),
    retry: 1,
  });
  if (q.isLoading) {
    return (
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm + 2 }}>
          <Skeleton style={{ flex: 1 }} height={96} />
          <Skeleton style={{ flex: 1 }} height={96} />
        </View>
      </View>
    );
  }
  // A dashboard failure must not hide the menu below it.
  if (q.isError) {
    return (
      <Card>
        <Text style={{ color: colors.textMuted, fontFamily: fonts.regular }}>Dashboard unavailable: {userMessage(q.error)}</Text>
      </Card>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ fontSize: 19, fontFamily: fonts.bold, color: colors.text }}>Your day at a glance</Text>
      <DataView data={q.data?.data} />
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md, paddingTop: 70, gap: spacing.md }}>
      <Skeleton height={170} radius={radius.xl} />
      <Skeleton height={128} style={{ width: 128 }} />
      <Skeleton height={76} />
      <Skeleton height={76} />
    </View>
  );
}

export function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const boot = useBootstrap();

  if (boot.isLoading) return <HomeSkeleton />;
  if (boot.isError) return <ErrorState message={userMessage(boot.error)} onRetry={() => void boot.refetch()} />;

  const initials = (user?.name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const allTiles = boot.menu.sections.flatMap((s) => s.tiles);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={boot.isRefetching} onRefresh={() => void boot.refetch()} tintColor={colors.primary} />}
      >
        <SafeAreaView edges={['top']} style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.xl, padding: spacing.lg, overflow: 'hidden', ...shadow }}
          >
            <Floating amplitude={10} duration={2600} style={{ position: 'absolute', right: -30, top: -30 }}>
              <View style={{ width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.16)' }} />
            </Floating>
            <Floating amplitude={7} duration={2000} style={{ position: 'absolute', right: 70, bottom: -26 }}>
              <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(126,217,87,0.75)' }} />
            </Floating>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 22,
                  backgroundColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ rotate: '-6deg' }],
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 22, fontFamily: fonts.bold }}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontFamily: fonts.medium }}>{greeting()}</Text>
                  <Wave size={18} />
                </View>
                <Text style={{ color: '#fff', fontSize: 22, fontFamily: fonts.bold }} numberOfLines={1}>
                  {user?.name}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
              <View style={{ backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 }}>
                <Text style={{ color: colors.primary, fontSize: 12, fontFamily: fonts.bold }}>🎒 {user?.userProfileName}</Text>
              </View>
              {user?.schoolName ? (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, maxWidth: '100%' }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontFamily: fonts.semibold }} numberOfLines={1}>
                    🏫 {user.schoolName}
                  </Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </SafeAreaView>

        <View style={{ padding: spacing.md, gap: spacing.lg }}>
          <QuickActions tiles={allTiles.slice(0, 8)} />
          <Dashboard roleName={boot.permissions.roleName || user?.userProfileName || ''} />
          <TileList sections={boot.menu.sections} />
        </View>
      </ScrollView>
    </View>
  );
}
