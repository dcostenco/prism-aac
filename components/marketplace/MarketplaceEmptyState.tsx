'use client';
import { useT } from '@/engine/useT';

type Variant = 'no-results' | 'loading' | 'error' | 'no-installed';

interface Props {
  variant: Variant;
  message?: string;
}

const ICON: Record<Variant, string> = {
  'no-results': '🔍',
  loading: '⏳',
  error: '⚠️',
  'no-installed': '📦',
};

const LABEL: Record<Variant, string> = {
  'no-results': 'mp_no_results',
  loading: 'loading',
  error: 'error',
  'no-installed': 'mp_no_installed',
};

export default function MarketplaceEmptyState({ variant, message }: Props) {
  const { t } = useT();
  return (
    <div
      data-testid={`mp-empty-${variant}`}
      role="status"
      className="flex flex-col items-center justify-center py-12 px-4 text-center gap-2"
    >
      <span className="text-5xl" aria-hidden="true">
        {ICON[variant]}
      </span>
      <p className="text-primary font-bold">{t(LABEL[variant])}</p>
      {message && <p className="text-muted text-sm">{message}</p>}
    </div>
  );
}
