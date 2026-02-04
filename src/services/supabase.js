import AsyncStorage from '@react-native-async-storage/async-storage';

// Hardcoded Supabase credentials
const SUPABASE_URL = 'https://celcufywdbcpwekgtned.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbGN1Znl3ZGJjcHdla2d0bmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjgzNDIsImV4cCI6MjA4MDYwNDM0Mn0.OZ_VUHv5Vv8rgGj1JJ4-w_im0n9sUYR1YPl_i94CzGM';

// Manually create Supabase client without import
class SupabaseClient {
  constructor(url, key, options) {
    this.url = url;
    this.key = key;
    this.options = options;
    this.auth = new AuthClient(this);
    this.headers = {
      'apikey': key,
      'Content-Type': 'application/json',
    };
  }

  from(table) {
    return new QueryBuilder(this, table);
  }
}

class AuthClient {
  constructor(client) {
    this.client = client;
    this.session = null;
  }

  async signUp({ email, password }) {
    try {
      const response = await fetch(`${this.client.url}/auth/v1/signup`, {
        method: 'POST',
        headers: this.client.headers,
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        return { data: { user: data.user }, error: null };
      }
      return { data: null, error: data };
    } catch (error) {
      return { data: null, error };
    }
  }

  async signInWithPassword({ email, password }) {
    try {
      const response = await fetch(`${this.client.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: this.client.headers,
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        this.session = data;
        await AsyncStorage.setItem('supabase_session', JSON.stringify(data));
        return { data: { user: data.user, session: data }, error: null };
      }
      return { data: null, error: data };
    } catch (error) {
      return { data: null, error };
    }
  }

  async signOut() {
    this.session = null;
    await AsyncStorage.removeItem('supabase_session');
    return { error: null };
  }

  async getSession() {
    try {
      const session = await AsyncStorage.getItem('supabase_session');
      if (session) {
        this.session = JSON.parse(session);
        return { data: { session: this.session }, error: null };
      }
      return { data: { session: null }, error: null };
    } catch (error) {
      return { data: { session: null }, error };
    }
  }
}

class QueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.method = 'GET';
    this.filters = [];
    this.data = null;
    this.selectFields = '*';
  }

  select(fields = '*') {
    this.selectFields = fields;
    // Only set method to GET if it's not already a mutation
    if (this.method !== 'POST' && this.method !== 'PATCH' && this.method !== 'DELETE') {
      this.method = 'GET';
    }
    return this;
  }

  insert(data) {
    this.method = 'POST';
    this.data = Array.isArray(data) ? data : [data];
    return this;
  }

  upsert(data, options = {}) {
    this.method = 'POST';
    this.data = Array.isArray(data) ? data : [data];
    if (options.onConflict) {
      this.upsertConflictTarget = options.onConflict;
    }
    this.isUpsert = true;
    return this;
  }

  update(data) {
    this.method = 'PATCH';
    this.data = data;
    return this;
  }

  delete() {
    this.method = 'DELETE';
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ column, operator: 'neq', value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ column, operator: 'gt', value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ column, operator: 'gte', value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ column, operator: 'lt', value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ column, operator: 'lte', value });
    return this;
  }

  like(column, value) {
    this.filters.push({ column, operator: 'like', value });
    return this;
  }

  ilike(column, value) {
    this.filters.push({ column, operator: 'ilike', value });
    return this;
  }

  not(column, operator, value) {
    // Supabase .not syntax is weird, but we'll map it to URL filters
    this.filters.push({ column, operator: `not.${operator}`, value });
    return this;
  }

  in(column, values) {
    const valString = Array.isArray(values) ? `(${values.join(',')})` : values;
    this.filters.push({ column, operator: 'in', value: valString });
    return this;
  }

  order(column, options = {}) {
    this.orderColumn = column;
    this.orderAscending = options.ascending !== false;
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  async execute() {
    try {
      // Clean up select fields (remove newlines and extra spaces)
      const cleanSelect = this.selectFields.replace(/\s+/g, ' ').trim().replace(/\s*,\s*/g, ',');
      let url = `${this.client.url}/rest/v1/${this.table}?select=${encodeURIComponent(cleanSelect)}`;

      // Add filters to URL with proper Supabase syntax
      this.filters.forEach(filter => {
        // Supabase filter format: column=operator.value
        const operator = filter.operator;
        const value = filter.value === null ? 'null' : encodeURIComponent(filter.value);
        url += `&${filter.column}=${operator}.${value}`;
      });

      // Add ordering if specified
      if (this.orderColumn) {
        const order = this.orderAscending ? 'asc' : 'desc';
        url += `&order=${this.orderColumn}.${order}`;
      }

      // Add limit if specified
      if (this.limitCount) {
        url += `&limit=${this.limitCount}`;
      }

      // Add on_conflict for upsert
      if (this.upsertConflictTarget) {
        url += `&on_conflict=${this.upsertConflictTarget}`;
      }

      const session = await this.client.auth.getSession();
      const headers = { ...this.client.headers };

      if (session.data?.session?.access_token) {
        headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
      }

      console.log(`Supabase Request [${this.table}]:`, this.method, url);
      if (this.method === 'POST') {
        console.log('Request Body:', JSON.stringify(this.data, null, 2));
      }

      const fetchOptions = {
        method: this.method,
        headers,
      };

      // Add Supabase preference headers to get data back for writes
      if (this.isUpsert) {
        headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
      } else if (this.method === 'POST' || this.method === 'PATCH' || this.method === 'PUT' || this.method === 'DELETE') {
        headers['Prefer'] = 'return=representation';
      }

      // Only add body for POST, PATCH, PUT requests
      if (this.method !== 'GET' && this.method !== 'DELETE' && this.data) {
        fetchOptions.body = JSON.stringify(this.data);
      }

      const response = await fetch(url, fetchOptions);

      let result = null;
      const responseText = await response.text();
      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          result = responseText;
        }
      }

      console.log(`Supabase Response [${this.table}]:`, response.status, result);

      if (response.ok) {
        // Handle single() - return first item if array
        if (this.isSingle && Array.isArray(result)) {
          return { data: result[0] || null, error: null };
        }
        return { data: result || [], error: null };
      }
      return { data: null, error: result };
    } catch (error) {
      console.error('Supabase Error:', error);
      return { data: null, error };
    }
  }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  // Realtime stubs to prevent crashes
  on(event, callback) {
    console.log(`Supabase Realtime stub: .on('${event}') called for ${this.table}`);
    return this;
  }

  subscribe() {
    console.log(`Supabase Realtime stub: .subscribe() called for ${this.table}`);
    return {
      unsubscribe: () => console.log(`Supabase Realtime stub: unsubscribe() called for ${this.table}`),
    };
  }
}

// Create Supabase client instance
export const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auth functions
export const authService = {
  // Sign up new user
  async signUp(email, password, firstName, lastName) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      // Create caregiver profile
      if (data.user) {
        console.log('Creating caregiver profile for user:', data.user.id);
        console.log('User email:', data.user.email);

        // Wait a moment for auth user to be fully created
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: insertData, error: profileError } = await supabase
          .from('caregivers')
          .insert([
            {
              auth_id: data.user.id,
              email: data.user.email || email,
              first_name: firstName,
              last_name: lastName,
              created_at: new Date().toISOString(),
            },
          ])
          .select();

        if (profileError) {
          console.error('Caregiver insert error:', profileError);
          console.error('Error code:', profileError.code);
          console.error('Error message:', profileError.message);
          console.error('Error details:', profileError.details);

          // If it's a foreign key error
          if (profileError.code === 'PGRST116' || profileError.message.includes('fk') || profileError.message.includes('foreign')) {
            console.error('⚠️ FOREIGN KEY ERROR: auth_id does not exist in auth.users table.');
            console.error('⚠️ This usually means:');
            console.error('   1. The auth user was not created properly');
            console.error('   2. There is a delay in auth user creation');
            console.error('   3. The foreign key constraint is too strict');
          }

          // If it's an RLS error
          if (profileError.code === 'PGRST116' || profileError.message.includes('rls')) {
            console.error('⚠️ RLS POLICY ERROR: Row-Level Security is blocking the insert.');
            console.error('⚠️ FIX: Run the SQL in HARD_FIX_CAREGIVER.md to disable RLS');
          }

          throw profileError;
        }

        console.log('✅ Caregiver created successfully:', insertData);
      }

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { user: null, error: error.message };
    }
  },

  // Sign in user
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { user: data.user, error: null };
    } catch (error) {
      return { user: null, error: error.message };
    }
  },

  // Sign out user
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error.message };
    }
  },

  // Get current user
  async getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { user: data.user, error: null };
    } catch (error) {
      return { user: null, error: error.message };
    }
  },

  // Get caregiver profile
  async getCaregiverProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('caregivers')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return { profile: data, error: null };
    } catch (error) {
      return { profile: null, error: error.message };
    }
  },
};

// Patient functions
export const patientService = {
  // Add new patient
  async addPatient(caregiverId, patientData) {
    try {
      console.log('Adding patient for caregiver:', caregiverId);
      console.log('Patient data:', patientData);

      const { data, error } = await supabase
        .from('patients')
        .insert([
          {
            caregiver_id: caregiverId,
            first_name: patientData.firstName,
            last_name: patientData.lastName,
            date_of_birth: patientData.dateOfBirth,
            gender: patientData.gender,
            blood_type: patientData.bloodType,
            height_cm: patientData.height ? parseFloat(patientData.height) : null,
            weight_kg: patientData.weight ? parseFloat(patientData.weight) : null,
            alzheimers_stage: patientData.alzheimerStage,
            diagnosis_date: patientData.diagnosisDate || null,
            medical_conditions: patientData.medicalConditions || null,
            current_medications: patientData.medications || null,
            emergency_contact_name: patientData.emergencyContact || null,
            emergency_contact_phone: patientData.emergencyPhone || null,
            doctor_name: patientData.doctorName || null,
            doctor_phone: patientData.doctorPhone || null,
            notes: patientData.notes || null,
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) {
        console.error('❌ Error adding patient:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        throw error;
      }

      console.log('✅ Patient added successfully:', data[0]);
      return { patient: data[0], error: null };
    } catch (error) {
      console.error('Exception in addPatient:', error);
      return { patient: null, error: error.message };
    }
  },

  // Get all patients for caregiver
  async getPatients(caregiverId) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('caregiver_id', caregiverId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { patients: data, error: null };
    } catch (error) {
      return { patients: [], error: error.message };
    }
  },

  // Get single patient
  async getPatient(patientId) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error) throw error;
      return { patient: data, error: null };
    } catch (error) {
      return { patient: null, error: error.message };
    }
  },

  // Update patient
  async updatePatient(patientId, patientData) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .update(patientData)
        .eq('id', patientId)
        .select();

      if (error) throw error;
      return { patient: data[0], error: null };
    } catch (error) {
      return { patient: null, error: error.message };
    }
  },

  // Delete patient
  async deletePatient(patientId) {
    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', patientId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error.message };
    }
  },
};

// Vitals functions
export const vitalsService = {
  // Add vital reading
  async addVital(patientId, vitalData) {
    try {
      const { data, error } = await supabase
        .from('patient_vitals')
        .insert([
          {
            patient_id: patientId,
            heart_rate: vitalData.heartRate,
            spo2: vitalData.spo2,
            blood_pressure_systolic: vitalData.bpSystolic,
            blood_pressure_diastolic: vitalData.bpDiastolic,
            temperature: vitalData.temperature,
            respiratory_rate: vitalData.respiratoryRate,
            notes: vitalData.notes,
            data_source: 'manual',
            created_at: new Date(),
          },
        ])
        .select();

      if (error) throw error;
      return { vital: data[0], error: null };
    } catch (error) {
      return { vital: null, error: error.message };
    }
  },

  // Get patient vitals
  async getVitals(patientId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('patient_vitals')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { vitals: data, error: null };
    } catch (error) {
      return { vitals: [], error: error.message };
    }
  },
};

// Location functions
export const locationService = {
  // Add location
  async addLocation(patientId, locationData) {
    try {
      const { data, error } = await supabase
        .from('patient_locations')
        .insert([
          {
            patient_id: patientId,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: locationData.accuracy,
            altitude: locationData.altitude,
            battery_level: locationData.batteryLevel,
            timestamp: new Date(),
            created_at: new Date(),
          },
        ])
        .select();

      if (error) throw error;
      return { location: data[0], error: null };
    } catch (error) {
      return { location: null, error: error.message };
    }
  },

  // Get patient locations
  async getLocations(patientId, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('patient_locations')
        .select('*')
        .eq('patient_id', patientId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { locations: data, error: null };
    } catch (error) {
      return { locations: [], error: error.message };
    }
  },
};

// Alerts functions
export const alertService = {
  // Get alerts
  async getAlerts(patientId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('patient_alerts')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { alerts: data, error: null };
    } catch (error) {
      return { alerts: [], error: error.message };
    }
  },

  // Mark alert as read
  async markAsRead(alertId) {
    try {
      const { data, error } = await supabase
        .from('patient_alerts')
        .update({ is_read: true })
        .eq('id', alertId)
        .select();

      if (error) throw error;
      return { alert: data[0], error: null };
    } catch (error) {
      return { alert: null, error: error.message };
    }
  },
};

export default supabase;
