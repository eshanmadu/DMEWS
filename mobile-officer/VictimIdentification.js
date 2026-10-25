import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';

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
  danger: '#C62828',
  dangerLight: '#FFEBEE',
  success: '#2E7D32',
  successLight: '#E8F5E9',
  warning: '#B26A00',
  warningLight: '#FFF4E0',
};

const STEPS = [
  { key: 'optional', label: 'Details' },
  { key: 'camera', label: 'Photo' },
  { key: 'processing', label: 'Analysis' },
  { key: 'result', label: 'Result' },
];

/* =====================================================
   SHARED COMPONENTS
===================================================== */

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

function Field({ label, style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
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

function StepIndicator({ current }) {
  const index = STEPS.findIndex((s) => s.key === current);
  if (index < 0) return null;
  return (
    <View style={styles.stepsRow}>
      {STEPS.map((step, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <View key={step.key} style={styles.stepItem}>
            <View style={[styles.stepBar, (done || active) && styles.stepBarOn]} />
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function CenteredState({ children }) {
  return <View style={styles.centeredState}>{children}</View>;
}

/* =====================================================
   SCREENS
===================================================== */

function Dashboard({ onScan, onHistory }) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Victim identification</Text>
      <Text style={styles.subtitle}>
        Capture a clear image to look for potential matches in authorised DMEWS records.
      </Text>

      <View style={styles.notice}>
        <View style={styles.noticeIcon}>
          <Text style={styles.noticeIconText}>i</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>How it works</Text>
          <Text style={styles.noticeText}>
            Capture a photo, add optional context, and send it for ranked potential matches.
          </Text>
        </View>
      </View>

      <Pressable style={({ pressed }) => [styles.featureCard, pressed && styles.pressedButton]} onPress={onScan}>
        <View style={[styles.featureIcon, { backgroundColor: COLORS.primary }]}>
          <Text style={[styles.featureIconText, { color: COLORS.white }]}>◉</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Scan a face</Text>
          <Text style={styles.cardText}>
            Use only for authorised disaster-response work. The photo stays on this device until you start a scan.
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={({ pressed }) => [styles.featureCard, pressed && styles.pressedButton]} onPress={onHistory}>
        <View style={[styles.featureIcon, { backgroundColor: COLORS.primaryLight }]}>
          <Text style={[styles.featureIconText, { color: COLORS.primary }]}>↺</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Identification history</Text>
          <Text style={styles.cardText}>
            Review your previous analysis requests and their potential matches.
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
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
        <View style={styles.stateIcon}>
          <Text style={styles.stateIconText}>◉</Text>
        </View>
        <Text style={styles.stateTitle}>Camera access is required</Text>
        <Text style={styles.stateText}>
          Allow camera access to capture an image. DMEWS will not open the camera without your permission.
        </Text>
        <View style={styles.stateActions}>
          {permission.canAskAgain ? <ActionButton onPress={requestPermission}>Allow camera</ActionButton> : null}
          <ActionButton onPress={onCancel} secondary>Cancel</ActionButton>
        </View>
      </CenteredState>
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.cameraTop}>
          <View style={styles.cameraTitlePill}>
            <Text style={styles.cameraTitle}>Position face in guide</Text>
          </View>
          <Pressable onPress={onCancel} style={({ pressed }) => [styles.closeButton, pressed && styles.pressedButton]}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.guideWrap}>
          <View style={styles.faceGuide} />
          <Text style={styles.cameraHint}>Use even lighting and keep the face visible.</Text>
        </View>

        <View style={styles.cameraBottom}>
          {cameraError ? <Text style={styles.cameraError}>{cameraError}</Text> : null}
          <View style={styles.cameraControls}>
            <Pressable style={styles.captureButton} onPress={capture} disabled={capturing}>
              {capturing ? <ActivityIndicator color={COLORS.primaryDark} /> : <View style={styles.captureInner} />}
            </Pressable>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

function OptionalInfoScreen({ value, onChange, onContinue, onBack }) {
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Help narrow the review</Text>
      <Text style={styles.subtitle}>
        These fields support ranking only. Leave them blank when unknown.
      </Text>
      <View style={styles.card}>
        <Field
          label="Last known location"
          value={value.location}
          onChangeText={(location) => onChange({ ...value, location })}
          placeholder="Town, shelter or incident area"
        />
        <View style={styles.row}>
          <View style={[styles.col, { marginRight: 6 }]}>
            <Field
              label="Approximate age"
              value={value.age}
              onChangeText={(age) => onChange({ ...value, age: age.replace(/\D/g, '').slice(0, 3) })}
              keyboardType="number-pad"
              placeholder="Optional"
            />
          </View>
          <View style={[styles.col, { marginLeft: 6 }]}>
            <Field
              label="Gender"
              value={value.gender}
              onChangeText={(gender) => onChange({ ...value, gender })}
              placeholder="Optional"
            />
          </View>
        </View>
        <Field
          label="Officer notes"
          style={styles.notesInput}
          value={value.notes}
          onChangeText={(notes) => onChange({ ...value, notes })}
          multiline
          placeholder="Optional incident context"
        />
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
      <View style={styles.stateIcon}>
        {error ? <Text style={[styles.stateIconText, { color: COLORS.danger }]}>!</Text> : <ActivityIndicator size="large" color={COLORS.primary} />}
      </View>
      <Text style={styles.stateTitle}>{error ? 'Analysis failed' : 'Analysing scan'}</Text>
      <Text style={styles.stateText}>{error || 'Uploading your explicitly submitted scan for analysis. Please wait.'}</Text>
    </CenteredState>
  );
}

function ScoreBar({ label, percent, color }) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreHeader}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={[styles.scoreValue, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ResultScreen({ photo, result, error, onRetake, onBack }) {
  const matches = result?.matches || [];
  const available = result?.status === 'completed';
  const found = !error && matches.length > 0;

  const heroStyle = error || !available ? styles.heroDanger : found ? styles.heroSuccess : styles.heroNeutral;
  const heroTitle = error ? 'Analysis failed' : matches.length ? 'Potential matches found' : 'No potential match';

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.resultHero, heroStyle]}>
        <View style={styles.resultIcon}>
          <Text style={[styles.resultIconText, { color: found ? COLORS.success : error || !available ? COLORS.danger : COLORS.primary }]}>
            {found ? '✓' : error || !available ? '!' : '–'}
          </Text>
        </View>
        <Text style={styles.resultTitle}>{heroTitle}</Text>
        {found ? (
          <Text style={styles.resultCount}>{matches.length} record{matches.length === 1 ? '' : 's'} to review</Text>
        ) : null}
      </View>

      <View style={[styles.notice, !available && styles.warningNotice]}>
        <View style={[styles.noticeIcon, !available && styles.noticeIconWarning]}>
          <Text style={[styles.noticeIconText, !available && { color: COLORS.danger }]}>{available ? 'i' : '!'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>
            {error ? 'Request error' : available ? 'Officer review required' : 'Recognition service unavailable'}
          </Text>
          <Text style={styles.noticeText}>
            {error || result?.serviceMessage || 'No identity conclusion was made. Potential matches must be verified against official records.'}
          </Text>
        </View>
      </View>

      {matches.map((match, index) => {
        const isFace = match.matchType === 'face';
        return (
          <View key={match.personId} style={styles.card}>
            <View style={styles.matchHeader}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{match.person?.fullName || 'Potential missing-person record'}</Text>
                <Text style={styles.matchLocation}>{match.person?.lastSeenLocation || 'Location unavailable'}</Text>
              </View>
              <View style={[styles.typeTag, isFace ? styles.typeTagFace : styles.typeTagDetails]}>
                <Text style={[styles.typeTagText, { color: isFace ? COLORS.primaryDark : COLORS.warning }]}>
                  {isFace ? 'Face match' : 'Details only'}
                </Text>
              </View>
            </View>

            {isFace ? (
              <ScoreBar label="Face similarity" percent={Math.round((match.confidence || 0) * 100)} color={COLORS.primary} />
            ) : null}
            <ScoreBar
              label={isFace ? 'Supporting details' : 'Details-based match'}
              percent={Math.round(match.metadataScore || 0)}
              color={COLORS.success}
            />

            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimer}>{match.reason || 'Potential match only; verify identity.'}</Text>
            </View>
          </View>
        );
      })}

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
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Your scans</Text>
      <Text style={styles.subtitle}>Previous analysis requests you have submitted.</Text>

      {loading ? (
        <View style={[styles.card, { alignItems: 'center' }]}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : scans.length === 0 ? (
        <View style={[styles.card, styles.emptyCard]}>
          <View style={styles.stateIcon}>
            <Text style={styles.stateIconText}>↺</Text>
          </View>
          <Text style={styles.cardTitle}>No scans yet</Text>
          <Text style={[styles.cardText, { textAlign: 'center' }]}>
            Start a scan from the dashboard and it will appear here.
          </Text>
        </View>
      ) : (
        scans.map((scan) => {
          const completed = scan.status === 'completed';
          const count = scan.matches?.length || 0;
          return (
            <View key={scan.id} style={styles.card}>
              <View style={styles.historyTop}>
                <Text style={[styles.cardTitle, { flex: 1 }]}>
                  {completed ? `${count} potential match${count === 1 ? '' : 'es'}` : 'Unavailable analysis'}
                </Text>
                <View style={[styles.statusTag, completed ? styles.statusTagOk : styles.statusTagOff]}>
                  <Text style={[styles.statusTagText, { color: completed ? COLORS.success : COLORS.danger }]}>
                    {completed ? 'Completed' : 'Unavailable'}
                  </Text>
                </View>
              </View>
              <Text style={styles.historyDate}>{new Date(scan.createdAt).toLocaleString()}</Text>
              <Text style={styles.cardText}>{scan.serviceMessage || 'No additional message'}</Text>
            </View>
          );
        })
      )}
      <ActionButton onPress={onBack} secondary>Back to dashboard</ActionButton>
    </ScrollView>
  );
}

/* =====================================================
   MAIN COMPONENT
===================================================== */

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
  }

  function reset() {
    setPhoto(null);
    setScreen('dashboard');
  }

  const isCamera = screen === 'camera';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.pressedButton]}
            onPress={screen === 'dashboard' ? onBack : reset}
          >
            <Text style={styles.backText}>‹ {screen === 'dashboard' ? 'Shelters' : 'Dashboard'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>DMEWS Officer Tools</Text>
        </View>
        {!isCamera && <StepIndicator current={screen} />}
      </View>

      <View style={styles.body}>
        {screen === 'dashboard' && <Dashboard onScan={() => setScreen('optional')} onHistory={() => setScreen('history')} />}
        {screen === 'optional' && <OptionalInfoScreen value={optionalInfo} onChange={setOptionalInfo} onContinue={() => setScreen('camera')} onBack={reset} />}
        {screen === 'camera' && <CameraScreen onCancel={reset} onCaptured={capturePhoto} />}
        {screen === 'processing' && <ProcessingScreen error={analysisError} onComplete={submitScan} />}
        {screen === 'result' && <ResultScreen photo={photo} result={result} error={analysisError} onRetake={() => setScreen('camera')} onBack={reset} />}
        {screen === 'history' && <HistoryStatus apiUrl={apiUrl} token={token} onBack={reset} />}
      </View>
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
  body: { flex: 1, backgroundColor: COLORS.background },

  /* Header */
  header: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  headerTitle: { color: '#CFE5FF', fontSize: 12, fontWeight: '600' },

  /* Steps */
  stepsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  stepItem: { flex: 1 },
  stepBar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' },
  stepBarOn: { backgroundColor: COLORS.white },
  stepLabel: { color: '#9CC3EC', fontSize: 11, marginTop: 6 },
  stepLabelActive: { color: COLORS.white, fontWeight: '700' },

  /* Layout */
  content: { padding: 20, paddingBottom: 36 },
  row: { flexDirection: 'row' },
  col: { flex: 1 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: COLORS.secondaryText, fontSize: 14, lineHeight: 21, marginTop: 6 },

  /* Notice */
  notice: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    marginTop: 20,
    padding: 14,
  },
  warningNotice: { backgroundColor: COLORS.dangerLight },
  noticeIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  noticeIconWarning: { backgroundColor: COLORS.white },
  noticeIconText: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
  noticeTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  noticeText: { color: COLORS.secondaryText, fontSize: 13, lineHeight: 19, marginTop: 4 },

  /* Cards */
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginTop: 16,
    padding: 18,
    ...cardShadow,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginTop: 16,
    padding: 16,
    ...cardShadow,
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureIconText: { fontSize: 24, fontWeight: '700' },
  chevron: { color: COLORS.placeholder, fontSize: 28, marginLeft: 8, marginTop: -3 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  cardText: { color: COLORS.secondaryText, fontSize: 13, lineHeight: 19, marginTop: 5 },
  emptyCard: { alignItems: 'center', paddingVertical: 28 },

  /* Form */
  label: { color: COLORS.text, fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 7 },
  input: {
    backgroundColor: '#FAFCFE',
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1.5,
    color: COLORS.text,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  notesInput: { minHeight: 96, textAlignVertical: 'top' },

  /* Buttons */
  actionButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    marginTop: 14,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  secondaryButton: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  actionButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  secondaryButtonText: { color: COLORS.primaryDark },
  disabledButton: { opacity: 0.65 },
  pressedButton: { opacity: 0.8 },

  /* Camera */
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1, justifyContent: 'space-between' },
  cameraTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 18,
  },
  cameraTitlePill: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cameraTitle: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  guideWrap: { alignItems: 'center' },
  faceGuide: {
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 150,
    borderWidth: 3,
    borderStyle: 'dashed',
    height: 300,
    width: 220,
  },
  cameraHint: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
    color: COLORS.white,
    fontSize: 13,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  cameraBottom: { alignItems: 'center' },
  cameraError: {
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    color: COLORS.white,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 10,
    textAlign: 'center',
    overflow: 'hidden',
  },
  cameraControls: { alignItems: 'center', paddingBottom: 36 },
  captureButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: COLORS.white,
    borderRadius: 42,
    borderWidth: 4,
    height: 82,
    justifyContent: 'center',
    width: 82,
  },
  captureInner: { backgroundColor: COLORS.white, borderRadius: 32, height: 64, width: 64 },

  /* States */
  centeredState: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 28 },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stateIconText: { color: COLORS.primary, fontSize: 32, fontWeight: '700' },
  stateTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  stateText: { color: COLORS.secondaryText, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  stateActions: { alignSelf: 'stretch', marginTop: 10 },

  /* Result */
  resultHero: {
    alignItems: 'center',
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 20,
  },
  heroSuccess: { backgroundColor: COLORS.successLight },
  heroNeutral: { backgroundColor: COLORS.primaryLight },
  heroDanger: { backgroundColor: COLORS.dangerLight },
  resultIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  resultIconText: { fontSize: 32, fontWeight: '800' },
  resultTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  resultCount: { color: COLORS.secondaryText, fontSize: 13, marginTop: 4 },

  matchHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: { color: COLORS.primaryDark, fontSize: 15, fontWeight: '800' },
  matchLocation: { color: COLORS.secondaryText, fontSize: 12, marginTop: 2 },
  typeTag: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 8 },
  typeTagFace: { backgroundColor: COLORS.primaryLight },
  typeTagDetails: { backgroundColor: COLORS.warningLight },
  typeTagText: { fontSize: 11, fontWeight: '800' },

  scoreRow: { marginTop: 14 },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  scoreLabel: { color: COLORS.secondaryText, fontSize: 12 },
  scoreValue: { fontSize: 13, fontWeight: '800' },
  scoreTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.borderSoft, overflow: 'hidden' },
  scoreFill: { height: 8, borderRadius: 4 },

  disclaimerBox: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 10,
    marginTop: 16,
    padding: 10,
  },
  disclaimer: { color: COLORS.danger, fontSize: 12, fontWeight: '700', lineHeight: 18 },

  /* History */
  historyTop: { flexDirection: 'row', alignItems: 'center' },
  historyDate: { color: COLORS.secondaryText, fontSize: 12, marginTop: 6 },
  statusTag: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 8 },
  statusTagOk: { backgroundColor: COLORS.successLight },
  statusTagOff: { backgroundColor: COLORS.dangerLight },
  statusTagText: { fontSize: 11, fontWeight: '800' },
});