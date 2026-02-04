const { createClient } = require('@supabase/supabase-js');

// Helper to wait
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    // CREDENTIALS FROM src/config/supabase.js (Where the app sends data)
    const SUPABASE_URL = 'https://celcufywdbcpwekgtned.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbGN1Znl3ZGJjcHdla2d0bmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjgzNDIsImV4cCI6MjA4MDYwNDM0Mn0.OZ_VUHv5Vv8rgGj1JJ4-w_im0n9sUYR1YPl_i94CzGM';

    console.log('--- CHECKING DATA IN PROJECT: ' + SUPABASE_URL + ' ---');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Check Patient Vitals
    console.log('\nFetching last 5 Patient Vitals...');
    const { data: vitals, error: vitalsError } = await supabase
        .from('patient_vitals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (vitalsError) {
        console.error('Error fetching vitals:', vitalsError.message);
    } else {
        if (vitals.length === 0) {
            console.log('No vitals found.');
        } else {
            vitals.forEach(v => {
                console.log(`[${v.created_at}] Source: ${v.data_source}`);
                console.log(`   HR: ${v.heart_rate} | O2: ${v.spo2}% | Temp: ${v.temperature}C`);
                console.log(`   BP: ${v.systolic_bp}/${v.diastolic_bp} | Resp: ${v.respiratory_rate}`);
                console.log(`   Notes: ${v.notes}`);
                console.log('-----------------------------------');
            });
        }
    }

    // 2. Check Sleep Data
    console.log('\nFetching last 5 Sleep Data records...');
    const { data: sleepData, error: sleepError } = await supabase
        .from('sleep_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (sleepError) {
        console.error('Error fetching sleep data:', sleepError.message);
    } else {
        if (sleepData.length === 0) {
            console.log('No sleep data found.');
        } else {
            sleepData.forEach(s => {
                console.log(`[${s.created_at}] Date: ${s.sleep_date}, Quality: ${s.sleep_quality}, Notes: ${s.notes}`);
            });
        }
    }
}

main();
