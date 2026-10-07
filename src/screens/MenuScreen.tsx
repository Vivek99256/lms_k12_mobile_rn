import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { userMessage } from '../api/errors';
import { TileList } from '../components/TileList';
import { ErrorState, Loading, Page } from '../components/ui';
import { colors, fonts, gradients, radius, spacing } from '../config/theme';
import { useBootstrap } from '../hooks/useBootstrap';

export function MenuScreen() {
  const boot = useBootstrap();
  if (boot.isLoading) return <Loading />;
  if (boot.isError) return <ErrorState message={userMessage(boot.error)} onRetry={() => void boot.refetch()} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        <SafeAreaView edges={['top']} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.lg }}>
          <Text style={{ color: '#fff', fontSize: 24, fontFamily: fonts.bold }}>All services</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: fonts.regular, marginTop: 4 }}>
            {boot.menu.tiles.size} available for your role
          </Text>
        </SafeAreaView>
      </LinearGradient>
      <Page onRefresh={() => void boot.refetch()} refreshing={boot.isRefetching}>
        <TileList sections={boot.menu.sections} />
      </Page>
    </View>
  );
}
