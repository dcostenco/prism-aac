'use client';
import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useCategoryStore } from '@/store/categoryStore';
import { useAuthStore } from '@/store/authStore';
import { synaluxSignInUrl, synaluxSignOutUrl, SynaluxProfile } from '@/services/aiService';
import { LANG_META, SupportedLanguage } from '@/engine/i18n';
import { useT } from '@/engine/useT';

const PLAN_LABEL: Record<SynaluxProfile['plan'], string> = {
  free: 'Free',
  standard: 'Standard ($19/mo)',
  advanced: 'Advanced ($49/mo)',
  enterprise: 'Enterprise ($99/mo)',
};

export default function SettingsModal() {
  const { showSettings, toggleSettings } = useUIStore();
  const settings = useSettingsStore();
  const { t } = useT();
  const { customCategories, customPhrases, addCustomCategory, removeCustomCategory, addCustomPhrase, removeCustomPhrase, allCategories } = useCategoryStore();
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📌');
  const [newPhraseText, setNewPhraseText] = useState('');
  const [newPhraseCat, setNewPhraseCat] = useState('');
  const profile = useAuthStore((s) => s.profile);
  const profileLoaded = useAuthStore((s) => s.loaded);
  const profileLoading = useAuthStore((s) => s.loading);
  const refreshProfile = useAuthStore((s) => s.refresh);

  useEffect(() => {
    if (showSettings) refreshProfile();
  }, [showSettings, refreshProfile]);

  if (!showSettings) return null;

  const cats = allCategories();

  const sectionTitle = 'text-muted font-semibold text-base uppercase tracking-wider mb-3';

  return (
    <div role="dialog" aria-modal="true" className="modal-backdrop fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={toggleSettings}>
      <div className="surface-bar rounded-2xl w-full max-w-lg max-h-[85svh] flex flex-col border border-theme shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-theme">
          <h2 className="text-primary font-bold text-lg">{t('settings')}</h2>
          <button onClick={toggleSettings} aria-label="Close settings" className="text-muted hover:text-primary text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Theme */}
          <div>
            <h3 className={sectionTitle}>Theme</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => settings.setTheme('light')}
                aria-pressed={settings.theme === 'light'}
                className={`aac-btn rounded-xl px-4 py-4 text-lg font-semibold border border-theme ${
                  settings.theme === 'light' ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                }`}
              >
                ☀ Light
              </button>
              <button
                onClick={() => settings.setTheme('dark')}
                aria-pressed={settings.theme === 'dark'}
                className={`aac-btn rounded-xl px-4 py-4 text-lg font-semibold border border-theme ${
                  settings.theme === 'dark' ? 'bg-[#4CAF50] text-white border-transparent' : 'surface-key text-primary'
                }`}
              >
                🌙 Dark
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
          </div>

          {/* Speech */}
          <div>
            <h3 className={sectionTitle}>{t('voice')}</h3>
            <label className="flex items-center justify-between mb-2">
              <span className="text-primary text-lg">Speed</span>
              <span className="text-muted text-lg">{settings.speechRate.toFixed(1)}</span>
            </label>
            <input
              type="range" min="0.1" max="1" step="0.1" value={settings.speechRate}
              onChange={(e) => settings.update({ speechRate: parseFloat(e.target.value) })}
              className="w-full accent-[#4CAF50]"
            />
            <label className="flex items-center justify-between mb-2 mt-4">
              <span className="text-primary text-lg">Volume</span>
              <span className="text-muted text-lg">{Math.round(settings.speechVolume * 100)}%</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.1" value={settings.speechVolume}
              onChange={(e) => settings.update({ speechVolume: parseFloat(e.target.value) })}
              className="w-full accent-[#2196F3]"
            />
          </div>

          {/* Custom Categories */}
          <div>
            <h3 className={sectionTitle}>Custom Categories</h3>
            <div className="flex gap-2 mb-2">
              <input value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} className="w-12 surface-key rounded-lg text-center text-xl p-2 border border-theme" maxLength={2} />
              <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Category name" className="flex-1 surface-key rounded-lg px-3 py-2 border border-theme" />
              <button
                onClick={() => { if (newCatName.trim()) { addCustomCategory(newCatName.trim(), newCatIcon || '📌'); setNewCatName(''); } }}
                className="aac-btn bg-[#4CAF50] text-white px-5 py-3 rounded-lg font-semibold text-base hover:bg-[#388E3C]"
              >
                Add
              </button>
            </div>
            {customCategories.map((c) => (
              <div key={c.id} className="flex items-center justify-between surface-key rounded-lg px-3 py-2 mb-1 border border-theme">
                <span className="text-primary">{c.icon} {c.name}</span>
                <button onClick={() => removeCustomCategory(c.id)} className="text-[#F44336] text-sm hover:underline">Remove</button>
              </div>
            ))}
          </div>

          {/* Custom Phrases */}
          <div>
            <h3 className={sectionTitle}>Custom Phrases</h3>
            <div className="flex gap-2 mb-2">
              <select value={newPhraseCat} onChange={(e) => setNewPhraseCat(e.target.value)} className="surface-key rounded-lg px-2 py-2 text-sm border border-theme">
                <option value="">Category…</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <input value={newPhraseText} onChange={(e) => setNewPhraseText(e.target.value)} placeholder="Phrase text" className="flex-1 surface-key rounded-lg px-3 py-2 border border-theme" />
              <button
                onClick={() => { if (newPhraseText.trim() && newPhraseCat) { addCustomPhrase(newPhraseCat, newPhraseText.trim()); setNewPhraseText(''); setNewPhraseCat(''); } }}
                className="aac-btn bg-[#4CAF50] text-white px-5 py-3 rounded-lg font-semibold text-base hover:bg-[#388E3C]"
              >
                Add
              </button>
            </div>
            {customPhrases.map((p) => {
              const cat = cats.find((c) => c.id === p.categoryId);
              return (
                <div key={p.id} className="flex items-center justify-between surface-key rounded-lg px-3 py-2 mb-1 border border-theme">
                  <span className="text-primary"><span className="text-muted text-xs">{cat?.icon}</span> {p.text}</span>
                  <button onClick={() => removeCustomPhrase(p.id)} className="text-[#F44336] text-sm hover:underline">Remove</button>
                </div>
              );
            })}
          </div>

          {/* Synalux Account */}
          <div>
            <h3 className={sectionTitle}>Synalux Account</h3>
            {!profileLoaded || profileLoading ? (
              <p className="text-muted text-sm">Checking sign-in status…</p>
            ) : profile ? (
              <div className="space-y-2">
                <div className="surface-key rounded-lg px-3 py-3 border border-theme">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted text-xs uppercase tracking-wider">Signed in as</span>
                    <span className="text-[#4CAF50] text-xs">● Active</span>
                  </div>
                  <p className="text-primary font-semibold text-sm break-all">{profile.email || profile.name}</p>
                </div>
                <div className="surface-key rounded-lg px-3 py-3 border border-theme">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted text-xs uppercase tracking-wider">Subscription</span>
                    {profile.isPlatformAdmin && <span className="text-[#FFD700] text-xs">★ Admin</span>}
                  </div>
                  <p className="text-primary font-semibold text-sm">{PLAN_LABEL[profile.plan] || profile.plan}</p>
                </div>
                <a href={synaluxSignOutUrl()} className="block text-center text-[#F44336] text-sm hover:underline pt-1">
                  Sign out
                </a>
              </div>
            ) : (
              <div>
                <p className="text-muted text-sm mb-3">Sign in with your Synalux account to enable AI Chat, web search, and all platform modules.</p>
                <a
                  href={synaluxSignInUrl()}
                  data-testid="synalux-signin"
                  className="aac-btn block w-full text-center bg-[#4CAF50] text-white px-4 py-4 rounded-lg font-semibold hover:bg-[#388E3C] text-lg"
                >
                  Sign in with Synalux
                </a>
                <p className="text-dim text-xs mt-2">Core AAC features (keyboard, categories, prediction, emergency) work without an account.</p>
              </div>
            )}
          </div>

          {/* Resources */}
          <div>
            <h3 className={sectionTitle}>AAC Resources</h3>
            <a href="https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/" target="_blank" rel="noopener" className="block text-[#2563eb] text-sm hover:underline mb-1">ASHA — AAC Practice Portal</a>
            <a href="https://aac-rerc.psu.edu/" target="_blank" rel="noopener" className="block text-[#2563eb] text-sm hover:underline mb-1">AAC-RERC — Research Center</a>
            <a href="https://praacticalaac.org/" target="_blank" rel="noopener" className="block text-[#2563eb] text-sm hover:underline mb-1">PrAACtical AAC — Implementation Resources</a>
          </div>
        </div>
      </div>
    </div>
  );
}
