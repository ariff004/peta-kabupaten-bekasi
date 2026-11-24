import React from 'react';
import { Award, CheckCircle2, Compass, Eye, HelpCircle, Map as MapIcon, RotateCcw, SlidersHorizontal, XCircle } from 'lucide-react';
import { KECAMATAN_META_LIST } from '../data/bekasiData';
import type { BestRecord, DistrictStatus, Language, QuizMode, ThemePreset } from '../types/quiz';
import { getModeLabel, getZoneLabel, UI_COPY } from '../utils/i18n';
import { THEME_CONFIG } from '../utils/theme';

interface QuizSummaryModalProps {
  isOpen: boolean;
  mode: QuizMode;
  statuses: Record<string, DistrictStatus>;
  score: number;
  elapsedSeconds: number;
  bestRecord: BestRecord | null;
  isNewBest: boolean;
  customTotal?: number;
  customFirstTryCount?: number;
  customMissedCount?: number;
  customModeLabel?: string;
  customHeadline?: string;
  customRecordSummary?: string;
  onPlayAgain: () => void;
  onChangeSettings?: () => void;
  onViewResultMap: () => void;
  onExploreMap: () => void;
  onInspectDistrict: (id: string) => void;
  onBackToHome?: () => void;
  lang?: Language;
  theme?: ThemePreset;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const QuizSummaryModal: React.FC<QuizSummaryModalProps> = ({
  isOpen,
  mode,
  statuses,
  score,
  elapsedSeconds,
  bestRecord,
  isNewBest,
  customTotal,
  customFirstTryCount,
  customMissedCount,
  customModeLabel,
  customHeadline,
  customRecordSummary,
  onPlayAgain,
  onChangeSettings,
  onViewResultMap,
  onExploreMap,
  onInspectDistrict,
  onBackToHome,
  lang = 'id',
  theme = 'light',
}) => {
  if (!isOpen) return null;

  const copy = UI_COPY[lang];
  const tokens = THEME_CONFIG[theme];

  const isCustomCountMode = typeof customTotal === 'number';
  const total = customTotal ?? KECAMATAN_META_LIST.length;

  let firstTryCount = 0;
  let assistedCount = 0;
  let missedCount = 0;

  if (isCustomCountMode) {
    firstTryCount = customFirstTryCount ?? 0;
    missedCount = customMissedCount ?? Math.max(0, total - firstTryCount);
  } else {
    for (const item of KECAMATAN_META_LIST) {
      const st = statuses[item.id];
      if (st === 'correct-first') firstTryCount += 1;
      else if (st === 'correct-assisted') assistedCount += 1;
      else if (st === 'missed') missedCount += 1;
    }
  }

  const accuracy =
    total > 0 ? Math.round(((firstTryCount + assistedCount * 0.5) / total) * 100) : 0;
  const modeLabel = customModeLabel || getModeLabel(mode, lang);

  const reviewItems = isCustomCountMode
    ? []
    : KECAMATAN_META_LIST.filter(
        (item) => statuses[item.id] === 'missed' || statuses[item.id] === 'correct-assisted'
      );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/35 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-title"
      onClick={onViewResultMap}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-md ${tokens.surface} rounded-t-3xl sm:rounded-2xl border ${tokens.border} shadow-xl overflow-hidden flex flex-col max-h-[90dvh]`}
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className={`w-10 h-1 rounded-full ${tokens.isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
        </div>

        <div className={`px-6 pt-5 pb-4 border-b ${tokens.border}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-xs font-medium ${tokens.textMuted}`}>
                {copy.summaryPrefix} · {modeLabel}
              </p>
              <h2 id="summary-title" className={`text-xl font-bold ${tokens.textPrimary} mt-0.5`}>
                {customHeadline ||
                  (isCustomCountMode ? copy.summaryNQuestionsDone(total) : copy.summaryAll23Done)}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onViewResultMap}
                aria-label={copy.viewResultMap}
                title={copy.viewResultMap}
                className={`min-w-[40px] min-h-[40px] rounded-xl border ${tokens.border} ${tokens.surfaceSubtle} ${tokens.textSecondary} ${tokens.surfaceHover} flex items-center justify-center transition-colors`}
              >
                <Eye className="w-4 h-4" />
              </button>
              <div
                className={`w-11 h-11 rounded-xl ${tokens.accentSoftBg} ${tokens.accentText} flex items-center justify-center shrink-0`}
              >
                <Award className="w-6 h-6" />
              </div>
            </div>
          </div>

          {isNewBest && (
            <p
              className={`mt-2 text-xs font-semibold ${
                tokens.isDark ? 'text-emerald-400' : 'text-emerald-700'
              }`}
            >
              {copy.summaryNewBest(modeLabel)}
            </p>
          )}
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {/* Primary Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className={`p-3 rounded-xl ${tokens.surfaceSubtle} border ${tokens.border}`}>
              <div className={`text-xs ${tokens.textMuted}`}>{copy.summaryScore}</div>
              <div className={`mt-1 text-xl font-bold font-mono tabular-nums ${tokens.textPrimary}`}>
                {score}
              </div>
            </div>
            <div className={`p-3 rounded-xl ${tokens.surfaceSubtle} border ${tokens.border}`}>
              <div className={`text-xs ${tokens.textMuted}`}>{copy.summaryAccuracy}</div>
              <div className={`mt-1 text-xl font-bold font-mono tabular-nums ${tokens.textPrimary}`}>
                {accuracy}%
              </div>
            </div>
            <div className={`p-3 rounded-xl ${tokens.surfaceSubtle} border ${tokens.border}`}>
              <div className={`text-xs ${tokens.textMuted}`}>{copy.summaryTime}</div>
              <div className={`mt-1 text-xl font-bold font-mono tabular-nums ${tokens.textPrimary}`}>
                {formatDuration(elapsedSeconds)}
              </div>
            </div>
          </div>

          {/* Mastery Breakdown */}
          <div className="space-y-2.5">
            <h3 className={`text-xs font-semibold ${tokens.textMuted}`}>
              {copy.summaryBreakdownTitle}
            </h3>
            <div className={`divide-y ${tokens.divider} border ${tokens.border} rounded-xl ${tokens.surface}`}>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className={`flex items-center gap-2.5 text-sm font-medium ${tokens.textSecondary}`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {isCustomCountMode ? copy.summaryCorrectAnswers : copy.summaryFirstTry}
                </span>
                <span className={`font-mono text-sm font-bold tabular-nums ${tokens.textPrimary}`}>
                  {firstTryCount} / {total}
                </span>
              </div>
              {!isCustomCountMode && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className={`flex items-center gap-2.5 text-sm font-medium ${tokens.textSecondary}`}>
                    <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    {copy.summaryWithHint}
                  </span>
                  <span className={`font-mono text-sm font-bold tabular-nums ${tokens.textPrimary}`}>
                    {assistedCount} / {total}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className={`flex items-center gap-2.5 text-sm font-medium ${tokens.textSecondary}`}>
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  {isCustomCountMode ? copy.summaryWrongAnswers : copy.summarySkippedWrong}
                </span>
                <span className={`font-mono text-sm font-bold tabular-nums ${tokens.textPrimary}`}>
                  {missedCount} / {total}
                </span>
              </div>
            </div>
          </div>

          {/* Best Record */}
          {(customRecordSummary || bestRecord) && (
            <div className={`text-xs ${tokens.textMuted} flex items-center justify-between gap-2 px-1`}>
              <span>{copy.summaryBestRecord}</span>
              <span className={`font-mono tabular-nums font-medium ${tokens.textSecondary} text-right`}>
                {customRecordSummary ||
                  `${bestRecord!.bestScore} ${copy.pts} · ${bestRecord!.bestAccuracy}% · ${formatDuration(
                    bestRecord!.fastestSeconds
                  )}`}
              </span>
            </div>
          )}

          {/* Review Missed / Assisted Districts */}
          {reviewItems.length > 0 && (
            <div className="space-y-2">
              <h3 className={`text-xs font-semibold ${tokens.textMuted}`}>
                {copy.summaryReviewTitle(reviewItems.length)}
              </h3>
              <div
                className={`max-h-36 overflow-y-auto divide-y ${tokens.divider} border ${tokens.border} rounded-xl`}
              >
                {reviewItems.map((item) => {
                  const st = statuses[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onInspectDistrict(item.id)}
                      className={`w-full min-h-[44px] px-3.5 py-2 flex items-center justify-between text-left ${tokens.surfaceHover} transition-colors`}
                    >
                      <div>
                        <div className={`text-sm font-semibold ${tokens.textPrimary}`}>
                          {item.name}
                        </div>
                        <div className={`text-xs ${tokens.textMuted}`}>
                          {getZoneLabel(item.zona, lang)}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          st === 'missed'
                            ? tokens.isDark
                              ? 'text-rose-400'
                              : 'text-rose-700'
                            : tokens.isDark
                            ? 'text-amber-400'
                            : 'text-amber-700'
                        }`}
                      >
                        {st === 'missed' ? copy.summaryMissedChip : copy.assisted}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={`px-6 py-4 pb-safe border-t ${tokens.border} ${tokens.surfaceSubtle} space-y-2`}>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onViewResultMap}
              className={`flex-1 min-h-[48px] px-3.5 py-2.5 rounded-xl border ${tokens.borderStrong} ${tokens.surface} ${tokens.textPrimary} text-sm font-semibold ${tokens.surfaceHover} active:scale-[0.99] transition flex items-center justify-center gap-2 whitespace-nowrap shrink-0`}
            >
              <MapIcon className="w-4 h-4 shrink-0" />
              {copy.viewResultMap}
            </button>
            <button
              type="button"
              onClick={onPlayAgain}
              className={`flex-1 min-h-[48px] px-3.5 py-2.5 rounded-xl ${tokens.accentBg} ${tokens.accentHover} text-white text-sm font-semibold active:scale-[0.99] transition flex items-center justify-center gap-2 whitespace-nowrap shrink-0`}
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              {copy.playAgain}
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onExploreMap}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold ${tokens.textSecondary} ${tokens.surfaceHover} transition flex items-center justify-center gap-1.5`}
            >
              <Compass className="w-3.5 h-3.5" />
              {copy.summaryExploreMap}
            </button>
            {onChangeSettings && (
              <button
                type="button"
                onClick={onChangeSettings}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold ${tokens.textMuted} ${tokens.surfaceHover} transition flex items-center justify-center gap-1.5`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {copy.summaryChangeSettings}
              </button>
            )}
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold ${tokens.textMuted} ${tokens.surfaceHover} transition`}
              >
                {copy.backToHome}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
