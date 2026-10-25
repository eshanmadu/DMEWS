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
import VictimIdentification from './VictimIdentification';

/* =====================================================
   DMEWS THEME (same palette, extended with a few tints)
===================================================== */

const COLORS = {
  primary: '#1976D2',
  primaryDark: '#0D47A1',
  primaryLight: '#E3F2FD',
  primarySoft: '#F1F7FD',

  background: '#F5F8FC',
  white: '#FFFFFF',

  text: '#172B4D',
  secondaryText: '#5F6B7A',
  placeholder: '#A5AFBC',

  border: '#D9E1EA',
  borderSoft: '#EEF2F6',

  required: '#E53935',

  success: '#2E7D32',
  successLight: '#E8F5E9',

  warning: '#B26A00',
  warningLight: '#FFF4E0',

  danger: '#C62828',
  dangerLight: '#FFEBEE',

  slate: '#64748B',
  slateLight: '#EEF1F5',
};

const CONDITION_STYLES = {
  good: { label: 'Good', fg: COLORS.success, bg: COLORS.successLight },
  fair: { label: 'Fair', fg: COLORS.primary, bg: COLORS.primaryLight },
  'needs-attention': { label: 'Needs attention', fg: COLORS.warning, bg: COLORS.warningLight },
  critical: { label: 'Critical', fg: COLORS.danger, bg: COLORS.dangerLight },
};

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

/* =====================================================
   SHARED COMPONENTS
===================================================== */

function Field({ label, required, hint, style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
        {hint ? <Text style={styles.optional}> {hint}</Text> : null}
      </Text>
      <TextInput
        {...props}
        style={[styles.input, focused && styles.inputFocused, style]}
        placeholderTextColor={COLORS.placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

function DropdownField({ label, required, hint, value, placeholder, options, onChange, disabled }) {
  const [visible, setVisible] = React.useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
        {hint ? <Text style={styles.optional}> {hint}</Text> : null}
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.input,
          styles.dropdown,
          disabled && styles.dropdownDisabled,
          pressed && !disabled && styles.inputFocused,
        ]}
        onPress={() => !disabled && setVisible(true)}
        disabled={disabled}
      >
        <Text style={selected ? styles.inputText : styles.placeholderText} numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
        <Text style={styles.dropdownArrow}>⌄</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.length === 0 ? (
                <Text style={styles.emptyText}>No options available.</Text>
              ) : (
                options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <Pressable
                      key={option.value}
                      style={({ pressed }) => [
                        styles.sheetOption,
                        isSelected && styles.sheetOptionSelected,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => {
                        onChange(option.value);
                        setVisible(false);
                      }}
                    >
                      <Text style={[styles.sheetOptionText, isSelected && styles.sheetOptionTextSelected]}>
                        {option.label}
                      </Text>
                      {isSelected ? <Text style={styles.sheetCheck}>✓</Text> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function PrimaryButton({ children, onPress, busy, disabled, style }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        (busy || disabled) && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={busy || disabled}
    >
      {busy ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.buttonText}>{children}</Text>}
    </Pressable>
  );
}

function Pill({ label, fg, bg }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <View style={[styles.pillDot, { backgroundColor: fg }]} />
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/* =====================================================
   AUTH SCREEN
===================================================== */

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  return (
    <SafeAreaView style={styles.authSafeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
      <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.authScroll}
          contentContainerStyle={styles.authContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authHero}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>D</Text>
            </View>
            <Text style={styles.authBrand}>DisasterWatch</Text>
            <Text style={styles.authTitle}>Mobile Officer</Text>
            <Text style={styles.authSubtitle}>
              Sign in to manage shelters in your assigned district.
            </Text>
          </View>

          <View style={[styles.card, styles.authCard]}>
            <View style={styles.segment}>
              <Pressable style={[styles.segmentItem, mode === 'login' && styles.segmentItemActive]} onPress={() => switchMode('login')}>
                <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>Log in</Text>
              </Pressable>
              <Pressable style={[styles.segmentItem, mode === 'signup' && styles.segmentItemActive]} onPress={() => switchMode('signup')}>
                <Text style={[styles.segmentText, mode === 'signup' && styles.segmentTextActive]}>Sign up</Text>
              </Pressable>
            </View>

            {mode === 'signup' && (
              <Field label="Full name" required value={name} onChangeText={setName} placeholder="Your name" />
            )}

            <Field
              label="Email"
              required
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="officer@example.com"
            />

            {mode === 'signup' && (
              <>
                <Field
                  label="Mobile"
                  required
                  value={mobile}
                  onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="phone-pad"
                  placeholder="10 digit mobile number"
                />
                <DropdownField
                  label="Province"
                  required
                  value={province}
                  placeholder="Select province"
                  options={provinceOptions}
                  onChange={(value) => {
                    setProvince(value);
                    setDistrictId('');
                    setDistrict('');
                    setCityId('');
                    setCity('');
                    setCities([]);
                  }}
                />
                <DropdownField
                  label="District"
                  required
                  value={districtId}
                  placeholder={province ? 'Select district' : 'Select province first'}
                  options={districtOptions}
                  disabled={!province}
                  onChange={(value) => {
                    const selected = districts.find((item) => String(item.id) === value);
                    setDistrictId(value);
                    setDistrict(selected?.name_en || '');
                    setCityId('');
                    setCity('');
                    setCityLatitude('');
                    setCityLongitude('');
                  }}
                />
                <DropdownField
                  label="City"
                  required
                  value={cityId}
                  placeholder={districtId ? 'Select city' : 'Select district first'}
                  options={cityOptions}
                  disabled={!districtId}
                  onChange={(value) => {
                    const selected = cities.find((item) => String(item.id) === value);
                    setCityId(value);
                    setCity(selected?.name_en || selected?.name || '');
                    setCityLatitude(selected?.latitude == null ? '' : String(selected.latitude));
                    setCityLongitude(selected?.longitude == null ? '' : String(selected.longitude));
                  }}
                />
              </>
            )}

            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>
                  Password<Text style={styles.required}> *</Text>
                </Text>
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Text style={styles.linkText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
              <PasswordInput value={password} onChangeText={setPassword} visible={showPassword} />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.authError}>{error}</Text>
              </View>
            ) : null}

            <PrimaryButton onPress={submit} busy={busy}>
              {mode === 'login' ? 'Log in' : 'Create officer account'}
            </PrimaryButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PasswordInput({ value, onChangeText, visible }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[styles.input, focused && styles.inputFocused]}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={!visible}
      autoCapitalize="none"
      placeholder="At least 6 characters"
      placeholderTextColor={COLORS.placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

/* =====================================================
   MAIN APP
===================================================== */

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('shelters');
  const [tab, setTab] = useState('manage');
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

  if (activeSection === 'victim-identification') {
    return <VictimIdentification apiUrl={API_URL} token={token} onBack={() => setActiveSection('shelters')} />;
  }

  function loadShelters() {
    setSheltersLoading(true);
    fetch(`${API_URL}/shelters`)
      .then((res) => res.json())
      .then((data) => setShelters(Array.isArray(data) ? data : []))
      .catch(() => setShelters([]))
      .finally(() => setSheltersLoading(false));
  }

  function logout() {
    setToken(null);
    setUser(null);
    setShelters([]);
    setTab('manage');
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

  const mySheltersList = shelters.filter((shelter) => shelter.district === user?.district);
  const openCount = mySheltersList.filter((s) => s.status !== 'inactive').length;
  const spacesLeft = mySheltersList.reduce(
    (sum, s) => sum + Math.max(0, (s.capacity || 0) - (s.occupied || 0)),
    0
  );
  const initial = (user?.name || 'O').trim().charAt(0).toUpperCase();

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

      // Show the new shelter in the list
      loadShelters();
      setTab('manage');
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              <View style={styles.headerUser}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.greeting}>Welcome back</Text>
                  <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Local Officer'}</Text>
                </View>
              </View>
              <Pressable style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]} onPress={logout}>
                <Text style={styles.logoutText}>Log out</Text>
              </Pressable>
            </View>

            <View style={styles.districtChip}>
              <Text style={styles.districtChipText}>
                {user?.district ? `${user.district} district` : 'DMEWS Local Officer'}
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{sheltersLoading ? '–' : mySheltersList.length}</Text>
                <Text style={styles.statLabel}>Shelters</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{sheltersLoading ? '–' : openCount}</Text>
                <Text style={styles.statLabel}>Open now</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{sheltersLoading ? '–' : spacesLeft}</Text>
                <Text style={styles.statLabel}>Places free</Text>
              </View>
            </View>
          </View>

          {/* ================= VICTIM IDENTIFICATION ENTRY ================= */}
          <Pressable
            style={({ pressed }) => [styles.victimEntry, pressed && styles.pressed]}
            onPress={() => setActiveSection('victim-identification')}
          >
            <View style={styles.victimIcon}>
              <Text style={styles.victimIconText}>◉</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.victimEntryTitle}>Victim identification</Text>
              <Text style={styles.victimEntryText}>Capture a face for authorised review</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {/* ================= TABS ================= */}
          <View style={styles.tabsWrap}>
            <View style={styles.segment}>
              <Pressable style={[styles.segmentItem, tab === 'manage' && styles.segmentItemActive]} onPress={() => setTab('manage')}>
                <Text style={[styles.segmentText, tab === 'manage' && styles.segmentTextActive]}>Manage shelters</Text>
              </Pressable>
              <Pressable style={[styles.segmentItem, tab === 'add' && styles.segmentItemActive]} onPress={() => setTab('add')}>
                <Text style={[styles.segmentText, tab === 'add' && styles.segmentTextActive]}>Add shelter</Text>
              </Pressable>
            </View>
          </View>

          {/* ================= ADD SHELTER ================= */}
          {tab === 'add' && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <Text style={styles.sectionIconText}>+</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Add shelter</Text>
                  <Text style={styles.sectionSubtitle}>Register a new emergency shelter</Text>
                </View>
              </View>

              <Text style={styles.groupTitle}>Shelter details</Text>

              <Field
                label="Shelter name"
                required
                value={name}
                onChangeText={setName}
                placeholder="Enter shelter name"
                returnKeyType="next"
              />

              <Field
                label="Location"
                required
                value={location}
                onChangeText={setLocation}
                placeholder="Enter address or description"
                returnKeyType="next"
              />

              <Text style={styles.groupTitle}>Area</Text>

              <DropdownField
                label="Province"
                required
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
                label="District"
                required
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
                label="City"
                hint="(Optional)"
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

              <View style={styles.coordinateBox}>
                <Text style={styles.coordinateTitle}>City coordinates</Text>
                <Text style={styles.coordinateHint}>Required only when a city is provided</Text>
                <View style={styles.coordinateRow}>
                  <View style={[styles.coordinateColumn, { marginRight: 6 }]}>
                    <Field
                      label="Latitude"
                      value={cityLatitude}
                      onChangeText={setCityLatitude}
                      placeholder="e.g. 6.9271"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.coordinateColumn, { marginLeft: 6 }]}>
                    <Field
                      label="Longitude"
                      value={cityLongitude}
                      onChangeText={setCityLongitude}
                      placeholder="e.g. 79.8612"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.groupTitle}>Capacity and contact</Text>

              <Field
                label="Capacity"
                required
                value={capacity}
                onChangeText={setCapacity}
                placeholder="Number of people"
                keyboardType="numeric"
              />

              <Field
                label="Contact"
                hint="(10 digits)"
                value={contact}
                onChangeText={setContact}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                maxLength={10}
              />

              <Field
                label="Notes"
                hint="(Optional)"
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Enter any additional details"
                multiline
                textAlignVertical="top"
              />

              <PrimaryButton onPress={handleSubmit} busy={loading}>
                Create shelter
              </PrimaryButton>

              <View style={styles.statusContainer}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Connected to DMEWS server</Text>
              </View>
            </View>
          )}

          {/* ================= MANAGE SHELTERS ================= */}
          {tab === 'manage' && (
            <View style={styles.listWrap}>
              <View style={styles.listHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Your shelters</Text>
                  <Text style={styles.sectionSubtitle}>Update availability and live conditions</Text>
                </View>
                <Pressable style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]} onPress={loadShelters}>
                  <Text style={styles.refreshText}>Refresh</Text>
                </Pressable>
              </View>

              {sheltersLoading ? (
                <View style={styles.card}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              ) : mySheltersList.length === 0 ? (
                <View style={[styles.card, styles.emptyCard]}>
                  <View style={styles.emptyIcon}>
                    <Text style={styles.emptyIconText}>⌂</Text>
                  </View>
                  <Text style={styles.emptyTitle}>No shelters in your district yet</Text>
                  <Text style={styles.emptyText}>Register your first shelter to start tracking places and conditions.</Text>
                  <Pressable style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]} onPress={() => setTab('add')}>
                    <Text style={styles.outlineButtonText}>Add a shelter</Text>
                  </Pressable>
                </View>
              ) : (
                mySheltersList.map((shelter) => {
                  const isActive = shelter.status !== 'inactive';
                  const isManaging = managementId === shelter.id;
                  const occupied = shelter.occupied || 0;
                  const cap = shelter.capacity || 0;
                  const isFull = shelter.isFull || occupied >= cap;
                  const available = shelter.availableSpaces ?? Math.max(0, cap - occupied);
                  const pct = cap > 0 ? Math.min(100, Math.round((occupied / cap) * 100)) : 0;
                  const barColor = isFull ? COLORS.danger : pct >= 70 ? '#F59E0B' : COLORS.success;
                  const cond = CONDITION_STYLES[shelter.condition || 'good'] || CONDITION_STYLES.good;
                  const busy = statusBusyId === shelter.id;

                  return (
                    <View key={shelter.id} style={styles.shelterCard}>
                      <View style={styles.shelterTop}>
                        <View style={styles.shelterDetails}>
                          <Text style={styles.shelterName} numberOfLines={2}>{shelter.name}</Text>
                          <Text style={styles.shelterMeta}>
                            {shelter.district}{shelter.city ? `, ${shelter.city}` : ''}
                          </Text>
                        </View>
                        <Pressable
                          style={[styles.togglePill, isActive ? styles.toggleOpen : styles.toggleClosed]}
                          onPress={() => updateShelterStatus(shelter.id, isActive ? 'inactive' : 'active')}
                          disabled={busy}
                        >
                          {busy ? (
                            <ActivityIndicator size="small" color={COLORS.white} />
                          ) : (
                            <Text style={styles.toggleText}>{isActive ? 'Open' : 'Closed'}</Text>
                          )}
                        </Pressable>
                      </View>

                      <View style={styles.occupancyRow}>
                        <Text style={styles.occupancyText}>
                          <Text style={styles.occupancyStrong}>{occupied}</Text> of {cap} places taken
                        </Text>
                        <Text style={[styles.occupancyBadge, { color: barColor }]}>
                          {isFull ? 'Full' : `${available} free`}
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                      </View>

                      <View style={styles.shelterFooter}>
                        <Pill label={cond.label} fg={cond.fg} bg={cond.bg} />
                        <Pressable
                          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                          onPress={() => (isManaging ? setManagementId(null) : startManagement(shelter))}
                        >
                          <Text style={styles.editButtonText}>{isManaging ? 'Cancel' : 'Edit details'}</Text>
                        </Pressable>
                      </View>

                      {isManaging && managementDraft && (
                        <View style={styles.managementEditor}>
                          <View style={styles.coordinateRow}>
                            <View style={[styles.coordinateColumn, { marginRight: 6 }]}>
                              <Field
                                label="Capacity"
                                keyboardType="numeric"
                                value={managementDraft.capacity}
                                onChangeText={(value) => setManagementDraft((draft) => ({ ...draft, capacity: value.replace(/\D/g, '') }))}
                              />
                            </View>
                            <View style={[styles.coordinateColumn, { marginLeft: 6 }]}>
                              <Field
                                label="Occupied"
                                keyboardType="numeric"
                                value={managementDraft.occupied}
                                onChangeText={(value) => setManagementDraft((draft) => ({ ...draft, occupied: value.replace(/\D/g, '') }))}
                              />
                            </View>
                          </View>
                          <DropdownField
                            label="Availability"
                            value={managementDraft.availability}
                            options={[{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }]}
                            onChange={(value) => setManagementDraft((draft) => ({ ...draft, availability: value }))}
                          />
                          <DropdownField
                            label="Live condition"
                            value={managementDraft.condition}
                            options={[
                              { value: 'good', label: 'Good' },
                              { value: 'fair', label: 'Fair' },
                              { value: 'needs-attention', label: 'Needs attention' },
                              { value: 'critical', label: 'Critical' },
                            ]}
                            onChange={(value) => setManagementDraft((draft) => ({ ...draft, condition: value }))}
                          />
                          <PrimaryButton style={styles.saveButton} onPress={() => saveManagement(shelter.id)} busy={busy}>
                            Save shelter details
                          </PrimaryButton>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ================= FOOTER BRAND ================= */}
          <View style={styles.footer}>
            <Text style={styles.footerBrand}>DMEWS</Text>
            <Text style={styles.footerText}>Disaster Management & Early Warning System</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* =====================================================
   STYLES
===================================================== */

const cardShadow = {
  elevation: 2,
  shadowColor: '#0D47A1',
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.primaryDark },
  authSafeArea: { flex: 1, backgroundColor: COLORS.primaryDark },
  keyboardContainer: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 32 },
  pressed: { opacity: 0.75 },

  /* ================= AUTH ================= */
  authScroll: { flex: 1, backgroundColor: COLORS.background },
  authContent: { flexGrow: 1, paddingBottom: 32 },
  authHero: {
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 72,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoBadgeText: { color: COLORS.primaryDark, fontSize: 32, fontWeight: '900' },
  authBrand: { color: COLORS.white, fontSize: 28, fontWeight: '800', letterSpacing: 1.5 },
  authTitle: { color: '#D5E6FA', fontSize: 18, fontWeight: '600', marginTop: 4 },
  authSubtitle: {
    color: '#AFCDEE',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 280,
  },
  authCard: { marginTop: -44 },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  authError: { color: COLORS.danger, fontSize: 13, lineHeight: 18 },

  /* ================= HEADER ================= */
  header: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 14 : 14,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerUser: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: COLORS.primaryDark, fontSize: 20, fontWeight: '800' },
  greeting: { color: '#AFCDEE', fontSize: 12 },
  userName: { color: COLORS.white, fontSize: 18, fontWeight: '700', marginTop: 1 },
  logoutButton: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4C7DB8',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  logoutText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  districtChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 16,
  },
  districtChipText: { color: '#E3F0FF', fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', marginTop: 18, gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  statValue: { color: COLORS.white, fontSize: 24, fontWeight: '800' },
  statLabel: { color: '#BBD6F3', fontSize: 12, marginTop: 2 },

  /* ================= VICTIM ENTRY ================= */
  victimEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...cardShadow,
  },
  victimIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  victimIconText: { color: COLORS.primary, fontSize: 22 },
  victimEntryTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  victimEntryText: { color: COLORS.secondaryText, fontSize: 12, marginTop: 2 },
  chevron: { color: COLORS.placeholder, fontSize: 28, marginLeft: 8, marginTop: -3 },

  /* ================= SEGMENT / TABS ================= */
  tabsWrap: { paddingHorizontal: 16, marginTop: 18 },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.slateLight,
    borderRadius: 14,
    padding: 4,
  },
  segmentItem: { flex: 1, alignItems: 'center', borderRadius: 11, paddingVertical: 11 },
  segmentItemActive: {
    backgroundColor: COLORS.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  segmentText: { color: COLORS.secondaryText, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: COLORS.primaryDark, fontWeight: '800' },

  /* ================= CARD ================= */
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 22,
    ...cardShadow,
  },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionIconText: { color: COLORS.primary, fontSize: 26, fontWeight: '500', marginTop: -2 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: COLORS.text },
  sectionSubtitle: { fontSize: 12, color: COLORS.secondaryText, marginTop: 2 },
  groupTitle: {
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 22,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  /* ================= FORM ================= */
  field: { marginTop: 14 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 7 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkText: { color: COLORS.primary, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  required: { color: COLORS.required },
  optional: { color: COLORS.secondaryText, fontWeight: '400' },

  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: '#FAFCFE',
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.text,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  inputText: { flex: 1, fontSize: 14, color: COLORS.text },
  placeholderText: { flex: 1, fontSize: 14, color: COLORS.placeholder },
  notesInput: { height: 100, paddingTop: 14, paddingBottom: 14 },

  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownDisabled: { backgroundColor: '#F1F4F7', opacity: 0.7 },
  dropdownArrow: { color: COLORS.secondaryText, fontSize: 20, marginLeft: 8, marginTop: -5 },

  /* Bottom sheet */
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(13, 32, 64, 0.5)',
  },
  sheet: {
    maxHeight: '75%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    marginBottom: 14,
  },
  sheetTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 15,
  },
  sheetOptionSelected: { backgroundColor: COLORS.primaryLight },
  sheetOptionText: { color: COLORS.text, fontSize: 15 },
  sheetOptionTextSelected: { color: COLORS.primaryDark, fontWeight: '700' },
  sheetCheck: { color: COLORS.primary, fontSize: 18, fontWeight: '800' },

  /* Coordinates */
  coordinateBox: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  coordinateTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  coordinateHint: { color: COLORS.secondaryText, fontSize: 11, marginTop: 2 },
  coordinateRow: { flexDirection: 'row' },
  coordinateColumn: { flex: 1 },

  /* ================= BUTTONS ================= */
  button: {
    height: 54,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    marginTop: 26,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  outlineButton: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  outlineButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },

  /* ================= STATUS ================= */
  statusContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success, marginRight: 6 },
  statusText: { fontSize: 11, color: COLORS.secondaryText },

  /* ================= SHELTER LIST ================= */
  listWrap: { marginTop: 22 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 2,
  },
  refreshButton: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  refreshText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },

  shelterCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 18,
    borderRadius: 20,
    ...cardShadow,
  },
  shelterTop: { flexDirection: 'row', alignItems: 'flex-start' },
  shelterDetails: { flex: 1, paddingRight: 12 },
  shelterName: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  shelterMeta: { color: COLORS.secondaryText, fontSize: 12, marginTop: 3 },

  togglePill: {
    minWidth: 78,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  toggleOpen: { backgroundColor: COLORS.success },
  toggleClosed: { backgroundColor: COLORS.slate },
  toggleText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },

  occupancyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  occupancyText: { color: COLORS.secondaryText, fontSize: 12 },
  occupancyStrong: { color: COLORS.text, fontWeight: '800', fontSize: 14 },
  occupancyBadge: { fontSize: 12, fontWeight: '800' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.borderSoft,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4 },

  shelterFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  pillText: { fontSize: 12, fontWeight: '700' },

  editButton: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  editButtonText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },

  managementEditor: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
    paddingTop: 4,
  },
  saveButton: { height: 50, marginTop: 20 },

  emptyCard: { alignItems: 'center', paddingVertical: 30 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyIconText: { color: COLORS.primary, fontSize: 28 },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingVertical: 6,
  },

  /* ================= FOOTER ================= */
  footer: { alignItems: 'center', marginTop: 28, paddingHorizontal: 20 },
  footerBrand: { color: COLORS.primary, fontSize: 15, fontWeight: '800', letterSpacing: 1.5 },
  footerText: { color: COLORS.secondaryText, fontSize: 10, marginTop: 3, textAlign: 'center' },
});