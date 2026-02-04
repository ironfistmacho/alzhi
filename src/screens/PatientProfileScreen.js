import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Card, Title, Button, Divider, TextInput, Avatar, IconButton, Menu } from 'react-native-paper';
import { MaterialCommunityIcons, MaterialIcons, FontAwesome } from '@expo/vector-icons';

const PatientProfileScreen = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Dummy patient data
  const [patientData, setPatientData] = useState({
    name: 'John A. Smith',
    age: 72,
    gender: 'Male',
    bloodType: 'A+',
    height: '175 cm',
    weight: '75 kg',
    emergencyContact: {
      name: 'Sarah Smith',
      relationship: 'Daughter',
      phone: '+1 (555) 123-4567',
      email: 'sarah.smith@example.com'
    },
    medicalConditions: [
      'Alzheimer\'s Disease (Stage 2)',
      'Hypertension',
      'Type 2 Diabetes',
      'Mild Arthritis'
    ],
    medications: [
      { name: 'Donepezil', dosage: '10mg', frequency: 'Once daily', time: 'Morning' },
      { name: 'Memantine', dosage: '10mg', frequency: 'Twice daily', time: 'Morning & Evening' },
      { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', time: 'With meals' },
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', time: 'Morning' },
    ],
    doctor: {
      name: 'Dr. Emily Chen',
      specialty: 'Neurologist',
      phone: '+1 (555) 987-6543',
      email: 'e.chen@neurocare.com'
    },
    lastCheckup: '2023-10-15',
    notes: 'Patient shows mild cognitive decline. Responding well to current medication. Recommended light physical activity and cognitive exercises.'
  });

  const [formData, setFormData] = useState({ ...patientData });

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleSave = () => {
    setPatientData(formData);
    setIsEditing(false);
  };

  const renderOverview = () => (
    <View style={styles.section}>
      <View style={styles.profileHeader}>
        <Avatar.Text 
          size={100} 
          label={patientData.name.split(' ').map(n => n[0]).join('')}
          style={styles.avatar}
        />
        <View style={styles.profileInfo}>
          <Title style={styles.patientName}>{patientData.name}</Title>
          <Text style={styles.patientAge}>{patientData.age} years old • {patientData.gender}</Text>
          <View style={styles.bloodType}>
            <Text style={styles.bloodTypeText}>{patientData.bloodType}</Text>
          </View>
        </View>
      </View>

      <Divider style={styles.divider} />

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{patientData.height}</Text>
          <Text style={styles.statLabel}>Height</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{patientData.weight}</Text>
          <Text style={styles.statLabel}>Weight</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>2</Text>
          <Text style={styles.statLabel}>Alerts</Text>
        </View>
      </View>

      <Divider style={styles.divider} />

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Medical Conditions</Text>
        {patientData.medicalConditions.map((condition, index) => (
          <View key={index} style={styles.conditionItem}>
            <MaterialIcons name="medical-services" size={20} color="#e74c3c" />
            <Text style={styles.conditionText}>{condition}</Text>
          </View>
        ))}
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Current Medications</Text>
        {patientData.medications.slice(0, 2).map((med, index) => (
          <View key={index} style={styles.medicationItem}>
            <MaterialCommunityIcons name="pill" size={20} color="#3498db" />
            <View style={styles.medicationInfo}>
              <Text style={styles.medicationName}>{med.name} ({med.dosage})</Text>
              <Text style={styles.medicationDetails}>{med.frequency} • {med.time}</Text>
            </View>
          </View>
        ))}
        <Button 
          mode="text" 
          onPress={() => setActiveTab('medications')}
          style={styles.viewAllButton}
        >
          View All Medications
        </Button>
      </View>
    </View>
  );

  const renderEmergencyContact = () => (
    <View style={styles.section}>
      <View style={styles.emergencyHeader}>
        <MaterialIcons name="warning" size={24} color="#e74c3c" />
        <Text style={styles.emergencyTitle}>Emergency Contact</Text>
      </View>
      <Card style={styles.contactCard}>
        <Card.Content>
          <View style={styles.contactHeader}>
            <Avatar.Text 
              size={60} 
              label={patientData.emergencyContact.name.split(' ').map(n => n[0]).join('')} 
              style={styles.contactAvatar}
            />
            <View>
              <Text style={styles.contactName}>{patientData.emergencyContact.name}</Text>
              <Text style={styles.contactRelationship}>{patientData.emergencyContact.relationship}</Text>
            </View>
          </View>
          
          <View style={styles.contactInfo}>
            <TouchableOpacity style={styles.contactItem}>
              <MaterialIcons name="phone" size={20} color="#4a90e2" />
              <Text style={styles.contactText}>{patientData.emergencyContact.phone}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactItem}>
              <MaterialIcons name="email" size={20} color="#4a90e2" />
              <Text style={styles.contactText}>{patientData.emergencyContact.email}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.contactActions}>
            <Button 
              mode="contained" 
              icon="phone" 
              style={styles.callButton}
              onPress={() => console.log('Calling emergency contact...')}
            >
              Call Now
            </Button>
            <Button 
              mode="outlined" 
              icon="message"
              style={styles.messageButton}
              onPress={() => console.log('Messaging emergency contact...')}
            >
              Message
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Divider style={styles.divider} />

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Doctor's Information</Text>
        <View style={styles.doctorInfo}>
          <Avatar.Icon size={50} icon="stethoscope" style={styles.doctorAvatar} />
          <View style={styles.doctorDetails}>
            <Text style={styles.doctorName}>{patientData.doctor.name}</Text>
            <Text style={styles.doctorSpecialty}>{patientData.doctor.specialty}</Text>
            <View style={styles.doctorContact}>
              <TouchableOpacity style={styles.doctorContactItem}>
                <MaterialIcons name="phone" size={16} color="#4a90e2" />
                <Text style={styles.doctorContactText}>{patientData.doctor.phone}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doctorContactItem}>
                <MaterialIcons name="email" size={16} color="#4a90e2" />
                <Text style={styles.doctorContactText}>{patientData.doctor.email}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <Button 
          mode="outlined" 
          icon="calendar"
          style={styles.appointmentButton}
          onPress={() => console.log('Schedule appointment...')}
        >
          Schedule Appointment
        </Button>
      </View>
    </View>
  );

  const renderMedicalInfo = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Medical History</Text>
      <Card style={styles.medicalCard}>
        <Card.Content>
          <View style={styles.medicalInfoItem}>
            <Text style={styles.medicalInfoLabel}>Last Checkup:</Text>
            <Text style={styles.medicalInfoValue}>{patientData.lastCheckup}</Text>
          </View>
          <View style={styles.medicalInfoItem}>
            <Text style={styles.medicalInfoLabel}>Blood Type:</Text>
            <Text style={styles.medicalInfoValue}>{patientData.bloodType}</Text>
          </View>
          <View style={styles.medicalInfoItem}>
            <Text style={styles.medicalInfoLabel}>Allergies:</Text>
            <Text style={styles.medicalInfoValue}>Penicillin, Peanuts</Text>
          </View>
        </Card.Content>
      </Card>

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Current Medications</Text>
      {patientData.medications.map((med, index) => (
        <Card key={index} style={styles.medicationCard}>
          <Card.Content>
            <View style={styles.medicationHeader}>
              <View style={styles.medicationIcon}>
                <MaterialCommunityIcons name="pill" size={24} color="#3498db" />
              </View>
              <View style={styles.medicationDetails}>
                <Text style={styles.medicationName}>{med.name}</Text>
                <Text style={styles.medicationDosage}>{med.dosage}</Text>
              </View>
              <Text style={styles.medicationTime}>{med.time}</Text>
            </View>
            <Text style={styles.medicationFrequency}>{med.frequency}</Text>
            <Button 
              mode="text" 
              icon="information" 
              style={styles.medicationInfoButton}
              labelStyle={{ fontSize: 12 }}
            >
              View Details
            </Button>
          </Card.Content>
        </Card>
      ))}
    </View>
  );

  const renderNotes = () => (
    <View style={styles.section}>
      <View style={styles.notesHeader}>
        <Text style={styles.sectionTitle}>Doctor's Notes</Text>
        <Button 
          mode="contained" 
          onPress={() => setIsEditing(!isEditing)}
          style={styles.editButton}
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </Button>
      </View>
      
      {isEditing ? (
        <View>
          <TextInput
            label="Notes"
            value={formData.notes}
            onChangeText={(text) => handleInputChange('notes', text)}
            multiline
            numberOfLines={8}
            style={styles.notesInput}
            mode="outlined"
          />
          <Button 
            mode="contained" 
            onPress={handleSave}
            style={styles.saveButton}
          >
            Save Changes
          </Button>
        </View>
      ) : (
        <Card style={styles.notesCard}>
          <Card.Content>
            <Text style={styles.notesText}>{patientData.notes}</Text>
            <Text style={styles.notesDate}>Last updated: {new Date().toLocaleDateString()}</Text>
          </Card.Content>
        </Card>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Patient Profile</Text>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  size={24}
                  onPress={() => setMenuVisible(true)}
                  style={styles.menuButton}
                />
              }
            >
              <Menu.Item onPress={() => {}} title="Print Medical Records" />
              <Menu.Item onPress={() => {}} title="Export Data" />
              <Divider />
              <Menu.Item onPress={() => {}} title="Settings" />
            </Menu>
          </View>
          
          <View style={styles.tabs}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
              onPress={() => setActiveTab('overview')}
            >
              <MaterialIcons 
                name="dashboard" 
                size={20} 
                color={activeTab === 'overview' ? '#4a90e2' : '#95a5a6'} 
              />
              <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
                Overview
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'medical' && styles.activeTab]}
              onPress={() => setActiveTab('medical')}
            >
              <MaterialCommunityIcons 
                name="medical-bag" 
                size={20} 
                color={activeTab === 'medical' ? '#4a90e2' : '#95a5a6'} 
              />
              <Text style={[styles.tabText, activeTab === 'medical' && styles.activeTabText]}>
                Medical
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'emergency' && styles.activeTab]}
              onPress={() => setActiveTab('emergency')}
            >
              <MaterialIcons 
                name="warning" 
                size={20} 
                color={activeTab === 'emergency' ? '#e74c3c' : '#95a5a6'} 
              />
              <Text style={[
                styles.tabText, 
                activeTab === 'emergency' ? styles.emergencyTabText : {}
              ]}>
                Emergency
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'notes' && styles.activeTab]}
              onPress={() => setActiveTab('notes')}
            >
              <MaterialIcons 
                name="note" 
                size={20} 
                color={activeTab === 'notes' ? '#4a90e2' : '#95a5a6'} 
              />
              <Text style={[styles.tabText, activeTab === 'notes' && styles.activeTabText]}>
                Notes
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'medical' && renderMedicalInfo()}
        {activeTab === 'emergency' && renderEmergencyContact()}
        {activeTab === 'notes' && renderNotes()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9fb',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingBottom: 8,
    elevation: 3,
    borderBottomWidth: 2,
    borderBottomColor: '#00bcd4',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00acc1',
  },
  menuButton: {
    margin: 0,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  tab: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: 'rgba(0, 172, 193, 0.1)',
  },
  tabText: {
    fontSize: 12,
    marginTop: 4,
    color: '#00838f',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#00acc1',
    fontWeight: '500',
  },
  emergencyTabText: {
    color: '#00acc1',
    fontWeight: '500',
  },
  section: {
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: '#b2ebf2',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00838f',
    marginBottom: 4,
  },
  patientAge: {
    fontSize: 14,
    color: '#00acc1',
    marginBottom: 8,
  },
  bloodType: {
    backgroundColor: '#e0f7fa',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  bloodTypeText: {
    color: '#00acc1',
    fontWeight: 'bold',
    fontSize: 12,
  },
  divider: {
    marginVertical: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00acc1',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#00838f',
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00acc1',
    marginBottom: 12,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#b2ebf2',
  },
  conditionText: {
    marginLeft: 12,
    color: '#00838f',
  },
  medicationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#b2ebf2',
  },
  medicationInfo: {
    marginLeft: 12,
    flex: 1,
  },
  medicationName: {
    fontWeight: '500',
    color: '#00838f',
  },
  medicationDetails: {
    fontSize: 12,
    color: '#00acc1',
    marginTop: 2,
  },
  viewAllButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00acc1',
    marginLeft: 8,
  },
  contactCard: {
    marginBottom: 24,
    borderRadius: 12,
    elevation: 2,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#00bcd4',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  contactAvatar: {
    backgroundColor: '#b2ebf2',
    marginRight: 12,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00838f',
  },
  contactRelationship: {
    fontSize: 14,
    color: '#00acc1',
  },
  contactInfo: {
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  contactText: {
    marginLeft: 12,
    color: '#00838f',
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  callButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#00acc1',
  },
  messageButton: {
    flex: 1,
    marginLeft: 8,
    borderColor: '#00acc1',
  },
  doctorInfo: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  doctorAvatar: {
    backgroundColor: '#b2ebf2',
    marginRight: 12,
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00838f',
    marginBottom: 2,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: '#00acc1',
    marginBottom: 8,
  },
  doctorContact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  doctorContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  doctorContactText: {
    fontSize: 12,
    color: '#00acc1',
    marginLeft: 4,
  },
  appointmentButton: {
    marginTop: 8,
    borderColor: '#00acc1',
  },
  medicalCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 1,
    backgroundColor: '#ffffff',
  },
  medicalInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  medicalInfoLabel: {
    color: '#00838f',
    fontSize: 14,
  },
  medicalInfoValue: {
    color: '#00acc1',
    fontWeight: '500',
    fontSize: 14,
  },
  medicationCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 1,
    backgroundColor: '#ffffff',
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  medicationIcon: {
    backgroundColor: '#b2ebf2',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  medicationDetails: {
    flex: 1,
  },
  medicationName: {
    fontWeight: '600',
    color: '#00838f',
    fontSize: 14,
  },
  medicationDosage: {
    fontSize: 12,
    color: '#00acc1',
  },
  medicationTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00acc1',
  },
  medicationFrequency: {
    fontSize: 12,
    color: '#00838f',
    marginLeft: 48,
    marginBottom: 4,
  },
  medicationInfoButton: {
    marginLeft: 48,
    marginTop: -8,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editButton: {
    borderRadius: 20,
  },
  notesCard: {
    borderRadius: 12,
    elevation: 1,
    backgroundColor: '#ffffff',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#00838f',
    marginBottom: 12,
  },
  notesDate: {
    fontSize: 12,
    color: '#00acc1',
    textAlign: 'right',
  },
  notesInput: {
    backgroundColor: '#f0f9fb',
    marginBottom: 12,
  },
  saveButton: {
    borderRadius: 8,
  },
});

export default PatientProfileScreen;
