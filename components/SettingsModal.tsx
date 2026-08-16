'use client';
import { useEffect, useState, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore, GridSize } from '@/store/settingsStore';
import { useCategoryStore } from '@/store/categoryStore';
import { useAuthStore } from '@/store/authStore';
import { synaluxSignInUrl, synaluxSignOutUrl, signInWithAppleNative, isNativeiOS, SynaluxProfile } from '@/services/aiService';
import { LANG_META, SupportedLanguage } from '@/engine/i18n';
import { UNREVIEWED_LANGUAGES } from '@/constants/translationReviewStatus';
import { useT } from '@/engine/useT';
import { VOCAB_SETS } from '@/constants/vocabularySets';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { tapFeedback } from '@/services/feedback';
import HeadTrackingSettings from './HeadTrackingSettings';
import LocalAISettings from './LocalAISettings';
import HandCalibration from './HandCalibration';
import InputModesSettings from './InputModesSettings';
import ToolbarCustomization from './ToolbarCustomization';
import VoicePicker from './VoicePicker';
import CaregiverContactsSettings from './CaregiverContactsSettings';
import PinPad from './PinPad';
import { getActiveProfile, loadProfiles, deleteProfile, setActiveProfile, enableContinuousLearning, disableContinuousLearning, isContinuousLearningActive } from '@/services/handProfileService';

// ── Accordion section ────────────────────────────────────────────────────────
function Section({
  icon, title, defaultOpen = false, children,
}: { icon: string; title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-theme rounded-xl overflow-hidden">
      <button
        onClick={() => { tapFeedback(); setOpen((v) => !v); }}
        aria-expanded={open}
        className="aac-btn w-full flex items-center justify-between px-4 py-3 surface-key hover:bg-black/5 text-left"
      >
        <span className="flex items-center gap-2 text-primary font-semibold text-base">
          <span>{icon}</span>
          <span>{title}</span>
        </span>
        <span className={`text-muted text-lg transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-theme space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Toggle helper ─────────────────────────────────────────────────────────────
function Toggle({
  on,
  onToggle,
  label,
  disabled = false,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => { tapFeedback(); onToggle(); }}
      aria-pressed={on}
      aria-label={label}
      disabled={disabled}
      className={`w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${on ? 'bg-[#4CAF50]' : 'bg-slate-400'}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white transition-transform mx-1 ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

// ── Hand calibration sub-section ──────────────────────────────────────────────
function HandProfileSection() {
  const [showCalibration, setShowCalibration] = useState(false);
  const [autoLearn, setAutoLearn] = useState(isContinuousLearningActive());
  const profiles = loadProfiles();
  const active = getActiveProfile();

  if (showCalibration) return <HandCalibration onClose={() => setShowCalibration(false)} />;

  return (
    <div className="space-y-2">
      <button
        onClick={() => { tapFeedback(); setShowCalibration(true); }}
        className="aac-btn w-full bg-[#2196F3] text-white rounded-lg py-2.5 text-sm font-bold"
      >
        {active.id === 'default' ? 'Scan Hand & Calibrate' : 'Re-Calibrate'}
      </button>
      <label className="flex items-center justify-between py-1">
        <span className="text-primary text-sm">Auto-Learn</span>
        <Toggle on={autoLearn} label="Auto-Learn" onToggle={() => {
          if (autoLearn) { disableContinuousLearning(); setAutoLearn(false); }
          else { enableContinuousLearning(); setAutoLearn(true); }
        }} />
      </label>
      {profiles.filter(p => p.id !== 'default').map(p => (
        <div key={p.id} className="flex items-center justify-between surface-key rounded-lg px-3 py-2 border border-theme text-sm">
          <button onClick={() => { tapFeedback(); setActiveProfile(p.id); }}
            className={`text-primary font-semibold ${active.id === p.id ? 'text-[#4CAF50]' : ''}`}>
            {active.id === p.id ? '● ' : ''}{p.name || p.id}
          </button>
          <button onClick={() => { tapFeedback(); deleteProfile(p.id); }} className="text-[#F44336] text-xs">Delete</button>
        </div>
      ))}
    </div>
  );
}

const PLAN_LABEL_KEYS: Record<SynaluxProfile['plan'], string> = {
  free: 'plan_free',
  standard: 'plan_standard',
  advanced: 'plan_advanced',
  enterprise: 'plan_enterprise',
};

export default function SettingsModal() {
  const { showSettings, toggleSettings } = useUIStore();
  const settings = useSettingsStore;  // namespace only — selectors below avoid whole-store subscription
  const gridSize = useSettingsStore(s => s.gridSize);
  const theme = useSettingsStore(s => s.theme);
  const speechRate = useSettingsStore(s => s.speechRate);
  const speechVolume = useSettingsStore(s => s.speechVolume);
  const language = useSettingsStore(s => s.language);
  const activeVocabSet = useSettingsStore(s => s.activeVocabSet);
  const highContrast = useSettingsStore(s => s.highContrast);
  const notificationsEnabled = useSettingsStore(s => s.notificationsEnabled);
  const setTheme = useSettingsStore(s => s.setTheme);
  const update = useSettingsStore(s => s.update);
  const aiAutocorrectEnabled = useSettingsStore(s => s.aiAutocorrectEnabled);
  const speakSelectionFeedback = useSettingsStore(s => s.speakSelectionFeedback);
  const cloudPredictionEnabled = useSettingsStore(s => s.cloudPredictionEnabled);
  const showUnreviewedVocabulary = useSettingsStore(s => s.showUnreviewedVocabulary);
  const mathHoldTimeMs = useSettingsStore(s => s.mathHoldTimeMs);
  const mathTwoHitMagnify = useSettingsStore(s => s.mathTwoHitMagnify);
  const showHandCalibration = useSettingsStore(s => s.showHandCalibration);
  const { t } = useT();
  const [pinVerified, setPinVerified] = useState(false);
  const pinJustSet = useRef(false);
  const caregiverPinHash = useSettingsStore(s => s.caregiverPinHash);
  const {
    customCategories, customPhrases,
    addCustomCategory, removeCustomCategory,
    addCustomPhrase, removeCustomPhrase,
    allCategories, hiddenCategoryIds, hideCategoryId, unhideCategoryId,
    hiddenPhraseIds, hideDefaultPhrase, unhideDefaultPhrase,
  } = useCategoryStore();

  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📌');
  const [newPhraseText, setNewPhraseText] = useState('');
  const [newPhraseCat, setNewPhraseCat] = useState('');
  const [newPhraseImage, setNewPhraseImage] = useState('');
  const [wordVisCat, setWordVisCat] = useState('');

  const handlePhraseImageUpload = (file: File, setter: (url: string) => void) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 500_000) { alert('Image must be under 500KB'); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') setter(reader.result); };
    reader.readAsDataURL(file);
  };

  const updatePhraseImage = (phraseId: string, imageUrl: string) => {
    useCategoryStore.setState((s) => ({
      customPhrases: s.customPhrases.map(p =>
        p.id === phraseId ? { ...p, customImageUrl: imageUrl } : p
      ),
    }));
  };

  const profile = useAuthStore((s) => s.profile);
  const profileLoaded = useAuthStore((s) => s.loaded);
  const profileLoading = useAuthStore((s) => s.loading);
  const refreshProfile = useAuthStore((s) => s.refresh);

  useEffect(() => {
    if (showSettings) refreshProfile();
  }, [showSettings, refreshProfile]);

  if (!showSettings) return null;

  // H18: Caregiver PIN gate — if a PIN hash is configured, require verification before opening settings
  // Skip gate if PIN was just set in this session (pinJustSet ref survives the Zustand re-render)
  if (caregiverPinHash && !pinVerified && !pinJustSet.current) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-4 shadow-2xl">
          <h2 className="text-xl font-bold">Caregiver Access</h2>
          <p className="text-sm text-muted">Enter your PIN to open settings</p>
          <PinPad
            pinHash={caregiverPinHash!}
            onVerify={setPinVerified}
            onSetPin={(hash) => useSettingsStore.getState().update({ caregiverPinHash: hash })}
          />
        </div>
      </div>
    );
  }

  const cats = allCategories(true);
  const topLevelCats = cats.filter((c) => !c.parentId);
  const hiddenSet = new Set(hiddenCategoryIds);
  const GRID_OPTIONS: GridSize[] = [4, 6, 9, 12, 16, 20];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') toggleSettings(); }}
      tabIndex={-1}
    >
      {/* Backdrop click intentionally removed — dwell-click drift closes the
          modal accidentally. Only the ✕ button closes Settings. */}
      <div
        className="surface-bar rounded-2xl w-full max-w-lg md:max-w-2xl max-h-[90svh] flex flex-col border border-theme shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-theme shrink-0">
          <h2 className="text-primary font-bold text-lg">⚙️ {t('settings')}</h2>
          <button onClick={toggleSettings} aria-label={t('close_settings')} className="text-muted hover:text-primary text-xl px-1">✕</button>
        </div>

        {/* Scrollable sections */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">

          {/* ── CATEGORIES (top, expanded — user said "can't find it") ── */}
          <Section icon="📂" title="Categories" defaultOpen>
            <button
              onClick={() => { tapFeedback(); useUIStore.getState().toggleCategoryManager(); toggleSettings(); }}
              className="aac-btn w-full rounded-xl px-4 py-3 font-semibold border border-theme surface-key text-primary flex items-center justify-between"
            >
              <span>📂 Open Category Manager</span>
              <span className="text-muted">→</span>
            </button>
            <div>
              <p className="text-muted text-xs mb-2">Show / hide categories on the board</p>
              <div className="max-h-[200px] overflow-y-auto space-y-0.5 border border-theme rounded-xl p-2">
                {topLevelCats.map((cat) => {
                  const visible = !hiddenSet.has(cat.id);
                  return (
                    <label key={cat.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-black/5">
                      <span className="text-primary text-sm">{cat.icon} {cat.name}</span>
                      <Toggle
                        on={visible}
                        label={`${cat.name} visibility`}
                        onToggle={() => visible ? hideCategoryId(cat.id) : unhideCategoryId(cat.id)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* ── GRID SIZE (expanded — primary AAC config) ── */}
          <Section icon="📐" title={t('grid_size')} defaultOpen>
            <p className="text-muted text-xs">{t('slp_tip_grid')}</p>
            <div className="grid grid-cols-6 gap-2">
              {GRID_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => update({ gridSize: size })}
                  className={`aac-btn rounded-xl px-2 py-3 text-lg font-bold border border-theme text-center ${
                    gridSize === size ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </Section>

          {/* ── THEME ── */}
          <Section icon="🎨" title={t('theme')} defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              {(['light', 'dark'] as const).map((th) => (
                <button key={th} onClick={() => setTheme(th)} aria-pressed={theme === th}
                  className={`aac-btn rounded-xl px-4 py-3 font-semibold border border-theme ${
                    theme === th ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                  }`}>
                  {th === 'light' ? '☀ Light' : '🌙 Dark'}
                </button>
              ))}
            </div>
          </Section>

          {/* ── VOICE ── */}
          <Section icon="🔊" title={t('voice')} defaultOpen>
            <label className="flex items-center justify-between">
              <span className="text-primary text-sm">{t('speed')} — {speechRate.toFixed(1)}</span>
            </label>
            <input type="range" min="0.25" max="2" step="0.05" value={speechRate}
              onChange={(e) => update({ speechRate: parseFloat(e.target.value) })}
              className="w-full accent-[#4CAF50]" />
            <label className="flex items-center justify-between mt-2">
              <span className="text-primary text-sm">{t('volume')} — {Math.round(speechVolume * 100)}%</span>
            </label>
            <input type="range" min="0" max="1" step="0.1" value={speechVolume}
              onChange={(e) => update({ speechVolume: parseFloat(e.target.value) })}
              className="w-full accent-[#2196F3]" />
            <div className="mt-2">
              <p className="text-muted text-xs mb-2">{t('voice_picker_desc')}</p>
              <VoicePicker />
            </div>
          </Section>

          {/* ── LANGUAGE ── */}
          <Section icon="🌐" title={t('language')}>
            <div className="grid grid-cols-3 gap-2">
              {LANG_META.map((lang) => (
                <button key={lang.code}
                  onClick={() => update({ language: lang.code as SupportedLanguage })}
                  className={`aac-btn rounded-xl px-3 py-2 text-sm text-left border border-theme ${
                    language === lang.code ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                  }`}
                >
                  <div className="font-semibold">{lang.nativeName}</div>
                  <div className="text-xs opacity-70">{lang.name}</div>
                </button>
              ))}
            </div>

            {/* Only for languages whose machine translations no native speaker
                has checked. For the other 24 this control would be a setting
                with no effect, so it is not shown. */}
            {UNREVIEWED_LANGUAGES.has(String(language).split('-')[0]) && (
              <label className="flex items-center justify-between py-1.5 mt-3 border-t border-theme pt-3">
                <div className="pr-3">
                  <span className="text-primary text-sm font-semibold">
                    {t('show_unreviewed_words')}
                  </span>
                  <p className="text-muted text-[10px]">
                    {t('show_unreviewed_words_desc')}
                  </p>
                </div>
                <Toggle
                  on={showUnreviewedVocabulary}
                  label={t('show_unreviewed_words')}
                  onToggle={() => update({ showUnreviewedVocabulary: !showUnreviewedVocabulary })}
                />
              </label>
            )}
          </Section>

          {/* ── VOCABULARY SET ── */}
          <Section icon="📚" title={t('vocab_set')}>
            <div className="grid grid-cols-2 gap-2">
              {VOCAB_SETS.map((vs) => (
                <button key={vs.id}
                  onClick={() => { tapFeedback(); update({ activeVocabSet: vs.id }); }}
                  aria-pressed={activeVocabSet === vs.id}
                  className={`aac-btn rounded-xl px-3 py-2 text-left border border-theme ${
                    activeVocabSet === vs.id ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{vs.icon}</span>
                    <span className="font-semibold text-sm">{t(vs.nameKey)}</span>
                    {vs.tier !== 'free' && (
                      <span className="ml-auto text-[10px] uppercase px-1.5 py-0.5 rounded bg-black/15 font-bold">{vs.tier}</span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${activeVocabSet === vs.id ? 'opacity-80' : 'text-muted'}`}>{t(vs.descKey)}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* ── WORD VISIBILITY ── */}
          <Section icon="👁" title={t('word_visibility')}>
            <select value={wordVisCat}
              onChange={(e) => { tapFeedback(); setWordVisCat(e.target.value); }}
              className="w-full surface-key rounded-lg px-3 py-2 text-sm border border-theme">
              <option value="">{t('select_category')}</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.nameKey ? t(c.nameKey) : c.name}</option>)}
            </select>
            {wordVisCat && (
              <div className="max-h-[200px] overflow-y-auto space-y-0.5 border border-theme rounded-xl p-2 mt-2">
                {DEFAULT_PHRASES.filter((p) => p.categoryId === wordVisCat).map((p) => {
                  const phraseVisible = !hiddenPhraseIds.includes(p.id);
                  const localText = getPhraseText(p.id, language, p.text);
                  return (
                    <label key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-black/5">
                      <span className="text-primary text-sm">{localText}</span>
                      <Toggle on={phraseVisible} label={localText}
                        onToggle={() => phraseVisible ? hideDefaultPhrase(p.id) : unhideDefaultPhrase(p.id)} />
                    </label>
                  );
                })}
              </div>
            )}
          </Section>

          {/* ── CONTACTS ── collapsed, just a button, no expanded list ── */}
          <Section icon="💬" title="Contacts">
            {/* Full contacts manager — includes Gmail/Outlook connect + reconnect */}
            <CaregiverContactsSettings />
            <label className="flex items-center justify-between py-1.5 mt-2 border-t border-theme pt-2">
              <div>
                <span className="text-primary text-sm font-semibold">Alarm on new message</span>
                <p className="text-muted text-[10px]">Chime when a message arrives from a contact</p>
              </div>
              <Toggle
                on={notificationsEnabled}
                label="Alarm on new message"
                onToggle={() => update({ notificationsEnabled: !notificationsEnabled })}
              />
            </label>
          </Section>

          {/* ── TOOLBAR BUTTONS ── */}
          <Section icon="🔧" title="Toolbar Buttons">
            <ToolbarCustomization />
          </Section>

          {/* ── INPUT MODES ── */}
          <Section icon="♿" title={`${t('accessibility')} & Input Modes`}>
            <label className="flex items-center justify-between py-1.5">
              <span className="text-primary text-sm">{t('high_contrast')}</span>
              <Toggle on={highContrast} label={t('high_contrast')}
                onToggle={() => update({ highContrast: !highContrast })} />
            </label>
            {/* Auditory feedback. Off by default: the MESSAGE is spoken only
                when the user presses Speak, and this confirms each SELECTION
                by saying the item just chosen. Scanning and low-literacy
                users rely on that confirmation; broadcasting the growing
                message instead is the user's public utterance being made
                without them choosing to make it. */}
            <label className="flex items-center justify-between py-1.5">
              <div>
                <span className="text-primary text-sm">{t('speak_selection_feedback')}</span>
                <p className="text-muted text-[10px]">{t('speak_selection_feedback_desc')}</p>
              </div>
              <Toggle on={speakSelectionFeedback} label={t('speak_selection_feedback')}
                onToggle={() => update({ speakSelectionFeedback: !speakSelectionFeedback })} />
            </label>
            <label className="flex items-center justify-between py-1.5">
              <div>
                <span className="text-primary text-sm">AI Autocorrect</span>
                <p className="text-muted text-[10px]">Suggests corrections while typing</p>
              </div>
              <Toggle on={aiAutocorrectEnabled} label="AI Autocorrect"
                onToggle={() => update({ aiAutocorrectEnabled: !aiAutocorrectEnabled })} />
            </label>
            <label className="flex items-center justify-between py-1.5">
              <div>
                <span className="text-primary text-sm">{t('cloud_memory_predictions')}</span>
                <p className="text-muted text-[10px]">
                  {t('cloud_memory_predictions_desc')}
                </p>
              </div>
              <Toggle
                on={profile !== null && cloudPredictionEnabled}
                disabled={profile === null}
                label={t('cloud_memory_predictions')}
                onToggle={() => update({ cloudPredictionEnabled: !cloudPredictionEnabled })} />
            </label>
            <div className="border-t border-theme pt-3 mt-1">
              <InputModesSettings />
            </div>
            <div className="border-t border-theme pt-3 mt-1">
              <HeadTrackingSettings />
            </div>
          </Section>

          {/* ── MATH ── */}
          <Section icon="🧮" title="Math">
            <label className="block">
              <span className="text-primary text-sm font-semibold">Hold-time dwell</span>
              <p className="text-muted text-[10px] mb-1">0 = instant · 200–1500 ms helps users with motor imprecision</p>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={1500} step={50} value={mathHoldTimeMs}
                  onChange={(e) => update({ mathHoldTimeMs: parseInt(e.target.value, 10) })}
                  className="flex-1" />
                <span className="text-primary font-mono text-sm min-w-[4ch] text-right">{mathHoldTimeMs}ms</span>
              </div>
            </label>
            <label className="flex items-center justify-between py-1.5">
              <div>
                <span className="text-primary text-sm">Two-hit magnify</span>
                <p className="text-muted text-[10px]">First tap magnifies; second tap commits</p>
              </div>
              <Toggle on={mathTwoHitMagnify} label="Two-hit magnify"
                onToggle={() => update({ mathTwoHitMagnify: !mathTwoHitMagnify })} />
            </label>
          </Section>

          {/* ── HAND CALIBRATION ── */}
          {showHandCalibration && (
            <Section icon="🤚" title="Hand Calibration">
              <HandProfileSection />
            </Section>
          )}

          {/* ── CUSTOM CONTENT ── */}
          <Section icon="✏️" title="Custom Categories & Phrases">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)}
                  className="w-11 surface-key rounded-lg text-center text-lg p-1.5 border border-theme" maxLength={2} />
                <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={t('category_name')} className="flex-1 surface-key rounded-lg px-3 py-1.5 text-sm border border-theme" />
                <button
                  onClick={() => { if (newCatName.trim()) { addCustomCategory(newCatName.trim(), newCatIcon || '📌'); setNewCatName(''); } }}
                  className="aac-btn bg-[#4CAF50] text-white px-4 py-2 rounded-lg font-semibold text-sm">
                  {t('add')}
                </button>
              </div>
              {customCategories.map((c) => (
                <div key={c.id} className="flex items-center justify-between surface-key rounded-lg px-3 py-1.5 border border-theme text-sm">
                  <span className="text-primary">{c.icon} {c.name}</span>
                  <button onClick={() => removeCustomCategory(c.id)} className="text-[#F44336] text-xs">{t('remove')}</button>
                </div>
              ))}
            </div>
            <div className="border-t border-theme pt-3 space-y-2">
              <div className="flex gap-2">
                <select value={newPhraseCat} onChange={(e) => setNewPhraseCat(e.target.value)}
                  className="surface-key rounded-lg px-2 py-1.5 text-xs border border-theme">
                  <option value="">{t('category_select')}</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                <input value={newPhraseText} onChange={(e) => setNewPhraseText(e.target.value)}
                  placeholder={t('phrase_text')} className="flex-1 surface-key rounded-lg px-3 py-1.5 text-sm border border-theme" />
                <label className="aac-btn bg-blue-500 text-white px-2 py-2 rounded-lg font-semibold text-sm cursor-pointer flex items-center gap-1" title="Add photo">
                  📷
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhraseImageUpload(f, setNewPhraseImage); e.target.value = ''; }} />
                </label>
                <button
                  onClick={() => { if (newPhraseText.trim() && newPhraseCat) { addCustomPhrase(newPhraseCat, newPhraseText.trim(), newPhraseImage || undefined); setNewPhraseText(''); setNewPhraseCat(''); setNewPhraseImage(''); } }}
                  className="aac-btn bg-[#4CAF50] text-white px-4 py-2 rounded-lg font-semibold text-sm">
                  {t('add')}
                </button>
              </div>
              {newPhraseImage && (
                <div className="flex items-center gap-2 surface-key rounded-lg px-3 py-1.5 border border-theme">
                  <img src={newPhraseImage} alt="Preview" className="w-10 h-10 object-cover rounded" />
                  <span className="text-xs text-muted flex-1">Photo selected</span>
                  <button onClick={() => setNewPhraseImage('')} className="text-[#F44336] text-xs">✕</button>
                </div>
              )}
              {customPhrases.filter(p => !p.deletedAt).map((p) => {
                const cat = cats.find((c) => c.id === p.categoryId);
                return (
                  <div key={p.id} className="flex items-center gap-2 surface-key rounded-lg px-3 py-1.5 border border-theme text-sm">
                    {p.customImageUrl ? (
                      <img src={p.customImageUrl} alt="" className="w-8 h-8 object-cover rounded flex-shrink-0" />
                    ) : (
                      <span className="text-muted text-xs flex-shrink-0">{cat?.icon}</span>
                    )}
                    <span className="text-primary flex-1">{p.text}</span>
                    <label className="text-blue-400 text-xs cursor-pointer flex-shrink-0" title="Change photo">
                      📷
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhraseImageUpload(f, (url) => updatePhraseImage(p.id, url)); e.target.value = ''; }} />
                    </label>
                    <button onClick={() => removeCustomPhrase(p.id)} className="text-[#F44336] text-xs flex-shrink-0">{t('remove')}</button>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ── EXPORT / IMPORT ── */}
          <Section icon="📦" title={t('export_import')}>
            <p className="text-muted text-xs">{t('export_import_desc')}</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => {
                  tapFeedback();
                  const data = {
                    version: 1,
                    categories: useCategoryStore.getState().customCategories,
                    phrases: useCategoryStore.getState().customPhrases.filter(p => !p.deletedAt),
                    hiddenCategories: useCategoryStore.getState().hiddenCategoryIds,
                    hiddenPhrases: useCategoryStore.getState().hiddenPhraseIds,
                    settings: { gridSize: gridSize, activeVocabSet: activeVocabSet },
                  };
                  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                }}
                className="aac-btn rounded-xl px-4 py-3 font-semibold border border-theme surface-key text-primary text-sm"
              >
                📋 {t('export_clipboard')}
              </button>
              <button
                onClick={async () => {
                  tapFeedback();
                  try {
                    const text = await navigator.clipboard.readText();
                    let data: unknown;
                    try { data = JSON.parse(text); } catch { return; }
                    // H19: Validate imported data structure before applying
                    const validateImport = (d: unknown): boolean => {
                      if (!d || typeof d !== 'object') return false;
                      const obj = d as Record<string, unknown>;
                      if (obj.version !== undefined && typeof obj.version !== 'number') return false;
                      if (obj.categories !== undefined && !Array.isArray(obj.categories)) return false;
                      if (obj.phrases !== undefined && !Array.isArray(obj.phrases)) return false;
                      return true;
                    };
                    if (!validateImport(data)) return;
                    const d = data as { version?: number; categories?: unknown[]; phrases?: unknown[] };
                    const store = useCategoryStore.getState();
                    for (const cat of (d.categories ?? [])) {
                      if (typeof (cat as Record<string, unknown>)?.name !== 'string' || ((cat as Record<string, unknown>).name as string).length > 100) continue;
                      if (typeof (cat as Record<string, unknown>)?.icon !== 'string' || ((cat as Record<string, unknown>).icon as string).length > 8) continue;
                      store.addCustomCategory((cat as Record<string, unknown>).name as string, (cat as Record<string, unknown>).icon as string);
                    }
                    for (const phrase of (d.phrases ?? [])) {
                      if (typeof (phrase as Record<string, unknown>)?.text !== 'string' || ((phrase as Record<string, unknown>).text as string).length > 500) continue;
                      if (typeof (phrase as Record<string, unknown>)?.categoryId !== 'string') continue;
                      if (!/^[a-zA-Z0-9_-]{1,64}$/.test((phrase as Record<string, unknown>).categoryId as string)) continue;
                      store.addCustomPhrase((phrase as Record<string, unknown>).categoryId as string, (phrase as Record<string, unknown>).text as string);
                    }
                  } catch { /* invalid clipboard data */ }
                }}
                className="aac-btn rounded-xl px-4 py-3 font-semibold border border-theme surface-key text-primary text-sm"
              >
                📥 {t('import_clipboard')}
              </button>
            </div>
          </Section>

          {/* ── ACCOUNT ── */}
          <Section icon="👤" title={t('synalux_account')}>
            {!profileLoaded || profileLoading ? (
              <p className="text-muted text-sm">{t('checking_sign_in')}</p>
            ) : profile ? (
              <div className="space-y-2">
                <div className="surface-key rounded-lg px-3 py-2 border border-theme">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-muted text-xs uppercase tracking-wider">{t('signed_in_as')}</span>
                    <span className="text-[#4CAF50] text-xs">● {t('active')}</span>
                  </div>
                  <p className="text-primary font-semibold text-sm break-all">{profile.email || profile.name}</p>
                </div>
                <div className="surface-key rounded-lg px-3 py-2 border border-theme">
                  <span className="text-muted text-xs uppercase tracking-wider">{t('subscription')}</span>
                  {profile.isPlatformAdmin && <span className="text-[#FFD700] text-xs ml-2">★ {t('admin')}</span>}
                  <p className="text-primary font-semibold text-sm">{t(PLAN_LABEL_KEYS[profile.plan]) || profile.plan}</p>
                </div>
                <a href={synaluxSignOutUrl()} target="_blank" rel="noopener" className="block text-center text-[#F44336] text-sm hover:underline pt-1">
                  {t('sign_out')}
                </a>
              </div>
            ) : (
              <div>
                <p className="text-muted text-sm mb-3">{t('sign_in_synalux_desc')}</p>
                {isNativeiOS() && (
                  <button
                    data-testid="apple-signin"
                    onClick={async () => {
                      const ok = await signInWithAppleNative();
                      if (!ok) { /* user canceled or error — no action needed */ }
                    }}
                    className="aac-btn flex items-center justify-center gap-2 w-full bg-black text-white px-4 py-3 rounded-lg font-semibold mb-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 17 20" fill="currentColor"><path d="M12.15 0c.12 1.07-.31 2.14-1.01 2.91-.7.77-1.85 1.37-2.98 1.29-.14-1.04.37-2.14 1.01-2.82C9.87.61 11.08.04 12.15 0zm3.49 6.63c-.08.05-2.14 1.23-2.12 3.67.03 2.91 2.56 3.89 2.59 3.9-.02.07-.4 1.39-1.34 2.75-.81 1.17-1.65 2.35-2.97 2.37-1.3.03-1.72-.77-3.2-.77-1.49 0-1.95.74-3.18.8-1.28.05-2.25-1.27-3.07-2.44C.66 14.69-.34 10.95.78 8.43c.56-1.25 1.55-2.05 2.63-2.07 1.25-.03 2.44.85 3.2.85.77 0 2.2-1.04 3.72-.89.63.03 2.41.26 3.56 1.94-.09.06-2.13 1.24-2.25 3.37z"/></svg>
                    Sign in with Apple
                  </button>
                )}
                <a href={synaluxSignInUrl()} data-testid="synalux-signin" target="_blank" rel="noopener"
                  className="aac-btn block w-full text-center bg-[#4CAF50] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#388E3C]">
                  {t('sign_in_with_synalux')}
                </a>
                <p className="text-dim text-xs mt-2">{t('core_aac_no_account')}</p>
              </div>
            )}
          </Section>

          {/* ── CAREGIVER PIN ── */}
          <Section icon="🔒" title="Caregiver PIN">
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>Caregiver PIN</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                {caregiverPinHash ? 'PIN is set. Settings require PIN to open.' : 'No PIN set. Anyone can access settings.'}
              </div>
              {caregiverPinHash && (
                <button type="button"
                  onClick={() => useSettingsStore.getState().update({ caregiverPinHash: undefined })}
                  style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: '12px', cursor: 'pointer' }}>
                  Remove PIN
                </button>
              )}
              {!caregiverPinHash && (
                <PinPad
                  pinHash=""
                  onVerify={() => {}}
                  onSetPin={(hash) => { pinJustSet.current = true; useSettingsStore.getState().update({ caregiverPinHash: hash }); }}
                />
              )}
            </div>
          </Section>

          {/* ── RESOURCES ── */}
          <Section icon="🤖" title="Local AI Models">
            <LocalAISettings />
          </Section>

          <Section icon="📖" title={t('aac_resources')}>
            <div className="space-y-1">
              <a href="https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/" target="_blank" rel="noopener" className="block text-[#2563eb] text-sm hover:underline">ASHA — AAC Practice Portal</a>
              <a href="https://aac-rerc.psu.edu/" target="_blank" rel="noopener" className="block text-[#2563eb] text-sm hover:underline">AAC-RERC — Research Center</a>
              <a href="https://praacticalaac.org/" target="_blank" rel="noopener" className="block text-[#2563eb] text-sm hover:underline">PrAACtical AAC — Resources</a>
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
