'use client';
import { classifyPhrase } from '@/engine/colorCoding';
import { useSettingsStore } from '@/store/settingsStore';

interface Props {
  text: string;
  className?: string;
}

export default function ColoredText({ text, className = '' }: Props) {
  const lang = useSettingsStore((s) => s.language);
  if (!text) return null;
  const tokens = classifyPhrase(text, lang);

  return (
    <span className={className}>
      {tokens.map((t, i) => (
        <span key={i} style={{ color: t.color !== 'transparent' ? t.color : undefined }}>
          {t.word}
        </span>
      ))}
    </span>
  );
}
