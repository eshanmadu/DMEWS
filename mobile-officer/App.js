import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';

const API_URL = (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.API_URL)
  || (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.API_URL)
  || 'http://localhost:4000';

export default function App() {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [cityLatitude, setCityLatitude] = useState('');
  const [cityLongitude, setCityLongitude] = useState('');
  const [capacity, setCapacity] = useState('');
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  function validateAndBuild() {
    const payload = {
      name: (name || '').trim(),
      location: (location || '').trim(),
      district: (district || '').trim(),
      city: (city || '').trim(),
      capacity: capacity ? Number(capacity) : null,
      contact: (contact || '').trim(),
      notes: (notes || '').trim(),
    };

    if (!payload.name || !payload.location || !payload.district || payload.capacity == null) {
      Alert.alert('Validation', 'Name, location, district and capacity are required.');
      return null;
    }

    if (!Number.isInteger(payload.capacity) || payload.capacity <= 0) {
      Alert.alert('Validation', 'Capacity must be a positive integer.');
      return null;
    }

    if (payload.contact && !/^\d{10}$/.test(payload.contact)) {
      Alert.alert('Validation', 'Contact must be exactly 10 digits.');
      return null;
    }

    if (payload.city) {
      if (cityLatitude === '' || cityLongitude === '') {
        Alert.alert('Validation', 'City coordinates are required when city is set.');
        return null;
      }
      const lat = Number(cityLatitude);
      const lon = Number(cityLongitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        Alert.alert('Validation', 'City coordinates must be valid numbers.');
        return null;
      }
      payload.cityLatitude = lat;
      payload.cityLongitude = lon;
    } else {
      payload.cityLatitude = null;
      payload.cityLongitude = null;
    }

    return payload;
  }

  async function handleSubmit() {
    const payload = validateAndBuild();
    if (!payload) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/shelters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Server error: ${res.status}`);
      }

      const data = await res.json();
      Alert.alert('Success', `Shelter created: ${data.name || data.id}`);
      // reset
      setName('');
      setLocation('');
      setDistrict('');
      setCity('');
      setCityLatitude('');
      setCityLongitude('');
      setCapacity('');
      setContact('');
      setNotes('');
    } catch (err) {
      console.error('Create shelter error', err);
      Alert.alert('Error', err.message || 'Failed to create shelter');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Local Officer — Add Shelter</Text>

        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Shelter name" />

        <Text style={styles.label}>Location *</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Address or description" />

        <Text style={styles.label}>District *</Text>
        <TextInput style={styles.input} value={district} onChangeText={setDistrict} placeholder="District/Zone" />

        <Text style={styles.label}>City (optional)</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" />

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>City Latitude</Text>
            <TextInput style={styles.input} value={cityLatitude} onChangeText={setCityLatitude} placeholder="e.g. 12.345" keyboardType="numeric" />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>City Longitude</Text>
            <TextInput style={styles.input} value={cityLongitude} onChangeText={setCityLongitude} placeholder="e.g. 98.765" keyboardType="numeric" />
          </View>
        </View>

        <Text style={styles.label}>Capacity *</Text>
        <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} placeholder="Number of people" keyboardType="numeric" />

        <Text style={styles.label}>Contact (10 digits)</Text>
        <TextInput style={styles.input} value={contact} onChangeText={setContact} placeholder="Phone" keyboardType="phone-pad" />

        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, { height: 80 }]} value={notes} onChangeText={setNotes} placeholder="Any extra details" multiline />

        <View style={styles.buttonContainer}>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Button title="Create Shelter" onPress={handleSubmit} />
          )}
        </View>

        <Text style={styles.hint}>Backend: {API_URL}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  label: { marginTop: 8, marginBottom: 4, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, backgroundColor: '#fff' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { flex: 1, marginRight: 8 },
  buttonContainer: { marginTop: 20 },
  hint: { marginTop: 16, color: '#666', fontSize: 12 }
});
