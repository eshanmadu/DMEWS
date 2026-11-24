import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { File } from 'expo-file-system';

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
  { key: 'camera', label: 'Photos' },
  { key: 'extracting', label: 'AI reading' },
  { key: 'review', label: 'Review' },
  { key: 'result', label: 'Result' },
];
const STEP_ALIASES = { matching: 'result' };
const MAX_PHOTOS = 4;

const MARK_FIELDS = [
  { key: 'bodyLocation', label: 'Body location', placeholder: 'e.g. left forearm' },
  { key: 'description', label: 'Description', placeholder: 'Shape, size, colour, design' },
  { key: 'visibleText', label: 'Text in mark', placeholder: 'Exact letters, if any' },
];
const ITEM_FIELDS = [
  { key: 'item', label: 'Item', placeholder: 'e.g. T-shirt, ring' },
  { key: 'color', label: 'Colour', placeholder: '' },
  { key: 'bodyLocation', label: 'Worn / found on', placeholder: '' },
  { key: 'description', label: 'Description', placeholder: 'Pattern, logo, printed text' },
];
const MARK_SECTIONS = [
  { key: 'tattoos', title: 'Tattoos' },
  { key: 'scars', title: 'Scars' },
  { key: 'birthmarks', title: 'Birthmarks' },
  { key: 'piercings', title: 'Piercings' },
  { key: 'otherMarks', title: 'Other distinguishing features' },
];
const ITEM_SECTIONS = [
  { key: 'clothing', title: 'Clothing' },
  { key: 'jewellery', title: 'Jewellery' },
  { key: 'personalItems', title: 'Personal items' },
];
const FACE_STATUS_TEXT = {
  ok: 'A clear face was found and will be compared with missing-person photos.',
  no_face: 'No face was found in the photos. Matching will use the details only.',
  multiple_faces: 'Several faces were found and none is clearly the main one. Matching will use the details only — retake with one face if possible.',
  error: 'The face service could not process the photos. Matching will use the details only.',
};

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
  const index = STEPS.findIndex((s) => s.key === (STEP_ALIASES[current] || current));
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
            Capture the face and any tattoos or scars. The AI fills in the details, you check them, then DMEWS ranks potential matches.
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

function CameraScreen({ photoCount, onCancel, onCaptured }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('back');
  const [capturedPhoto, setCapturedPhoto] = useState(null);

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
      setCapturedPhoto(photo);
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

  if (capturedPhoto) {
    const total = photoCount + 1;
    return (
      <View style={styles.cameraScreen}>
        <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} resizeMode="contain" />
        <View style={styles.previewPanel}>
          <Text style={styles.previewTitle}>Photo {total} of up to {MAX_PHOTOS}</Text>
          <Text style={styles.previewText}>
            Take the face first, then close-ups of tattoos, scars or clothing if visible.
          </Text>
          <ActionButton onPress={() => onCaptured(capturedPhoto, true)}>
            Analyse {total} photo{total === 1 ? '' : 's'}
          </ActionButton>
          {total < MAX_PHOTOS ? (
            <ActionButton onPress={() => { onCaptured(capturedPhoto, false); setCapturedPhoto(null); }} secondary>
              Keep and take another photo
            </ActionButton>
          ) : null}
          <ActionButton onPress={() => setCapturedPhoto(null)} secondary>Retake this photo</ActionButton>
          <ActionButton onPress={onCancel} secondary>Cancel</ActionButton>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <CameraView ref={cameraRef} style={styles.camera} facing={cameraFacing}>
        <View style={styles.cameraTop}>
          <View style={styles.cameraTitlePill}>
            <Text style={styles.cameraTitle}>
              {photoCount === 0 ? 'Position face in guide' : `Photo ${photoCount + 1}: tattoo, scar or clothing`}
            </Text>
          </View>
          <Pressable onPress={onCancel} style={({ pressed }) => [styles.closeButton, pressed && styles.pressedButton]}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
          <Pressable
            onPress={() => setCameraFacing((current) => current === 'back' ? 'front' : 'back')}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressedButton]}
          >
            <Text style={styles.closeButtonText}>{cameraFacing === 'back' ? 'Front camera' : 'Back camera'}</Text>
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

function Choice({ label, value, options, onChange }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.choiceChip, value === option && styles.choiceChipOn]}
          >
            <Text style={[styles.choiceText, value === option && styles.choiceTextOn]}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ListEditor({ title, items, fields, onChange }) {
  const list = Array.isArray(items) ? items : [];
  const blank = Object.fromEntries(fields.map((f) => [f.key, '']));
  const update = (index, key, text) => onChange(list.map((item, i) => (i === index ? { ...item, [key]: text } : item)));
  return (
    <View style={styles.card}>
      <View style={styles.listHeader}>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{title}</Text>
        <Text style={styles.listCount}>{list.length}</Text>
      </View>
      {list.length === 0 ? <Text style={styles.cardText}>None recorded.</Text> : null}
      {list.map((item, index) => (
        <View key={index} style={styles.listItem}>
          {fields.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              value={String(item[field.key] ?? '')}
              placeholder={field.placeholder}
              onChangeText={(text) => update(index, field.key, text)}
            />
          ))}
          <Pressable onPress={() => onChange(list.filter((_, i) => i !== index))}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => onChange([...list, blank])}>
        <Text style={styles.addText}>+ Add</Text>
      </Pressable>
    </View>
  );
}

function DetailsReviewScreen({ scan, details, onChange, onSubmit, onCancel, error }) {
  const set = (key) => (value) => onChange({ ...details, [key]: value });
  const extraction = scan?.extraction || {};
  const aiOk = extraction.status === 'ok';
  const warnings = scan?.face?.quality?.warnings || [];
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Review the details</Text>
      <Text style={styles.subtitle}>
        {aiOk
          ? 'Pre-filled by AI from the photos. Check every field against the photos and correct anything wrong.'
          : 'The AI could not fill in the details. Enter what you can see.'}
      </Text>

      <View style={[styles.notice, !aiOk && styles.warningNotice]}>
        <View style={[styles.noticeIcon, !aiOk && styles.noticeIconWarning]}>
          <Text style={[styles.noticeIconText, !aiOk && { color: COLORS.danger }]}>{aiOk ? 'AI' : '!'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>{aiOk ? 'AI suggestions' : 'Manual entry needed'}</Text>
          <Text style={styles.noticeText}>{aiOk ? 'AI can miss or misread marks. You are responsible for the final details.' : extraction.error || 'AI unavailable.'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Face check</Text>
        <Text style={styles.cardText}>{FACE_STATUS_TEXT[scan?.face?.status] || FACE_STATUS_TEXT.error}</Text>
        {warnings.length ? (
          <Text style={[styles.cardText, { color: COLORS.warning }]}>Quality: {warnings.map((w) => w.replace(/_/g, ' ')).join(', ')}</Text>
        ) : null}
      </View>

      {aiOk && scan?.aiDetails?.uncertainties ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI could not determine</Text>
          <Text style={styles.cardText}>{scan.aiDetails.uncertainties}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Where and when found</Text>
        <Field label="Found location (required)" value={details.foundLocation || ''} onChangeText={set('foundLocation')} placeholder="Town, shelter or incident area" />
        <Field label="Date found (YYYY-MM-DD)" value={details.foundDate || ''} onChangeText={set('foundDate')} placeholder="2026-11-24" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Physical description</Text>
        <View style={styles.row}>
          <View style={[styles.col, { marginRight: 6 }]}>
            <Field label="Age from" value={String(details.estimatedAgeMin ?? '')} keyboardType="number-pad"
              onChangeText={(v) => set('estimatedAgeMin')(v.replace(/\D/g, '').slice(0, 3))} />
          </View>
          <View style={[styles.col, { marginLeft: 6 }]}>
            <Field label="Age to" value={String(details.estimatedAgeMax ?? '')} keyboardType="number-pad"
              onChangeText={(v) => set('estimatedAgeMax')(v.replace(/\D/g, '').slice(0, 3))} />
          </View>
        </View>
        <Choice label="Sex" value={details.sex} options={['male', 'female', 'unknown']} onChange={set('sex')} />
        <Choice label="Build" value={details.build} options={['slim', 'medium', 'heavy', 'unknown']} onChange={set('build')} />
        <Field label="Skin tone" value={details.skinTone || ''} onChangeText={set('skinTone')} />
        <Field label="Hair colour" value={details.hairColor || ''} onChangeText={set('hairColor')} />
        <Choice label="Hair length" value={details.hairLength} options={['bald', 'short', 'medium', 'long', 'unknown']} onChange={set('hairLength')} />
        <Field label="Facial hair" value={details.facialHair || ''} onChangeText={set('facialHair')} />
      </View>

      {MARK_SECTIONS.map((section) => (
        <ListEditor key={section.key} title={section.title} items={details[section.key]} fields={MARK_FIELDS} onChange={set(section.key)} />
      ))}
      {ITEM_SECTIONS.map((section) => (
        <ListEditor key={section.key} title={section.title} items={details[section.key]} fields={ITEM_FIELDS} onChange={set(section.key)} />
      ))}

      <View style={styles.card}>
        <Field label="Other readable text (comma separated)" value={(details.visibleText || []).join(', ')}
          onChangeText={(v) => set('visibleText')(v.split(',').map((s) => s.trimStart()))} />
        <Field label="Summary" style={styles.notesInput} multiline value={details.summary || ''} onChangeText={set('summary')} />
        <Field label="Officer notes" style={styles.notesInput} multiline value={details.notes || ''} onChangeText={set('notes')} placeholder="Optional incident context" />
      </View>

      {error ? <Text style={styles.formError}>{error}</Text> : null}
      <ActionButton onPress={onSubmit} disabled={!String(details.foundLocation || '').trim()}>Confirm details and find matches</ActionButton>
      <ActionButton onPress={onCancel} secondary>Cancel</ActionButton>
    </ScrollView>
  );
}

function ProcessingScreen({ title, text, onStart }) {
  useEffect(() => {
    onStart();
  }, []);
  return (
    <CenteredState>
      <View style={styles.stateIcon}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
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

function ResultScreen({ result, error, onRetake, onBack }) {
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

      {result?.analysisStats?.candidates != null ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Records checked</Text>
          <Text style={styles.cardText}>
            {result.analysisStats.candidates} record(s) checked · {result.analysisStats.queryHasFace ? `${result.analysisStats.comparedFaces || 0} compared by face` : 'no usable face, details only'} · {result.analysisStats.markQueries || 0} mark(s)/item(s) compared{result.analysisStats.excludedByDate ? ` · ${result.analysisStats.excludedByDate} excluded (reported missing after the found date)` : ''}.
          </Text>
        </View>
      ) : null}

      {matches.map((match, index) => {
        const isFace = match.matchType === 'face';
        return (
          <View key={match.personId} style={styles.card}>
            <View style={styles.matchHeader}>
              {match.person?.photoUrl ? (
                <Image
                  source={{ uri: match.person.photoUrl }}
                  style={styles.matchPhoto}
                  resizeMode="cover"
                  accessibilityLabel={`${match.person?.fullName || 'Missing person'} reference photo`}
                />
              ) : (
                <View style={styles.matchPhotoPlaceholder}>
                  <Text style={styles.matchPhotoPlaceholderText}>No photo</Text>
                </View>
              )}
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{match.person?.fullName || 'Potential missing-person record'}</Text>
                <Text style={styles.matchLocation}>{match.person?.lastSeenLocation || 'Location unavailable'}</Text>
              </View>
              <View style={[styles.typeTag, isFace ? styles.typeTagFace : styles.typeTagDetails]}>
                <Text style={[styles.typeTagText, { color: isFace ? COLORS.primaryDark : COLORS.warning }]}>
                  {isFace ? `${match.band === 'strong' ? 'Strong' : 'Possible'} face match` : 'Details only'}
                </Text>
              </View>
            </View>

            <ScoreBar label="Evidence score" percent={Math.round(match.score ?? match.metadataScore ?? 0)} color={COLORS.primary} />
            {(match.evidence || []).length ? (
              <View style={styles.evidenceList}>
                <Text style={styles.evidenceTitle}>Why this record was suggested</Text>
                {match.evidence.map((item, i) => (
                  <View key={i} style={styles.evidenceRow}>
                    <Text style={[styles.evidencePoints, { color: item.points < 0 ? COLORS.danger : COLORS.success }]}>
                      {item.points > 0 ? '+' : ''}{item.points}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evidenceLabel}>{item.label}</Text>
                      {item.detail ? <Text style={styles.evidenceDetail}>{item.detail}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimer}>{match.reason || 'Potential match only; verify identity.'}</Text>
            </View>
          </View>
        );
      })}

      <ActionButton onPress={onRetake}>Start a new scan</ActionButton>
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
  const [photos, setPhotos] = useState([]);
  const [draft, setDraft] = useState(null);
  const [details, setDetails] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function describeError(err) {
    const message = String(err?.message || 'Unknown request error');
    const lower = message.toLowerCase();
    return lower.includes('fetch failed') || lower.includes('network request failed')
      ? 'Cannot reach the DMEWS backend. Confirm the phone and computer are on the same Wi-Fi and restart Expo after the backend starts.'
      : message;
  }

  async function request(path, options) {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options?.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
    return data;
  }

  function startScan() {
    setPhotos([]);
    setDraft(null);
    setDetails(null);
    setResult(null);
    setError('');
    setScreen('camera');
  }

  function capturePhoto(photo, done) {
    const next = [...photos, photo].slice(0, MAX_PHOTOS);
    setPhotos(next);
    if (done) setScreen('extracting');
  }

  // Step 1: send photos; the backend returns AI-filled details and the face check.
  async function extractDetails() {
    try {
      const body = new FormData();
      // Expo's fetch only accepts real file objects in FormData (not RN-style { uri, name, type }).
      photos.forEach((photo) => {
        body.append('images', new File(photo.uri));
      });
      const data = await request('/victim-access/scans', { method: 'POST', body });
      setDraft(data.scan);
      setDetails(data.scan.details || {});
      setError('');
      setScreen('review');
    } catch (err) {
      setResult(null);
      setError(describeError(err));
      setScreen('result');
    }
  }

  // Step 2: officer-confirmed details; the backend runs matching.
  async function findMatches() {
    try {
      const data = await request(`/victim-access/scans/${draft.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details }),
      });
      setResult(data.scan);
      setError('');
      setScreen('result');
    } catch (err) {
      setError(describeError(err));
      setScreen('review');
    }
  }

  function reset() {
    setPhotos([]);
    setDraft(null);
    setDetails(null);
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
        {screen === 'dashboard' && <Dashboard onScan={startScan} onHistory={() => setScreen('history')} />}
        {screen === 'camera' && <CameraScreen photoCount={photos.length} onCancel={reset} onCaptured={capturePhoto} />}
        {screen === 'extracting' && (
          <ProcessingScreen
            title="Reading the photos"
            text={`AI is describing ${photos.length} photo${photos.length === 1 ? '' : 's'} and checking the face. This can take up to a minute.`}
            onStart={extractDetails}
          />
        )}
        {screen === 'review' && details && (
          <DetailsReviewScreen
            scan={draft}
            details={details}
            onChange={setDetails}
            onSubmit={() => setScreen('matching')}
            onCancel={reset}
            error={error}
          />
        )}
        {screen === 'matching' && (
          <ProcessingScreen title="Finding matches" text="Comparing with missing-person records." onStart={findMatches} />
        )}
        {screen === 'result' && <ResultScreen result={result} error={error} onRetake={startScan} onBack={reset} />}
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
  /* Match evidence */
  evidenceList: { marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderSoft, paddingTop: 8 },
  evidenceTitle: { fontSize: 12, fontWeight: '800', color: COLORS.secondaryText, marginBottom: 4, textTransform: 'uppercase' },
  evidenceRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  evidencePoints: { width: 38, fontSize: 13, fontWeight: '800' },
  evidenceLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  evidenceDetail: { fontSize: 12, color: COLORS.secondaryText, marginTop: 1 },

  /* Review form */
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  choiceChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6, backgroundColor: COLORS.white },
  choiceChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  choiceText: { fontSize: 13, color: COLORS.text, textTransform: 'capitalize' },
  choiceTextOn: { color: COLORS.white, fontWeight: '700' },
  listHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  listCount: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  listItem: { borderTopWidth: 1, borderTopColor: COLORS.borderSoft, paddingTop: 10, marginTop: 10 },
  removeText: { color: COLORS.danger, fontWeight: '700', fontSize: 13, marginTop: 4 },
  addText: { color: COLORS.primary, fontWeight: '800', fontSize: 14, marginTop: 12 },
  formError: { color: COLORS.danger, backgroundColor: COLORS.dangerLight, padding: 10, borderRadius: 10, marginBottom: 10 },

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
  previewImage: { flex: 1, backgroundColor: '#000' },
  previewPanel: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  previewTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  previewText: { color: COLORS.secondaryText, fontSize: 13, lineHeight: 19, marginTop: 6 },
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
  matchPhoto: {
    backgroundColor: COLORS.borderSoft,
    borderRadius: 12,
    height: 64,
    marginRight: 12,
    width: 64,
  },
  matchPhotoPlaceholder: {
    alignItems: 'center',
    backgroundColor: COLORS.borderSoft,
    borderRadius: 12,
    height: 64,
    justifyContent: 'center',
    marginRight: 12,
    width: 64,
  },
  matchPhotoPlaceholderText: { color: COLORS.secondaryText, fontSize: 10, fontWeight: '700' },
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