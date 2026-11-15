import React from 'react';
import { WifiOff } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { t } from '../utils/i18n';

export const OfflineSyncBanner: React.FC = () => {
  const { data, isOnline } = useFinance();
  const { language } = data.settings;

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/95 dark:bg-amber-600/95 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-xs">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>{t('offlineBannerSavedLocally', language)}</span>
    </div>
  );
};
