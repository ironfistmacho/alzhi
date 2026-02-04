import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Modal, Portal, Text, Button, TextInput, SegmentedButtons } from 'react-native-paper';

const ManualVitalsModal = ({ visible, onDismiss, onSave, patientName, type }) => {
    const [systolic, setSystolic] = useState('');
    const [diastolic, setDiastolic] = useState('');
    const [glucose, setGlucose] = useState('');
    const [glucoseContext, setGlucoseContext] = useState('before_food');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        const data = {
            notes,
            data_source: 'manual',
        };

        if (type === 'bp') {
            if (!systolic || !diastolic) {
                alert('Please enter both Systolic and Diastolic pressure');
                setLoading(false);
                return;
            }
            data.systolic_bp = parseInt(systolic);
            data.diastolic_bp = parseInt(diastolic);
        } else {
            if (!glucose) {
                alert('Please enter glucose level');
                setLoading(false);
                return;
            }
            data.blood_glucose = parseFloat(glucose);
            data.glucose_context = glucoseContext;
        }

        await onSave(data);
        setLoading(false);
        resetForm();
        onDismiss();
    };

    const resetForm = () => {
        setSystolic('');
        setDiastolic('');
        setGlucose('');
        setGlucoseContext('before_food');
        setNotes('');
    };

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
                <ScrollView>
                    <Text style={styles.title}>Manual Entry: {type === 'bp' ? 'Blood Pressure' : 'Blood Glucose'}</Text>
                    <Text style={styles.subtitle}>Patient: {patientName}</Text>

                    {type === 'bp' ? (
                        <View style={styles.inputGroup}>
                            <TextInput
                                label="Systolic (High)"
                                value={systolic}
                                onChangeText={setSystolic}
                                keyboardType="numeric"
                                mode="outlined"
                                style={styles.input}
                                placeholder="e.g. 120"
                            />
                            <TextInput
                                label="Diastolic (Low)"
                                value={diastolic}
                                onChangeText={setDiastolic}
                                keyboardType="numeric"
                                mode="outlined"
                                style={styles.input}
                                placeholder="e.g. 80"
                            />
                        </View>
                    ) : (
                        <View style={styles.inputGroup}>
                            <TextInput
                                label="Glucose Level (mg/dL)"
                                value={glucose}
                                onChangeText={setGlucose}
                                keyboardType="numeric"
                                mode="outlined"
                                style={styles.input}
                                placeholder="e.g. 95"
                            />
                            <Text style={styles.label}>Context:</Text>
                            <SegmentedButtons
                                value={glucoseContext}
                                onValueChange={setGlucoseContext}
                                buttons={[
                                    { value: 'before_food', label: 'Before Food' },
                                    { value: 'after_food', label: 'After Food' },
                                    { value: 'fasting', label: 'Fasting' },
                                ]}
                                style={styles.segmented}
                            />
                        </View>
                    )}

                    <TextInput
                        label="Notes (Optional)"
                        value={notes}
                        onChangeText={setNotes}
                        mode="outlined"
                        multiline
                        numberOfLines={3}
                        style={styles.notes}
                    />

                    <View style={styles.actions}>
                        <Button onPress={onDismiss} style={styles.button}>Cancel</Button>
                        <Button
                            mode="contained"
                            onPress={handleSave}
                            loading={loading}
                            disabled={loading}
                            style={styles.saveButton}
                        >
                            Save Vitals
                        </Button>
                    </View>
                </ScrollView>
            </Modal>
        </Portal>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        padding: 20,
        margin: 20,
        borderRadius: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#00838f',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    input: {
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
        marginTop: 8,
    },
    segmented: {
        marginBottom: 12,
    },
    notes: {
        marginBottom: 20,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    button: {
        minWidth: 80,
    },
    saveButton: {
        minWidth: 120,
        backgroundColor: '#00acc1',
    },
});

export default ManualVitalsModal;
