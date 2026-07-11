'use client';

import { useEffect, useState } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { useBrowserStore } from './browserStore';
import { tapFeedback } from '@/services/feedback';

export default function BrowserPredictionBar() {
  const text = useMessageStore((s) => s.text);
  const navigate = useBrowserStore((s) => s.navigate);
  const getSiteSuggestions = useBrowserStore((s) => s.getSiteSuggestions);
  const clearAll = useMessageStore((s) => s.clearAll);
  const [suggestions, setSuggestions] = useState(getSiteSuggestions(''));

  useEffect(() => {
    setSuggestions(getSiteSuggestions(text));
  }, [text, getSiteSuggestions]);

  const handleTap = (url: string) => {
    tapFeedback();
    navigate(url);
    clearAll();
  };

  return (
    <div
      data-testid="browser-prediction-bar"
      className="flex items-stretch gap-[2px] px-1 py-[2px] shrink-0"
      style={{ height: 'clamp(56px, 10svh, 88px)' }}
    >
      {suggestions.map((s, i) => (
        <button
          key={`${s.url}-${i}`}
          onClick={() => handleTap(s.url)}
          aria-label={`Go to ${s.title}`}
          className="aac-btn flex-1 min-w-0 surface-key rounded-xl flex flex-col items-center justify-center py-1 px-1 border border-theme overflow-hidden gap-0.5"
        >
          <span className="text-lg leading-none">{s.icon}</span>
          <span className="truncate w-full text-center text-[clamp(0.7rem,1.8vw,1rem)] font-bold shrink-0 leading-tight text-primary">
            {s.title}
          </span>
        </button>
      ))}
      {Array.from({ length: Math.max(0, 5 - suggestions.length) }).map((_, i) => (
        <div key={`pad-${i}`} className="flex-1 min-w-0" />
      ))}
    </div>
  );
}
