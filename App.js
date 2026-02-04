import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Provider as PaperProvider } from 'react-native-paper';

// Screens
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import AddPatientScreen from './src/screens/AddPatientScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PatientsScreen from './src/screens/PatientsScreen';
import LocationTrackingScreen from './src/screens/LocationTrackingScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DeviceConnectionScreen from './src/screens/DeviceConnectionScreen';

// Services
import SMSListenerService from './src/services/smsListener.android';
import { PermissionsAndroid, Platform } from 'react-native';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Patients') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Device') {
            iconName = focused ? 'bluetooth' : 'bluetooth';
          } else if (route.name === 'Location') {
            iconName = focused ? 'location' : 'location-outline';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#00acc1',
        tabBarInactiveTintColor: '#00838f',
        tabBarStyle: {
          backgroundColor: '#f0f9fb',
          borderTopColor: '#00bcd4',
          borderTopWidth: 1,
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Patients" component={PatientsScreen} />
      <Tab.Screen name="Device" component={DeviceConnectionScreen} />
      <Tab.Screen name="Location" component={LocationTrackingScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  React.useEffect(() => {
    const setupSMSListener = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
            PermissionsAndroid.PERMISSIONS.READ_SMS,
          ]);

          if (
            granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED
          ) {
            console.log('SMS Permissions GRANTED');
            const initialized = await SMSListenerService.initialize();
            if (initialized) {
              await SMSListenerService.startListening();
            }
          } else {
            console.log('SMS Permissions DENIED');
          }
        } catch (err) {
          console.warn(err);
        }
      }
    };

    setupSMSListener();

    return () => {
      if (Platform.OS === 'android') {
        SMSListenerService.cleanup();
      }
    };
  }, []);

  return (
    <PaperProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="Splash"
              component={SplashScreen}
              options={{ animationEnabled: false }}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ animationEnabled: false }}
            />
            <Stack.Screen
              name="SignUp"
              component={SignUpScreen}
            />
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{ animationEnabled: false }}
            />
            <Stack.Screen
              name="AddPatient"
              component={AddPatientScreen}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </PaperProvider>
  );
}
