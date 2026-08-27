'use client';

import { ComputedStatus } from '@/lib/database.types';
import { STATUS_COLORS } from '@/lib/status';
import { useTranslation } from './i18n/LanguageProvider';

export function StatusBadge({ status }: { status: ComputedStatus }) {
  const { t } = useTranslation();
  const colors = STATUS_COLORS[status];
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
      {t(`status.${status}`)}
    </span>
  );
}
