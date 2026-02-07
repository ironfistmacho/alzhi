const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://celcufywdbcpwekgtned.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbGN1Znl3ZGJjcHdla2d0bmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjgzNDIsImV4cCI6MjA4MDYwNDM0Mn0.OZ_VUHv5Vv8rgGj1JJ4-w_im0n9sUYR1YPl_i94CzGM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSchema() {
    const { data, error } = await supabase
        .from('patients')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else if (data && data.length > 0) {
        console.log('Columns in patients table:', Object.keys(data[0]).join(', '));
    } else {
        console.log('No patients found to check schema.');
    }
}

checkSchema();
