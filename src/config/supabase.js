import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://celcufywdbcpwekgtned.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbGN1Znl3ZGJjcHdla2d0bmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjgzNDIsImV4cCI6MjA4MDYwNDM0Mn0.OZ_VUHv5Vv8rgGj1JJ4-w_im0n9sUYR1YPl_i94CzGM';

// Custom Supabase client implementation
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

  channel(name) {
    return new ChannelClient(this, name);
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
      let url = `${this.client.url}/rest/v1/${this.table}?select=${this.selectFields}`;

      // Add filters to URL with proper Supabase syntax
      this.filters.forEach(filter => {
        url += `&${filter.column}=eq.${encodeURIComponent(filter.value)}`;
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

      const session = await this.client.auth.getSession();
      const headers = { ...this.client.headers };

      if (session.data?.session?.access_token) {
        headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
      }

      const fetchOptions = {
        method: this.method,
        headers,
      };

      // Add Supabase preference headers to get data back for writes
      if (this.method === 'POST' || this.method === 'PATCH' || this.method === 'PUT' || this.method === 'DELETE') {
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

      if (response.ok) {
        if (this.isSingle && Array.isArray(result)) {
          return { data: result[0] || null, error: null };
        }
        return { data: result || [], error: null };
      }
      return { data: null, error: result };
    } catch (error) {
      return { data: null, error };
    }
  }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
}

class ChannelClient {
  constructor(client, name) {
    this.client = client;
    this.name = name;
    this.listeners = [];
  }

  on(event, config, callback) {
    this.listeners.push({ event, config, callback });
    return this;
  }

  subscribe() {
    return {
      unsubscribe: () => {
        this.listeners = [];
      },
    };
  }
}

// Create Supabase client instance
export const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Patient Data API
const patientApi = {
  // Get patient vitals
  async getVitals(patientId) {
    const { data, error } = await supabase
      .from('patient_vitals')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  },

  // Get patient location history
  async getLocationHistory(patientId, limit = 10) {
    const { data, error } = await supabase
      .from('patient_locations')
      .select('*')
      .eq('patient_id', patientId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  // Get patient alerts
  async getAlerts(patientId, limit = 20) {
    const { data, error } = await supabase
      .from('patient_alerts')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  // Get patient profile
  async getProfile(patientId) {
    const { data, error } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('id', patientId)
      .single();

    if (error) throw error;
    return data;
  },

  // Update patient profile
  async updateProfile(patientId, updates) {
    const { data, error } = await supabase
      .from('patient_profiles')
      .update(updates)
      .eq('id', patientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Subscribe to real-time updates
  subscribeToPatientData(patientId, callback) {
    const subscription = supabase
      .channel('patient-data-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_vitals',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          callback('vitals', payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_locations',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          callback('location', payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_alerts',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          callback('alerts', payload);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  },
};

export default patientApi;
