import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, DeviceEventEmitter } from 'react-native';
import { Card, Title, Button, IconButton, Menu, Divider, ActivityIndicator, Badge } from 'react-native-paper';
import { format } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';

const AlertsScreen = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const fetchAlerts = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get caregiver
      const { data: caregiver } = await supabase
        .from('caregivers')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();

      if (!caregiver) return;

      // 1. Get alerts (fetch raw data first to avoid relationship error)
      const { data: alertsData, error } = await supabase
        .from('patient_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!alertsData || alertsData.length === 0) {
        setAlerts([]);
        return;
      }

      // 2. Extracts unique patient IDs
      const patientIds = [...new Set(alertsData.map(a => a.patient_id))];

      // 3. Fetch patient details manually
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('id, first_name, last_name')
        .in('id', patientIds);

      if (patientsError) {
        console.error('Error fetching patients for alerts:', patientsError);
        // Continue with unknown patient names if this fails
      }

      // Create a map for quick lookup
      const patientMap = {};
      if (patientsData) {
        patientsData.forEach(p => {
          patientMap[p.id] = p;
        });
      }

      // Map to UI format
      const formattedAlerts = alertsData.map(a => {
        const patient = patientMap[a.patient_id];
        return {
          id: a.id,
          type: a.title || 'Fall Alert',
          message: a.message,
          timestamp: new Date(a.created_at),
          priority: a.priority,
          read: a.is_read,
          patientName: patient ? `${patient.first_name} ${patient.last_name}` : 'Patient',
          details: a.message
        };
      });

      setAlerts(formattedAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAlerts();

      // Listen for local SMS parsing events for immediate feedback
      const localSub = DeviceEventEmitter.addListener('FALL_ALERT_RECEIVED', ({ parsedData, patient }) => {
        console.log('Received local fall alert event:', parsedData);
        // Add to local state immediately
        const newAlert = {
          id: `local_fall_${Date.now()}`,
          patient_id: patient.id,
          alert_type: 'fall',
          title: '🚨 FALL DETECTED (LIVE)',
          message: `SMS Alert from ${parsedData.deviceType} | Impact: ${parsedData.impactForce}g`,
          timestamp: new Date(),
          priority: 'critical',
          read: false,
          patientName: `${patient.first_name} ${patient.last_name}`,
          details: parsedData.rawMessage,
          isLive: true
        };

        setAlerts(prev => [newAlert, ...prev]);
        setTimeout(() => fetchAlerts(false), 2000);
      });

      const locSub = DeviceEventEmitter.addListener('LOCATION_UPDATED', (data) => {
        console.log('Received local location update in AlertsScreen:', data);

        // Only show in alerts list if not a "silent" update or for debugging
        const newAlert = {
          id: `local_loc_${Date.now()}`,
          patient_id: data.patientId,
          alert_type: 'location',
          title: '📍 LOCATION UPDATE (LIVE)',
          message: `Incoming tracking data | Status: ${data.gpsStatus || 'OK'}`,
          timestamp: new Date(),
          priority: 'low',
          read: true,
          patientName: 'Live Tracker',
          details: `Source: SMS | ${data.location.latitude}, ${data.location.longitude}`,
          isLive: true
        };

        setAlerts(prev => [newAlert, ...prev]);
      });

      // Set up Realtime subscription stub
      const channel = supabase
        .channel('public:patient_alerts')
        .on(
          'postgres_changes',
          { event: '*', table: 'patient_alerts', schema: 'public' },
          (payload) => {
            console.log('Realtime alert update:', payload);
            fetchAlerts(false);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        localSub.remove();
        locSub.remove();
      };
    }, [fetchAlerts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAlerts();
  };

  const filteredAlerts = alerts.filter(alert => {
    if (selectedFilter === 'all') return true;
    return alert.priority === selectedFilter;
  });

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('patient_alerts')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;

      setAlerts(alerts.map(alert =>
        alert.id === id ? { ...alert, read: true } : alert
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const deleteAlert = async (id) => {
    try {
      const { error } = await supabase
        .from('patient_alerts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAlerts(alerts.filter(alert => alert.id !== id));
      setMenuVisible(false);
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const clearAllRead = async () => {
    try {
      const readAlertIds = alerts.filter(a => a.read).map(a => a.id);
      if (readAlertIds.length === 0) return;

      const { error } = await supabase
        .from('patient_alerts')
        .delete()
        .in('id', readAlertIds);

      if (error) throw error;

      setAlerts(alerts.filter(alert => !alert.read));
    } catch (error) {
      console.error('Error clearing read alerts:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return '#e74c3c';
      case 'high': return '#e67e22';
      case 'medium': return '#f1c40f';
      case 'low': return '#3498db';
      default: return '#95a5a6';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'critical':
      case 'high': return 'alert-circle';
      case 'medium': return 'alert';
      case 'low': return 'information';
      default: return 'bell';
    }
  };

  const renderAlertItem = ({ item }) => (
    <Card
      style={[styles.alertCard, !item.read && styles.unreadAlert]}
      onPress={() => {
        markAsRead(item.id);
        setExpandedAlertId(expandedAlertId === item.id ? null : item.id);
      }}
    >
      <Card.Content>
        <View style={styles.alertHeader}>
          <View style={styles.alertTypeContainer}>
            <IconButton
              icon={getPriorityIcon(item.priority)}
              size={20}
              iconColor={getPriorityColor(item.priority)}
              style={styles.alertIcon}
            />
            <Text style={styles.alertType}>{item.type}</Text>
            {item.isLive && (
              <Badge style={styles.liveBadge}>LIVE</Badge>
            )}
          </View>
          <View style={styles.alertTimeContainer}>
            <Text style={styles.alertTime}>
              {format(item.timestamp, 'h:mm a')}
            </Text>
            <Text style={styles.alertDate}>
              {format(item.timestamp, 'MMM d, yyyy')}
            </Text>
          </View>
        </View>

        <Text style={styles.alertPatient}>{item.patientName}</Text>
        <Text style={styles.alertMessage}>{item.message}</Text>

        {expandedAlertId === item.id && (
          <View style={styles.detailsContainer}>
            <Text style={styles.detailsTitle}>Details:</Text>
            <Text style={styles.detailsText}>{item.details}</Text>

            <View style={styles.actionsContainer}>
              <Button
                mode="outlined"
                style={styles.actionButton}
                icon="phone"
                onPress={() => console.log('Call emergency contact')}
              >
                Call
              </Button>
              <Button
                mode="contained"
                style={[styles.actionButton, styles.viewLocationButton]}
                icon="map"
                onPress={() => console.log('View location')}
              >
                Map
              </Button>
              <Button
                mode="text"
                style={styles.actionButton}
                icon="delete"
                textColor="#e74c3c"
                onPress={() => deleteAlert(item.id)}
              >
                Delete
              </Button>
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00acc1" />
        <Text style={styles.loadingText}>Loading alerts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.title}>Alerts & Notifications</Title>
        <View style={styles.headerActions}>
          <Button
            mode="text"
            onPress={() => {
              const testMsg = "FALL_ALERT|PATIENT_001|9.723517,76.726443|GPS_OK(0s)|20:41:59|Impact:2.51g|Device:PiZero";
              const SMSParser = require('../services/smsParser').default;
              SMSParser.processIncomingSMS(testMsg, "+910000000000");
            }}
            compact
          >
            Test Fall SMS
          </Button>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={24}
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                clearAllRead();
                setMenuVisible(false);
              }}
              title="Clear Read"
            />
            <Divider />
            <Menu.Item
              onPress={() => {
                setAlerts([]);
                setMenuVisible(false);
              }}
              title="Clear All"
              titleStyle={{ color: '#e74c3c' }}
            />
          </Menu>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <Button
          mode={selectedFilter === 'all' ? 'contained' : 'outlined'}
          onPress={() => setSelectedFilter('all')}
          style={styles.filterButton}
          compact
        >
          All
        </Button>
        <Button
          mode={selectedFilter === 'high' ? 'contained' : 'outlined'}
          onPress={() => setSelectedFilter('high')}
          style={[styles.filterButton, { borderColor: '#e74c3c' }]}
          labelStyle={selectedFilter === 'high' ? { color: 'white' } : { color: '#e74c3c' }}
          compact
        >
          High
        </Button>
        <Button
          mode={selectedFilter === 'medium' ? 'contained' : 'outlined'}
          onPress={() => setSelectedFilter('medium')}
          style={[styles.filterButton, { borderColor: '#f39c12' }]}
          labelStyle={selectedFilter === 'medium' ? { color: 'white' } : { color: '#f39c12' }}
          compact
        >
          Medium
        </Button>
        <Button
          mode={selectedFilter === 'low' ? 'contained' : 'outlined'}
          onPress={() => setSelectedFilter('low')}
          style={[styles.filterButton, { borderColor: '#3498db' }]}
          labelStyle={selectedFilter === 'low' ? { color: 'white' } : { color: '#3498db' }}
          compact
        >
          Low
        </Button>
      </View>

      <FlatList
        data={filteredAlerts}
        renderItem={renderAlertItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No alerts to display</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9fb',
  },
  loadingText: {
    marginTop: 10,
    color: '#00acc1',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    elevation: 3,
    borderBottomWidth: 2,
    borderBottomColor: '#00bcd4',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00acc1',
  },
  headerActions: {
    flexDirection: 'row',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#b2ebf2',
  },
  filterButton: {
    marginHorizontal: 4,
    borderRadius: 20,
  },
  listContainer: {
    padding: 8,
  },
  alertCard: {
    margin: 4,
    borderRadius: 12,
    elevation: 2,
    backgroundColor: '#ffffff',
  },
  unreadAlert: {
    borderLeftWidth: 4,
    borderLeftColor: '#00acc1',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIcon: {
    margin: 0,
    marginLeft: -10,
    marginRight: 4,
  },
  alertType: {
    fontWeight: '600',
    fontSize: 16,
    color: '#00838f',
    marginRight: 8,
  },
  liveBadge: {
    backgroundColor: '#e74c3c',
    color: 'white',
    alignSelf: 'center',
  },
  alertTimeContainer: {
    alignItems: 'flex-end',
  },
  alertTime: {
    fontSize: 12,
    color: '#00acc1',
  },
  alertDate: {
    fontSize: 10,
    color: '#80deea',
  },
  alertPatient: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00acc1',
    marginLeft: 24,
    marginBottom: 2,
  },
  alertMessage: {
    fontSize: 14,
    color: '#00838f',
    marginLeft: 24,
  },
  detailsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e0f7fa',
    borderRadius: 6,
    marginLeft: 24,
  },
  detailsTitle: {
    fontWeight: '600',
    marginBottom: 4,
    color: '#00838f',
  },
  detailsText: {
    fontSize: 13,
    color: '#00838f',
    lineHeight: 18,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    flexWrap: 'wrap',
  },
  actionButton: {
    marginLeft: 4,
    marginBottom: 4,
    borderRadius: 4,
  },
  viewLocationButton: {
    backgroundColor: '#00acc1',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#00acc1',
    textAlign: 'center',
  },
});

export default AlertsScreen;
