import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal,
} from 'react-native';
import Constants from 'expo-constants';

function resolveApiUrl() {
  const configured =
    (Constants.expoConfig &&
      Constants.expoConfig.extra &&
      Constants.expoConfig.extra.API_URL) ||
    'http://localhost:4000';

  try {
    const url = new URL(configured);

    const isLoopback =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1';

    if (!isLoopback) {
      return configured.replace(/\/$/, '');
    }

    const hostUri =
      Constants.expoConfig && Constants.expoConfig.hostUri;

    if (hostUri) {
      const host = String(hostUri)
        .split('/')[0]
        .split(':')[0];

      if (
        host &&
        host !== 'localhost' &&
        host !== '127.0.0.1'
      ) {
        url.hostname = host;
        return url.origin;
      }
    }
  } catch (_) {
    // Fall back to configured URL.
  }

  return configured.replace(/\/$/, '');
}

const API_URL = resolveApiUrl();

const PROVINCES = [
  { value: '1', label: 'Western Province' },
  { value: '2', label: 'Central Province' },
  { value: '3', label: 'Southern Province' },
  { value: '4', label: 'North Western Province' },
  { value: '5', label: 'Sabaragamuwa Province' },
  { value: '6', label: 'Eastern Province' },
  { value: '7', label: 'Uva Province' },
  { value: '8', label: 'North Central Province' },
  { value: '9', label: 'Northern Province' },
];

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [province, setProvince] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [district, setDistrict] = useState('');
  const [cityId, setCityId] = useState('');
  const [city, setCity] = useState('');
  const [cityLatitude, setCityLatitude] = useState('');
  const [cityLongitude, setCityLongitude] = useState('');
  const [districts, setDistricts] = useState([]);
  const [provinceOptions, setProvinceOptions] = useState(PROVINCES);
  const [cities, setCities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/locations/sri-lanka/provinces`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.provinces) && data.provinces.length) {
          setProvinceOptions(data.provinces.map((item) => ({ value: String(item.id), label: item.name_en })));
        }
      })
      .catch(() => {});
    fetch(`${API_URL}/locations/sri-lanka/districts`)
      .then((res) => res.json())
      .then((data) => setDistricts(Array.isArray(data?.districts) ? data.districts : []))
      .catch(() => setError('Unable to load location data.'));
  }, []);

  useEffect(() => {
    if (!districtId) {
      setCities([]);
      return;
    }
    fetch(`${API_URL}/locations/sri-lanka/cities?district=${encodeURIComponent(districtId)}`)
      .then((res) => res.json())
      .then((data) => setCities(Array.isArray(data?.cities) ? data.cities : []))
      .catch(() => setCities([]));
  }, [districtId]);

  const districtOptions = districts
    .filter((item) => String(item.province_id) === province)
    .sort((a, b) => a.name_en.localeCompare(b.name_en))
    .map((item) => ({ value: String(item.id), label: item.name_en }));
  const cityOptions = cities.map((item) => ({
    value: String(item.id),
    label: item.name_en || item.name || 'Unnamed city',
  }));

  async function submit() {
    setError('');
    if (mode === 'signup' && (!name.trim() || !province || !district || !city)) {
      setError('Name, province, district and city are required.');
      return;
    }
    setBusy(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup';
      const body = mode === 'login'
        ? { email: email.trim(), password }
        : {
            name: name.trim(),
            province,
            district,
            city,
            cityLatitude: Number(cityLatitude),
            cityLongitude: Number(cityLongitude),
            email: email.trim(),
            mobile: mobile.replace(/\D/g, ''),
            password,
          };
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Authentication failed.');
      onAuthenticated(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.authBrand}>DMEWS</Text>
          <Text style={styles.authTitle}>Mobile Officer</Text>
          <Text style={styles.authSubtitle}>Sign in to manage shelters in your assigned district.</Text>
          <View style={styles.card}>
            <View style={styles.authTabs}>
              <Pressable style={[styles.authTab, mode === 'login' && styles.authTabActive]} onPress={() => { setMode('login'); setError(''); }}>
                <Text style={styles.authTabText}>Log in</Text>
              </Pressable>
              <Pressable style={[styles.authTab, mode === 'signup' && styles.authTabActive]} onPress={() => { setMode('signup'); setError(''); }}>
                <Text style={styles.authTabText}>Sign up</Text>
              </Pressable>
            </View>
            {mode === 'signup' && (
              <>
                <Text style={styles.label}>Full name *</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={COLORS.placeholder} />
              </>
            )}
            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="officer@example.com" placeholderTextColor={COLORS.placeholder} />
            {mode === 'signup' && (
              <>
                <Text style={styles.label}>Mobile *</Text>
                <TextInput style={styles.input} value={mobile} onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="10 digit mobile number" placeholderTextColor={COLORS.placeholder} />
                <DropdownField label="Province *" value={province} placeholder="Select province" options={provinceOptions} onChange={(value) => { setProvince(value); setDistrictId(''); setDistrict(''); setCityId(''); setCity(''); setCities([]); }} />
                <DropdownField label="District *" value={districtId} placeholder={province ? 'Select district' : 'Select province first'} options={districtOptions} disabled={!province} onChange={(value) => { const selected = districts.find((item) => String(item.id) === value); setDistrictId(value); setDistrict(selected?.name_en || ''); setCityId(''); setCity(''); setCityLatitude(''); setCityLongitude(''); }} />
                <DropdownField label="City *" value={cityId} placeholder={districtId ? 'Select city' : 'Select district first'} options={cityOptions} disabled={!districtId} onChange={(value) => { const selected = cities.find((item) => String(item.id) === value); setCityId(value); setCity(selected?.name_en || selected?.name || ''); setCityLatitude(selected?.latitude == null ? '' : String(selected.latitude)); setCityLongitude(selected?.longitude == null ? '' : String(selected.longitude)); }} />
              </>
            )}
            <Text style={styles.label}>Password *</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" placeholderTextColor={COLORS.placeholder} />
            {error ? <Text style={styles.authError}>{error}</Text> : null}
            <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>{mode === 'login' ? 'Log in' : 'Create officer account'}</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DropdownField({ label, value, placeholder, options, onChange, disabled }) {
  const [visible, setVisible] = React.useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.input, styles.dropdown, disabled && styles.dropdownDisabled]}
        onPress={() => !disabled && setVisible(true)}
        disabled={disabled}
      >
        <Text style={selected ? styles.inputText : styles.placeholderText}>
          {selected?.label || placeholder}
        </Text>
        <Text style={styles.dropdownArrow}>⌄</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setVisible(false)}>
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownModalTitle}>{label}</Text>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  style={styles.dropdownOption}
                  onPress={() => {
                    onChange(option.value);
                    setVisible(false);
                  }}
                >
                  <Text style={styles.dropdownOptionText}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [city, setCity] = useState('');
  const [cityLatitude, setCityLatitude] = useState('');
  const [cityLongitude, setCityLongitude] = useState('');
  const [capacity, setCapacity] = useState('');
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [cities, setCities] = useState([]);
  const [provinceOptions, setProvinceOptions] = useState(PROVINCES);
  const [shelters, setShelters] = useState([]);
  const [sheltersLoading, setSheltersLoading] = useState(true);
  const [statusBusyId, setStatusBusyId] = useState(null);
  const [managementId, setManagementId] = useState(null);
  const [managementDraft, setManagementDraft] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/locations/sri-lanka/provinces`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.provinces) && data.provinces.length) {
          setProvinceOptions(data.provinces.map((item) => ({ value: String(item.id), label: item.name_en })));
        }
      })
      .catch(() => {});
    fetch(`${API_URL}/locations/sri-lanka/districts`)
      .then((res) => res.json())
      .then((data) => setDistricts(Array.isArray(data?.districts) ? data.districts : []))
      .catch(() => setDistricts([]));
    loadShelters();
  }, [token]);

  useEffect(() => {
    if (!districtId) {
      setCities([]);
      return;
    }
    fetch(`${API_URL}/locations/sri-lanka/cities?district=${encodeURIComponent(districtId)}`)
      .then((res) => res.json())
      .then((data) => setCities(Array.isArray(data?.cities) ? data.cities : []))
      .catch(() => setCities([]));
  }, [districtId]);

  if (!token) {
    return <AuthScreen onAuthenticated={(nextToken, nextUser) => { setToken(nextToken); setUser(nextUser); }} />;
  }

  function loadShelters() {
    setSheltersLoading(true);
    fetch(`${API_URL}/shelters`)
      .then((res) => res.json())
      .then((data) => setShelters(Array.isArray(data) ? data : []))
      .catch(() => setShelters([]))
      .finally(() => setSheltersLoading(false));
  }

  async function updateShelterStatus(id, status) {
    setStatusBusyId(id);
    try {
      const res = await fetch(`${API_URL}/shelters/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to update shelter status.');
      setShelters((current) => current.map((shelter) => shelter.id === id ? data : shelter));
    } catch (err) {
      Alert.alert('Status Update Failed', err.message);
    } finally {
      setStatusBusyId(null);
    }
  }

  function startManagement(shelter) {
    setManagementId(shelter.id);
    setManagementDraft({
      capacity: String(shelter.capacity || 1),
      occupied: String(shelter.occupied || 0),
      availability: shelter.availability || (shelter.status === 'inactive' ? 'closed' : 'open'),
      condition: shelter.condition || 'good',
    });
  }

  async function saveManagement(id) {
    if (!managementDraft) return;
    setStatusBusyId(id);
    try {
      const res = await fetch(`${API_URL}/shelters/${id}/management`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...managementDraft,
          capacity: Number(managementDraft.capacity),
          occupied: Number(managementDraft.occupied),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to update shelter details.');
      setShelters((current) => current.map((shelter) => shelter.id === id ? data : shelter));
      setManagementId(null);
      setManagementDraft(null);
    } catch (err) {
      Alert.alert('Shelter Update Failed', err.message);
    } finally {
      setStatusBusyId(null);
    }
  }

  const provinceDistricts = districts
    .filter((item) => String(item.province_id) === province)
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
  const districtOptions = provinceDistricts.map((item) => ({
    value: String(item.id),
    label: item.name_en,
  }));
  const cityOptions = cities.map((item) => ({
    value: String(item.id),
    label: item.name_en || item.name || 'Unnamed city',
  }));

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

    if (
      !payload.name ||
      !payload.location ||
      !province ||
      !payload.district ||
      payload.capacity == null
    ) {
      Alert.alert(
        'Required Fields',
        'Please enter the shelter name, location, district and capacity.'
      );
      return null;
    }

    if (
      !Number.isInteger(payload.capacity) ||
      payload.capacity <= 0
    ) {
      Alert.alert(
        'Invalid Capacity',
        'Capacity must be a positive whole number.'
      );
      return null;
    }

    if (
      payload.contact &&
      !/^\d{10}$/.test(payload.contact)
    ) {
      Alert.alert(
        'Invalid Contact',
        'Contact number must contain exactly 10 digits.'
      );
      return null;
    }

    if (payload.city) {
      if (
        cityLatitude === '' ||
        cityLongitude === ''
      ) {
        Alert.alert(
          'Coordinates Required',
          'Please enter both city latitude and longitude.'
        );
        return null;
      }

      const lat = Number(cityLatitude);
      const lon = Number(cityLongitude);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        Alert.alert(
          'Invalid Coordinates',
          'Latitude and longitude must be valid numbers.'
        );
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({}));

        throw new Error(
          body.message ||
            `Server error: ${res.status}`
        );
      }

      const data = await res.json();

      Alert.alert(
        'Shelter Created',
        `${data.name || data.id} has been successfully registered.`
      );

      // Reset form
      setName('');
      setLocation('');
      setProvince('');
      setDistrict('');
      setDistrictId('');
      setCity('');
      setCityLatitude('');
      setCityLongitude('');
      setCapacity('');
      setContact('');
      setNotes('');
    } catch (err) {
      console.error(
        'Create shelter error:',
        err
      );

      Alert.alert(
        'Connection Error',
        err.message ||
          'Failed to create shelter. Please check the backend connection.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryDark}
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ================= HEADER ================= */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.brand}>
                  DMEWS
                </Text>

                <Text style={styles.brandSubtitle}>
                  Disaster Management & Early Warning System
                </Text>
              </View>

              <View style={styles.headerIcon}>
                <Text style={styles.headerIconText}>
                  ⚙
                </Text>
              </View>
            </View>

            <View style={styles.headerDivider} />

            <Text style={styles.headerTitle}>
              Local Officer
            </Text>

            <Text style={styles.headerDescription}>
              Register a new emergency shelter
            </Text>
          </View>

          {/* ================= MAIN CARD ================= */}
          <View style={styles.card}>

            {/* Section title */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionIconText}>
                  +
                </Text>
              </View>

              <View>
                <Text style={styles.sectionTitle}>
                  Add Shelter
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Enter shelter information below
                </Text>
              </View>
            </View>

            {/* ================= SHELTER INFORMATION ================= */}

            <Text style={styles.label}>
              Shelter Name
              <Text style={styles.required}> *</Text>
            </Text>

            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter shelter name"
              placeholderTextColor={COLORS.placeholder}
              returnKeyType="next"
            />

            <Text style={styles.label}>
              Location
              <Text style={styles.required}> *</Text>
            </Text>

            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Enter address or description"
              placeholderTextColor={COLORS.placeholder}
              returnKeyType="next"
            />

            <DropdownField
              label={<Text>Province<Text style={styles.required}> *</Text></Text>}
              value={province}
              placeholder="Select province"
              options={provinceOptions}
              onChange={(value) => {
                setProvince(value);
                setDistrict('');
                setDistrictId('');
                setCity('');
                setCities([]);
                setCityLatitude('');
                setCityLongitude('');
              }}
            />

            <DropdownField
              label={<Text>District<Text style={styles.required}> *</Text></Text>}
              value={districtId}
              placeholder={province ? 'Select district' : 'Select province first'}
              options={districtOptions}
              disabled={!province || districts.length === 0}
              onChange={(value) => {
                const selected = provinceDistricts.find((item) => String(item.id) === value);
                setDistrictId(value);
                setDistrict(selected?.name_en || '');
                setCity('');
                setCityLatitude('');
                setCityLongitude('');
              }}
            />

            <DropdownField
              label={<Text>City<Text style={styles.optional}> (Optional)</Text></Text>}
              value={city ? String(cities.find((item) => (item.name_en || item.name) === city)?.id || '') : ''}
              placeholder={districtId ? 'Select city' : 'Select district first'}
              options={cityOptions}
              disabled={!districtId || cities.length === 0}
              onChange={(value) => {
                const selected = cities.find((item) => String(item.id) === value);
                setCity(selected?.name_en || selected?.name || '');
                setCityLatitude(selected?.latitude == null ? '' : String(selected.latitude));
                setCityLongitude(selected?.longitude == null ? '' : String(selected.longitude));
              }}
            />

            {/* ================= COORDINATES ================= */}

            <Text style={styles.subSectionTitle}>
              City Coordinates
            </Text>

            <Text style={styles.coordinateHint}>
              Required only when a city is provided
            </Text>

            <View style={styles.coordinateRow}>
              <View
                style={[
                  styles.coordinateColumn,
                  { marginRight: 8 },
                ]}
              >
                <Text style={styles.smallLabel}>
                  Latitude
                </Text>

                <TextInput
                  style={styles.input}
                  value={cityLatitude}
                  onChangeText={setCityLatitude}
                  placeholder="e.g. 6.9271"
                  placeholderTextColor={
                    COLORS.placeholder
                  }
                  keyboardType="numeric"
                />
              </View>

              <View
                style={[
                  styles.coordinateColumn,
                  { marginLeft: 8 },
                ]}
              >
                <Text style={styles.smallLabel}>
                  Longitude
                </Text>

                <TextInput
                  style={styles.input}
                  value={cityLongitude}
                  onChangeText={setCityLongitude}
                  placeholder="e.g. 79.8612"
                  placeholderTextColor={
                    COLORS.placeholder
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* ================= CAPACITY ================= */}

            <Text style={styles.label}>
              Capacity
              <Text style={styles.required}> *</Text>
            </Text>

            <TextInput
              style={styles.input}
              value={capacity}
              onChangeText={setCapacity}
              placeholder="Number of people"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="numeric"
            />

            {/* ================= CONTACT ================= */}

            <Text style={styles.label}>
              Contact
              <Text style={styles.optional}>
                {' '}
                (10 digits)
              </Text>
            </Text>

            <TextInput
              style={styles.input}
              value={contact}
              onChangeText={setContact}
              placeholder="Enter phone number"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="phone-pad"
              maxLength={10}
            />

            {/* ================= NOTES ================= */}

            <Text style={styles.label}>
              Notes
              <Text style={styles.optional}>
                {' '}
                (Optional)
              </Text>
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.notesInput,
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Enter any additional details"
              placeholderTextColor={COLORS.placeholder}
              multiline
              textAlignVertical="top"
            />

            {/* ================= BUTTON ================= */}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  color="#FFFFFF"
                  size="small"
                />
              ) : (
                <>
                  <Text style={styles.buttonIcon}>
                    +
                  </Text>

                  <Text style={styles.buttonText}>
                    Create Shelter
                  </Text>
                </>
              )}
            </Pressable>

            {/* ================= FOOTER ================= */}

            <View style={styles.statusContainer}>
              <View style={styles.statusDot} />

              <Text style={styles.statusText}>
                Connected to DMEWS server
              </Text>
            </View>

          </View>

          {/* ================= EXISTING SHELTERS ================= */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionIconText}>✓</Text>
              </View>
              <View>
                <Text style={styles.sectionTitle}>Manage Shelters</Text>
                <Text style={styles.sectionSubtitle}>Update availability for registered shelters</Text>
              </View>
            </View>

            {sheltersLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : shelters.length === 0 ? (
              <Text style={styles.emptyText}>No shelters have been registered yet.</Text>
            ) : (
              shelters.filter((shelter) => shelter.district === user?.district).map((shelter) => {
                const isActive = shelter.status !== 'inactive';
                const isManaging = managementId === shelter.id;
                const isFull = shelter.isFull || (shelter.occupied || 0) >= (shelter.capacity || 0);
                return (
                  <View key={shelter.id} style={styles.shelterRow}>
                    <View style={styles.shelterDetails}>
                      <Text style={styles.shelterName}>{shelter.name}</Text>
                      <Text style={styles.shelterMeta}>{shelter.district}{shelter.city ? ` • ${shelter.city}` : ''}</Text>
                      <Text style={styles.shelterMeta}>Places: {shelter.occupied || 0}/{shelter.capacity} {isFull ? '• FULL' : `• ${shelter.availableSpaces ?? Math.max(0, shelter.capacity - (shelter.occupied || 0))} available`}</Text>
                      <Text style={styles.shelterMeta}>Condition: {(shelter.condition || 'good').replace('-', ' ')}</Text>
                    </View>
                    <View style={styles.shelterActions}>
                      <Pressable
                        style={[styles.statusButton, isActive ? styles.activeButton : styles.inactiveButton]}
                        onPress={() => updateShelterStatus(shelter.id, isActive ? 'inactive' : 'active')}
                        disabled={statusBusyId === shelter.id}
                      >
                        <Text style={styles.statusButtonText}>{isActive ? 'Open' : 'Closed'}</Text>
                      </Pressable>
                      <Pressable style={styles.editButton} onPress={() => isManaging ? setManagementId(null) : startManagement(shelter)}>
                        <Text style={styles.editButtonText}>{isManaging ? 'Cancel' : 'Edit'}</Text>
                      </Pressable>
                    </View>
                    {isManaging && managementDraft && (
                      <View style={styles.managementEditor}>
                        <Text style={styles.smallLabel}>Capacity</Text>
                        <TextInput style={styles.smallInput} keyboardType="numeric" value={managementDraft.capacity} onChangeText={(value) => setManagementDraft((draft) => ({ ...draft, capacity: value.replace(/\D/g, '') }))} />
                        <Text style={styles.smallLabel}>Occupied</Text>
                        <TextInput style={styles.smallInput} keyboardType="numeric" value={managementDraft.occupied} onChangeText={(value) => setManagementDraft((draft) => ({ ...draft, occupied: value.replace(/\D/g, '') }))} />
                        <DropdownField label="Availability" value={managementDraft.availability} options={[{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }]} onChange={(value) => setManagementDraft((draft) => ({ ...draft, availability: value }))} />
                        <DropdownField label="Live condition" value={managementDraft.condition} options={[{ value: 'good', label: 'Good' }, { value: 'fair', label: 'Fair' }, { value: 'needs-attention', label: 'Needs attention' }, { value: 'critical', label: 'Critical' }]} onChange={(value) => setManagementDraft((draft) => ({ ...draft, condition: value }))} />
                        <Pressable style={styles.saveManagementButton} onPress={() => saveManagement(shelter.id)} disabled={statusBusyId === shelter.id}>
                          {statusBusyId === shelter.id ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.statusButtonText}>Save shelter details</Text>}
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* ================= FOOTER BRAND ================= */}

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>
              DMEWS
            </Text>

            <Text style={styles.footerText}>
              Disaster Management & Early Warning System
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* =====================================================
   DMEWS THEME
===================================================== */

const COLORS = {
  primary: '#1976D2',
  primaryDark: '#0D47A1',
  primaryLight: '#E3F2FD',

  background: '#F5F8FC',
  white: '#FFFFFF',

  text: '#172B4D',
  secondaryText: '#5F6B7A',
  placeholder: '#A5AFBC',

  border: '#D9E1EA',

  required: '#E53935',

  success: '#2E7D32',
  successLight: '#E8F5E9',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
  },

  keyboardContainer: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    paddingBottom: 30,
  },

  authContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },

  authBrand: {
    color: COLORS.primaryDark,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },

  authTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },

  authSubtitle: {
    color: COLORS.secondaryText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 18,
    textAlign: 'center',
  },

  authTabs: {
    flexDirection: 'row',
    marginBottom: 8,
  },

  authTab: {
    flex: 1,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },

  authTabActive: {
    borderBottomColor: COLORS.primary,
  },

  authTabText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },

  authError: {
    color: COLORS.required,
    fontSize: 13,
    marginTop: 12,
  },

  /* ================= HEADER ================= */

  header: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,

    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  brand: {
    color: COLORS.white,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: 1,
  },

  brandSubtitle: {
    color: '#D5E6FA',
    fontSize: 10,
    marginTop: 3,
    maxWidth: 260,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',

    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  headerIconText: {
    fontSize: 25,
    color: COLORS.primary,
  },

  headerDivider: {
    height: 1,
    backgroundColor: '#4C7DB8',
    marginTop: 18,
    marginBottom: 16,
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 23,
    fontWeight: '700',
  },

  headerDescription: {
    color: '#D5E6FA',
    fontSize: 14,
    marginTop: 4,
  },

  /* ================= CARD ================= */

  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 18,
    padding: 20,

    borderRadius: 18,

    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  /* ================= SECTION ================= */

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  sectionIconText: {
    color: COLORS.primary,
    fontSize: 26,
    fontWeight: '500',
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 2,
  },

  /* ================= FORM ================= */

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 15,
    marginBottom: 7,
  },

  smallLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 7,
  },

  required: {
    color: COLORS.required,
  },

  optional: {
    color: COLORS.secondaryText,
    fontWeight: '400',
  },

  input: {
    height: 48,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,

    backgroundColor: '#FAFCFE',

    paddingHorizontal: 14,

    fontSize: 14,
    color: COLORS.text,
  },

  inputText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },

  placeholderText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.placeholder,
  },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dropdownDisabled: {
    backgroundColor: '#F1F4F7',
    opacity: 0.75,
  },

  dropdownArrow: {
    color: COLORS.secondaryText,
    fontSize: 20,
    marginLeft: 8,
    marginTop: -5,
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 32, 56, 0.45)',
  },

  dropdownModal: {
    maxHeight: '75%',
    borderRadius: 16,
    backgroundColor: COLORS.white,
    padding: 18,
    elevation: 8,
  },

  dropdownModalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },

  dropdownOption: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
    paddingVertical: 14,
  },

  dropdownOptionText: {
    color: COLORS.text,
    fontSize: 15,
  },

  notesInput: {
    height: 100,
    paddingTop: 13,
    paddingBottom: 13,
  },

  shelterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
    paddingVertical: 14,
  },

  shelterDetails: {
    flex: 1,
    paddingRight: 10,
  },

  shelterActions: {
    alignItems: 'flex-end',
    gap: 6,
  },

  shelterName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },

  shelterMeta: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 3,
  },

  statusButton: {
    minWidth: 78,
    minHeight: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  activeButton: {
    backgroundColor: COLORS.success,
  },

  inactiveButton: {
    backgroundColor: '#64748B',
  },

  statusButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },

  editButton: {
    minWidth: 78,
    minHeight: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },

  editButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  managementEditor: {
    width: '100%',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
    paddingTop: 12,
  },

  smallInput: {
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    backgroundColor: '#FAFCFE',
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 6,
  },

  saveManagementButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginTop: 8,
  },

  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },

  /* ================= COORDINATES ================= */

  subSectionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 22,
  },

  coordinateHint: {
    color: COLORS.secondaryText,
    fontSize: 11,
    marginTop: 3,
    marginBottom: 10,
  },

  coordinateRow: {
    flexDirection: 'row',
  },

  coordinateColumn: {
    flex: 1,
  },

  /* ================= BUTTON ================= */

  button: {
    height: 52,

    backgroundColor: COLORS.primary,

    borderRadius: 12,

    marginTop: 25,

    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',

    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonIcon: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '400',
    marginRight: 8,
    marginTop: -2,
  },

  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },

  /* ================= STATUS ================= */

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 17,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },

  statusText: {
    fontSize: 11,
    color: COLORS.secondaryText,
  },

  /* ================= FOOTER ================= */

  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },

  footerBrand: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },

  footerText: {
    color: COLORS.secondaryText,
    fontSize: 9,
    marginTop: 3,
    textAlign: 'center',
  },
});