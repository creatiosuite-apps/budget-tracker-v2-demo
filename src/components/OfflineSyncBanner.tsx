import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { isValidGoogleScriptUrl } from '../services/googleSheetsSync';
import { t } from '../utils/i18n';

export const OfflineSyncBanner: React.FC = () => {
  const {
    data,
    isOnline,
    syncPending,
    pendingChangesCount,
    syncStatus,
    flushOfflineQueue,
  } = useFinance();

  const { language } = data.settings;
  const hasSheetsUrl = isValidGoogleScriptUrl(data.settings.googleScriptUrl);

  if (isOnline && !(hasSheetsUrl && syncPending && pendingChangesCount > 0)) {
    return null;
  }

  const changeWord = t(
    pendingChangesCount === 1 ? 'changeSingular' : 'changePlural',
    language
  );

  if (!isOnline) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/95 dark:bg-amber-600/95 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-xs">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>
          {t('offlineBannerSavedLocally', language)}
          {hasSheetsUrl && pendingChangesCount > 0
            ? ` ${t('queuedForSheetsSuffix', language, {
                count: pendingChangesCount,
              })}`
            : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 px-3 py-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100 shadow-lg backdrop-blur-xs">
      <RefreshCw
        className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ${
          syncStatus === 'syncing' ? 'animate-spin' : ''
        }`}
      />
      <span>
        {syncStatus === 'syncing'
          ? t('syncingQueuedChanges', language, {
              count: pendingChangesCount,
              word: changeWord,
            })
          : t('changesQueuedBanner', language, {
              count: pendingChangesCount,
              word: changeWord,
            })}
      </span>
      {syncStatus !== 'syncing' && (
        <button
          type="button"
          onClick={() => void flushOfflineQueue()}
          className="ml-1 underline underline-offset-2 text-emerald-600 dark:text-emerald-400 hover:opacity-80"
        >
          {t('syncNowShort', language)}
        </button>
      )}
    </div>
  );
};
