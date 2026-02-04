import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Card, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useCallback } from 'react';

const ClockCard = React.memo(() => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Card style={styles.timerCard}>
      <Card.Content style={styles.timerContent}>
        <View style={styles.timerIconContainer}>
          <Ionicons name="time" size={48} color="#00acc1" />
        </View>
        <View style={styles.timerTextContainer}>
          <Text style={styles.timerLabel}>Current Time</Text>
          <Text style={styles.timerDisplay}>{formatTime(time)}</Text>
          <Text style={styles.dateDisplay}>{formatDate(time)}</Text>
        </View>
      </Card.Content>
    </Card>
  );
});

const DashboardScreen = ({ navigation }) => {
  const [caregiver, setCaregiver] = useState(null);
  const [patientCount, setPatientCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch caregiver info
  const fetchCaregiverInfo = useCallback(async (force = false) => {
    // If we already have data and not forcing refresh, skip
    if (caregiver && !force) {
      setLoading(false);
      return;
    }

    try {
      if (!caregiver) setLoading(true); // Only show loading if we don't have data yet

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.warn('No session found');
        setLoading(false);
        return;
      }

      const user = session.user;

      // Get caregiver profile
      const { data: caregiverData, error: caregiverError } = await supabase
        .from('caregivers')
        .select('*')
        .eq('auth_id', user.id)
        .single();

      if (caregiverError && caregiverError.code !== 'PGRST116') {
        console.error('Error fetching caregiver:', caregiverError);
        return;
      }

      if (caregiverData) {
        setCaregiver(caregiverData);

        // Get patient count
        const { count, error: countError } = await supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('caregiver_id', caregiverData.id);

        if (!countError) {
          setPatientCount(count || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching caregiver info:', error);
    } finally {
      setLoading(false);
    }
  }, [caregiver]);

  useFocusEffect(
    useCallback(() => {
      fetchCaregiverInfo();
    }, [fetchCaregiverInfo])
  );

  if (loading && !caregiver) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00acc1" />
      </View>
    );
  }

  // If no caregiver found, show message
  if (!loading && !caregiver) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="person-add" size={64} color="#b2ebf2" />
          <Text style={styles.emptyText}>Welcome to CareMind</Text>
          <Text style={styles.emptySubText}>
            Your caregiver profile hasn't been created yet
          </Text>
          <Text style={styles.emptyNote}>
            Please sign out and sign up to create your profile
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Settings')}
            style={styles.setupButton}
            labelStyle={styles.setupButtonLabel}
          >
            Go to Settings
          </Button>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>
        Welcome, {caregiver ? `${caregiver.first_name} ${caregiver.last_name}` : 'Caregiver'}
      </Text>

      {/* Caregiver Profile Card */}
      {caregiver && (
        <Card style={styles.profileCard}>
          <Card.Content style={styles.profileContent}>
            <View style={styles.profileHeader}>
              <Ionicons name="person-circle" size={60} color="#00acc1" />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {caregiver.first_name} {caregiver.last_name}
                </Text>
                <Text style={styles.profileEmail}>{caregiver.email}</Text>
                {caregiver.phone && (
                  <Text style={styles.profilePhone}>📱 {caregiver.phone}</Text>
                )}
              </View>
            </View>

            {/* Additional Caregiver Details */}
            <View style={styles.divider} />
            <View style={styles.detailsGrid}>
              {caregiver.relationship_to_patient && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Relationship</Text>
                  <Text style={styles.detailValue}>{caregiver.relationship_to_patient}</Text>
                </View>
              )}
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={[styles.detailValue, { color: caregiver.account_status === 'active' ? '#4caf50' : '#ff9800' }]}>
                  {caregiver.account_status || 'Active'}
                </Text>
              </View>
              {caregiver.is_primary_caregiver && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Role</Text>
                  <Text style={styles.detailValue}>👑 Primary Caregiver</Text>
                </View>
              )}
              {caregiver.last_login && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Last Login</Text>
                  <Text style={styles.detailValue}>
                    {new Date(caregiver.last_login).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Timer Card - Optimized */}
      <ClockCard />

      {/* Patients Overview Card */}
      <Card style={styles.card}>
        <Card.Title
          title="Patients Overview"
          left={(props) => <Ionicons name="people" size={24} color="#00acc1" />}
        />
        <Card.Content style={styles.patientsOverview}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{patientCount}</Text>
            <Text style={styles.statLabel}>Total Patients</Text>
          </View>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Patients' })}
            style={styles.viewButton}
            labelStyle={styles.buttonLabel}
          >
            View Patients
          </Button>
        </Card.Content>
      </Card>

      {/* Quick Actions Card */}
      <Card style={styles.card}>
        <Card.Title
          title="Quick Actions"
          left={(props) => <Ionicons name="flash" size={24} color="#00acc1" />}
        />
        <Card.Content>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate('AddPatient')}
            style={styles.actionButton}
            labelStyle={styles.actionLabel}
            icon="plus"
          >
            Add New Patient
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Location' })}
            style={styles.actionButton}
            labelStyle={styles.actionLabel}
            icon="map-marker"
          >
            Track Location
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f0f9fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9fb',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 50,
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
  emptyNote: {
    fontSize: 12,
    color: '#00acc1',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  setupButton: {
    backgroundColor: '#00acc1',
    paddingVertical: 8,
    borderRadius: 8,
  },
  setupButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#00acc1',
  },
  profileCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 5,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#00acc1',
  },
  profileContent: {
    paddingVertical: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00838f',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 13,
    color: '#00acc1',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '48%',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 11,
    color: '#00838f',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 13,
    color: '#00acc1',
    fontWeight: '500',
  },
  timerCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 5,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#00acc1',
    overflow: 'hidden',
  },
  timerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  timerIconContainer: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerTextContainer: {
    flex: 1,
  },
  timerLabel: {
    fontSize: 14,
    color: '#00838f',
    fontWeight: '500',
    marginBottom: 4,
  },
  timerDisplay: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00acc1',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  dateDisplay: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#00bcd4',
  },
  patientsOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00acc1',
  },
  statLabel: {
    fontSize: 12,
    color: '#00838f',
    marginTop: 4,
  },
  viewButton: {
    backgroundColor: '#00acc1',
    borderRadius: 6,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    marginBottom: 10,
    borderColor: '#00acc1',
  },
  actionLabel: {
    color: '#00acc1',
    fontSize: 12,
  },
});

export default DashboardScreen;
