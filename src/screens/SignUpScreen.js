import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Card, Checkbox } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { authService } from '../services/supabase';

const SignUpScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!agreeTerms) {
      setError('Please agree to terms and conditions');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { user, error } = await authService.signUp(
        formData.email,
        formData.password,
        formData.firstName,
        formData.lastName
      );

      if (error) {
        setError(error);
        setLoading(false);
        return;
      }

      if (user) {
        // Clear form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: '',
        });
        setAgreeTerms(false);
        setError('');
        // Show success message
        alert('Account created successfully! Please log in with your credentials.');
        // Navigate to login screen
        navigation.replace('Login');
      }
    } catch (err) {
      setError('Sign up failed. Please try again.');
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
          <Button
            mode="text"
            onPress={() => navigation.goBack()}
            labelStyle={styles.backButton}
            icon="arrow-left"
          >
            Back
          </Button>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join CareMind as a Caregiver</Text>
        </View>

        {/* Sign Up Card */}
        <Card style={styles.card}>
          <Card.Content>
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

            {/* First Name */}
            <TextInput
              label="First Name"
              value={formData.firstName}
              onChangeText={(text) =>
                setFormData({ ...formData, firstName: text })
              }
              mode="outlined"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
              left={<TextInput.Icon icon="account" color="#00acc1" />}
            />

            {/* Last Name */}
            <TextInput
              label="Last Name"
              value={formData.lastName}
              onChangeText={(text) =>
                setFormData({ ...formData, lastName: text })
              }
              mode="outlined"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
              left={<TextInput.Icon icon="account" color="#00acc1" />}
            />

            {/* Email */}
            <TextInput
              label="Email"
              value={formData.email}
              onChangeText={(text) =>
                setFormData({ ...formData, email: text })
              }
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
              left={<TextInput.Icon icon="email" color="#00acc1" />}
            />

            {/* Phone */}
            <TextInput
              label="Phone (Optional)"
              value={formData.phone}
              onChangeText={(text) =>
                setFormData({ ...formData, phone: text })
              }
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
              left={<TextInput.Icon icon="phone" color="#00acc1" />}
            />

            {/* Password */}
            <TextInput
              label="Password"
              value={formData.password}
              onChangeText={(text) =>
                setFormData({ ...formData, password: text })
              }
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

            {/* Confirm Password */}
            <TextInput
              label="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(text) =>
                setFormData({ ...formData, confirmPassword: text })
              }
              mode="outlined"
              secureTextEntry={!showConfirmPassword}
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
              left={<TextInput.Icon icon="lock" color="#00acc1" />}
              right={
                <TextInput.Icon
                  icon={showConfirmPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  color="#00acc1"
                />
              }
            />

            {/* Terms Checkbox */}
            <View style={styles.checkboxContainer}>
              <Checkbox
                status={agreeTerms ? 'checked' : 'unchecked'}
                onPress={() => setAgreeTerms(!agreeTerms)}
                color="#00acc1"
              />
              <Text style={styles.checkboxLabel}>
                I agree to Terms & Conditions
              </Text>
            </View>

            {/* Sign Up Button */}
            <Button
              mode="contained"
              onPress={handleSignUp}
              loading={loading}
              disabled={loading}
              style={styles.signupButton}
              labelStyle={styles.buttonLabel}
            >
              Create Account
            </Button>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <Button
                mode="text"
                onPress={() => navigation.goBack()}
                labelStyle={styles.loginButton}
              >
                Sign In
              </Button>
            </View>
          </Card.Content>
        </Card>
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
  },
  header: {
    marginBottom: 30,
  },
  backButton: {
    color: '#00acc1',
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00acc1',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#00838f',
  },
  card: {
    borderRadius: 12,
    elevation: 3,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#00bcd4',
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
    marginBottom: 12,
    backgroundColor: '#f0f9fb',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  checkboxLabel: {
    marginLeft: 8,
    color: '#00838f',
    fontSize: 14,
  },
  signupButton: {
    marginTop: 8,
    backgroundColor: '#00acc1',
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  loginText: {
    color: '#00838f',
    fontSize: 14,
  },
  loginButton: {
    color: '#00acc1',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SignUpScreen;
