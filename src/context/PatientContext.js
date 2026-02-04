import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import patientService from '../services/patientService';

const PatientContext = createContext();

export const PatientProvider = ({ children, patientId }) => {
  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState(null);
  const [location, setLocation] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [medications, setMedications] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [patientData, vitalsData, locationData, alertsData, medicationsData, safeZonesData] = await Promise.all([
          patientService.getPatientProfile(patientId),
          patientService.getLatestVitals(patientId),
          patientService.getCurrentLocation(patientId),
          patientService.getAlerts(patientId),
          patientService.getMedications(patientId),
          patientService.getSafeZones(patientId)
        ]);

        setPatient(patientData);
        setVitals(vitalsData);
        setLocation(locationData);
        setAlerts(alertsData);
        setMedications(medicationsData);
        setSafeZones(safeZonesData);
        setError(null);
      } catch (err) {
        console.error('Error loading patient data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (patientId) {
      loadInitialData();
    }
  }, [patientId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!patientId) return;

    const unsubscribeVitals = patientService.subscribeToVitals(patientId, (newVital) => {
      setVitals(newVital);
    });

    const unsubscribeAlerts = patientService.subscribeToAlerts(patientId, (newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
    });

    const unsubscribeLocation = patientService.subscribeToLocation(patientId, (newLocation) => {
      setLocation(newLocation);
    });

    return () => {
      patientService.unsubscribe(patientId, 'vitals');
      patientService.unsubscribe(patientId, 'alerts');
      patientService.unsubscribe(patientId, 'location');
    };
  }, [patientId]);

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [vitalsData, locationData, alertsData] = await Promise.all([
        patientService.getLatestVitals(patientId),
        patientService.getCurrentLocation(patientId),
        patientService.getAlerts(patientId)
      ]);

      setVitals(vitalsData);
      setLocation(locationData);
      setAlerts(alertsData);
      setError(null);
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const markAlertAsRead = useCallback(async (alertId) => {
    try {
      await patientService.markAlertAsRead(alertId);
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, is_read: true } : alert
      ));
    } catch (err) {
      console.error('Error marking alert as read:', err);
      setError(err.message);
    }
  }, []);

  const addSafeZone = useCallback(async (zoneName, latitude, longitude, radiusMeters) => {
    try {
      const newZone = await patientService.addSafeZone(patientId, zoneName, latitude, longitude, radiusMeters);
      setSafeZones(prev => [...prev, newZone]);
      return newZone;
    } catch (err) {
      console.error('Error adding safe zone:', err);
      setError(err.message);
      throw err;
    }
  }, [patientId]);

  const logMedicationTaken = useCallback(async (medicationId) => {
    try {
      await patientService.logMedicationTaken(medicationId, patientId);
      // Refresh medications to update status
      const updatedMedications = await patientService.getMedications(patientId);
      setMedications(updatedMedications);
    } catch (err) {
      console.error('Error logging medication:', err);
      setError(err.message);
      throw err;
    }
  }, [patientId]);

  const value = {
    patient,
    vitals,
    location,
    alerts,
    medications,
    safeZones,
    loading,
    error,
    refreshData,
    markAlertAsRead,
    addSafeZone,
    logMedicationTaken
  };

  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  );
};

export const usePatient = () => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatient must be used within a PatientProvider');
  }
  return context;
};
