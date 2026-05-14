import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';

// Import screens
import DashboardScreen from './src/screens/DashboardScreen';
import ProjectsScreen from './src/screens/ProjectsScreen';
import FinanceScreen from './src/screens/FinanceScreen';
import CRMScreen from './src/screens/CRMScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProjectDetailScreen from './src/screens/ProjectDetailScreen';
import LeadDetailScreen from './src/screens/LeadDetailScreen';
import InvoiceDetailScreen from './src/screens/InvoiceDetailScreen';

// Import components
import TabBarIcon from './src/components/TabBarIcon';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';

type TabIconProps = {
  color: string;
  size: number;
};

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#020D1A',
          borderTopColor: '#1E293B',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#00D2A0',
        tabBarInactiveTintColor: '#64748B',
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <TabBarIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="Projects" 
        component={ProjectsScreen}
        options={{
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <TabBarIcon name="folder" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="CRM" 
        component={CRMScreen}
        options={{
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <TabBarIcon name="people" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="Finance" 
        component={FinanceScreen}
        options={{
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <TabBarIcon name="cash" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <TabBarIcon name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
          <Stack.Screen name="LeadDetail" component={LeadDetailScreen} />
          <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="light" />
            <Toast />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
