import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useAuthStore } from '../auth/authStore';
import { Loading } from '../components/ui';
import { colors, fonts, shadow } from '../config/theme';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TileScreen } from './TileScreen';
import { AuthStackParams, RootStackParams, TabParams } from './types';

const Auth = createNativeStackNavigator<AuthStackParams>();
const Root = createNativeStackNavigator<RootStackParams>();
const Tab = createBottomTabNavigator<TabParams>();

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary } };

const ICONS: Record<keyof TabParams, [React.ComponentProps<typeof Ionicons>['name'], React.ComponentProps<typeof Ionicons>['name']]> = {
  Home: ['home', 'home-outline'],
  Menu: ['grid', 'grid-outline'],
  Profile: ['person', 'person-outline'],
};

/** Tab icon that pops when it becomes the active tab. */
function TabIcon({ name, color, size, focused }: { name: React.ComponentProps<typeof Ionicons>['name']; color: string; size: number; focused: boolean }) {
  const s = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(s, { toValue: focused ? 1 : 0, friction: 4, tension: 180, useNativeDriver: true }).start();
  }, [focused, s]);
  return (
    <Animated.View
      style={{
        transform: [
          { scale: s.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) },
          { translateY: s.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
        ],
      }}
    >
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, marginBottom: 4 },
        tabBarStyle: { height: 68, paddingTop: 8, borderTopWidth: 0, backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, position: 'absolute', ...shadow },
        tabBarIcon: ({ focused, color, size }) => (
          <TabIcon name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/**
 * Two completely separate trees: unauthenticated users have no route to the app stack at all,
 * and signing out (including via a 401) swaps the tree, discarding every in-app route.
 */
export function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  if (status === 'restoring') return <Loading />;

  return (
    <NavigationContainer theme={theme}>
      {status === 'signedIn' ? (
        <Root.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: fonts.semibold },
            headerShadowVisible: false,
            headerBackTitle: 'Back',
            animation: 'slide_from_right',
          }}
        >
          <Root.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Root.Screen name="Tile" component={TileScreen} options={({ route }) => ({ title: route.params.title ?? '' })} />
        </Root.Navigator>
      ) : (
        <Auth.Navigator screenOptions={{ headerShown: false }}>
          <Auth.Screen name="Login" component={LoginScreen} />
        </Auth.Navigator>
      )}
    </NavigationContainer>
  );
}
