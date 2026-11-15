import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  CurrencyCode,
  LanguageCode,
  SavingsHistoryEntry,
} from '../types/finance';
import {
  DebtSimulationMonth,
  formatCompactCurrency,
  formatCurrency,
} from '../utils/formatters';
import { t } from '../utils/i18n';

interface CashflowPoint {
  label: string;
  shortLabel?: string;
  income: number;
  expense: number;
  net: number;
}

export const AnimatedCashflowChart: React.FC<{
  points: CashflowPoint[];
  currency: CurrencyCode;
  language?: LanguageCode;
}> = ({ points, currency, language = 'en' }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const safeHoveredIdx =
    hoveredIdx !== null && hoveredIdx < points.length ? hoveredIdx : null;

  const maxVal = Math.max(
    100,
    ...points.map((p) => Math.max(p.income, p.expense))
  );

  const barGroupWidthClass =
    points.length <= 2
      ? 'max-w-[56px] sm:max-w-[72px]'
      : points.length <= 4
      ? 'max-w-[38px] sm:max-w-[52px]'
      : 'max-w-[26px] sm:max-w-[38px]';

  return (
    <div className="relative w-full">
      {/* Legend & Hover Readout */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-300 inline-block" />
            <span>{t('chartIncome', language)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-t from-slate-900 via-indigo-600 to-sky-400 dark:from-indigo-500 dark:via-sky-400 dark:to-cyan-200 inline-block" />
            <span>{t('chartExpenses', language)}</span>
          </span>
        </div>

        {safeHoveredIdx !== null && points[safeHoveredIdx] ? (
          <div className="flex items-center gap-2.5 text-xs tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
            <span>{points[safeHoveredIdx].label}</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              {t('chartInPrefix', language)}:{' '}
              {formatCurrency(points[safeHoveredIdx].income, currency)}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t('chartOutPrefix', language)}:{' '}
              {formatCurrency(points[safeHoveredIdx].expense, currency)}
            </span>
          </div>
        ) : (
          <div className="text-xs text-neutral-400 dark:text-neutral-500">
            <span className="sm:hidden">{t('chartTapBars', language)}</span>
            <span className="hidden sm:inline">
              {t('chartHoverBars', language)}
            </span>
          </div>
        )}
      </div>

      {/* Bar Grid + Right Axis Gutter */}
      <div className="relative">
        <div className="h-44 sm:h-48 flex items-end justify-between gap-2 sm:gap-3 pt-4 pr-10 sm:pr-12 border-b border-neutral-200 dark:border-neutral-800 relative">
          {/* Subtle horizontal reference lines */}
          <div className="absolute inset-x-0 top-4 border-t border-dashed border-neutral-200/70 dark:border-neutral-800/70 pointer-events-none flex justify-end">
            <span className="text-[10px] text-neutral-400 -mt-2.5 bg-white dark:bg-neutral-900 pl-1 tabular-nums">
              {formatCompactCurrency(maxVal, currency)}
            </span>
          </div>
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-200/70 dark:border-neutral-800/70 pointer-events-none flex justify-end">
            <span className="text-[10px] text-neutral-400 -mt-2.5 bg-white dark:bg-neutral-900 pl-1 tabular-nums">
              {formatCompactCurrency(maxVal / 2, currency)}
            </span>
          </div>

          {points.map((pt, idx) => {
            const incPct = Math.min(100, Math.max(3, (pt.income / maxVal) * 100));
            const expPct = Math.min(100, Math.max(3, (pt.expense / maxVal) * 100));
            const isHovered = safeHoveredIdx === idx;

            return (
              <div
                key={pt.label}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() =>
                  setHoveredIdx((prev) => (prev === idx ? null : idx))
                }
                className="flex-1 h-full flex items-end justify-center cursor-pointer relative z-10"
              >
                <div
                  className={`w-full ${barGroupWidthClass} h-full flex items-end justify-center gap-0.5 sm:gap-1`}
                >
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      duration: 0.45,
                      delay: idx * 0.04,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{
                      height: `${pt.income > 0 ? incPct : 3}%`,
                      transformOrigin: 'bottom',
                    }}
                    className={`flex-1 rounded-t-sm transition-opacity ${
                      pt.income > 0
                        ? 'bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-300 dark:from-emerald-600 dark:via-emerald-500 dark:to-teal-300'
                        : 'bg-neutral-200 dark:bg-neutral-800'
                    } ${
                      safeHoveredIdx !== null && !isHovered
                        ? 'opacity-45'
                        : 'opacity-100'
                    }`}
                  />
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      duration: 0.45,
                      delay: idx * 0.04 + 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{
                      height: `${pt.expense > 0 ? expPct : 3}%`,
                      transformOrigin: 'bottom',
                    }}
                    className={`flex-1 rounded-t-sm transition-opacity ${
                      pt.expense > 0
                        ? 'bg-gradient-to-t from-slate-900 via-indigo-600 to-sky-400 dark:from-indigo-500 dark:via-sky-400 dark:to-cyan-200'
                        : 'bg-neutral-200 dark:bg-neutral-800'
                    } ${
                      safeHoveredIdx !== null && !isHovered
                        ? 'opacity-45'
                        : 'opacity-100'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Dedicated Non-Overlapping X-Axis Labels Row */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 pr-10 sm:pr-12 pt-2">
          {points.map((pt, idx) => {
            const isHovered = safeHoveredIdx === idx;
            const compactLabel = pt.shortLabel ?? pt.label;
            return (
              <button
                key={pt.label}
                type="button"
                onClick={() =>
                  setHoveredIdx((prev) => (prev === idx ? null : idx))
                }
                className={`flex-1 text-center text-[10px] sm:text-[11px] tabular-nums whitespace-nowrap transition-colors ${
                  isHovered
                    ? 'text-neutral-900 dark:text-white font-semibold'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                <span className="sm:hidden">{compactLabel}</span>
                <span className="hidden sm:inline">{pt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * Interactive Gradient Sparkline for Saving Goals historical log.
 */
export const GoalGradientSparkline: React.FC<{
  history: SavingsHistoryEntry[];
  color: string;
  currency: CurrencyCode;
  height?: number;
  language?: LanguageCode;
}> = ({ history, color, currency, height = 180, language = 'en' }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const points =
    sorted.length > 1
      ? sorted
      : sorted.length === 1
      ? [
          {
            id: 'origin',
            date: t('chartStart', language),
            amount: 0,
            balanceAfter: 0,
            note: t('chartInitial', language),
            type: 'deposit' as const,
          },
          sorted[0],
        ]
      : [
          {
            id: 'p0',
            date: t('chartStart', language),
            amount: 0,
            balanceAfter: 0,
            note: t('chartNoEntries', language),
            type: 'deposit' as const,
          },
          {
            id: 'p1',
            date: t('chartNow', language),
            amount: 0,
            balanceAfter: 0,
            note: t('chartNoEntries', language),
            type: 'deposit' as const,
          },
        ];

  const width = 640;
  const padX = 24;
  const padY = 24;
  const balances = points.map((p) => p.balanceAfter);
  const minVal = Math.min(0, ...balances);
  const maxVal = Math.max(100, ...balances);
  const range = Math.max(1, maxVal - minVal);

  const coords = points.map((pt, i) => {
    const x =
      padX + (i / Math.max(1, points.length - 1)) * (width - padX * 2);
    const y =
      height -
      padY -
      ((pt.balanceAfter - minVal) / range) * (height - padY * 2);
    return { x, y, pt };
  });

  // Build smooth SVG path
  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(
    1
  )} ${(height - padY).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(
    height - padY
  ).toFixed(1)} Z`;

  const gradId = `spark-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  const activePoint =
    hoverIndex !== null && coords[hoverIndex]
      ? coords[hoverIndex]
      : coords[coords.length - 1];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 text-xs">
        <div className="text-neutral-500 dark:text-neutral-400">
          <span>{activePoint.pt.date}</span>
          <span className="mx-1.5" aria-hidden="true">
            ·
          </span>
          <span>{activePoint.pt.note}</span>
        </div>
        <div className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
          {t('chartBalancePrefix', language)}:{' '}
          {formatCurrency(activePoint.pt.balanceAfter, currency)}
          {activePoint.pt.amount > 0 && (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400">
              ({activePoint.pt.type === 'deposit' ? '+' : '-'}
              {formatCurrency(activePoint.pt.amount, currency)})
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/50 p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.38" />
              <stop offset="75%" stopColor={color} stopOpacity="0.06" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal baseline grid */}
          <line
            x1={padX}
            y1={height - padY}
            x2={width - padX}
            y2={height - padY}
            stroke="currentColor"
            className="text-neutral-200 dark:text-neutral-800"
            strokeDasharray="3 3"
          />
          <line
            x1={padX}
            y1={padY}
            x2={width - padX}
            y2={padY}
            stroke="currentColor"
            className="text-neutral-200 dark:text-neutral-800"
            strokeDasharray="3 3"
          />

          {/* Gradient Area */}
          <motion.path
            d={areaPath}
            fill={`url(#${gradId})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />

          {/* Animated Stroke */}
          <motion.path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />

          {/* Data Nodes */}
          {coords.map((c, idx) => {
            const isSelected =
              hoverIndex === idx ||
              (hoverIndex === null && idx === coords.length - 1);
            return (
              <g
                key={c.pt.id + idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <rect
                  x={c.x - 18}
                  y={0}
                  width={36}
                  height={height}
                  fill="transparent"
                />
                {isSelected && (
                  <line
                    x1={c.x}
                    y1={padY}
                    x2={c.x}
                    y2={height - padY}
                    stroke={color}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.6"
                  />
                )}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 5.5 : 3.5}
                  fill={isSelected ? color : '#ffffff'}
                  stroke={color}
                  strokeWidth="2"
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

/**
 * Animated Debt Payoff Trajectory Chart (Baseline vs Snowball/Avalanche Strategy)
 */
export const DebtPayoffTrajectoryChart: React.FC<{
  schedule: DebtSimulationMonth[];
  currency: CurrencyCode;
  strategyName: string;
  language?: LanguageCode;
}> = ({ schedule, currency, strategyName, language = 'en' }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (schedule.length <= 1) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-neutral-500">
        {t('chartNoDebtData', language)}
      </div>
    );
  }

  // Sample up to 36 points so SVG stays crisp and fast
  const step = Math.max(1, Math.floor(schedule.length / 30));
  const sampled = schedule.filter(
    (_, idx) => idx === 0 || idx === schedule.length - 1 || idx % step === 0
  );

  const width = 720;
  const height = 230;
  const padX = 36;
  const padY = 24;

  const maxBal = Math.max(
    100,
    ...sampled.map((s) =>
      Math.max(s.totalRemainingBaseline, s.totalRemainingStrategy)
    )
  );

  const coords = sampled.map((item, idx) => {
    const x =
      padX + (idx / Math.max(1, sampled.length - 1)) * (width - padX * 2);
    const yBase =
      height -
      padY -
      (item.totalRemainingBaseline / maxBal) * (height - padY * 2);
    const yStrat =
      height -
      padY -
      (item.totalRemainingStrategy / maxBal) * (height - padY * 2);
    return { x, yBase, yStrat, item };
  });

  const baseLine = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yBase.toFixed(1)}`)
    .join(' ');
  const stratLine = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yStrat.toFixed(1)}`)
    .join(' ');
  const stratArea = `${stratLine} L ${coords[coords.length - 1].x.toFixed(
    1
  )} ${(height - padY).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(
    height - padY
  ).toFixed(1)} Z`;

  const active =
    hoverIdx !== null && coords[hoverIdx]
      ? coords[hoverIdx]
      : coords[Math.min(coords.length - 1, Math.floor(coords.length / 3))];

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3 text-xs">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-medium">
            <span className="w-3 h-0.5 bg-emerald-600 dark:bg-emerald-400 inline-block" />
            <span>{t('chartStrategyPlan', language, { strategy: strategyName })}</span>
          </span>
          <span className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
            <span className="w-3 h-0.5 bg-neutral-400 border-b border-dashed inline-block" />
            <span>{t('chartMinBaseline', language)}</span>
          </span>
        </div>

        {active && (
          <div className="flex items-center gap-3 tabular-nums text-xs">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {active.item.label}{' '}
              {t('chartMonthParen', language, { month: active.item.monthIndex })}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {strategyName}:{' '}
              {formatCurrency(active.item.totalRemainingStrategy, currency, {
                maximumFractionDigits: 0,
              })}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-neutral-500">
              {t('chartBaselinePrefix', language)}:{' '}
              {formatCurrency(active.item.totalRemainingBaseline, currency, {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        )}
      </div>

      <div className="relative w-full overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/40 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <defs>
            <linearGradient id="debtStratGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <line
            x1={padX}
            y1={height - padY}
            x2={width - padX}
            y2={height - padY}
            stroke="currentColor"
            className="text-neutral-200 dark:text-neutral-800"
          />

          {/* Baseline curve */}
          <path
            d={baseLine}
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="2"
            strokeDasharray="5 4"
          />

          {/* Strategy area & curve */}
          <motion.path
            key={`area-${strategyName}-${schedule.length}`}
            d={stratArea}
            fill="url(#debtStratGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
          <motion.path
            key={`line-${strategyName}-${schedule.length}`}
            d={stratLine}
            fill="none"
            stroke="#059669"
            strokeWidth="2.75"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          />

          {/* Hover Scrub Columns */}
          {coords.map((c, idx) => {
            const isHovered = hoverIdx === idx;
            return (
              <g
                key={c.item.monthIndex}
                className="cursor-pointer"
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <rect
                  x={c.x - width / sampled.length / 2}
                  y={0}
                  width={width / sampled.length}
                  height={height}
                  fill="transparent"
                />
                {isHovered && (
                  <>
                    <line
                      x1={c.x}
                      y1={padY}
                      x2={c.x}
                      y2={height - padY}
                      stroke="#059669"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={c.x}
                      cy={c.yBase}
                      r={4}
                      fill="#9CA3AF"
                      stroke="#fff"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={c.x}
                      cy={c.yStrat}
                      r={5}
                      fill="#059669"
                      stroke="#fff"
                      strokeWidth="2"
                    />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

/**
 * Compact animated gradient sparkline for dashboard KPI cards.
 */
export const MiniGradientSparkline: React.FC<{
  points: { label: string; value: number }[];
  color: string;
  gradientId: string;
  formatValue?: (v: number) => string;
  caption?: string;
  language?: LanguageCode;
}> = ({ points, color, gradientId, formatValue, caption, language = 'en' }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const resolvedCaption = caption ?? t('chartDefaultTrend', language);

  const safePoints =
    points.length >= 2
      ? points
      : points.length === 1
      ? [points[0], points[0]]
      : [
          { label: t('chartStart', language), value: 0 },
          { label: t('chartNow', language), value: 0 },
        ];

  const width = 240;
  const height = 56;
  const padX = 4;
  const padTop = 6;
  const padBottom = 4;

  const vals = safePoints.map((p) => p.value);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const span = Math.max(1, maxVal - minVal);
  // Add subtle 15% headroom/floor padding so curves never clip at top/bottom
  const paddedMin = minVal - span * 0.15;
  const paddedRange = Math.max(1, maxVal + span * 0.12 - paddedMin);

  const coords = safePoints.map((pt, idx) => {
    const x =
      padX + (idx / Math.max(1, safePoints.length - 1)) * (width - padX * 2);
    const y =
      height -
      padBottom -
      ((pt.value - paddedMin) / paddedRange) * (height - padTop - padBottom);
    return { x, y, pt };
  });

  // Smooth Catmull-Rom-like cubic Bezier path
  const linePath = coords.reduce((acc, point, i, arr) => {
    if (i === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const prev = arr[i - 1];
    const cp1x = prev.x + (point.x - prev.x) * 0.45;
    const cp2x = prev.x + (point.x - prev.x) * 0.55;
    return `${acc} C ${cp1x.toFixed(1)} ${prev.y.toFixed(
      1
    )}, ${cp2x.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(
      1
    )} ${point.y.toFixed(1)}`;
  }, '');

  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(
    1
  )} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`;

  const activePoint =
    hoverIdx !== null && coords[hoverIdx] ? coords[hoverIdx] : null;

  return (
    <div className="w-full my-3">
      <div className="flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 mb-1 tabular-nums h-3.5">
        <span>{activePoint ? activePoint.pt.label : resolvedCaption}</span>
        {activePoint && formatValue && (
          <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">
            {formatValue(activePoint.pt.value)}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-14 overflow-visible"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="75%" stopColor={color} stopOpacity="0.06" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <motion.path
          d={areaPath}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
        />

        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
        />

        {/* End node or hovered node */}
        {coords.map((c, idx) => {
          const isTarget =
            hoverIdx !== null ? hoverIdx === idx : idx === coords.length - 1;
          return (
            <g
              key={c.pt.label + idx}
              className="cursor-pointer"
              onMouseEnter={() => setHoverIdx(idx)}
            >
              <rect
                x={c.x - width / safePoints.length / 2}
                y={0}
                width={width / safePoints.length}
                height={height}
                fill="transparent"
              />
              {isTarget && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={hoverIdx !== null ? 3.5 : 2.75}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

