import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { TextInput, Button, Card, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { patientService, supabase } from '../services/supabase';

const AddPatientScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'male',
    bloodType: 'O+',
    height: '',
    weight: '',
    alzheimerStage: 'early',
    diagnosisDate: '',
    medicalConditions: '',
    medications: '',
    emergencyContact: '',
    emergencyPhone: '',
    doctorName: '',
    doctorPhone: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddPatient = async () => {
    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth) {
      setError('Please fill in required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError('Please log in first');
        setLoading(false);
        return;
      }

      const user = session.user;
      console.log('Adding patient for user:', user.id);

      // Get caregiver ID first
      const { data: caregiverData, error: caregiverError } = await supabase
        .from('caregivers')
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (caregiverError || !caregiverData) {
        setError('Caregiver not found. Please sign up first.');
        setLoading(false);
        return;
      }

      console.log('Caregiver ID:', caregiverData.id);

      // Add patient with caregiver_id
      const { patient, error } = await patientService.addPatient(
        caregiverData.id,
        formData
      );

      if (error) {
        setError(error);
        setLoading(false);
        return;
      }

      if (patient) {
        // Reset form immediately
        setFormData({
          firstName: '',
          lastName: '',
          dateOfBirth: '',
          gender: 'male',
          bloodType: 'O+',
          height: '',
          weight: '',
          alzheimerStage: 'early',
          diagnosisDate: '',
          medicalConditions: '',
          medications: '',
          emergencyContact: '',
          emergencyPhone: '',
          doctorName: '',
          doctorPhone: '',
          notes: '',
        });
        setError('');
        setLoading(false);
        
        console.log('✅ Patient added successfully');
        
        // Navigate back to Patients tab immediately
        navigation.navigate('MainTabs', { screen: 'Patients' });
        
        // Show success message after navigation
        setTimeout(() => {
          Alert.alert('Success', 'Patient added successfully!');
        }, 500);
      }
    } catch (err) {
      console.error('Error adding patient:', err);
      setError('Failed to add patient. Please try again.');
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
          <Text style={styles.title}>Add New Patient</Text>
        </View>

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

        {/* Personal Information */}
        <Card style={styles.card}>
          <Card.Title
            title="Personal Information"
            left={(props) => (
              <MaterialCommunityIcons
                name="account"
                size={24}
                color="#00acc1"
              />
            )}
            titleStyle={styles.cardTitle}
          />
          <Card.Content>
            <TextInput
              label="First Name *"
              value={formData.firstName}
              onChangeText={(text) =>
                setFormData({ ...formData, firstName: text })
              }
              mode="outlined"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
            />

            <TextInput
              label="Last Name *"
              value={formData.lastName}
              onChangeText={(text) =>
                setFormData({ ...formData, lastName: text })
              }
              mode="outlined"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
            />

            <TextInput
              label="Date of Birth (YYYY-MM-DD) *"
              value={formData.dateOfBirth}
              onChangeText={(text) =>
                setFormData({ ...formData, dateOfBirth: text })
              }
              mode="outlined"
              placeholder="2000-01-01"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
            />

            <Text style={styles.label}>Gender</Text>
            <SegmentedButtons
              value={formData.gender}
              onValueChange={(value) =>
                setFormData({ ...formData, gender: value })
              }
              buttons={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
              style={styles.segmentedButton}
            />

            <TextInput
              label="Blood Type"
              value={formData.bloodType}
              onChangeText={(text) =>
                setFormData({ ...formData, bloodType: text })
              }
              mode="outlined"
              placeholder="O+"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
            />

            <View style={styles.row}>
              <TextInput
                label="Height (cm)"
                value={formData.height}
                onChangeText={(text) =>
                  setFormData({ ...formData, height: text })
                }
                mode="outlined"
                keyboardType="decimal-pad"
                style={[styles.input, styles.halfInput]}
                outlineColor="#b2ebf2"
                activeOutlineColor="#00acc1"
              />
              <TextInput
                label="Weight (kg)"
                value={formData.weight}
                onChangeText={(text) =>
                  setFormData({ ...formData, weight: text })
                }
                mode="outlined"
                keyboardType="decimal-pad"
                style={[styles.input, styles.halfInput]}
                outlineColor="#b2ebf2"
                activeOutlineColor="#00acc1"
              />
            </View>
          </Card.Content>
        </Card>

        {/* Medical Information */}
        <Card style={styles.card}>
          <Card.Title
            title="Medical Information"
            left={(props) => (
              <MaterialCommunityIcons
                name="hospital-box"
                size={24}
                color="#00acc1"
              />
            )}
            titleStyle={styles.cardTitle}
          />
          <Card.Content>
            <Text style={styles.label}>Alzheimer's Stage</Text>
            <SegmentedButtons
              value={formData.alzheimerStage}
              onValueChange={(value) =>
                setFormData({ ...formData, alzheimerStage: value })
              }
              buttons={[
                { value: 'early', label: 'Early' },
                { value: 'middle', label: 'Middle' },
                { value: 'late', label: 'Late' },
              ]}
              style={styles.segmentedButton}
            />

            <TextInput
              label="Diagnosis Date (YYYY-MM-DD)"
              value={formData.diagnosisDate}
              onChangeText={(text) =>
                setFormData({ ...formData, diagnosisDate: text })
              }
              mode="outlined"
              placeholder="2020-01-01"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
            />

            <TextInput
              label="Medical Conditions"
              value={formData.medicalConditions}
              onChangeText={(text) =>
                setFormData({ ...formData, medicalConditions: text })
              }
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="e.g., Diabetes, Hypertension"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
            />

            <TextInput
              label="Current Medications"
              value={formData.medications}
              onChangeText={(text) =>
                setFormData({ ...formData, medications: text })
              }
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="e.g., Aricept 10mg, Namenda 20mg"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
            />

            <TextInput
              label="Additional Notes"
              value={formData.notes}
              onChangeText={(text) =>
                setFormData({ ...formData, notes: text })
              }
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
            />
          </Card.Content>
        </Card>

        {/* Emergency & Doctor Information */}
        <Card style={styles.card}>
          <Card.Title
            title="Emergency & Doctor Info"
            left={(props) => (
              <MaterialCommunityIcons
                name="phone-alert"
                size={24}
                color="#00acc1"
              />
            )}
            titleStyle={styles.cardTitle}
          />
          <Card.Content>
            <TextInput
              label="Emergency Contact Name"
              value={formData.emergencyContact}
              onChangeText={(text) =>
                setFormData({ ...formData, emergencyContact: text })
              }
              mode="outlined"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
            />

            <TextInput
              label="Emergency Contact Phone"
              value={formData.emergencyPhone}
              onChangeText={(text) =>
                setFormData({ ...formData, emergencyPhone: text })
              }
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
            />

            <TextInput
              label="Doctor Name"
              value={formData.doctorName}
              onChangeText={(text) =>
                setFormData({ ...formData, doctorName: text })
              }
              mode="outlined"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
            />

            <TextInput
              label="Doctor Phone"
              value={formData.doctorPhone}
              onChangeText={(text) =>
                setFormData({ ...formData, doctorPhone: text })
              }
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
              outlineColor="#b2ebf2"
              activeOutlineColor="#00acc1"
            />
          </Card.Content>
        </Card>

        {/* Add Button */}
        <Button
          mode="contained"
          onPress={handleAddPatient}
          loading={loading}
          disabled={loading}
          style={styles.addButton}
          labelStyle={styles.buttonLabel}
        >
          Add Patient
        </Button>
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
    paddingBottom: 30,
  },
  header: {
    marginBottom: 20,
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
  card: {
    borderRadius: 12,
    elevation: 2,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#00bcd4',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#00acc1',
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00838f',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#f0f9fb',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 1,
    marginRight: 8,
  },
  segmentedButton: {
    marginBottom: 12,
  },
  addButton: {
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: '#00acc1',
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddPatientScreen;
