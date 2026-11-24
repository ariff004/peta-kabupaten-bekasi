import type { ThemePreset } from '../types/quiz';

export interface ThemeTokens {
  id: ThemePreset;
  isDark: boolean;
  swatchPrimary: string;
  swatchSecondary: string;
  // Tailwind classes for UI surfaces & typography
  appBg: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  surfaceSubtle: string;
  surfaceHover: string;
  cardHover: string;
  border: string;
  borderStrong: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentBg: string;
  accentHover: string;
  accentText: string;
  accentSoftBg: string;
  accentSoftBorder: string;
  accentSoftText: string;
  inputBg: string;
  inputBorder: string;
  inputFocusBg: string;
  tabContainerBg: string;
  tabActiveBg: string;
  tabInactiveText: string;
  // Banner feedback classes
  bannerCorrect: string;
  bannerWrong: string;
  bannerHint: string;
  bannerInfo: string;
  // D3 SVG Vector Map Palette
  mapBg: string;
  mapFrameBorder: string;
  mapUnansweredFill: string;
  mapUnansweredHoverFill: string;
  mapStroke: string;
  mapHoverStroke: string;
  mapDuelInactiveStroke: string;
  mapTargetFill: string;
  mapTargetStroke: string;
  mapSilhouetteFill: string;
  mapSilhouetteStroke: string;
  mapLabelFill: string;
  mapLabelHalo: string;
  mapSolvedStroke: string;
  mapAssistedStroke: string;
  mapMissedStroke: string;
  mapChoroplethStroke: string;
  mapChoroplethSelectedStroke: string;
  mapDuelBlueFill: string;
  mapDuelBlueStroke: string;
  mapDuelOrangeFill: string;
  mapDuelOrangeStroke: string;
  mapDuelWinnerStroke: string;
}

export const THEME_ORDER: ThemePreset[] = ['light', 'dark', 'sepia', 'ocean'];

export const THEME_CONFIG: Record<ThemePreset, ThemeTokens> = {
  light: {
    id: 'light',
    isDark: false,
    swatchPrimary: '#F3F5F8',
    swatchSecondary: '#1D4ED8',
    appBg: 'bg-[#F3F5F8]',
    surface: 'bg-white',
    surfaceElevated: 'bg-white/95',
    surfaceMuted: 'bg-slate-100',
    surfaceSubtle: 'bg-slate-50',
    surfaceHover: 'hover:bg-slate-100',
    cardHover: 'hover:border-slate-300 hover:bg-slate-50/70',
    border: 'border-slate-200',
    borderStrong: 'border-slate-300',
    divider: 'divide-slate-100',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-700',
    textMuted: 'text-slate-500',
    accentBg: 'bg-blue-700',
    accentHover: 'hover:bg-blue-800',
    accentText: 'text-blue-700',
    accentSoftBg: 'bg-blue-50',
    accentSoftBorder: 'border-blue-600',
    accentSoftText: 'text-blue-950',
    inputBg: 'bg-slate-50',
    inputBorder: 'border-slate-300',
    inputFocusBg: 'focus:bg-white',
    tabContainerBg: 'bg-slate-100',
    tabActiveBg: 'bg-white text-slate-900 shadow-xs',
    tabInactiveText: 'text-slate-600 hover:text-slate-900',
    bannerCorrect: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    bannerWrong: 'bg-rose-50 border-rose-200 text-rose-900',
    bannerHint: 'bg-amber-50 border-amber-200 text-amber-900',
    bannerInfo: 'bg-slate-50 border-slate-200 text-slate-800',
    mapBg: 'bg-[#F3F5F8]',
    mapFrameBorder: 'border-slate-200/70',
    mapUnansweredFill: '#FFFFFF',
    mapUnansweredHoverFill: '#E2E8F0',
    mapStroke: '#94A3B8',
    mapHoverStroke: '#475569',
    mapDuelInactiveStroke: '#CBD5E1',
    mapTargetFill: '#2563EB',
    mapTargetStroke: '#1E3A8A',
    mapSilhouetteFill: '#1E293B',
    mapSilhouetteStroke: '#0F172A',
    mapLabelFill: '#0F172A',
    mapLabelHalo: '#FFFFFF',
    mapSolvedStroke: '#065F46',
    mapAssistedStroke: '#92400E',
    mapMissedStroke: '#9F1239',
    mapChoroplethStroke: '#64748B',
    mapChoroplethSelectedStroke: '#0F172A',
    mapDuelBlueFill: '#2563EB',
    mapDuelBlueStroke: '#1E3A8A',
    mapDuelOrangeFill: '#EA580C',
    mapDuelOrangeStroke: '#9A3412',
    mapDuelWinnerStroke: '#0F172A',
  },
  dark: {
    id: 'dark',
    isDark: true,
    swatchPrimary: '#0F172A',
    swatchSecondary: '#38BDF8',
    appBg: 'bg-[#0F172A]',
    surface: 'bg-[#1E293B]',
    surfaceElevated: 'bg-[#1E293B]/95',
    surfaceMuted: 'bg-slate-800',
    surfaceSubtle: 'bg-[#0F172A]/70',
    surfaceHover: 'hover:bg-slate-700',
    cardHover: 'hover:border-slate-500 hover:bg-slate-800/90',
    border: 'border-slate-700',
    borderStrong: 'border-slate-600',
    divider: 'divide-slate-700/80',
    textPrimary: 'text-slate-50',
    textSecondary: 'text-slate-200',
    textMuted: 'text-slate-400',
    accentBg: 'bg-blue-600',
    accentHover: 'hover:bg-blue-500',
    accentText: 'text-sky-400',
    accentSoftBg: 'bg-blue-950/70',
    accentSoftBorder: 'border-sky-400',
    accentSoftText: 'text-sky-100',
    inputBg: 'bg-[#0F172A]',
    inputBorder: 'border-slate-600',
    inputFocusBg: 'focus:bg-slate-900',
    tabContainerBg: 'bg-[#0F172A]',
    tabActiveBg: 'bg-slate-700 text-white shadow-xs',
    tabInactiveText: 'text-slate-400 hover:text-slate-100',
    bannerCorrect: 'bg-emerald-950/70 border-emerald-700 text-emerald-100',
    bannerWrong: 'bg-rose-950/70 border-rose-700 text-rose-100',
    bannerHint: 'bg-amber-950/70 border-amber-700 text-amber-100',
    bannerInfo: 'bg-slate-800 border-slate-600 text-slate-100',
    mapBg: 'bg-[#0F172A]',
    mapFrameBorder: 'border-slate-700/80',
    mapUnansweredFill: '#1E293B',
    mapUnansweredHoverFill: '#334155',
    mapStroke: '#94A3B8',
    mapHoverStroke: '#E2E8F0',
    mapDuelInactiveStroke: '#64748B',
    mapTargetFill: '#3B82F6',
    mapTargetStroke: '#DBEAFE',
    mapSilhouetteFill: '#E2E8F0',
    mapSilhouetteStroke: '#F8FAFC',
    mapLabelFill: '#F8FAFC',
    mapLabelHalo: '#0F172A',
    mapSolvedStroke: '#6EE7B7',
    mapAssistedStroke: '#FDE68A',
    mapMissedStroke: '#FDA4AF',
    mapChoroplethStroke: '#CBD5E1',
    mapChoroplethSelectedStroke: '#FFFFFF',
    mapDuelBlueFill: '#3B82F6',
    mapDuelBlueStroke: '#93C5FD',
    mapDuelOrangeFill: '#F97316',
    mapDuelOrangeStroke: '#FDBA74',
    mapDuelWinnerStroke: '#FFFFFF',
  },
  sepia: {
    id: 'sepia',
    isDark: false,
    swatchPrimary: '#F5F0E6',
    swatchSecondary: '#7C3F1D',
    appBg: 'bg-[#F5F0E6]',
    surface: 'bg-[#FBF8F1]',
    surfaceElevated: 'bg-[#FBF8F1]/95',
    surfaceMuted: 'bg-[#EBE2D0]',
    surfaceSubtle: 'bg-[#F2EBD9]',
    surfaceHover: 'hover:bg-[#EAE0CC]',
    cardHover: 'hover:border-[#BCA98B] hover:bg-[#F7F1E3]',
    border: 'border-[#DDD2BE]',
    borderStrong: 'border-[#C8B89C]',
    divider: 'divide-[#E6DCC8]',
    textPrimary: 'text-[#3E2723]',
    textSecondary: 'text-[#5C3D2E]',
    textMuted: 'text-[#7C5D48]',
    accentBg: 'bg-[#8B4513]',
    accentHover: 'hover:bg-[#72370E]',
    accentText: 'text-[#7C3F1D]',
    accentSoftBg: 'bg-[#EFE3CF]',
    accentSoftBorder: 'border-[#8B4513]',
    accentSoftText: 'text-[#3E2723]',
    inputBg: 'bg-[#F2EBD9]',
    inputBorder: 'border-[#C8B89C]',
    inputFocusBg: 'focus:bg-[#FBF8F1]',
    tabContainerBg: 'bg-[#E9DFCC]',
    tabActiveBg: 'bg-[#FBF8F1] text-[#3E2723] shadow-xs',
    tabInactiveText: 'text-[#6D523E] hover:text-[#3E2723]',
    bannerCorrect: 'bg-emerald-50 border-emerald-300 text-emerald-950',
    bannerWrong: 'bg-rose-50 border-rose-300 text-rose-950',
    bannerHint: 'bg-amber-50 border-amber-300 text-amber-950',
    bannerInfo: 'bg-[#EFE8D8] border-[#D3C4AA] text-[#3E2723]',
    mapBg: 'bg-[#F5F0E6]',
    mapFrameBorder: 'border-[#D5C8B0]',
    mapUnansweredFill: '#FBF8F1',
    mapUnansweredHoverFill: '#EAE0CD',
    mapStroke: '#8F775C',
    mapHoverStroke: '#4E342E',
    mapDuelInactiveStroke: '#BFA98E',
    mapTargetFill: '#0369A1',
    mapTargetStroke: '#0C4A6E',
    mapSilhouetteFill: '#4E342E',
    mapSilhouetteStroke: '#2E1B16',
    mapLabelFill: '#2E1B16',
    mapLabelHalo: '#FBF8F1',
    mapSolvedStroke: '#065F46',
    mapAssistedStroke: '#92400E',
    mapMissedStroke: '#9F1239',
    mapChoroplethStroke: '#6D4C3D',
    mapChoroplethSelectedStroke: '#2E1B16',
    mapDuelBlueFill: '#1D4ED8',
    mapDuelBlueStroke: '#1E3A8A',
    mapDuelOrangeFill: '#C2410C',
    mapDuelOrangeStroke: '#7C2D12',
    mapDuelWinnerStroke: '#2E1B16',
  },
  ocean: {
    id: 'ocean',
    isDark: false,
    swatchPrimary: '#EFF6FF',
    swatchSecondary: '#0369A1',
    appBg: 'bg-[#EFF6FF]',
    surface: 'bg-white',
    surfaceElevated: 'bg-white/95',
    surfaceMuted: 'bg-blue-100/80',
    surfaceSubtle: 'bg-blue-50/80',
    surfaceHover: 'hover:bg-blue-100/70',
    cardHover: 'hover:border-blue-300 hover:bg-blue-50/40',
    border: 'border-blue-200',
    borderStrong: 'border-blue-300',
    divider: 'divide-blue-100',
    textPrimary: 'text-[#0F294A]',
    textSecondary: 'text-[#1E4068]',
    textMuted: 'text-[#446891]',
    accentBg: 'bg-[#0369A1]',
    accentHover: 'hover:bg-[#075985]',
    accentText: 'text-[#0369A1]',
    accentSoftBg: 'bg-sky-50',
    accentSoftBorder: 'border-[#0369A1]',
    accentSoftText: 'text-[#0C4A6E]',
    inputBg: 'bg-blue-50/70',
    inputBorder: 'border-blue-300',
    inputFocusBg: 'focus:bg-white',
    tabContainerBg: 'bg-blue-100/80',
    tabActiveBg: 'bg-white text-[#0F294A] shadow-xs',
    tabInactiveText: 'text-[#3B628F] hover:text-[#0F294A]',
    bannerCorrect: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    bannerWrong: 'bg-rose-50 border-rose-200 text-rose-900',
    bannerHint: 'bg-amber-50 border-amber-200 text-amber-900',
    bannerInfo: 'bg-blue-50 border-blue-200 text-[#0F294A]',
    mapBg: 'bg-[#EFF6FF]',
    mapFrameBorder: 'border-blue-200',
    mapUnansweredFill: '#FFFFFF',
    mapUnansweredHoverFill: '#DBEAFE',
    mapStroke: '#60A5FA',
    mapHoverStroke: '#1E40AF',
    mapDuelInactiveStroke: '#93C5FD',
    mapTargetFill: '#0284C7',
    mapTargetStroke: '#0C4A6E',
    mapSilhouetteFill: '#0C4A6E',
    mapSilhouetteStroke: '#082F49',
    mapLabelFill: '#0F294A',
    mapLabelHalo: '#FFFFFF',
    mapSolvedStroke: '#065F46',
    mapAssistedStroke: '#92400E',
    mapMissedStroke: '#9F1239',
    mapChoroplethStroke: '#475569',
    mapChoroplethSelectedStroke: '#0F294A',
    mapDuelBlueFill: '#0284C7',
    mapDuelBlueStroke: '#0C4A6E',
    mapDuelOrangeFill: '#EA580C',
    mapDuelOrangeStroke: '#9A3412',
    mapDuelWinnerStroke: '#0F294A',
  },
};
