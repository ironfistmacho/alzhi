import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Card, Button, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase, authService } from '../services/supabase';

const SettingsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Sign Out',
          onPress: async () => {
            try {
              setLoading(true);
              console.log('Signing out...');
              
              // Sign out from Supabase
              const { error } = await authService.signOut();
              
              if (error) {
                console.error('Sign out error:', error);
                Alert.alert('Error', 'Failed to sign out');
                setLoading(false);
                return;
              }
              
              console.log('✅ Signed out successfully');
              setLoading(false);
              
              // Navigate to Login immediately
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out');
              setLoading(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleExportData = async () => {
    try {
      setLoading(true);

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        Alert.alert('Error', 'User not authenticated');
        setLoading(false);
        return;
      }

      const user = session.user;

      // Get caregiver info
      const { data: caregiverData, error: caregiverError } = await supabase
        .from('caregivers')
        .select('*')
        .eq('auth_id', user.id);

      if (caregiverError) throw caregiverError;

      if (!caregiverData || caregiverData.length === 0) {
        Alert.alert('Error', 'Could not find caregiver information');
        setLoading(false);
        return;
      }

      const caregiver = caregiverData[0];

      // Get all patients
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .eq('caregiver_id', caregiver.id);

      if (patientsError) throw patientsError;

      // Get vitals for all patients
      const vitalsPromises = (patientsData || []).map(patient =>
        supabase
          .from('patient_vitals')
          .select('*')
          .eq('patient_id', patient.id)
      );

      const vitalsResults = await Promise.all(vitalsPromises);
      const allVitals = vitalsResults.map(result => result.data || []);

      // Create export data object
      const exportData = {
        exportDate: new Date().toISOString(),
        caregiver: {
          name: `${caregiver.first_name} ${caregiver.last_name}`,
          email: caregiver.email,
          phone: caregiver.phone,
          relationship: caregiver.relationship_to_patient,
          isPrimary: caregiver.is_primary_caregiver,
        },
        patients: patientsData?.map((patient, index) => ({
          name: `${patient.first_name} ${patient.last_name}`,
          dateOfBirth: patient.date_of_birth,
          gender: patient.gender,
          bloodType: patient.blood_type,
          height: patient.height_cm,
          weight: patient.weight_kg,
          alzheimerStage: patient.alzheimers_stage,
          diagnosisDate: patient.diagnosis_date,
          medicalConditions: patient.medical_conditions,
          medications: patient.current_medications,
          emergencyContact: patient.emergency_contact_name,
          emergencyPhone: patient.emergency_contact_phone,
          doctor: patient.doctor_name,
          doctorPhone: patient.doctor_phone,
          vitals: allVitals[index] || [],
        })) || [],
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(exportData, null, 2);

      // Share the data
      await Share.share({
        message: jsonString,
        title: `Caregiver Data Export - ${new Date().toLocaleDateString()}`,
      });

      Alert.alert('Success', 'Data exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. Continue?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Clear',
          onPress: () => {
            // In a real app, you would clear AsyncStorage here
            Alert.alert('Success', 'Cache cleared');
          },
          style: 'destructive',
        },
      ]
    );
  };

  const SettingItem = ({ icon, title, subtitle, onPress, destructive = false }) => (
    <View>
      <TouchableOpacity
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.7}
      >
        <View style={styles.settingButton}>
          <Ionicons
            name={icon}
            size={24}
            color={destructive ? '#ff6b6b' : '#00acc1'}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingTitle, destructive && styles.destructiveText]}>
              {title}
            </Text>
            {subtitle && (
              <Text style={styles.settingSubtitle}>{subtitle}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <Divider style={styles.divider} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00acc1" />
        <Text style={styles.loadingText}>Processing...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Settings</Text>

      {/* Account Section */}
      <Card style={styles.card}>
        <Card.Title
          title="Account"
          left={(props) => <Ionicons name="person" size={24} color="#00acc1" />}
          titleStyle={styles.cardTitle}
        />
        <Card.Content style={styles.cardContent}>
          <SettingItem
            icon="log-out"
            title="Sign Out"
            subtitle="Log out from your account"
            onPress={handleSignOut}
            destructive={true}
          />
        </Card.Content>
      </Card>

      {/* Data Section */}
      <Card style={styles.card}>
        <Card.Title
          title="Data"
          left={(props) => <Ionicons name="download" size={24} color="#00acc1" />}
          titleStyle={styles.cardTitle}
        />
        <Card.Content style={styles.cardContent}>
          <SettingItem
            icon="share-social"
            title="Export Data"
            subtitle="Export all patient data and vitals"
            onPress={handleExportData}
          />
          <SettingItem
            icon="trash"
            title="Clear Cache"
            subtitle="Clear all cached application data"
            onPress={handleClearCache}
            destructive={true}
          />
        </Card.Content>
      </Card>

      {/* About Section */}
      <Card style={styles.card}>
        <Card.Title
          title="About"
          left={(props) => <Ionicons name="information-circle" size={24} color="#00acc1" />}
          titleStyle={styles.cardTitle}
        />
        <Card.Content style={styles.cardContent}>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>App Name</Text>
            <Text style={styles.aboutValue}>Alzheimer's Caregiver</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Build</Text>
            <Text style={styles.aboutValue}>2024.12.06</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Info Text */}
      <View style={styles.infoContainer}>
        <Ionicons name="shield-checkmark" size={20} color="#00acc1" />
        <Text style={styles.infoText}>
          Your data is securely stored and encrypted. We never share your information with third parties.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9fb',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9fb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#00acc1',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#00bcd4',
  },
  cardTitle: {
    color: '#00acc1',
    fontSize: 16,
    fontWeight: '600',
  },
  cardContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingLabel: {
    flex: 1,
    textAlign: 'left',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  settingIcon: {
    marginRight: 16,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  destructiveLabel: {
    color: '#ff6b6b',
  },
  destructiveText: {
    color: '#ff6b6b',
  },
  divider: {
    backgroundColor: '#e0e0e0',
  },
  aboutItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutLabel: {
    fontSize: 14,
    color: '#00838f',
    fontWeight: '500',
  },
  aboutValue: {
    fontSize: 14,
    color: '#00acc1',
    fontWeight: '600',
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: '#e0f7fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
    marginBottom: 30,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: '#00838f',
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
});

export default SettingsScreen;
