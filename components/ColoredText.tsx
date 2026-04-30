'use client';
import { classifyPhrase } from '@/engine/colorCoding';

interface Props {
  text: string;
  className?: string;
}

export default function ColoredText({ text, className = '' }: Props) {
  if (!text) return null;
  const tokens = classifyPhrase(text);

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
