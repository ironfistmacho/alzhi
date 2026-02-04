import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, ProgressBar, Title, Button } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const PatientVitalsScreen = () => {
  const [timeRange, setTimeRange] = useState('day');
  
  // Dummy data for vitals
  const vitalsData = {
    heartRate: {
      current: 72,
      min: 68,
      max: 85,
      unit: 'bpm',
      data: [72, 75, 73, 70, 72, 71, 70, 69, 71, 72],
      timestamps: ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
    },
    spo2: {
      current: 97,
      min: 95,
      max: 99,
      unit: '%',
      data: [97, 96, 97, 98, 97, 96, 97, 98, 97, 97],
      timestamps: ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
    },
    sleep: {
      total: 7.5,
      deep: 2.5,
      light: 4,
      rem: 1,
      awake: 0.5
    }
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(74, 144, 226, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#4a90e2',
    },
  };

  const renderVitalCard = (title, value, unit, min, max) => {
    const progress = (value - min) / (max - min);
    let color = '#4CAF50'; // Green
    
    if (title === 'Heart Rate' && (value > 80 || value < 60)) {
      color = '#F44336'; // Red
    } else if (title === 'SpO2' && value < 95) {
      color = '#F44336'; // Red
    }

    return (
      <Card style={styles.card} key={title}>
        <Card.Content>
          <View style={styles.vitalHeader}>
            <Text style={styles.vitalTitle}>{title}</Text>
            <Text style={[styles.vitalValue, { color }]}>
              {value} <Text style={styles.vitalUnit}>{unit}</Text>
            </Text>
          </View>
          <View style={styles.rangeContainer}>
            <Text style={styles.rangeText}>{min}{unit}</Text>
            <ProgressBar 
              progress={progress} 
              color={color} 
              style={styles.progressBar} 
            />
            <Text style={styles.rangeText}>{max}{unit}</Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderChart = (data, color) => (
    <LineChart
      data={{
        labels: vitalsData.heartRate.timestamps,
        datasets: [{
          data: data,
          color: (opacity = 1) => color,
          strokeWidth: 2
        }]
      }}
      width={Dimensions.get('window').width - 40}
      height={200}
      chartConfig={chartConfig}
      bezier
      style={styles.chart}
    />
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.timeRangeContainer}>
        <Button 
          mode={timeRange === 'day' ? 'contained' : 'outlined'} 
          onPress={() => setTimeRange('day')}
          style={styles.timeButton}
        >
          Day
        </Button>
        <Button 
          mode={timeRange === 'week' ? 'contained' : 'outlined'} 
          onPress={() => setTimeRange('week')}
          style={styles.timeButton}
        >
          Week
        </Button>
        <Button 
          mode={timeRange === 'month' ? 'contained' : 'outlined'} 
          onPress={() => setTimeRange('month')}
          style={styles.timeButton}
        >
          Month
        </Button>
      </View>

      <Title style={styles.sectionTitle}>Heart Rate</Title>
      {renderVitalCard('Heart Rate', vitalsData.heartRate.current, vitalsData.heartRate.unit, 60, 100)}
      {renderChart(vitalsData.heartRate.data, '#4a90e2')}

      <Title style={styles.sectionTitle}>Blood Oxygen (SpO2)</Title>
      {renderVitalCard('SpO2', vitalsData.spo2.current, vitalsData.spo2.unit, 90, 100)}
      {renderChart(vitalsData.spo2.data, '#e63946')}

      <Title style={styles.sectionTitle}>Sleep Analysis</Title>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.sleepContainer}>
            <View style={styles.sleepItem}>
              <Text style={styles.sleepValue}>{vitalsData.sleep.total}h</Text>
              <Text style={styles.sleepLabel}>Total Sleep</Text>
            </View>
            <View style={styles.sleepItem}>
              <Text style={styles.sleepValue}>{vitalsData.sleep.deep}h</Text>
              <Text style={styles.sleepLabel}>Deep</Text>
            </View>
            <View style={styles.sleepItem}>
              <Text style={styles.sleepValue}>{vitalsData.sleep.light}h</Text>
              <Text style={styles.sleepLabel}>Light</Text>
            </View>
            <View style={styles.sleepItem}>
              <Text style={styles.sleepValue}>{vitalsData.sleep.rem}h</Text>
              <Text style={styles.sleepLabel}>REM</Text>
            </View>
          </View>
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
  timeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timeButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#00acc1',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 3,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#00bcd4',
  },
  vitalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vitalTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#00838f',
  },
  vitalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00acc1',
  },
  vitalUnit: {
    fontSize: 14,
    color: '#00838f',
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  rangeText: {
    fontSize: 12,
    color: '#00838f',
    width: 40,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 8,
    backgroundColor: '#b2ebf2',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 8,
    marginLeft: -10,
  },
  sleepContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#e0f7fa',
    borderRadius: 8,
    padding: 8,
  },
  sleepItem: {
    alignItems: 'center',
    padding: 8,
  },
  sleepValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00acc1',
  },
  sleepLabel: {
    fontSize: 12,
    color: '#00838f',
    marginTop: 4,
    fontWeight: '600',
  },
});

export default PatientVitalsScreen;
