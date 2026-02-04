import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { authService } from '../services/supabase';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { user, error } = await authService.signIn(email, password);

      if (error) {
        setError(error);
        setLoading(false);
        return;
      }

      if (user) {
        // Clear form
        setEmail('');
        setPassword('');
        // Navigate to main tabs
        navigation.replace('MainTabs');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons
              name="heart-pulse"
              size={60}
              color="#ffffff"
            />
          </View>
          <Text style={styles.appName}>CareMind</Text>
          <Text style={styles.subtitle}>Caregiver Portal</Text>
        </View>

        {/* Login Card */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Sign In</Text>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={20}
                  color="#e74c3c"
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
              left={<TextInput.Icon icon="email" color="#00acc1" />}
            />

            {/* Password Input */}
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
              left={<TextInput.Icon icon="lock" color="#00acc1" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                  color="#00acc1"
                />
              }
            />

            {/* Login Button */}
            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.loginButton}
              labelStyle={styles.buttonLabel}
            >
              Sign In
            </Button>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.line} />
            </View>

            {/* Sign Up Link */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <Button
                mode="text"
                onPress={() => navigation.navigate('SignUp')}
                labelStyle={styles.signupButton}
              >
                Sign Up
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Demo Credentials */}
        <View style={styles.demoContainer}>
          <Text style={styles.demoTitle}>Demo Credentials</Text>
          <Text style={styles.demoText}>Email: demo@caremind.com</Text>
          <Text style={styles.demoText}>Password: demo123</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9fb',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#00acc1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#00acc1',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00acc1',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#00838f',
    fontWeight: '500',
  },
  card: {
    borderRadius: 12,
    elevation: 3,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#00bcd4',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00acc1',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#e74c3c',
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#f0f9fb',
  },
  loginButton: {
    marginTop: 8,
    backgroundColor: '#00acc1',
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#b2ebf2',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#00838f',
    fontWeight: '500',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  signupText: {
    color: '#00838f',
    fontSize: 14,
  },
  signupButton: {
    color: '#00acc1',
    fontSize: 14,
    fontWeight: '600',
  },
  demoContainer: {
    backgroundColor: '#e0f7fa',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00acc1',
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00838f',
    marginBottom: 4,
  },
  demoText: {
    fontSize: 12,
    color: '#00838f',
    marginBottom: 2,
  },
});

export default LoginScreen;
