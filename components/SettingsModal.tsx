'use client';
import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore, GridSize } from '@/store/settingsStore';
import { useCategoryStore } from '@/store/categoryStore';
import { useAuthStore } from '@/store/authStore';
import { synaluxSignInUrl, synaluxSignOutUrl, SynaluxProfile } from '@/services/aiService';
import { LANG_META, SupportedLanguage } from '@/engine/i18n';
import { useT } from '@/engine/useT';
import { VOCAB_SETS } from '@/constants/vocabularySets';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { tapFeedback } from '@/services/feedback';
import HeadTrackingSettings from './HeadTrackingSettings';
import HandCalibration from './HandCalibration';
import InputModesSettings from './InputModesSettings';
import ToolbarCustomization from './ToolbarCustomization';
import CaregiverContactsSettings from './CaregiverContactsSettings';
import VoicePicker from './VoicePicker';
import { getActiveProfile, loadProfiles, deleteProfile, setActiveProfile, enableContinuousLearning, disableContinuousLearning, isContinuousLearningActive } from '@/services/handProfileService';

function HandProfileSection() {
  const [showCalibration, setShowCalibration] = useState(false);
  const [autoLearn, setAutoLearn] = useState(isContinuousLearningActive());
  const profiles = loadProfiles();
  const active = getActiveProfile();

  if (showCalibration) {
    return <HandCalibration onClose={() => setShowCalibration(false)} />;
  }

  return (
    <div className="py-2 space-y-2">
      <div className="surface-key rounded-xl p-3 border border-theme">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted text-xs uppercase tracking-wider">Hand Profile</span>
          <span className="text-[#4CAF50] text-xs font-bold">{active.name || 'Default'}</span>
        </div>
        {active.id !== 'default' && (
          <div className="grid grid-cols-2 gap-1 text-xs mb-2">
            <div className="flex justify-between"><span className="text-muted">Hand</span><span className="text-primary capitalize">{active.handedness}</span></div>
            <div className="flex justify-between"><span className="text-muted">Y-Offset</span><span className="text-primary">{active.yOffset}px</span></div>
            <div className="flex justify-between"><span className="text-muted">Tremor</span><span className="text-primary">{active.tremorAmplPx}px @ {active.tremorFreqHz}Hz</span></div>
            <div className="flex justify-between"><span className="text-muted">Smoothing</span><span className="text-primary">{active.emaAlpha}</span></div>
            <div className="flex justify-between"><span className="text-muted">Dead Zone</span><span className="text-primary">{active.deadZonePx}px</span></div>
            <div className="flex justify-between"><span className="text-muted">Touches</span><span className="text-primary">{active.touchSamples}</span></div>
          </div>
        )}
        <button
          onClick={() => { tapFeedback(); setShowCalibration(true); }}
          className="aac-btn w-full bg-[#2196F3] text-white rounded-lg py-2.5 text-sm font-bold"
        >
          {active.id === 'default' ? 'Scan Hand & Calibrate' : 'Re-Calibrate'}
        </button>
      </div>

      {/* Auto-learn toggle */}
      <label className="flex items-center justify-between py-1">
        <div>
          <span className="text-primary text-sm">Auto-Learn</span>
          <p className="text-muted text-[10px]">Continuously improves precision from usage</p>
        </div>
        <button
          onClick={() => {
            tapFeedback();
            if (autoLearn) { disableContinuousLearning(); setAutoLearn(false); }
            else { enableContinuousLearning(); setAutoLearn(true); }
          }}
          aria-pressed={autoLearn}
          className={`w-12 h-7 rounded-full transition-colors shrink-0 ml-3 ${autoLearn ? 'bg-[#4CAF50]' : 'bg-[#999]'}`}
        >
          <div className={`w-5 h-5 rounded-full bg-white transition-transform mx-1 ${autoLearn ? 'translate-x-5' : ''}`} />
        </button>
      </label>

      {/* Profile list */}
      {profiles.length > 1 && (
        <div className="space-y-1">
          {profiles.filter(p => p.id !== 'default').map(p => (
            <div key={p.id} className="flex items-center justify-between surface-key rounded-lg px-3 py-2 border border-theme text-sm">
              <button
                onClick={() => { tapFeedback(); setActiveProfile(p.id); }}
                className={`text-primary font-semibold ${active.id === p.id ? 'text-[#4CAF50]' : ''}`}
              >
                {active.id === p.id ? '● ' : ''}{p.name || p.id}
              </button>
              <button onClick={() => { tapFeedback(); deleteProfile(p.id); }} className="text-[#F44336] text-xs">Delete</button>
            </div>
          ))}
        </div>
      )}
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
  const settings = useSettingsStore();
  const { t } = useT();
  const { customCategories, customPhrases, addCustomCategory, removeCustomCategory, addCustomPhrase, removeCustomPhrase, allCategories, hiddenCategoryIds, hideCategoryId, unhideCategoryId, hiddenPhraseIds, hideDefaultPhrase, unhideDefaultPhrase } = useCategoryStore();
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📌');
  const [newPhraseText, setNewPhraseText] = useState('');
  const [newPhraseCat, setNewPhraseCat] = useState('');
  const [wordVisCat, setWordVisCat] = useState('');
  const profile = useAuthStore((s) => s.profile);
  const profileLoaded = useAuthStore((s) => s.loaded);
  const profileLoading = useAuthStore((s) => s.loading);
  const refreshProfile = useAuthStore((s) => s.refresh);

  useEffect(() => {
    if (showSettings) refreshProfile();
  }, [showSettings, refreshProfile]);

  if (!showSettings) return null;

  const cats = allCategories(true);
  const hiddenSet = new Set(hiddenCategoryIds);
  const GRID_OPTIONS: GridSize[] = [4, 6, 9, 12, 16, 20];

  const sectionTitle = 'text-muted font-semibold text-base uppercase tracking-wider mb-3';

  return (
    <div role="dialog" aria-modal="true" className="modal-backdrop fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={toggleSettings}>
      <div className="surface-bar rounded-2xl w-full max-w-lg max-h-[85svh] flex flex-col border border-theme shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-theme">
          <h2 className="text-primary font-bold text-lg">{t('settings')}</h2>
          <button onClick={toggleSettings} aria-label={t('close_settings')} className="text-muted hover:text-primary text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Theme */}
          <div>
            <h3 className={sectionTitle}>{t('theme')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => settings.setTheme('light')}
                aria-pressed={settings.theme === 'light'}
                className={`aac-btn rounded-xl px-4 py-4 text-lg font-semibold border border-theme ${
                  settings.theme === 'light' ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                }`}
              >
                ☀ {t('light')}
              </button>
              <button
                onClick={() => settings.setTheme('dark')}
                aria-pressed={settings.theme === 'dark'}
                className={`aac-btn rounded-xl px-4 py-4 text-lg font-semibold border border-theme ${
                  settings.theme === 'dark' ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                }`}
              >
                🌙 {t('dark')}
              </button>
            </div>
          </div>

          {/* Language */}
          <div>
            <h3 className={sectionTitle}>{t('language')}</h3>
            <div className="grid grid-cols-3 gap-2">
              {LANG_META.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => settings.update({ language: lang.code as SupportedLanguage })}
                  className={`aac-btn rounded-xl px-3 py-3 text-base text-left border border-theme ${
                    settings.language === lang.code ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                  }`}
                >
                  <div className="font-semibold">{lang.nativeName}</div>
                  <div className="text-sm opacity-70">{lang.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Text Input Settings */}
          <div>
            <h3 className={sectionTitle}>Text Input</h3>
            <label className="flex items-center justify-between py-1.5">
              <div>
                <span className="text-primary text-sm font-semibold">AI Autocorrect & Completion</span>
                <p className="text-muted text-[10px]">Suggests corrections and word completions while typing</p>
              </div>
              <button onClick={() => { tapFeedback(); settings.update({ aiAutocorrectEnabled: !settings.aiAutocorrectEnabled }); }} aria-pressed={settings.aiAutocorrectEnabled} aria-label="AI Autocorrect"
                className={`w-12 h-7 rounded-full transition-colors shrink-0 ${settings.aiAutocorrectEnabled ? 'bg-[#4CAF50]' : 'bg-[#999]'}`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform mx-1 ${settings.aiAutocorrectEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </label>
          </div>

          {/* Input Modes — all accessibility input methods */}
          <div>
            <h3 className={sectionTitle}>Input Modes</h3>
            <InputModesSettings />
          </div>

          {/* Toolbar Customization — reorder/hide buttons + manage apps */}
          <div>
            <h3 className={sectionTitle}>Toolbar Buttons</h3>
            <ToolbarCustomization />
          </div>

          {/* AAC Chat — caregiver-curated contact list. The AAC user
              consumes the list read-only via the AAC Chat picker. */}
          <div>
            <h3 className={sectionTitle}>Contacts (Send a message)</h3>
            <CaregiverContactsSettings />
            <label className="flex items-center justify-between py-2 mt-3 border-t border-theme pt-3">
              <div>
                <span className="text-primary text-sm font-semibold">Alarm on new message</span>
                <p className="text-muted text-[10px]">Plays a chime when an incoming message lands from a connected provider. Mute for school / quiet contexts.</p>
              </div>
              <button
                onClick={() => { tapFeedback(); settings.update({ notificationsEnabled: !settings.notificationsEnabled }); }}
                aria-pressed={settings.notificationsEnabled}
                aria-label="Alarm on new message"
                data-testid="notifications-enabled-toggle"
                className={`w-12 h-7 rounded-full transition-colors shrink-0 ${settings.notificationsEnabled ? 'bg-[#4CAF50]' : 'bg-[#999]'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform mx-1 ${settings.notificationsEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </label>
          </div>

          {/* Hand Calibration */}
          {settings.showHandCalibration && (
            <div>
              <h3 className={sectionTitle}>Hand Calibration</h3>
              <HandProfileSection />
            </div>
          )}

          {/* Accessibility */}
          <div>
            <h3 className={sectionTitle}>{t('accessibility')}</h3>
            <label className="flex items-center justify-between py-2">
              <span className="text-primary text-lg">{t('high_contrast')}</span>
              <button
                onClick={() => settings.update({ highContrast: !settings.highContrast })}
                aria-pressed={settings.highContrast}
                aria-label={t('high_contrast')}
                className={`w-14 h-8 rounded-full transition-colors ${settings.highContrast ? 'bg-[#FFD700]' : 'bg-[#999]'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white transition-transform mx-1 ${settings.highContrast ? 'translate-x-6' : ''}`} />
              </button>
            </label>
            <label className="flex items-center justify-between py-2">
              <span className="text-primary text-lg">AI Autocorrect</span>
              <button
                onClick={() => settings.update({ aiAutocorrectEnabled: !settings.aiAutocorrectEnabled })}
                aria-pressed={settings.aiAutocorrectEnabled}
                aria-label="AI Autocorrect"
                className={`w-14 h-8 rounded-full transition-colors ${settings.aiAutocorrectEnabled ? 'bg-[#4CAF50]' : 'bg-[#999]'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white transition-transform mx-1 ${settings.aiAutocorrectEnabled ? 'translate-x-6' : ''}`} />
              </button>
            </label>
          </div>

          {/* Head Tracking */}
          <HeadTrackingSettings />

          {/* Vocabulary Set */}
          <div>
            <h3 className={sectionTitle}>{t('vocab_set')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {VOCAB_SETS.map((vs) => (
                <button
                  key={vs.id}
                  onClick={() => { tapFeedback(); settings.update({ activeVocabSet: vs.id }); }}
                  aria-pressed={settings.activeVocabSet === vs.id}
                  className={`aac-btn rounded-xl px-3 py-3 text-left border border-theme ${
                    settings.activeVocabSet === vs.id ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{vs.icon}</span>
                    <span className="font-semibold text-sm">{t(vs.nameKey)}</span>
                    {vs.tier !== 'free' && (
                      <span className="ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/15 font-bold">{vs.tier}</span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${settings.activeVocabSet === vs.id ? 'opacity-80' : 'text-muted'}`}>{t(vs.descKey)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Category Visibility */}
          <div>
            <h3 className={sectionTitle}>{t('category_visibility')}</h3>
            <p className="text-muted text-sm mb-3">{t('slp_tip_categories')}</p>
            <div className="max-h-[240px] overflow-y-auto space-y-1 border border-theme rounded-xl p-2">
              {cats.map((cat) => {
                const visible = !hiddenSet.has(cat.id);
                return (
                  <label key={cat.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-black/5">
                    <span className="text-primary text-base">{cat.icon} {cat.name}</span>
                    <button
                      onClick={() => { tapFeedback(); visible ? hideCategoryId(cat.id) : unhideCategoryId(cat.id); }}
                      aria-pressed={visible}
                      aria-label={`${cat.name} visibility`}
                      className={`w-14 h-8 rounded-full transition-colors ${visible ? 'bg-[#4CAF50]' : 'bg-[#999]'}`}
                    >
                      <div className={`w-6 h-6 rounded-full bg-white transition-transform mx-1 ${visible ? 'translate-x-6' : ''}`} />
                    </button>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Word Visibility */}
          <div>
            <h3 className={sectionTitle}>{t('word_visibility')}</h3>
            <select
              value={wordVisCat}
              onChange={(e) => { tapFeedback(); setWordVisCat(e.target.value); }}
              className="w-full surface-key rounded-lg px-3 py-2 text-sm border border-theme mb-3"
            >
              <option value="">{t('select_category')}</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.nameKey ? t(c.nameKey) : c.name}</option>)}
            </select>
            {wordVisCat && (
              <div className="max-h-[240px] overflow-y-auto space-y-1 border border-theme rounded-xl p-2">
                {DEFAULT_PHRASES.filter((p) => p.categoryId === wordVisCat).map((p) => {
                  const phraseVisible = !hiddenPhraseIds.includes(p.id);
                  const localText = getPhraseText(p.id, settings.language, p.text);
                  return (
                    <label key={p.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-black/5">
                      <span className="text-primary text-base">{localText}</span>
                      <button
                        onClick={() => { tapFeedback(); phraseVisible ? hideDefaultPhrase(p.id) : unhideDefaultPhrase(p.id); }}
                        aria-pressed={phraseVisible}
                        aria-label={phraseVisible ? t('hide_word') : t('show_word')}
                        className={`w-14 h-8 rounded-full transition-colors ${phraseVisible ? 'bg-[#4CAF50]' : 'bg-[#999]'}`}
                      >
                        <div className={`w-6 h-6 rounded-full bg-white transition-transform mx-1 ${phraseVisible ? 'translate-x-6' : ''}`} />
                      </button>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grid Size */}
          <div>
            <h3 className={sectionTitle}>{t('grid_size')}</h3>
            <p className="text-muted text-sm mb-3">{t('slp_tip_grid')}</p>
            <div className="grid grid-cols-6 gap-2">
              {GRID_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => settings.update({ gridSize: size })}
                  className={`aac-btn rounded-xl px-2 py-3 text-lg font-bold border border-theme text-center ${
                    settings.gridSize === size ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Speech */}
          <div>
            <h3 className={sectionTitle}>{t('voice')}</h3>
            <label className="flex items-center justify-between mb-2">
              <span className="text-primary text-lg">{t('speed')}</span>
              <span className="text-muted text-lg">{settings.speechRate.toFixed(1)}</span>
            </label>
            <input
              type="range" min="0.1" max="1" step="0.1" value={settings.speechRate}
              onChange={(e) => settings.update({ speechRate: parseFloat(e.target.value) })}
              className="w-full accent-[#4CAF50]"
            />
            <label className="flex items-center justify-between mb-2 mt-4">
              <span className="text-primary text-lg">{t('volume')}</span>
              <span className="text-muted text-lg">{Math.round(settings.speechVolume * 100)}%</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.1" value={settings.speechVolume}
              onChange={(e) => settings.update({ speechVolume: parseFloat(e.target.value) })}
              className="w-full accent-[#2196F3]"
            />

            {/* Voice picker — paid plans only. Free-tier users keep the
                speed/volume controls but don't see the voice list (server
                also enforces this with a 403 on /api/v1/tts/voices). */}
            {profile && profile.plan && profile.plan !== 'free' && (
              <div className="mt-5">
                <h4 className="text-muted font-semibold text-sm uppercase tracking-wider mb-2">
                  {t('voice_picker_title')}
                </h4>
                <p className="text-muted text-xs mb-3">{t('voice_picker_desc')}</p>
                <VoicePicker />
              </div>
            )}
          </div>

          {/* Custom Categories */}
          <div>
            <h3 className={sectionTitle}>{t('custom_categories')}</h3>
            <div className="flex gap-2 mb-2">
              <input value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} className="w-12 surface-key rounded-lg text-center text-xl p-2 border border-theme" maxLength={2} />
              <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder={t('category_name')} className="flex-1 surface-key rounded-lg px-3 py-2 border border-theme" />
              <button
                onClick={() => { if (newCatName.trim()) { addCustomCategory(newCatName.trim(), newCatIcon || '📌'); setNewCatName(''); } }}
                className="aac-btn bg-[#4CAF50] text-white px-5 py-3 rounded-lg font-semibold text-base hover:bg-[#388E3C]"
              >
                {t('add')}
              </button>
            </div>
            {customCategories.map((c) => (
              <div key={c.id} className="flex items-center justify-between surface-key rounded-lg px-3 py-2 mb-1 border border-theme">
                <span className="text-primary">{c.icon} {c.name}</span>
                <button onClick={() => removeCustomCategory(c.id)} className="text-[#F44336] text-sm hover:underline">{t('remove')}</button>
              </div>
            ))}
          </div>

          {/* Custom Phrases */}
          <div>
            <h3 className={sectionTitle}>{t('custom_phrases')}</h3>
            <div className="flex gap-2 mb-2">
              <select value={newPhraseCat} onChange={(e) => setNewPhraseCat(e.target.value)} className="surface-key rounded-lg px-2 py-2 text-sm border border-theme">
                <option value="">{t('category_select')}</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <input value={newPhraseText} onChange={(e) => setNewPhraseText(e.target.value)} placeholder={t('phrase_text')} className="flex-1 surface-key rounded-lg px-3 py-2 border border-theme" />
              <button
                onClick={() => { if (newPhraseText.trim() && newPhraseCat) { addCustomPhrase(newPhraseCat, newPhraseText.trim()); setNewPhraseText(''); setNewPhraseCat(''); } }}
                className="aac-btn bg-[#4CAF50] text-white px-5 py-3 rounded-lg font-semibold text-base hover:bg-[#388E3C]"
              >
                {t('add')}
              </button>
            </div>
            {customPhrases.map((p) => {
              const cat = cats.find((c) => c.id === p.categoryId);
              return (
                <div key={p.id} className="flex items-center justify-between surface-key rounded-lg px-3 py-2 mb-1 border border-theme">
                  <span className="text-primary"><span className="text-muted text-xs">{cat?.icon}</span> {p.text}</span>
                  <button onClick={() => removeCustomPhrase(p.id)} className="text-[#F44336] text-sm hover:underline">{t('remove')}</button>
                </div>
              );
            })}
          </div>

          {/* Export / Import — Copy/Paste to/from other apps */}
          <div>
            <h3 className={sectionTitle}>{t('export_import')}</h3>
            <p className="text-muted text-sm mb-3">{t('export_import_desc')}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  tapFeedback();
                  const data = {
                    version: 1,
                    categories: useCategoryStore.getState().customCategories,
                    phrases: useCategoryStore.getState().customPhrases.filter(p => !p.deletedAt),
                    hiddenCategories: useCategoryStore.getState().hiddenCategoryIds,
                    hiddenPhrases: useCategoryStore.getState().hiddenPhraseIds,
                    settings: { gridSize: settings.gridSize, activeVocabSet: settings.activeVocabSet },
                  };
                  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                }}
                className="aac-btn rounded-xl px-4 py-4 text-lg font-semibold border border-theme surface-key text-primary"
              >
                📋 {t('export_clipboard')}
              </button>
              <button
                onClick={async () => {
                  tapFeedback();
                  try {
                    const text = await navigator.clipboard.readText();
                    const data = JSON.parse(text);
                    if (data.version && data.categories) {
                      const store = useCategoryStore.getState();
                      for (const cat of data.categories || []) store.addCustomCategory(cat.name, cat.icon);
                      for (const phrase of data.phrases || []) store.addCustomPhrase(phrase.categoryId, phrase.text);
                    }
                  } catch { /* invalid clipboard data */ }
                }}
                className="aac-btn rounded-xl px-4 py-4 text-lg font-semibold border border-theme surface-key text-primary"
              >
                📥 {t('import_clipboard')}
              </button>
            </div>
          </div>

          {/* Synalux Account */}
          <div>
            <h3 className={sectionTitle}>{t('synalux_account')}</h3>
            {!profileLoaded || profileLoading ? (
              <p className="text-muted text-sm">{t('checking_sign_in')}</p>
            ) : profile ? (
              <div className="space-y-2">
                <div className="surface-key rounded-lg px-3 py-3 border border-theme">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted text-xs uppercase tracking-wider">{t('signed_in_as')}</span>
                    <span className="text-[#4CAF50] text-xs">● {t('active')}</span>
                  </div>
                  <p className="text-primary font-semibold text-sm break-all">{profile.email || profile.name}</p>
                </div>
                <div className="surface-key rounded-lg px-3 py-3 border border-theme">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted text-xs uppercase tracking-wider">{t('subscription')}</span>
                    {profile.isPlatformAdmin && <span className="text-[#FFD700] text-xs">★ {t('admin')}</span>}
                  </div>
                  <p className="text-primary font-semibold text-sm">{t(PLAN_LABEL_KEYS[profile.plan]) || profile.plan}</p>
                </div>
                <a href={synaluxSignOutUrl()} className="block text-center text-[#F44336] text-sm hover:underline pt-1">
                  {t('sign_out')}
                </a>
              </div>
            ) : (
              <div>
                <p className="text-muted text-sm mb-3">{t('sign_in_synalux_desc')}</p>
                <a
                  href={synaluxSignInUrl()}
                  data-testid="synalux-signin"
                  className="aac-btn block w-full text-center bg-[#4CAF50] text-white px-4 py-4 rounded-lg font-semibold hover:bg-[#388E3C] text-lg"
                >
                  {t('sign_in_with_synalux')}
                </a>
                <p className="text-dim text-xs mt-2">{t('core_aac_no_account')}</p>
              </div>
            )}
          </div>

          {/* Resources */}
          <div>
            <h3 className={sectionTitle}>{t('aac_resources')}</h3>
            <a href="https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/" target="_blank" rel="noopener" className="block text-[#2563eb] text-sm hover:underline mb-1">ASHA — AAC Practice Portal</a>
            <a href="https://aac-rerc.psu.edu/" target="_blank" rel="noopener" className="block text-[#2563eb] text-sm hover:underline mb-1">AAC-RERC — Research Center</a>
            <a href="https://praacticalaac.org/" target="_blank" rel="noopener" className="block text-[#2563eb] text-sm hover:underline mb-1">PrAACtical AAC — Implementation Resources</a>
          </div>
        </div>
      </div>
    </div>
  );
}
