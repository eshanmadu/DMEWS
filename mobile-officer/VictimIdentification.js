import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
const COLORS = {
  primary: '#1976D2',
  primaryDark: '#0D47A1',
  background: '#F5F8FC',
  white: '#FFFFFF',
  text: '#172B4D',
  secondaryText: '#5F6B7A',
  border: '#D9E1EA',
  danger: '#C62828',
  dangerLight: '#FFEBEE',
  success: '#2E7D32',
  successLight: '#E8F5E9',
};

function ActionButton({ children, onPress, secondary, disabled }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        secondary && styles.secondaryButton,
        disabled && styles.disabledButton,
        pressed && styles.pressedButton,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.actionButtonText, secondary && styles.secondaryButtonText]}>
        {children}
      </Text>
    </Pressable>
  );
}

function Dashboard({ onScan, onHistory }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PROTECTED OFFICER WORKSPACE</Text>
      <Text style={styles.title}>Victim Identification</Text>
      <Text style={styles.subtitle}>
        Capture a clear image for a potential match against authorised DMEWS records.
      </Text>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Recognition service status</Text>
        <Text style={styles.noticeText}>
          Capture a photo, add optional context, and send it for ranked potential matches.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Scan a face</Text>
        <Text style={styles.cardText}>
          Use only for authorised disaster-response work. A photo stays on this device until
          you explicitly start a scan.
        </Text>
        <ActionButton onPress={onScan}>Start scan</ActionButton>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Identification history</Text>
        <Text style={styles.cardText}>
          Review your previous analysis requests and their potential matches.
        </Text>
        <ActionButton onPress={onHistory} secondary>View history status</ActionButton>
      </View>
    </ScrollView>
  );
}

function CameraScreen({ onCancel, onCaptured }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState('');
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  async function capture() {
    if (!cameraRef.current || capturing) return;
    setCameraError('');
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: false });
      if (!photo?.uri) throw new Error('The camera did not return an image. Please try again.');
      onCaptured(photo);
    } catch (error) {
      setCameraError(error?.message || 'Unable to capture the image.');
    } finally {
      setCapturing(false);
    }
  }

  if (!permission) {
    return <CenteredState><ActivityIndicator color={COLORS.primary} /></CenteredState>;
  }
  if (!permission.granted) {
    return (
      <CenteredState>
        <Text style={styles.stateTitle}>Camera access is required</Text>
        <Text style={styles.stateText}>
          Allow camera access to capture an image. DMEWS will not open the camera without your permission.
        </Text>
        {permission.canAskAgain ? <ActionButton onPress={requestPermission}>Allow camera</ActionButton> : null}
        <ActionButton onPress={onCancel} secondary>Cancel</ActionButton>
      </CenteredState>
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.cameraTop}>
          <Text style={styles.cameraTitle}>Position face in guide</Text>
          <Pressable onPress={onCancel} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
        <View style={styles.faceGuide} />
        <Text style={styles.cameraHint}>Use even lighting and keep the face visible.</Text>
        {cameraError ? <Text style={styles.cameraError}>{cameraError}</Text> : null}
        <View style={styles.cameraControls}>
          <Pressable style={styles.captureButton} onPress={capture} disabled={capturing}>
            {capturing ? <ActivityIndicator color={COLORS.primaryDark} /> : <View style={styles.captureInner} />}
          </Pressable>
        </View>
      </CameraView>
    </View>
  );
}

function OptionalInfoScreen({ value, onChange, onContinue, onBack }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>OPTIONAL CONTEXT</Text>
      <Text style={styles.title}>Help narrow the review</Text>
      <Text style={styles.subtitle}>These fields support ranking only. Leave them blank when unknown.</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Last known location</Text>
        <TextInput style={styles.input} value={value.location} onChangeText={(location) => onChange({ ...value, location })} placeholder="Town, shelter or incident area" placeholderTextColor={COLORS.secondaryText} />
        <Text style={styles.label}>Approximate age</Text>
        <TextInput style={styles.input} value={value.age} onChangeText={(age) => onChange({ ...value, age: age.replace(/\D/g, '').slice(0, 3) })} keyboardType="number-pad" placeholder="Optional" placeholderTextColor={COLORS.secondaryText} />
        <Text style={styles.label}>Gender</Text>
        <TextInput style={styles.input} value={value.gender} onChangeText={(gender) => onChange({ ...value, gender })} placeholder="Optional" placeholderTextColor={COLORS.secondaryText} />
        <Text style={styles.label}>Officer notes</Text>
        <TextInput style={[styles.input, styles.notesInput]} value={value.notes} onChangeText={(notes) => onChange({ ...value, notes })} multiline placeholder="Optional incident context" placeholderTextColor={COLORS.secondaryText} />
      </View>
      <ActionButton onPress={onContinue}>Continue to camera</ActionButton>
      <ActionButton onPress={onBack} secondary>Cancel</ActionButton>
    </ScrollView>
  );
}

function ProcessingScreen({ onComplete, error }) {
  useEffect(() => {
    onComplete();
  }, []);
  return (
    <CenteredState>
      {error ? <Text style={styles.stateTitle}>Analysis failed</Text> : <ActivityIndicator size="large" color={COLORS.primary} />}
      <Text style={styles.stateText}>{error || 'Uploading your explicitly submitted scan for analysis. Please wait.'}</Text>
    </CenteredState>
  );
}

function ResultScreen({ photo, result, error, onRetake, onBack }) {
  const matches = result?.matches || [];
  const available = result?.status === 'completed';
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>IDENTIFICATION RESULT</Text>
      <Text style={styles.title}>{error ? 'Analysis failed' : matches.length ? 'Potential matches found' : 'No potential match'}</Text>
      <View style={[styles.resultIcon, available && matches.length ? styles.successIcon : null]}><Text style={styles.resultIconText}>{matches.length ? '✓' : '!'}</Text></View>
      <View style={[styles.notice, !available && styles.warningNotice]}>
        <Text style={styles.noticeTitle}>{error ? 'Request error' : available ? 'Officer review required' : 'Recognition service unavailable'}</Text>
        <Text style={styles.noticeText}>
          {error || result?.serviceMessage || 'No identity conclusion was made. Potential matches must be verified against official records.'}
        </Text>
      </View>
      {matches.map((match) => (
        <View key={match.personId} style={styles.card}>
          <Text style={styles.cardTitle}>{match.person?.fullName || 'Potential missing-person record'}</Text>
          <Text style={styles.cardText}>Similarity: {Math.round((match.confidence || 0) * 100)}% · Supporting metadata: {match.metadataScore || 0}%</Text>
          <Text style={styles.cardText}>{match.person?.lastSeenLocation || 'Location unavailable'}</Text>
          <Text style={styles.disclaimer}>{match.reason || 'Potential match only; verify identity.'}</Text>
        </View>
      ))}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Image quality check</Text>
        <Text style={styles.cardText}>
          {photo?.width && photo?.height
            ? `Captured at ${photo.width} × ${photo.height}. Retake if the face is blurred, too dark, or outside the guide.`
            : 'Retake if the face is blurred, too dark, or outside the guide.'}
        </Text>
      </View>
      <ActionButton onPress={onRetake}>Retake photo</ActionButton>
      <ActionButton onPress={onBack} secondary>Back to dashboard</ActionButton>
    </ScrollView>
  );
}

function HistoryStatus({ apiUrl, token, onBack }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${apiUrl}/victim-access/scans`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data) => setScans(Array.isArray(data.scans) ? data.scans : []))
      .catch(() => setScans([]))
      .finally(() => setLoading(false));
  }, [token]);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>ANALYSIS HISTORY</Text>
      <Text style={styles.title}>Your scans</Text>
      {loading ? <ActivityIndicator color={COLORS.primary} /> : scans.length === 0 ? <Text style={styles.stateText}>No scans have been submitted.</Text> : scans.map((scan) => (
        <View key={scan.id} style={styles.card}>
          <Text style={styles.cardTitle}>{scan.status === 'completed' ? `${scan.matches?.length || 0} potential match(es)` : 'Unavailable analysis'}</Text>
          <Text style={styles.cardText}>{new Date(scan.createdAt).toLocaleString()} · {scan.serviceMessage || 'No additional message'}</Text>
        </View>
      ))}
      <ActionButton onPress={onBack} secondary>Back to dashboard</ActionButton>
    </ScrollView>
  );
}

function CenteredState({ children }) {
  return <View style={styles.centeredState}>{children}</View>;
}

export default function VictimIdentification({ apiUrl, token, onBack }) {
  const [screen, setScreen] = useState('dashboard');
  const [photo, setPhoto] = useState(null);
  const [optionalInfo, setOptionalInfo] = useState({ location: '', age: '', gender: '', notes: '' });
  const [result, setResult] = useState(null);
  const [analysisError, setAnalysisError] = useState('');

  function capturePhoto(nextPhoto) {
    setPhoto(nextPhoto);
    setScreen('processing');
  }

  async function submitScan() {
    setAnalysisError('');
    try {
      const upload = await FileSystem.uploadAsync(`${apiUrl}/victim-access/scans`, photo.uri, {
        fieldName: 'image',
        mimeType: 'image/jpeg',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        parameters: Object.fromEntries(
          Object.entries(optionalInfo).filter(([, value]) => Boolean(value))
        ),
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = JSON.parse(upload.body || '{}');
      if (upload.status < 200 || upload.status >= 300) {
        throw new Error(data.message || `Analysis request failed (${upload.status}).`);
      }
      setResult(data.scan);
    } catch (error) {
      setAnalysisError(error.message);
    } finally {
      setScreen('result');
    }
    return;
    try {
      const response = await fetch(`${apiUrl}/victim-access/scans`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Analysis could not be completed.');
      setResult(data.scan);
    } catch (error) {
      setAnalysisError(error.message);
    } finally {
      setScreen('result');
    }
  }

  function reset() {
    setPhoto(null);
    setScreen('dashboard');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={screen === 'dashboard' ? onBack : reset}>
          <Text style={styles.backText}>‹ {screen === 'dashboard' ? 'Shelters' : 'Dashboard'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>DMEWS Officer Tools</Text>
      </View>
      {screen === 'dashboard' && <Dashboard onScan={() => setScreen('optional')} onHistory={() => setScreen('history')} />}
      {screen === 'optional' && <OptionalInfoScreen value={optionalInfo} onChange={setOptionalInfo} onContinue={() => setScreen('camera')} onBack={reset} />}
      {screen === 'camera' && <CameraScreen onCancel={reset} onCaptured={capturePhoto} />}
      {screen === 'processing' && <ProcessingScreen error={analysisError} onComplete={submitScan} />}
      {screen === 'result' && <ResultScreen photo={photo} result={result} error={analysisError} onRetake={() => setScreen('camera')} onBack={reset} />}
      {screen === 'history' && <HistoryStatus apiUrl={apiUrl} token={token} onBack={reset} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  headerTitle: { color: '#CFE5FF', fontSize: 12, marginTop: 8 },
  content: { padding: 20, paddingBottom: 32 },
  eyebrow: { color: COLORS.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginTop: 6 },
  subtitle: { color: COLORS.secondaryText, fontSize: 14, lineHeight: 21, marginTop: 8 },
  notice: { backgroundColor: COLORS.successLight, borderLeftWidth: 4, borderLeftColor: COLORS.success, marginTop: 20, padding: 14 },
  warningNotice: { backgroundColor: COLORS.dangerLight, borderLeftColor: COLORS.danger },
  noticeTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  noticeText: { color: COLORS.secondaryText, fontSize: 13, lineHeight: 19, marginTop: 5 },
  card: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, marginTop: 16, padding: 16 },
  cardTitle: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  cardText: { color: COLORS.secondaryText, fontSize: 13, lineHeight: 19, marginTop: 6 },
  label: { color: COLORS.text, fontSize: 13, fontWeight: '700', marginTop: 14 },
  input: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderRadius: 9, borderWidth: 1, color: COLORS.text, fontSize: 14, marginTop: 6, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  disclaimer: { color: COLORS.danger, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 8 },
  actionButton: { alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 10, marginTop: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButton: { backgroundColor: COLORS.white, borderColor: COLORS.primary, borderWidth: 1 },
  actionButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  secondaryButtonText: { color: COLORS.primaryDark },
  disabledButton: { opacity: 0.65 },
  pressedButton: { opacity: 0.8 },
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1, justifyContent: 'space-between' },
  cameraTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 20 },
  cameraTitle: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  closeButton: { backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  closeButtonText: { color: COLORS.white, fontWeight: '700' },
  faceGuide: { alignSelf: 'center', borderColor: '#FFFFFFCC', borderRadius: 150, borderWidth: 3, height: 300, width: 220 },
  cameraHint: { alignSelf: 'center', backgroundColor: '#0009', color: COLORS.white, fontSize: 13, padding: 8 },
  cameraError: { alignSelf: 'center', backgroundColor: COLORS.danger, color: COLORS.white, marginHorizontal: 20, padding: 10, textAlign: 'center' },
  cameraControls: { alignItems: 'center', paddingBottom: 35 },
  captureButton: { alignItems: 'center', backgroundColor: COLORS.white, borderColor: '#FFFFFF99', borderRadius: 40, borderWidth: 4, height: 78, justifyContent: 'center', width: 78 },
  captureInner: { backgroundColor: COLORS.primary, borderRadius: 30, height: 58, width: 58 },
  centeredState: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 28 },
  stateTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  stateText: { color: COLORS.secondaryText, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  resultIcon: { alignItems: 'center', alignSelf: 'center', backgroundColor: COLORS.dangerLight, borderRadius: 30, height: 60, justifyContent: 'center', marginTop: 24, width: 60 },
  resultIconText: { color: COLORS.danger, fontSize: 30, fontWeight: '800' },
  successIcon: { backgroundColor: COLORS.successLight },
});
