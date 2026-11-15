import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { t } from '../utils/i18n';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({
  compact = false,
}) => {
  const { data } = useFinance();
  const { language } = data.settings;
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        title={t('installOfflineTitle', language)}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap'
            : 'w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>
          {compact ? t('installCompact', language) : t('installOfflineApp', language)}
        </span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title={t('installIOSTitle', language)}
          className={
            compact
              ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap'
              : 'w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors'
          }
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>
            {compact ? t('installCompact', language) : t('installOnIOS', language)}
          </span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4">
            <div className="w-full max-w-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('installIOSHeading', language)}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                  aria-label={t('close', language)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {t('installIOSLine1', language)}
                <br />
                {t('installIOSLine2', language)}
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-lg bg-neutral-900 dark:bg-neutral-100 py-2 text-xs font-medium text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
              >
                {t('gotIt', language)}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
