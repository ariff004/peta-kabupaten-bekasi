import React from 'react';
import { CheckCircle2, Circle, HelpCircle, MapPin, XCircle } from 'lucide-react';
import { KECAMATAN_META_LIST } from '../data/bekasiData';
import type { DistrictStatus, Language, QuizMode, ThemePreset } from '../types/quiz';
import { formatPenduduk } from '../utils/format';
import { getZoneLabel, UI_COPY } from '../utils/i18n';
import { THEME_CONFIG } from '../utils/theme';

interface DistrictChecklistProps {
  mode: QuizMode;
  statuses: Record<string, DistrictStatus>;
  selectedExploreId: string | null;
  onFocusDistrict: (id: string) => void;
  isResultView?: boolean;
  lang?: Language;
  theme?: ThemePreset;
}

export const DistrictChecklist: React.FC<DistrictChecklistProps> = ({
  mode,
  statuses,
  selectedExploreId,
  onFocusDistrict,
  isResultView = false,
  lang = 'id',
  theme = 'light',
}) => {
  const sorted = [...KECAMATAN_META_LIST].sort((a, b) => a.name.localeCompare(b.name));
  const copy = UI_COPY[lang];
  const tokens = THEME_CONFIG[theme];

  return (
    <div className={`divide-y ${tokens.divider}`}>
      {sorted.map((item) => {
        const status = statuses[item.id] || 'unanswered';
        const isSolved = status !== 'unanswered';
        const canRevealName = mode === 'explore' || isResultView || isSolved;
        const canFocusOnMap =
          mode === 'explore' ||
          isResultView ||
          (mode !== 'silhouette' && mode !== 'duel' && isSolved);
        const isSelected = mode === 'explore' && selectedExploreId === item.id;

        return (
          <button
            key={item.id}
            type="button"
            disabled={!canFocusOnMap}
            onClick={() => canFocusOnMap && onFocusDistrict(item.id)}
            className={`w-full min-h-[46px] px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors ${
              isSelected
                ? tokens.accentSoftBg
                : canFocusOnMap
                ? `${tokens.surfaceHover} cursor-pointer`
                : canRevealName
                ? 'cursor-default'
                : 'opacity-70 cursor-default'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {mode === 'explore' ? (
                <MapPin
                  className={`w-4 h-4 shrink-0 ${
                    isSelected ? tokens.accentText : tokens.textMuted
                  }`}
                />
              ) : status === 'correct-first' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : status === 'correct-assisted' ? (
                <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
              ) : status === 'missed' ? (
                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
              ) : (
                <Circle className={`w-4 h-4 ${tokens.textMuted} opacity-50 shrink-0`} />
              )}

              <div className="min-w-0">
                <div className={`text-sm font-semibold ${tokens.textPrimary} truncate`}>
                  {canRevealName ? item.name : copy.unansweredDistrict}
                </div>
                <div className={`text-xs ${tokens.textMuted} font-mono tabular-nums`}>
                  {getZoneLabel(item.zona, lang)} ·{' '}
                  {mode === 'explore' ? formatPenduduk(item.penduduk, lang) : item.kodeWilayah}
                </div>
              </div>
            </div>

            {mode !== 'explore' && (
              <span
                className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                  status === 'correct-first'
                    ? tokens.isDark
                      ? 'text-emerald-400'
                      : 'text-emerald-700'
                    : status === 'correct-assisted'
                    ? tokens.isDark
                      ? 'text-amber-400'
                      : 'text-amber-700'
                    : status === 'missed'
                    ? tokens.isDark
                      ? 'text-rose-400'
                      : 'text-rose-700'
                    : tokens.textMuted
                }`}
              >
                {status === 'correct-first'
                  ? copy.correct
                  : status === 'correct-assisted'
                  ? copy.assisted
                  : status === 'missed'
                  ? copy.missed
                  : copy.pending}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
