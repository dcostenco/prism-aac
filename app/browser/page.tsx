'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { aacSpeak } from '@/services/aacSpeak';

const BOOKMARKS = [
  { label: 'Google', url: 'https://www.google.com/webhp?igu=1', icon: '🔍' },
  { label: 'YouTube', url: 'https://m.youtube.com', icon: '▶️' },
  { label: 'Wikipedia', url: 'https://en.m.wikipedia.org', icon: '📚' },
  { label: 'Gmail', url: 'https://mail.google.com', icon: '📧' },
  { label: 'News', url: 'https://news.google.com', icon: '📰' },
  { label: 'Maps', url: 'https://maps.google.com', icon: '🗺️' },
];

const QUICK_PHRASES = [
  { text: 'I want', icon: '👆' },
  { text: 'Help', icon: '🆘' },
  { text: 'Yes', icon: '✅' },
  { text: 'No', icon: '❌' },
  { text: 'More', icon: '➕' },
  { text: 'Stop', icon: '🛑' },
  { text: 'Thank you', icon: '🙏' },
  { text: 'Please', icon: '🤲' },
];

export default function BrowserPage() {
  const [url, setUrl] = useState('');
  const [displayUrl, setDisplayUrl] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [aacExpanded, setAacExpanded] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyStack = useRef<string[]>([]);
  const historyIdx = useRef(-1);
  const [canBack, setCanBack] = useState(false);
  const [canFwd, setCanFwd] = useState(false);

  const navigate = useCallback((rawUrl: string) => {
    let resolved = rawUrl.trim();
    if (!resolved) return;
    if (!resolved.startsWith('http://') && !resolved.startsWith('https://')) {
      if (resolved.includes('.') && !resolved.includes(' ')) {
        resolved = 'https://' + resolved;
      } else {
        resolved = `https://www.google.com/search?q=${encodeURIComponent(resolved)}&igu=1`;
      }
    }
    setUrl(resolved);
    setDisplayUrl(resolved.replace(/^https?:\/\/(www\.|m\.)?/, '').split('/')[0].split('?')[0]);
    setIsHome(false);
    setIsLoading(true);
    setInputValue('');

    const h = historyStack.current;
    historyStack.current = [...h.slice(0, historyIdx.current + 1), resolved];
    historyIdx.current = historyStack.current.length - 1;
    setCanBack(historyIdx.current > 0);
    setCanFwd(false);
  }, []);

  const goBack = () => {
    if (historyIdx.current > 0) {
      historyIdx.current--;
      const prev = historyStack.current[historyIdx.current];
      setUrl(prev);
      setDisplayUrl(prev.replace(/^https?:\/\/(www\.|m\.)?/, '').split('/')[0]);
      setCanBack(historyIdx.current > 0);
      setCanFwd(true);
    }
  };

  const goFwd = () => {
    if (historyIdx.current < historyStack.current.length - 1) {
      historyIdx.current++;
      const next = historyStack.current[historyIdx.current];
      setUrl(next);
      setDisplayUrl(next.replace(/^https?:\/\/(www\.|m\.)?/, '').split('/')[0]);
      setCanBack(true);
      setCanFwd(historyIdx.current < historyStack.current.length - 1);
    }
  };

  const goHome = () => {
    setIsHome(true);
    setUrl('');
    setDisplayUrl('');
    setInputValue('');
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim()) navigate(inputValue);
  };

  const speak = (text: string) => {
    setSpokenText((prev) => (prev ? prev + ' ' + text : text));
    aacSpeak(text, 1, 1);
  };

  return (
    <div style={{ height: '100svh', display: 'flex', flexDirection: 'column', background: '#0f1117', color: '#e2e8f0', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* ═══ BROWSER TOOLBAR ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px 6px', background: '#1a1d2e', borderBottom: '1px solid #2a2d3e', flexShrink: 0 }}>
        <NavBtn onClick={goBack} disabled={!canBack} label="Back">←</NavBtn>
        <NavBtn onClick={goFwd} disabled={!canFwd} label="Forward">→</NavBtn>
        <NavBtn onClick={() => isHome ? null : setIsLoading(true)} label="Refresh">↻</NavBtn>
        <NavBtn onClick={goHome} label="Home">🏠</NavBtn>

        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', gap: 4 }}>
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={displayUrl || 'Search or enter URL'}
            style={{
              flex: 1, height: 44, borderRadius: 10,
              border: '2px solid #3a3d5e', background: '#141627',
              color: '#e2e8f0', fontSize: 15, padding: '0 12px',
              outline: 'none',
            }}
            onFocus={() => { if (displayUrl && !inputValue) setInputValue(displayUrl); }}
          />
          <button type="submit" style={{ width: 52, height: 44, borderRadius: 10, border: 'none', background: '#22c55e', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            Go
          </button>
        </form>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#fff' }}>
        {isHome ? (
          <HomePage bookmarks={BOOKMARKS} onNavigate={navigate} onSearch={(q) => { setInputValue(q); inputRef.current?.focus(); }} />
        ) : (
          <>
            {isLoading && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #3b82f6 0%, #22c55e 50%, #3b82f6 100%)', backgroundSize: '200% 100%', animation: 'loading-bar 1s linear infinite', zIndex: 10 }} />
            )}
            <iframe
              ref={iframeRef}
              src={url}
              title="Web content"
              onLoad={() => setIsLoading(false)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </>
        )}
      </div>

      {/* ═══ AAC BAR ═══ */}
      <div style={{ background: '#1a1d2e', borderTop: '1px solid #2a2d3e', flexShrink: 0 }}>
        {/* Spoken text display */}
        {spokenText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#141627', borderBottom: '1px solid #2a2d3e' }}>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{spokenText}</span>
            <button onClick={() => aacSpeak(spokenText, 1, 1)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              🔊 Speak
            </button>
            <button onClick={() => setSpokenText('')} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        )}

        {/* Quick phrases */}
        <div style={{ display: 'flex', gap: 4, padding: '6px 8px', overflowX: 'auto' }}>
          {QUICK_PHRASES.map((p) => (
            <button
              key={p.text}
              onClick={() => speak(p.text)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 14px', borderRadius: 10,
                border: '1px solid #3a3d5e', background: '#252840',
                color: '#e2e8f0', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 40,
              }}
            >
              <span style={{ fontSize: 18 }}>{p.icon}</span>
              {p.text}
            </button>
          ))}
          <button
            onClick={() => setAacExpanded(!aacExpanded)}
            style={{
              padding: '8px 14px', borderRadius: 10,
              border: '1px solid #6366f1', background: '#312e81',
              color: '#a5b4fc', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 40,
            }}
          >
            {aacExpanded ? '▼ Less' : '▲ More AAC'}
          </button>
        </div>

        {/* Expanded AAC keyboard */}
        {aacExpanded && (
          <div style={{ padding: '6px 8px 10px', borderTop: '1px solid #2a2d3e' }}>
            <AACKeyboard
              onType={(char) => setSpokenText((p) => p + char)}
              onBackspace={() => setSpokenText((p) => p.slice(0, -1))}
              onSpeak={() => { if (spokenText) aacSpeak(spokenText, 1, 1); }}
              onClear={() => setSpokenText('')}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes loading-bar {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ── Nav button ──
function NavBtn({ onClick, disabled, label, children }: { onClick: () => void; disabled?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 44, height: 44, borderRadius: 10, border: 'none',
        background: disabled ? '#1e2030' : '#252840',
        color: disabled ? '#4a4d6e' : '#e2e8f0',
        fontSize: 20, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ── Home page ──
function HomePage({ bookmarks, onNavigate, onSearch }: { bookmarks: typeof BOOKMARKS; onNavigate: (url: string) => void; onSearch: (q: string) => void }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #0f1117 0%, #1a1d2e 100%)', padding: 24, gap: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🌐</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e2e8f0', margin: '0 0 4px' }}>Prism AAC Browser</h1>
        <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>Browse the web with AAC support</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', maxWidth: 400 }}>
        {bookmarks.map((b) => (
          <button
            key={b.url}
            onClick={() => onNavigate(b.url)}
            aria-label={b.label}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: 16, borderRadius: 14,
              border: '1px solid #2a2d3e', background: '#1e2030',
              color: '#e2e8f0', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', minHeight: 80,
            }}
          >
            <span style={{ fontSize: 32 }}>{b.icon}</span>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Compact AAC keyboard ──
function AACKeyboard({ onType, onBackspace, onSpeak, onClear }: { onType: (c: string) => void; onBackspace: () => void; onSpeak: () => void; onClear: () => void }) {
  const rows = [
    'qwertyuiop'.split(''),
    'asdfghjkl'.split(''),
    'zxcvbnm'.split(''),
  ];
  const btnStyle: React.CSSProperties = {
    flex: 1, height: 42, borderRadius: 6, border: 'none',
    background: '#2a2d45', color: '#e2e8f0', fontSize: 18,
    fontWeight: 600, cursor: 'pointer', minWidth: 0,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 3, paddingLeft: i === 2 ? 20 : 0, paddingRight: i === 2 ? 20 : 0 }}>
          {row.map((c) => (
            <button key={c} onClick={() => onType(c)} style={btnStyle}>{c}</button>
          ))}
          {i === 2 && <button onClick={onBackspace} style={{ ...btnStyle, flex: 1.5, background: '#3a2020' }}>⌫</button>}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 3 }}>
        <button onClick={() => onType(' ')} style={{ ...btnStyle, flex: 4 }}>space</button>
        <button onClick={() => onType('.')} style={{ ...btnStyle, flex: 0.8 }}>.</button>
        <button onClick={onSpeak} style={{ ...btnStyle, flex: 2, background: '#22c55e', color: '#fff', fontWeight: 800 }}>Speak</button>
      </div>
    </div>
  );
}
