import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class PatientService {
  constructor() {
    this.cache = new Map();
    this.subscriptions = new Map();
  }

  // Helper function to check cache validity
  isCacheValid(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < CACHE_DURATION;
  }

  // Get patient profile with caching
  async getPatientProfile(patientId) {
    const cacheKey = `patient_${patientId}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    try {
      // Simplified query to avoid join errors
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error) throw error;

      // Cache the result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error('Error fetching patient profile:', error);
      throw error;
    }
  }

  // Get latest vitals
  async getLatestVitals(patientId) {
    const cacheKey = `vitals_${patientId}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    try {
      const { data, error } = await supabase
        .from('patient_vitals')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      this.cache.set(cacheKey, {
        data: data || null,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error('Error fetching vitals:', error);
      return null;
    }
  }

  // Get vitals history with pagination
  async getVitalsHistory(patientId, limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('patient_vitals')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching vitals history:', error);
      return [];
    }
  }

  // Get current location
  async getCurrentLocation(patientId) {
    const cacheKey = `location_${patientId}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    try {
      const { data, error } = await supabase
        .from('patient_locations')
        .select('*')
        .eq('patient_id', patientId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      this.cache.set(cacheKey, {
        data: data || null,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error('Error fetching current location:', error);
      return null;
    }
  }

  // Get location history
  async getLocationHistory(patientId, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('patient_locations')
        .select('*')
        .eq('patient_id', patientId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching location history:', error);
      return [];
    }
  }

  // Get alerts with filtering
  async getAlerts(patientId, limit = 50, priority = null) {
    const cacheKey = `alerts_${patientId}_${priority || 'all'}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    try {
      // Use explicit select to avoid potential relationship errors with *
      let query = supabase
        .from('patient_alerts')
        .select('id, patient_id, alert_type, message, priority, is_read, created_at')
        .eq('patient_id', patientId);

      if (priority) {
        query = query.eq('priority', priority);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return [];
    }
  }

  // Mark alert as read
  async markAlertAsRead(alertId) {
    try {
      const { error } = await supabase
        .from('patient_alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;

      // Invalidate cache
      this.cache.forEach((value, key) => {
        if (key.startsWith('alerts_')) {
          this.cache.delete(key);
        }
      });
    } catch (error) {
      console.error('Error marking alert as read:', error);
      throw error;
    }
  }

  // Get safe zones
  async getSafeZones(patientId) {
    const cacheKey = `safe_zones_${patientId}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    try {
      const { data, error } = await supabase
        .from('safe_zones')
        .select('*')
        .eq('patient_id', patientId)
        .eq('is_active', true);

      if (error) throw error;

      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error('Error fetching safe zones:', error);
      return [];
    }
  }

  // Add new safe zone
  async addSafeZone(patientId, zoneName, latitude, longitude, radiusMeters = 100) {
    try {
      const { data, error } = await supabase
        .from('safe_zones')
        .insert([{
          patient_id: patientId,
          zone_name: zoneName,
          latitude,
          longitude,
          radius_meters: radiusMeters
        }])
        .select()
        .single();

      if (error) throw error;

      // Invalidate cache
      this.cache.delete(`safe_zones_${patientId}`);

      return data;
    } catch (error) {
      console.error('Error adding safe zone:', error);
      throw error;
    }
  }

  // Get medications
  async getMedications(patientId) {
    const cacheKey = `medications_${patientId}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .order('scheduled_time');

      if (error) throw error;

      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error('Error fetching medications:', error);
      return [];
    }
  }

  // Log medication taken
  async logMedicationTaken(medicationId, patientId) {
    try {
      const { error } = await supabase
        .from('medication_logs')
        .insert([{
          medication_id: medicationId,
          patient_id: patientId,
          taken_at: new Date().toISOString(),
          status: 'taken'
        }]);

      if (error) throw error;

      // Invalidate cache
      this.cache.delete(`medications_${patientId}`);
    } catch (error) {
      console.error('Error logging medication:', error);
      throw error;
    }
  }

  // Get sleep data
  async getSleepData(patientId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('sleep_data')
        .select('*')
        .eq('patient_id', patientId)
        .gte('sleep_date', startDate.toISOString().split('T')[0])
        .order('sleep_date', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching sleep data:', error);
      return [];
    }
  }

  // Get daily summary
  async getDailySummary(patientId, date) {
    try {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('patient_id', patientId)
        .eq('summary_date', date)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error fetching daily summary:', error);
      return null;
    }
  }

  // Subscribe to real-time vitals
  subscribeToVitals(patientId, callback) {
    const subscriptionKey = `vitals_${patientId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey);
    }

    const subscription = supabase
      .channel(`vitals_${patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'patient_vitals',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          // Invalidate cache
          this.cache.delete(`vitals_${patientId}`);
          callback(payload.new);
        }
      )
      .subscribe();

    this.subscriptions.set(subscriptionKey, subscription);
    return subscription;
  }

  // Subscribe to real-time alerts
  subscribeToAlerts(patientId, callback) {
    const subscriptionKey = `alerts_${patientId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey);
    }

    const subscription = supabase
      .channel(`alerts_${patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'patient_alerts',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          // Invalidate cache
          this.cache.forEach((value, key) => {
            if (key.startsWith('alerts_')) {
              this.cache.delete(key);
            }
          });
          callback(payload.new);
        }
      )
      .subscribe();

    this.subscriptions.set(subscriptionKey, subscription);
    return subscription;
  }

  // Subscribe to real-time location
  subscribeToLocation(patientId, callback) {
    const subscriptionKey = `location_${patientId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey);
    }

    const subscription = supabase
      .channel(`location_${patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'patient_locations',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          // Invalidate cache
          this.cache.delete(`location_${patientId}`);
          callback(payload.new);
        }
      )
      .subscribe();

    this.subscriptions.set(subscriptionKey, subscription);
    return subscription;
  }

  // Unsubscribe from real-time updates
  unsubscribe(patientId, type) {
    const subscriptionKey = `${type}_${patientId}`;
    const subscription = this.subscriptions.get(subscriptionKey);

    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionKey);
    }
  }

  // Clear all subscriptions
  unsubscribeAll() {
    this.subscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });
    this.subscriptions.clear();
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Clear specific cache
  clearCacheForKey(key) {
    this.cache.delete(key);
  }
}

export default new PatientService();
