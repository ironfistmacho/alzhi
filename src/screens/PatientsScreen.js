import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { Card, Button, ActivityIndicator, FAB } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '../services/supabase';
import ManualVitalsModal from '../components/ManualVitalsModal';

const PatientsScreen = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [caregiverId, setCaregiverId] = useState(null);
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [lastFetch, setLastFetch] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('bp'); // 'bp' or 'glucose'
  const [selectedPatient, setSelectedPatient] = useState(null);
  const navigation = useNavigation();

  // Fetch caregiver ID and patients when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Always refetch when screen is focused (user might have added patient)
      console.log('Screen focused, fetching patients');
      fetchCaregiverAndPatients();
      setLastFetch(Date.now());
    }, [caregiverId])
  );

  const fetchCaregiverAndPatients = async () => {
    try {
      setLoading(true);

      // If we already have caregiver ID, just fetch patients
      if (caregiverId) {
        console.log('✅ Using cached caregiver ID:', caregiverId);
        await fetchPatients(caregiverId);
        return;
      }

      // Get session (no retry needed on first load)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error('Error getting session:', sessionError);
        setPatients([]);
        setLoading(false);
        return;
      }

      const user = session.user;
      console.log('✅ Fetching caregiver for user:', user.id);

      // Get caregiver ID (only once)
      const { data: caregiverData, error: caregiverError } = await supabase
        .from('caregivers')
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (caregiverError) {
        console.error('Error fetching caregiver:', caregiverError);
        setPatients([]);
        setLoading(false);
        return;
      }

      if (!caregiverData) {
        console.warn('No caregiver found for user');
        setPatients([]);
        setLoading(false);
        return;
      }

      console.log('✅ Caregiver found:', caregiverData.id);
      setCaregiverId(caregiverData.id);

      // Fetch patients for this caregiver
      await fetchPatients(caregiverData.id);
    } catch (error) {
      console.error('Error fetching caregiver:', error);
      setPatients([]);
      setLoading(false);
    }
  };

  const fetchPatients = async (cId) => {
    try {
      console.log('Fetching patients for caregiver:', cId);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('caregiver_id', cId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('✅ Patients loaded:', data?.length || 0);

      // Fetch latest vitals for each patient
      if (data && data.length > 0) {
        const patientsWithVitals = await Promise.all(
          data.map(async (patient) => {
            try {
              const { data: vitalsData } = await supabase
                .from('patient_vitals')
                .select('*')
                .eq('patient_id', patient.id)
                .order('created_at', { ascending: false })
                .limit(1);

              return {
                ...patient,
                latestVital: vitalsData && vitalsData.length > 0 ? vitalsData[0] : null,
              };
            } catch (err) {
              console.error('Error fetching vitals for patient:', patient.id, err);
              return { ...patient, latestVital: null };
            }
          })
        );
        setPatients(patientsWithVitals);
      } else {
        setPatients(data || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching patients:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to load patients');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (caregiverId) {
      await fetchPatients(caregiverId);
    }
    setRefreshing(false);
  };

  const fetchPatientVitals = async (patientId) => {
    try {
      const { data, error } = await supabase
        .from('patient_vitals')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching vitals:', error);
      return [];
    }
  };

  const handleDownloadCSV = async (patient) => {
    try {
      const { data, error } = await supabase
        .from('patient_vitals')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        Alert.alert('No Data', 'No vitals records found to export.');
        return;
      }

      // Create CSV
      const headers = ['Date', 'Heart Rate', 'SpO2', 'Temperature', 'Blood Glucose', 'Context', 'Systolic BP', 'Diastolic BP', 'Resp Rate', 'Notes', 'Source'];
      const rows = data.map(v => [
        `"${new Date(v.created_at).toLocaleString()}"`,
        v.heart_rate || '',
        v.spo2 || '',
        v.temperature || '',
        v.blood_glucose || '',
        `"${v.glucose_context || ''}"`,
        v.systolic_bp || '',
        v.diastolic_bp || '',
        v.respiratory_rate || '',
        `"${(v.notes || '').replace(/"/g, '""')}"`,
        v.data_source || ''
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      const fileName = `Vitals_${patient.first_name}_${patient.last_name}_${Date.now()}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Export Error:', error);
      Alert.alert('Error', 'Failed to export CSV: ' + error.message);
    }
  };

  const togglePatientExpand = async (patientId) => {
    if (expandedPatientId === patientId) {
      setExpandedPatientId(null);
    } else {
      setExpandedPatientId(patientId);
    }
  };

  const handleAddPatient = () => {
    navigation.navigate('AddPatient');
  };

  const handleDeletePatient = async (patientId) => {
    Alert.alert(
      'Delete Patient',
      'Are you sure you want to delete this patient?',
      [
        { text: 'Cancel', onPress: () => { } },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('patients')
                .delete()
                .eq('id', patientId);

              if (error) throw error;
              Alert.alert('Success', 'Patient deleted successfully');
              if (caregiverId) {
                await fetchPatients(caregiverId);
              }
            } catch (error) {
              console.error('Error deleting patient:', error);
              Alert.alert('Error', 'Failed to delete patient');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleManualVitalsSave = async (data) => {
    try {
      if (!selectedPatient) return;

      const { error } = await supabase
        .from('patient_vitals')
        .insert([{
          patient_id: selectedPatient.id,
          ...data,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      Alert.alert('Success', 'Vitals saved successfully');

      // Refresh patients to show latest vitals in preview
      if (caregiverId) {
        await fetchPatients(caregiverId);
      }
    } catch (error) {
      console.error('Error saving manual vitals:', error);
      Alert.alert('Error', 'Failed to save vitals');
    }
  };

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const PatientCard = ({ patient }) => {
    const [vitals, setVitals] = useState([]);
    const [loadingVitals, setLoadingVitals] = useState(false);

    const handleExpand = async () => {
      if (expandedPatientId !== patient.id) {
        setLoadingVitals(true);
        const vitalData = await fetchPatientVitals(patient.id);
        setVitals(vitalData);
        setLoadingVitals(false);
      }
      togglePatientExpand(patient.id);
    };

    return (
      <Card style={styles.patientCard}>
        <TouchableOpacity onPress={handleExpand} activeOpacity={0.7}>
          <Card.Content style={styles.patientHeader}>
            <View style={styles.patientInfo}>
              <Ionicons name="person-circle" size={40} color="#00acc1" />
              <View style={styles.patientDetails}>
                <Text style={styles.patientName}>
                  {patient.first_name} {patient.last_name}
                </Text>
                <Text style={styles.patientAge}>Age: {calculateAge(patient.date_of_birth)}</Text>
                <Text style={styles.patientCondition}>
                  {patient.alzheimers_stage ? `Stage: ${patient.alzheimers_stage}` : 'No stage specified'}
                </Text>
                {/* Display latest vitals if available */}
                {patient.latestVital && (
                  <View style={styles.vitalsPreview}>
                    <Text style={styles.vitalsText}>
                      💓 {patient.latestVital.heart_rate || '--'} bpm |
                      🫁 {patient.latestVital.spo2 || '--'}% |
                      🌡️ {patient.latestVital.temperature || '--'}°C
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.headerActions}>
              <View style={styles.entryButtons}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedPatient(patient);
                    setModalType('bp');
                    setModalVisible(true);
                  }}
                  style={[styles.miniButton, { backgroundColor: '#e1f5fe' }]}
                >
                  <Text style={[styles.miniButtonText, { color: '#0288d1' }]}>Add BP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedPatient(patient);
                    setModalType('glucose');
                    setModalVisible(true);
                  }}
                  style={[styles.miniButton, { backgroundColor: '#f3e5f5' }]}
                >
                  <Text style={[styles.miniButtonText, { color: '#7b1fa2' }]}>Add Sugar</Text>
                </TouchableOpacity>
              </View>
              <Ionicons
                name={expandedPatientId === patient.id ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#00acc1"
              />
            </View>
          </Card.Content>
        </TouchableOpacity>

        {expandedPatientId === patient.id && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />

            {/* Patient Details */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Patient Information</Text>
              <Text style={styles.detailText}>
                � Name: {patient.first_name} {patient.last_name}
              </Text>
              <Text style={styles.detailText}>
                📅 DOB: {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'Not provided'}
              </Text>
              <Text style={styles.detailText}>
                ⚧️ Gender: {patient.gender || 'Not provided'}
              </Text>
              <Text style={styles.detailText}>
                🩸 Blood Type: {patient.blood_type || 'Not provided'}
              </Text>
              <Text style={styles.detailText}>
                � Height: {patient.height_cm ? `${patient.height_cm} cm` : 'Not provided'}
              </Text>
              <Text style={styles.detailText}>
                ⚖️ Weight: {patient.weight_kg ? `${patient.weight_kg} kg` : 'Not provided'}
              </Text>
              <Text style={styles.detailText}>
                🧠 Alzheimer's Stage: {patient.alzheimers_stage || 'Not specified'}
              </Text>
              {patient.diagnosis_date && (
                <Text style={styles.detailText}>
                  📋 Diagnosis Date: {new Date(patient.diagnosis_date).toLocaleDateString()}
                </Text>
              )}
              {patient.medical_conditions && (
                <Text style={styles.detailText}>
                  🏥 Medical Conditions: {patient.medical_conditions}
                </Text>
              )}
              {patient.current_medications && (
                <Text style={styles.detailText}>
                  💊 Medications: {patient.current_medications}
                </Text>
              )}
              {patient.emergency_contact_name && (
                <Text style={styles.detailText}>
                  🚨 Emergency Contact: {patient.emergency_contact_name}
                </Text>
              )}
              {patient.emergency_contact_phone && (
                <Text style={styles.detailText}>
                  📞 Emergency Phone: {patient.emergency_contact_phone}
                </Text>
              )}
              {patient.doctor_name && (
                <Text style={styles.detailText}>
                  👨‍⚕️ Doctor: {patient.doctor_name}
                </Text>
              )}
            </View>

            {/* Vitals Section */}
            <View style={styles.vitalsSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={styles.sectionTitle}>Recent Vitals</Text>
                <Button
                  mode="outlined"
                  compact
                  icon="download"
                  onPress={() => handleDownloadCSV(patient)}
                  labelStyle={{ fontSize: 12 }}
                >
                  Export CSV
                </Button>
              </View>
              {loadingVitals ? (
                <ActivityIndicator size="small" color="#00acc1" />
              ) : vitals.length > 0 ? (
                vitals.map((vital, index) => (
                  <View key={index} style={styles.vitalItem}>
                    <View style={styles.vitalRow}>
                      <Text style={styles.vitalLabel}>❤️ Heart Rate:</Text>
                      <Text style={styles.vitalValue}>{vital.heart_rate || '--'} BPM</Text>
                    </View>
                    <View style={styles.vitalRow}>
                      <Text style={styles.vitalLabel}>🫁 SpO2:</Text>
                      <Text style={styles.vitalValue}>{vital.spo2 || '--'}%</Text>
                    </View>
                    <View style={styles.vitalRow}>
                      <Text style={styles.vitalLabel}>🌡️ Temperature:</Text>
                      <Text style={styles.vitalValue}>{vital.temperature || '--'}°C</Text>
                    </View>
                    <View style={styles.vitalRow}>
                      <Text style={styles.vitalLabel}>💉 Glucose:</Text>
                      <Text style={styles.vitalValue}>
                        {vital.blood_glucose || '--'} mg/dL
                        {vital.glucose_context ? ` (${vital.glucose_context.replace('_', ' ')})` : ''}
                      </Text>
                    </View>
                    <View style={styles.vitalRow}>
                      <Text style={styles.vitalLabel}>🩸 BP:</Text>
                      <Text style={styles.vitalValue}>
                        {vital.systolic_bp && vital.diastolic_bp
                          ? `${vital.systolic_bp}/${vital.diastolic_bp}`
                          : '--/--'} mmHg
                      </Text>
                    </View>
                    <View style={styles.vitalRow}>
                      <Text style={styles.vitalLabel}>💨 Resp. Rate:</Text>
                      <Text style={styles.vitalValue}>{vital.respiratory_rate || '--'} rpm</Text>
                    </View>
                    {vital.notes && (
                      <View style={styles.vitalNoteRow}>
                        <Text style={styles.vitalLabel}>📝 Notes:</Text>
                        <Text style={styles.vitalNoteText}>
                          {vital.notes}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.vitalTime}>
                      {new Date(vital.created_at).toLocaleString()}
                    </Text>
                  </View>
                ))
              ) : null}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                onPress={() => handleDeletePatient(patient.id)}
                style={styles.deleteButton}
                labelStyle={styles.buttonLabel}
              >
                Delete
              </Button>
            </View>
          </View>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00acc1" />
        <Text style={styles.loadingText}>Loading patients...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Your Patients</Text>
        <Text style={styles.subHeader}>{patients.length} patient(s)</Text>
      </View>

      {patients.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="person-add" size={64} color="#b2ebf2" />
          <Text style={styles.emptyText}>No patients added yet</Text>
          <Text style={styles.emptySubText}>
            Tap the + button to add your first patient
          </Text>
        </View>
      ) : (
        <FlatList
          data={patients}
          renderItem={({ item }) => <PatientCard patient={item} />}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <FAB
        icon="plus"
        color="white"
        style={styles.fab}
        onPress={handleAddPatient}
      />

      <ManualVitalsModal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        onSave={handleManualVitalsSave}
        patientName={selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : ''}
        type={modalType}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#f0f9fb',
    borderBottomWidth: 1,
    borderBottomColor: '#b2ebf2',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00838f',
  },
  subHeader: {
    fontSize: 14,
    color: '#00acc1',
    marginTop: 4,
  },
  listContent: {
    padding: 12,
  },
  patientCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 3,
    backgroundColor: 'white',
    borderLeftWidth: 4,
    borderLeftColor: '#00acc1',
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryButtons: {
    flexDirection: 'column',
    gap: 4,
    marginRight: 8,
  },
  miniButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  miniButtonText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  patientDetails: {
    marginLeft: 12,
    flex: 1,
  },
  patientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  patientAge: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  patientCondition: {
    fontSize: 12,
    color: '#00acc1',
    marginTop: 2,
    fontStyle: 'italic',
  },
  vitalsPreview: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  vitalsText: {
    fontSize: 11,
    color: '#00838f',
    fontWeight: '500',
  },
  expandedContent: {
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  detailsSection: {
    marginBottom: 16,
  },
  vitalsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00838f',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    lineHeight: 20,
  },
  vitalItem: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00bcd4',
  },
  vitalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  vitalLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  vitalValue: {
    fontSize: 13,
    color: '#00acc1',
    fontWeight: 'bold',
  },
  vitalTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 6,
    fontStyle: 'italic',
  },
  vitalNoteRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  vitalNoteText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  deleteButton: {
    backgroundColor: '#ff6b6b',
    borderRadius: 6,
  },
  buttonLabel: {
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#00acc1',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default PatientsScreen;
