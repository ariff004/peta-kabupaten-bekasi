import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Crosshair,
  Flag,
  Heart,
  HelpCircle,
  Keyboard,
  Lightbulb,
  ListChecks,
  ListOrdered,
  Palette,
  RotateCcw,
  Scale,
  Shapes,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { BekasiVectorMap, type DuelMapHighlight } from './components/BekasiVectorMap';
import { DistrictChecklist } from './components/DistrictChecklist';
import { QuizSummaryModal } from './components/QuizSummaryModal';
import {
  KECAMATAN_BY_NORMALIZED_NAME,
  KECAMATAN_FEATURES,
  KECAMATAN_META_BY_ID,
  KECAMATAN_META_LIST,
} from './data/bekasiData';
import type {
  BestRecord,
  ChoroplethFilter,
  DemographicMetric,
  DistrictStatus,
  DuelCategory,
  DuelFormat,
  DuelQuestion,
  FeedbackBanner,
  KecamatanFeature,
  KecamatanMeta,
  Language,
  PlayableQuizMode,
  QuizMode,
  RankedScope,
  RecordKey,
  ThemePreset,
} from './types/quiz';
import {
  formatKepadatan,
  formatLuas,
  formatMetricValue,
  formatPenduduk,
  formatTimeClock,
  getMetricRawValue,
  normalizeDistrictQuery,
} from './utils/format';
import {
  getDistrictClue,
  getMetricLabel,
  getModeCardTitle,
  getModeDescription,
  getModeLabel,
  getRankedScopeLabel,
  getThemeLabel,
  getZoneLabel,
  UI_COPY,
} from './utils/i18n';
import { playCompleteTone, playCorrectTone, playWrongTone } from './utils/sound';
import { THEME_CONFIG, THEME_ORDER } from './utils/theme';

const STORAGE_KEY_BEST = 'peta-bekasi-best-v1';
const STORAGE_KEY_LANG = 'peta-bekasi-lang-v1';
const STORAGE_KEY_THEME = 'peta-bekasi-theme-v1';
const NAME_ALL_DURATION_SECONDS = 180; // 3 Menit

type ScreenView = 'home' | 'play';
type DuelQuestionCountOption = 10 | 15 | 20 | 25;
type DuelTimeOption = 30 | 45 | 60;

function shuffleIds(ids: string[]): string[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildInitialStatuses(): Record<string, DistrictStatus> {
  const map: Record<string, DistrictStatus> = {};
  for (const f of KECAMATAN_FEATURES) {
    map[f.properties.id] = 'unanswered';
  }
  return map;
}

function buildChoiceOptions(targetId: string): string[] {
  const targetMeta = KECAMATAN_META_BY_ID[targetId];
  const allOther = KECAMATAN_META_LIST.filter((m) => m.id !== targetId);

  const neighborSet = new Set(targetMeta?.neighbors || []);
  const prioritized = allOther.filter(
    (m) => neighborSet.has(m.name) || m.zona === targetMeta?.zona
  );
  const rest = allOther.filter(
    (m) => !neighborSet.has(m.name) && m.zona !== targetMeta?.zona
  );

  const pool = [...shuffleIds(prioritized.map((m) => m.id)), ...shuffleIds(rest.map((m) => m.id))];
  const distractors = pool.slice(0, 3);
  return shuffleIds([targetId, ...distractors]);
}

function createNextDuelQuestion(
  category: DuelCategory,
  prevPairKey: string | null,
  usedPairKeys: Set<string>
): { question: DuelQuestion; pairKey: string } {
  const metrics: DemographicMetric[] = ['penduduk', 'luas', 'kepadatan'];
  const metric: DemographicMetric =
    category === 'mixed' ? metrics[Math.floor(Math.random() * metrics.length)] : category;

  const allIds = KECAMATAN_META_LIST.map((m) => m.id);
  const unusedPairs: Array<{ idA: string; idB: string; key: string }> = [];
  const fallbackPairs: Array<{ idA: string; idB: string; key: string }> = [];

  for (let i = 0; i < allIds.length; i++) {
    for (let j = i + 1; j < allIds.length; j++) {
      const id1 = allIds[i];
      const id2 = allIds[j];
      const key = `${id1}-${id2}`;
      if (key === prevPairKey) continue;

      const val1 = getMetricRawValue(KECAMATAN_META_BY_ID[id1], metric);
      const val2 = getMetricRawValue(KECAMATAN_META_BY_ID[id2], metric);
      if (val1 === val2) continue;

      const swap = Math.random() < 0.5;
      const pairObj = { idA: swap ? id2 : id1, idB: swap ? id1 : id2, key };
      fallbackPairs.push(pairObj);
      if (!usedPairKeys.has(key)) {
        unusedPairs.push(pairObj);
      }
    }
  }

  let pool = unusedPairs;
  if (pool.length === 0) {
    usedPairKeys.clear();
    pool = fallbackPairs;
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  usedPairKeys.add(chosen.key);

  const valA = getMetricRawValue(KECAMATAN_META_BY_ID[chosen.idA], metric);
  const valB = getMetricRawValue(KECAMATAN_META_BY_ID[chosen.idB], metric);

  return {
    question: {
      idA: chosen.idA,
      idB: chosen.idB,
      metric,
      winnerId: valA > valB ? chosen.idA : chosen.idB,
    },
    pairKey: chosen.key,
  };
}

function loadBestRecords(): Partial<Record<RecordKey, BestRecord>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BEST);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<RecordKey, BestRecord>>;
  } catch {
    return {};
  }
}

function loadSavedLanguage(): Language {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LANG);
    return raw === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
  }
}

function loadSavedTheme(): ThemePreset {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_THEME);
    if (raw === 'dark' || raw === 'sepia' || raw === 'ocean' || raw === 'light') {
      return raw;
    }
    return 'light';
  } catch {
    return 'light';
  }
}

const MODE_CARDS: Array<{
  id: QuizMode;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'locate', icon: Crosshair },
  { id: 'choice', icon: HelpCircle },
  { id: 'silhouette', icon: Shapes },
  { id: 'nameAll', icon: Keyboard },
  { id: 'ranked', icon: ListOrdered },
  { id: 'duel', icon: Scale },
  { id: 'explore', icon: Compass },
];

const CHOROPLETH_FILTERS: ChoroplethFilter[] = ['none', 'penduduk', 'luas', 'kepadatan'];
const RANKED_METRICS: DemographicMetric[] = ['penduduk', 'luas', 'kepadatan'];

const RANKED_SCOPE_CONFIG: Record<
  RankedScope,
  {
    id: RankedScope;
    count: number;
    maxLives: number;
    sequential: boolean;
    recordKey: RecordKey;
  }
> = {
  all: {
    id: 'all',
    count: 23,
    maxLives: 5,
    sequential: true,
    recordKey: 'ranked',
  },
  top10: {
    id: 'top10',
    count: 10,
    maxLives: 4,
    sequential: false,
    recordKey: 'ranked10',
  },
  top5: {
    id: 'top5',
    count: 5,
    maxLives: 3,
    sequential: false,
    recordKey: 'ranked5',
  },
};

const RANKED_SCOPE_OPTIONS: RankedScope[] = ['all', 'top10', 'top5'];

export default function App() {
  const allIds = useMemo(() => KECAMATAN_FEATURES.map((f) => f.properties.id), []);

  const [screen, setScreen] = useState<ScreenView>('home');
  const [mode, setMode] = useState<QuizMode>('locate');
  const [queue, setQueue] = useState<string[]>(() => shuffleIds(allIds));
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [statuses, setStatuses] = useState<Record<string, DistrictStatus>>(() =>
    buildInitialStatuses()
  );

  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const [attemptsOnCurrent, setAttemptsOnCurrent] = useState<number>(0);
  const [usedHintOnCurrent, setUsedHintOnCurrent] = useState<boolean>(false);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [eliminatedChoices, setEliminatedChoices] = useState<string[]>([]);
  const [choiceSuccessId, setChoiceSuccessId] = useState<string | null>(null);

  const [wrongFlashId, setWrongFlashId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedExploreId, setSelectedExploreId] = useState<string | null>(
    KECAMATAN_META_LIST[0]?.id || null
  );
  const [choroplethFilter, setChoroplethFilter] = useState<ChoroplethFilter>('none');

  // Mode: Sebutkan Semua (nameAll) & Peringkat Wilayah (ranked)
  const [typedGuess, setTypedGuess] = useState<string>('');
  const [nameAllTimed, setNameAllTimed] = useState<boolean>(true);
  const [nameAllEnded, setNameAllEnded] = useState<boolean>(false);
  const [rankedMetric, setRankedMetric] = useState<DemographicMetric>('penduduk');
  const [rankedScope, setRankedScope] = useState<RankedScope>('all');
  const [rankedLives, setRankedLives] = useState<number>(RANKED_SCOPE_CONFIG.all.maxLives);
  const [rankedActiveIndex, setRankedActiveIndex] = useState<number>(0);
  const [rankedEnded, setRankedEnded] = useState<boolean>(false);
  const [lastMatchedId, setLastMatchedId] = useState<string | null>(null);

  // Mode: Adu Data (duel)
  const [duelPhase, setDuelPhase] = useState<'setup' | 'playing'>('setup');
  const [duelCategory, setDuelCategory] = useState<DuelCategory>('mixed');
  const [duelFormat, setDuelFormat] = useState<DuelFormat>('questions');
  const [duelQuestionLimit, setDuelQuestionLimit] = useState<DuelQuestionCountOption>(15);
  const [duelTimeLimit, setDuelTimeLimit] = useState<DuelTimeOption>(45);
  const [currentDuel, setCurrentDuel] = useState<DuelQuestion | null>(null);
  const [duelRoundNum, setDuelRoundNum] = useState<number>(1);
  const [duelAnsweredCount, setDuelAnsweredCount] = useState<number>(0);
  const [duelChosenId, setDuelChosenId] = useState<string | null>(null);
  const [duelCorrectCount, setDuelCorrectCount] = useState<number>(0);

  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [summaryModalHidden, setSummaryModalHidden] = useState<boolean>(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [isNewBest, setIsNewBest] = useState<boolean>(false);
  const [bestRecords, setBestRecords] = useState<Partial<Record<RecordKey, BestRecord>>>(
    () => loadBestRecords()
  );

  const [lang, setLang] = useState<Language>(() => loadSavedLanguage());
  const [theme, setTheme] = useState<ThemePreset>(() => loadSavedTheme());
  const [themeMenuOpen, setThemeMenuOpen] = useState<boolean>(false);

  const [checklistOpen, setChecklistOpen] = useState<boolean>(false);
  const [confirmResetAllOpen, setConfirmResetAllOpen] = useState<boolean>(false);
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number } | null>(null);

  const advanceTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const isTransitioningRef = useRef<boolean>(false);
  const usedDuelPairKeysRef = useRef<Set<string>>(new Set());
  const prevDuelPairKeyRef = useRef<string | null>(null);
  const rankedSlotRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const themePickerRef = useRef<HTMLDivElement | null>(null);

  const copy = UI_COPY[lang];
  const tokens = THEME_CONFIG[theme];

  // Persist & apply theme + language on document root
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = UI_COPY[lang].pageTitle;
    try {
      localStorage.setItem(STORAGE_KEY_LANG, lang);
    } catch {
      // Ignore storage errors
    }
  }, [lang]);

  // Close theme dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!themeMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setThemeMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [themeMenuOpen]);

  const clearPendingTimers = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    isTransitioningRef.current = false;
  }, []);

  useEffect(() => {
    return () => clearPendingTimers();
  }, [clearPendingTimers]);

  const saveBestRecordIfBeaten = useCallback(
    (
      targetKey: RecordKey,
      finalScore: number,
      accuracy: number,
      finalSeconds: number,
      finalCorrect?: number
    ) => {
      const prevBest = bestRecords[targetKey];
      const beaten =
        targetKey === 'duelTimed'
          ? !prevBest ||
            (finalCorrect ?? 0) > (prevBest.bestCorrect ?? 0) ||
            ((finalCorrect ?? 0) === (prevBest.bestCorrect ?? 0) &&
              finalScore > prevBest.bestScore)
          : !prevBest ||
            finalScore > prevBest.bestScore ||
            (finalScore === prevBest.bestScore && finalSeconds < prevBest.fastestSeconds);

      if (beaten) {
        const updated: Partial<Record<RecordKey, BestRecord>> = {
          ...bestRecords,
          [targetKey]: {
            bestScore: finalScore,
            bestAccuracy: accuracy,
            fastestSeconds: finalSeconds,
            ...(typeof finalCorrect === 'number' ? { bestCorrect: finalCorrect } : {}),
          },
        };
        setBestRecords(updated);
        setIsNewBest(true);
        try {
          localStorage.setItem(STORAGE_KEY_BEST, JSON.stringify(updated));
        } catch {
          // Ignore storage errors
        }
      }
    },
    [bestRecords]
  );

  const handleResetSingleRecord = useCallback((targetMode: PlayableQuizMode) => {
    setBestRecords((prev) => {
      const next = { ...prev };
      if (targetMode === 'duel') {
        delete next.duelQuestions;
        delete next.duelTimed;
      } else if (targetMode === 'ranked') {
        delete next.ranked;
        delete next.ranked10;
        delete next.ranked5;
      } else {
        delete next[targetMode];
      }
      try {
        if (Object.keys(next).length === 0) {
          localStorage.removeItem(STORAGE_KEY_BEST);
        } else {
          localStorage.setItem(STORAGE_KEY_BEST, JSON.stringify(next));
        }
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const handleConfirmResetAllRecords = useCallback(() => {
    setBestRecords({});
    setConfirmResetAllOpen(false);
    try {
      localStorage.removeItem(STORAGE_KEY_BEST);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Quiz timer runs only while actively playing on the game screen
  const isRoundPaused =
    screen !== 'play' ||
    mode === 'explore' ||
    isCompleted ||
    (mode === 'nameAll' && nameAllEnded) ||
    (mode === 'ranked' && rankedEnded) ||
    (mode === 'duel' && duelPhase === 'setup');

  useEffect(() => {
    if (isRoundPaused) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRoundPaused]);

  // Handle 3-minute countdown expiry in 'nameAll' mode
  useEffect(() => {
    if (
      screen !== 'play' ||
      mode !== 'nameAll' ||
      !nameAllTimed ||
      nameAllEnded ||
      isCompleted
    ) {
      return;
    }
    if (elapsedSeconds >= NAME_ALL_DURATION_SECONDS) {
      playWrongTone(soundEnabled);
      setNameAllEnded(true);
      setStatuses((prev) => {
        const next: Record<string, DistrictStatus> = { ...prev };
        let correctCount = 0;
        for (const id of Object.keys(next)) {
          if (next[id] === 'unanswered') {
            next[id] = 'missed';
          } else if (next[id] === 'correct-first') {
            correctCount += 1;
          }
        }
        setFeedback({
          type: 'wrong',
          title:
            lang === 'en'
              ? `Time's up! Named ${correctCount} of 23 districts.`
              : `Waktu habis! Tertebak ${correctCount} dari 23 kecamatan.`,
          detail:
            lang === 'en'
              ? 'Red polygons mark the districts you missed.'
              : 'Wilayah berwarna merah adalah kecamatan yang belum terjawab.',
        });
        return next;
      });
    }
  }, [elapsedSeconds, isCompleted, lang, mode, nameAllEnded, nameAllTimed, screen, soundEnabled]);

  // Handle countdown expiry in 'duel' Time Attack format
  useEffect(() => {
    if (
      screen !== 'play' ||
      mode !== 'duel' ||
      duelPhase !== 'playing' ||
      duelFormat !== 'timed' ||
      isCompleted
    ) {
      return;
    }
    if (elapsedSeconds >= duelTimeLimit) {
      clearPendingTimers();
      setIsCompleted(true);
      setSummaryModalHidden(false);
      setSelectedResultId(null);
      playCompleteTone(soundEnabled);
      const accuracy =
        duelAnsweredCount > 0 ? Math.round((duelCorrectCount / duelAnsweredCount) * 100) : 0;
      saveBestRecordIfBeaten(
        'duelTimed',
        score,
        accuracy,
        duelTimeLimit,
        duelCorrectCount
      );
    }
  }, [
    clearPendingTimers,
    duelAnsweredCount,
    duelCorrectCount,
    duelFormat,
    duelPhase,
    duelTimeLimit,
    elapsedSeconds,
    isCompleted,
    mode,
    saveBestRecordIfBeaten,
    score,
    screen,
    soundEnabled,
  ]);

  const currentTargetId =
    (mode === 'locate' || mode === 'choice' || mode === 'silhouette') &&
    currentIndex < queue.length
      ? queue[currentIndex]
      : null;
  const currentTargetMeta = currentTargetId ? KECAMATAN_META_BY_ID[currentTargetId] : null;

  const choiceOptions = useMemo(() => {
    if ((mode !== 'choice' && mode !== 'silhouette') || !currentTargetId) return [];
    return buildChoiceOptions(currentTargetId);
  }, [mode, currentTargetId]);

  const answeredCount = useMemo(() => {
    return Object.values(statuses).filter((s) => s !== 'unanswered').length;
  }, [statuses]);

  const correctOnlyCount = useMemo(() => {
    return Object.values(statuses).filter((s) => s === 'correct-first').length;
  }, [statuses]);

  const rankedScopeCfg = RANKED_SCOPE_CONFIG[rankedScope];

  const rankedList = useMemo(() => {
    return [...KECAMATAN_META_LIST].sort(
      (a, b) => getMetricRawValue(b, rankedMetric) - getMetricRawValue(a, rankedMetric)
    );
  }, [rankedMetric]);

  const activeRankedList = useMemo(() => {
    return rankedList.slice(0, rankedScopeCfg.count);
  }, [rankedList, rankedScopeCfg.count]);

  const rankedSolvedCount = useMemo(() => {
    return activeRankedList.filter((item) => statuses[item.id] === 'correct-first').length;
  }, [activeRankedList, statuses]);

  // Smoothly scroll the active target rank slot into view when playing 'Semua (23)'
  useEffect(() => {
    if (screen !== 'play' || mode !== 'ranked' || rankedScope !== 'all' || rankedEnded) {
      return;
    }
    const targetEl = rankedSlotRefs.current[rankedActiveIndex];
    if (targetEl) {
      targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [mode, rankedActiveIndex, rankedEnded, rankedScope, screen]);

  const startDuelRound = useCallback(
    (categoryOverride?: DuelCategory) => {
      clearPendingTimers();
      const cat = categoryOverride ?? duelCategory;
      usedDuelPairKeysRef.current.clear();
      prevDuelPairKeyRef.current = null;
      const first = createNextDuelQuestion(cat, null, usedDuelPairKeysRef.current);
      prevDuelPairKeyRef.current = first.pairKey;

      setMode('duel');
      setDuelPhase('playing');
      setCurrentDuel(first.question);
      setDuelRoundNum(1);
      setDuelAnsweredCount(0);
      setDuelChosenId(null);
      setDuelCorrectCount(0);
      setScore(0);
      setStreak(0);
      setElapsedSeconds(0);
      setHoveredId(null);
      setFeedback(null);
      setIsCompleted(false);
      setSummaryModalHidden(false);
      setSelectedResultId(null);
      setIsNewBest(false);
      setChecklistOpen(false);
      setScreen('play');
    },
    [clearPendingTimers, duelCategory]
  );

  const startNewRound = useCallback(
    (
      nextMode: QuizMode,
      opts?: {
        timed?: boolean;
        rankedCategory?: DemographicMetric;
        rankedVariant?: RankedScope;
      }
    ) => {
      if (nextMode === 'duel') {
        startDuelRound();
        return;
      }
      clearPendingTimers();
      setMode(nextMode);
      setQueue(shuffleIds(allIds));
      setCurrentIndex(0);
      setStatuses(buildInitialStatuses());
      setScore(0);
      setStreak(0);
      setElapsedSeconds(0);
      setAttemptsOnCurrent(0);
      setUsedHintOnCurrent(false);
      setHintLevel(0);
      setEliminatedChoices([]);
      setChoiceSuccessId(null);
      setWrongFlashId(null);
      setHoveredId(null);
      setTypedGuess('');
      setLastMatchedId(null);
      setNameAllEnded(false);

      const nextScope = opts?.rankedVariant ?? rankedScope;
      if (opts?.rankedVariant !== undefined) {
        setRankedScope(opts.rankedVariant);
      }
      if (opts?.rankedCategory !== undefined) {
        setRankedMetric(opts.rankedCategory);
      }
      setRankedLives(RANKED_SCOPE_CONFIG[nextScope].maxLives);
      setRankedActiveIndex(0);
      setRankedEnded(false);

      if (opts?.timed !== undefined) {
        setNameAllTimed(opts.timed);
      }
      setFeedback(null);
      setIsCompleted(false);
      setSummaryModalHidden(false);
      setSelectedResultId(null);
      setIsNewBest(false);
      setChecklistOpen(false);
      setScreen('play');
    },
    [allIds, clearPendingTimers, rankedScope, startDuelRound]
  );

  const handleEnterMode = useCallback(
    (selectedMode: QuizMode) => {
      if (selectedMode === 'explore') {
        clearPendingTimers();
        setMode('explore');
        setFeedback(null);
        setWrongFlashId(null);
        setHoveredId(null);
        setIsCompleted(false);
        setSummaryModalHidden(false);
        setSelectedResultId(null);
        setChecklistOpen(false);
        setScreen('play');
        return;
      }
      if (selectedMode === 'duel') {
        clearPendingTimers();
        setMode('duel');
        setDuelPhase('setup');
        setFeedback(null);
        setHoveredId(null);
        setIsCompleted(false);
        setSummaryModalHidden(false);
        setSelectedResultId(null);
        setIsNewBest(false);
        setChecklistOpen(false);
        setScreen('play');
        return;
      }
      startNewRound(selectedMode);
    },
    [clearPendingTimers, startNewRound]
  );

  const handleBackToHome = useCallback(() => {
    clearPendingTimers();
    setIsCompleted(false);
    setSummaryModalHidden(false);
    setSelectedResultId(null);
    setFeedback(null);
    setWrongFlashId(null);
    setHoveredId(null);
    setChecklistOpen(false);
    setThemeMenuOpen(false);
    setScreen('home');
  }, [clearPendingTimers]);

  const finishQuiz = useCallback(
    (finalStatuses: Record<string, DistrictStatus>, finalScore: number, finalSeconds: number) => {
      setIsCompleted(true);
      setSummaryModalHidden(false);
      setSelectedResultId(null);
      playCompleteTone(soundEnabled);

      if (mode !== 'explore' && mode !== 'duel') {
        const targetItems = mode === 'ranked' ? activeRankedList : KECAMATAN_META_LIST;
        const total = targetItems.length;
        let firstCount = 0;
        let assistedCount = 0;
        for (const item of targetItems) {
          const st = finalStatuses[item.id];
          if (st === 'correct-first') firstCount += 1;
          else if (st === 'correct-assisted') assistedCount += 1;
        }
        const accuracy = total > 0 ? Math.round(((firstCount + assistedCount * 0.5) / total) * 100) : 0;
        const targetRecordKey: RecordKey =
          mode === 'ranked' ? RANKED_SCOPE_CONFIG[rankedScope].recordKey : mode;
        saveBestRecordIfBeaten(targetRecordKey, finalScore, accuracy, finalSeconds);
      }
    },
    [activeRankedList, mode, rankedScope, saveBestRecordIfBeaten, soundEnabled]
  );

  const advanceQuestion = useCallback(
    (updatedStatuses: Record<string, DistrictStatus>, updatedScore: number) => {
      const nextIdx = currentIndex + 1;
      if (nextIdx >= queue.length) {
        finishQuiz(updatedStatuses, updatedScore, elapsedSeconds);
        return;
      }
      setCurrentIndex(nextIdx);
      setAttemptsOnCurrent(0);
      setUsedHintOnCurrent(false);
      setHintLevel(0);
      setEliminatedChoices([]);
      setChoiceSuccessId(null);
      setFeedback(null);
      isTransitioningRef.current = false;
    },
    [currentIndex, elapsedSeconds, finishQuiz, queue.length]
  );

  const handleMapSelectDistrict = useCallback(
    (feature: KecamatanFeature) => {
      const clickedId = feature.properties.id;
      const clickedMeta = KECAMATAN_META_BY_ID[clickedId];

      if (mode === 'explore') {
        setSelectedExploreId(clickedId);
        return;
      }

      if (isCompleted || (mode === 'nameAll' && nameAllEnded) || (mode === 'ranked' && rankedEnded)) {
        setSelectedResultId((prev) => (prev === clickedId ? null : clickedId));
        return;
      }

      if (mode !== 'locate' || !currentTargetId || isTransitioningRef.current) {
        return;
      }

      if (clickedId === currentTargetId) {
        isTransitioningRef.current = true;
        const isFirstTry = attemptsOnCurrent === 0 && !usedHintOnCurrent;
        const earned = isFirstTry ? 100 + streak * 15 : 50;
        const nextScore = score + earned;
        const nextStreak = isFirstTry ? streak + 1 : 0;
        const nextStatus: DistrictStatus = isFirstTry ? 'correct-first' : 'correct-assisted';

        const nextStatuses = {
          ...statuses,
          [currentTargetId]: nextStatus,
        };

        setStatuses(nextStatuses);
        setScore(nextScore);
        setStreak(nextStreak);
        setWrongFlashId(null);
        setHintLevel(0);
        playCorrectTone(soundEnabled);

        setFeedback({
          type: 'correct',
          title:
            lang === 'en'
              ? `Correct! ${clickedMeta?.name || feature.properties.name}`
              : `Tepat! ${clickedMeta?.name || feature.properties.name}`,
          detail: `+${earned} ${copy.pts} · ${
            clickedMeta ? getZoneLabel(clickedMeta.zona, lang) : ''
          }`,
        });

        advanceTimerRef.current = window.setTimeout(() => {
          advanceQuestion(nextStatuses, nextScore);
        }, 680);
        return;
      }

      if (statuses[clickedId] !== 'unanswered') {
        setFeedback({
          type: 'info',
          title:
            lang === 'en'
              ? `That is ${clickedMeta?.name || feature.properties.name}`
              : `Itu Kec. ${clickedMeta?.name || feature.properties.name}`,
          detail:
            lang === 'en'
              ? 'This district has already been answered.'
              : 'Wilayah ini sudah terjawab sebelumnya.',
        });
        return;
      }

      playWrongTone(soundEnabled);
      setStreak(0);
      const nextAttempts = attemptsOnCurrent + 1;
      setAttemptsOnCurrent(nextAttempts);

      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
      setWrongFlashId(clickedId);
      flashTimerRef.current = window.setTimeout(() => {
        setWrongFlashId(null);
      }, 650);

      if (nextAttempts >= 2 && hintLevel === 0) {
        setHintLevel(1);
      }

      setFeedback({
        type: 'wrong',
        title:
          lang === 'en'
            ? `Nope, that is ${clickedMeta?.name || feature.properties.name}`
            : `Bukan, itu Kec. ${clickedMeta?.name || feature.properties.name}`,
        detail:
          nextAttempts >= 2 && currentTargetMeta
            ? `${copy.hint}: ${getZoneLabel(currentTargetMeta.zona, lang)}`
            : lang === 'en'
            ? 'Try again or tap Hint.'
            : 'Coba lagi atau gunakan Petunjuk.',
      });
    },
    [
      advanceQuestion,
      attemptsOnCurrent,
      copy.hint,
      copy.pts,
      currentTargetId,
      currentTargetMeta,
      hintLevel,
      isCompleted,
      lang,
      mode,
      nameAllEnded,
      rankedEnded,
      score,
      soundEnabled,
      statuses,
      streak,
      usedHintOnCurrent,
    ]
  );

  const handleSelectChoiceOption = useCallback(
    (optionId: string) => {
      if (
        (mode !== 'choice' && mode !== 'silhouette') ||
        !currentTargetId ||
        isCompleted ||
        isTransitioningRef.current ||
        eliminatedChoices.includes(optionId)
      ) {
        return;
      }

      if (optionId === currentTargetId) {
        isTransitioningRef.current = true;
        setChoiceSuccessId(optionId);
        const isFirstTry = attemptsOnCurrent === 0 && !usedHintOnCurrent;
        const earned = isFirstTry ? 100 + streak * 15 : 50;
        const nextScore = score + earned;
        const nextStreak = isFirstTry ? streak + 1 : 0;
        const nextStatus: DistrictStatus = isFirstTry ? 'correct-first' : 'correct-assisted';

        const nextStatuses = {
          ...statuses,
          [currentTargetId]: nextStatus,
        };

        setStatuses(nextStatuses);
        setScore(nextScore);
        setStreak(nextStreak);
        playCorrectTone(soundEnabled);

        setFeedback({
          type: 'correct',
          title:
            lang === 'en'
              ? `Correct! ${currentTargetMeta?.name || ''}`
              : `Benar! ${currentTargetMeta?.name || ''}`,
          detail: `+${earned} ${copy.pts} · ${
            currentTargetMeta ? getZoneLabel(currentTargetMeta.zona, lang) : ''
          }`,
        });

        advanceTimerRef.current = window.setTimeout(() => {
          advanceQuestion(nextStatuses, nextScore);
        }, 680);
      } else {
        playWrongTone(soundEnabled);
        setStreak(0);
        setAttemptsOnCurrent((prev) => prev + 1);
        setEliminatedChoices((prev) => [...prev, optionId]);
        const wrongName = KECAMATAN_META_BY_ID[optionId]?.name || '';
        setFeedback({
          type: 'wrong',
          title: lang === 'en' ? `Not ${wrongName}` : `Bukan ${wrongName}`,
          detail:
            lang === 'en' ? 'Choose another district name.' : 'Pilih nama kecamatan lainnya.',
        });
      }
    },
    [
      advanceQuestion,
      attemptsOnCurrent,
      copy.pts,
      currentTargetId,
      currentTargetMeta,
      eliminatedChoices,
      isCompleted,
      lang,
      mode,
      score,
      soundEnabled,
      statuses,
      streak,
      usedHintOnCurrent,
    ]
  );

  const evaluateRankedGuess = useCallback(
    (matched: KecamatanMeta) => {
      if (mode !== 'ranked' || rankedEnded || isCompleted) return;

      const metricLabel = getMetricLabel(rankedMetric, lang);
      const scopeLabel = getRankedScopeLabel(rankedScope, lang);

      // Varian 1: Semua (23) — Wajib berurutan #1 sampai #23, 5 nyawa
      if (rankedScopeCfg.sequential) {
        const targetDistrict = activeRankedList[rankedActiveIndex];
        if (!targetDistrict) return;

        if (matched.id === targetDistrict.id) {
          const nextStatuses: Record<string, DistrictStatus> = {
            ...statuses,
            [matched.id]: 'correct-first',
          };
          const nextScore = score + 100;
          const nextIndex = rankedActiveIndex + 1;

          setStatuses(nextStatuses);
          setScore(nextScore);
          setTypedGuess('');
          setLastMatchedId(matched.id);
          setRankedActiveIndex(nextIndex);
          playCorrectTone(soundEnabled);

          setFeedback({
            type: 'correct',
            title:
              lang === 'en'
                ? `Correct! Rank #${rankedActiveIndex + 1} · ${matched.name}`
                : `Tepat! Peringkat #${rankedActiveIndex + 1} · ${matched.name}`,
            detail: `${formatMetricValue(matched, rankedMetric, lang)} · (${nextIndex}/${rankedScopeCfg.count})`,
          });

          if (nextIndex >= activeRankedList.length) {
            setRankedEnded(true);
            finishQuiz(nextStatuses, nextScore, elapsedSeconds);
          }
          return;
        }

        // If already guessed correctly in an earlier slot, inform without losing a life
        if (statuses[matched.id] === 'correct-first') {
          const alreadyRank = activeRankedList.findIndex((it) => it.id === matched.id) + 1;
          setTypedGuess('');
          setFeedback({
            type: 'info',
            title:
              lang === 'en'
                ? `${matched.name} was already answered at rank #${alreadyRank}`
                : `${matched.name} sudah terjawab di peringkat #${alreadyRank}`,
            detail:
              lang === 'en'
                ? `Currently guessing rank #${rankedActiveIndex + 1}.`
                : `Saat ini tebak peringkat #${rankedActiveIndex + 1}.`,
          });
          return;
        }

        // Wrong rank guess: deduct 1 life & do NOT reveal true rank
        const nextLives = Math.max(0, rankedLives - 1);
        setRankedLives(nextLives);
        setTypedGuess('');
        playWrongTone(soundEnabled);

        if (nextLives <= 0) {
          const nextStatuses: Record<string, DistrictStatus> = { ...statuses };
          for (const item of activeRankedList) {
            if (nextStatuses[item.id] === 'unanswered') {
              nextStatuses[item.id] = 'missed';
            }
          }
          const solved = activeRankedList.filter(
            (it) => nextStatuses[it.id] === 'correct-first'
          ).length;
          setStatuses(nextStatuses);
          setRankedEnded(true);
          setFeedback({
            type: 'wrong',
            title:
              lang === 'en'
                ? `Out of lives! Solved ${solved} of ${rankedScopeCfg.count} ranks.`
                : `Kesempatan habis! ${solved} dari ${rankedScopeCfg.count} peringkat tertebak.`,
            detail:
              lang === 'en'
                ? 'All remaining rank answers are now revealed in the list.'
                : 'Seluruh sisa jawaban peringkat telah ditampilkan di daftar.',
          });
        } else {
          setFeedback({
            type: 'wrong',
            title:
              lang === 'en'
                ? `Nope! ${matched.name} is not rank #${rankedActiveIndex + 1}.`
                : `Bukan! ${matched.name} bukan peringkat #${rankedActiveIndex + 1}.`,
            detail:
              lang === 'en'
                ? `Lives remaining: ${nextLives} of ${rankedScopeCfg.maxLives}.`
                : `Sisa kesempatan: ${nextLives} dari ${rankedScopeCfg.maxLives} nyawa.`,
          });
        }
        return;
      }

      // Varian 2 & 3: 10 Besar (4 nyawa) / 5 Besar (3 nyawa) — Urutan bebas
      const rankIdx = activeRankedList.findIndex((item) => item.id === matched.id);

      if (rankIdx !== -1) {
        if (statuses[matched.id] !== 'unanswered') {
          setTypedGuess('');
          setFeedback({
            type: 'info',
            title:
              lang === 'en'
                ? `${matched.name} is already on the list (#${rankIdx + 1})`
                : `${matched.name} sudah masuk daftar (#${rankIdx + 1})`,
            detail:
              lang === 'en'
                ? `Type another district belonging to ${scopeLabel}.`
                : `Ketik nama kecamatan lain yang termasuk ${scopeLabel}.`,
          });
          return;
        }

        const nextStatuses: Record<string, DistrictStatus> = {
          ...statuses,
          [matched.id]: 'correct-first',
        };
        const nextScore = score + 100;
        const solvedCount = activeRankedList.filter(
          (it) => nextStatuses[it.id] === 'correct-first'
        ).length;

        setStatuses(nextStatuses);
        setScore(nextScore);
        setTypedGuess('');
        setLastMatchedId(matched.id);
        playCorrectTone(soundEnabled);

        setFeedback({
          type: 'correct',
          title:
            lang === 'en'
              ? `Rank #${rankIdx + 1} · ${matched.name}`
              : `Peringkat #${rankIdx + 1} · ${matched.name}`,
          detail: `${formatMetricValue(matched, rankedMetric, lang)} · (${solvedCount}/${rankedScopeCfg.count})`,
        });

        if (solvedCount >= activeRankedList.length) {
          setRankedEnded(true);
          finishQuiz(nextStatuses, nextScore, elapsedSeconds);
        }
        return;
      }

      // District is outside Top 5 / Top 10: deduct 1 life
      const nextLives = Math.max(0, rankedLives - 1);
      setRankedLives(nextLives);
      setTypedGuess('');
      playWrongTone(soundEnabled);

      if (nextLives <= 0) {
        const nextStatuses: Record<string, DistrictStatus> = { ...statuses };
        for (const item of activeRankedList) {
          if (nextStatuses[item.id] === 'unanswered') {
            nextStatuses[item.id] = 'missed';
          }
        }
        const solved = activeRankedList.filter(
          (it) => nextStatuses[it.id] === 'correct-first'
        ).length;
        setStatuses(nextStatuses);
        setRankedEnded(true);
        setFeedback({
          type: 'wrong',
          title:
            lang === 'en'
              ? `Out of lives! Solved ${solved} of ${rankedScopeCfg.count} ranks.`
              : `Kesempatan habis! ${solved} dari ${rankedScopeCfg.count} peringkat tertebak.`,
          detail:
            lang === 'en'
              ? `All remaining ${scopeLabel} answers are now revealed.`
              : `Seluruh sisa jawaban ${scopeLabel} telah ditampilkan.`,
        });
      } else {
        setFeedback({
          type: 'wrong',
          title:
            lang === 'en'
              ? `Nope! ${matched.name} is outside ${scopeLabel} (${metricLabel}).`
              : `Bukan! ${matched.name} tidak masuk ${scopeLabel} ${metricLabel}.`,
          detail:
            lang === 'en'
              ? `Lives remaining: ${nextLives} of ${rankedScopeCfg.maxLives}.`
              : `Sisa kesempatan: ${nextLives} dari ${rankedScopeCfg.maxLives} nyawa.`,
        });
      }
    },
    [
      activeRankedList,
      elapsedSeconds,
      finishQuiz,
      isCompleted,
      lang,
      mode,
      rankedActiveIndex,
      rankedEnded,
      rankedLives,
      rankedMetric,
      rankedScope,
      rankedScopeCfg,
      score,
      soundEnabled,
      statuses,
    ]
  );

  // Auto-match typing handler for 'nameAll' & 'ranked'
  const handleTypedGuessChange = useCallback(
    (rawValue: string) => {
      if (
        (mode === 'nameAll' && (nameAllEnded || isCompleted)) ||
        (mode === 'ranked' && (rankedEnded || isCompleted))
      ) {
        return;
      }

      const normalized = normalizeDistrictQuery(rawValue);
      const matched = normalized ? KECAMATAN_BY_NORMALIZED_NAME[normalized] : undefined;

      // Half-typed / non-matching input never triggers evaluation or life deduction
      if (!matched) {
        setTypedGuess(rawValue);
        return;
      }

      if (mode === 'ranked') {
        evaluateRankedGuess(matched);
        return;
      }

      if (statuses[matched.id] !== 'unanswered') {
        setTypedGuess(rawValue);
        setFeedback({
          type: 'info',
          title:
            lang === 'en'
              ? `${matched.name} is already on the list`
              : `${matched.name} sudah masuk daftar`,
          detail:
            lang === 'en'
              ? 'Type another district name that has not been guessed yet.'
              : 'Ketik nama kecamatan lain yang belum ditebak.',
        });
        return;
      }

      const nextStatuses: Record<string, DistrictStatus> = {
        ...statuses,
        [matched.id]: 'correct-first',
      };
      const nextScore = score + 100;
      const newCount = Object.values(nextStatuses).filter((s) => s === 'correct-first').length;

      setStatuses(nextStatuses);
      setScore(nextScore);
      setTypedGuess('');
      setLastMatchedId(matched.id);
      playCorrectTone(soundEnabled);

      setFeedback({
        type: 'correct',
        title: lang === 'en' ? `Correct! ${matched.name}` : `Tepat! ${matched.name}`,
        detail:
          lang === 'en'
            ? `${newCount} of 23 districts named.`
            : `${newCount} dari 23 kecamatan berhasil disebutkan.`,
      });

      if (newCount >= KECAMATAN_META_LIST.length) {
        setNameAllEnded(true);
        finishQuiz(nextStatuses, nextScore, elapsedSeconds);
      }
    },
    [
      elapsedSeconds,
      evaluateRankedGuess,
      finishQuiz,
      isCompleted,
      lang,
      mode,
      nameAllEnded,
      rankedEnded,
      score,
      soundEnabled,
      statuses,
    ]
  );

  // Explicit Enter / Submit handler for 'ranked' mode
  const handleSubmitRankedGuess = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (mode !== 'ranked' || rankedEnded || isCompleted) return;
      const normalized = normalizeDistrictQuery(typedGuess);
      if (!normalized) return;

      const matched = KECAMATAN_BY_NORMALIZED_NAME[normalized];
      if (matched) {
        evaluateRankedGuess(matched);
      } else {
        setFeedback({
          type: 'info',
          title:
            lang === 'en'
              ? 'District name is incomplete or unrecognized'
              : 'Nama kecamatan belum lengkap atau tidak dikenali',
          detail:
            lang === 'en'
              ? 'Enter one of the 23 official Bekasi Regency district names.'
              : 'Ketik salah satu dari 23 nama kecamatan resmi Kabupaten Bekasi.',
        });
      }
    },
    [evaluateRankedGuess, isCompleted, lang, mode, rankedEnded, typedGuess]
  );

  // Surrender handler for 'nameAll' & 'ranked'
  const handleSurrenderTypedMode = useCallback(() => {
    if (mode !== 'nameAll' && mode !== 'ranked') return;
    playWrongTone(soundEnabled);

    const nextStatuses: Record<string, DistrictStatus> = { ...statuses };
    let guessed = 0;

    if (mode === 'ranked') {
      for (const item of activeRankedList) {
        if (nextStatuses[item.id] === 'unanswered') {
          nextStatuses[item.id] = 'missed';
        } else if (nextStatuses[item.id] === 'correct-first') {
          guessed += 1;
        }
      }
      setStatuses(nextStatuses);
      setTypedGuess('');
      setRankedEnded(true);
      setFeedback({
        type: 'wrong',
        title:
          lang === 'en'
            ? `Gave Up · ${guessed} of ${rankedScopeCfg.count} ranks solved`
            : `Menyerah · ${guessed} dari ${rankedScopeCfg.count} peringkat tertebak`,
        detail:
          lang === 'en'
            ? 'Remaining unguessed ranks are highlighted in red.'
            : 'Sisa peringkat yang belum tertebak ditandai dengan warna merah.',
      });
      return;
    }

    for (const id of Object.keys(nextStatuses)) {
      if (nextStatuses[id] === 'unanswered') {
        nextStatuses[id] = 'missed';
      } else if (nextStatuses[id] === 'correct-first') {
        guessed += 1;
      }
    }

    setStatuses(nextStatuses);
    setTypedGuess('');
    setNameAllEnded(true);

    setFeedback({
      type: 'wrong',
      title:
        lang === 'en'
          ? `Gave Up · ${guessed} of 23 districts named`
          : `Menyerah · ${guessed} dari 23 kecamatan tertebak`,
      detail:
        lang === 'en'
          ? 'Unguessed districts are highlighted in red.'
          : 'Kecamatan yang belum tertebak ditandai dengan warna merah.',
    });
  }, [activeRankedList, lang, mode, rankedScopeCfg.count, soundEnabled, statuses]);

  const advanceNextDuel = useCallback(
    (latestScore: number, latestCorrect: number, latestRound: number) => {
      if (mode !== 'duel') return;

      if (duelFormat === 'questions' && latestRound >= duelQuestionLimit) {
        setIsCompleted(true);
        setSummaryModalHidden(false);
        setSelectedResultId(null);
        playCompleteTone(soundEnabled);
        const accuracy = Math.round((latestCorrect / duelQuestionLimit) * 100);
        saveBestRecordIfBeaten('duelQuestions', latestScore, accuracy, elapsedSeconds);
        return;
      }

      const next = createNextDuelQuestion(
        duelCategory,
        prevDuelPairKeyRef.current,
        usedDuelPairKeysRef.current
      );
      prevDuelPairKeyRef.current = next.pairKey;
      setCurrentDuel(next.question);
      setDuelRoundNum((prev) => prev + 1);
      setDuelChosenId(null);
      setFeedback(null);
      isTransitioningRef.current = false;
    },
    [
      duelCategory,
      duelFormat,
      duelQuestionLimit,
      elapsedSeconds,
      mode,
      saveBestRecordIfBeaten,
      soundEnabled,
    ]
  );

  // Answer handler for 'duel' mode
  const handleAnswerDuel = useCallback(
    (chosenId: string) => {
      if (
        mode !== 'duel' ||
        duelPhase !== 'playing' ||
        !currentDuel ||
        duelChosenId !== null ||
        isCompleted ||
        isTransitioningRef.current
      ) {
        return;
      }

      setDuelChosenId(chosenId);
      const isCorrect = chosenId === currentDuel.winnerId;
      const metaA = KECAMATAN_META_BY_ID[currentDuel.idA];
      const metaB = KECAMATAN_META_BY_ID[currentDuel.idB];
      const winnerMeta = KECAMATAN_META_BY_ID[currentDuel.winnerId];

      const nextAnswered = duelAnsweredCount + 1;
      setDuelAnsweredCount(nextAnswered);

      let nextScore = score;
      let nextCorrect = duelCorrectCount;

      if (isCorrect) {
        const earned = 100 + streak * 15;
        nextScore = score + earned;
        nextCorrect = duelCorrectCount + 1;
        setScore(nextScore);
        setStreak((prev) => prev + 1);
        setDuelCorrectCount(nextCorrect);
        playCorrectTone(soundEnabled);
        setFeedback({
          type: 'correct',
          title:
            lang === 'en'
              ? `Correct! ${winnerMeta.name} wins (+${earned} ${copy.pts})`
              : `Benar! ${winnerMeta.name} lebih unggul (+${earned} ${copy.pts})`,
          detail: `${metaA.name}: ${formatMetricValue(metaA, currentDuel.metric, lang)} · ${metaB.name}: ${formatMetricValue(metaB, currentDuel.metric, lang)}`,
        });
      } else {
        setStreak(0);
        playWrongTone(soundEnabled);
        setFeedback({
          type: 'wrong',
          title:
            lang === 'en'
              ? `Incorrect! ${winnerMeta.name} is higher`
              : `Kurang tepat! Jawabannya ${winnerMeta.name}`,
          detail: `${metaA.name}: ${formatMetricValue(metaA, currentDuel.metric, lang)} · ${metaB.name}: ${formatMetricValue(metaB, currentDuel.metric, lang)}`,
        });
      }

      if (duelFormat === 'timed') {
        isTransitioningRef.current = true;
        advanceTimerRef.current = window.setTimeout(() => {
          advanceNextDuel(nextScore, nextCorrect, duelRoundNum);
        }, 500);
      }
    },
    [
      advanceNextDuel,
      copy.pts,
      currentDuel,
      duelAnsweredCount,
      duelChosenId,
      duelCorrectCount,
      duelFormat,
      duelPhase,
      duelRoundNum,
      isCompleted,
      lang,
      mode,
      score,
      soundEnabled,
      streak,
    ]
  );

  const handleNextDuel = useCallback(() => {
    if (mode !== 'duel' || duelFormat !== 'questions' || duelChosenId === null) return;
    advanceNextDuel(score, duelCorrectCount, duelRoundNum);
  }, [advanceNextDuel, duelChosenId, duelCorrectCount, duelFormat, duelRoundNum, mode, score]);

  const handleUseHint = useCallback(() => {
    if (!currentTargetMeta || isTransitioningRef.current || isCompleted) return;
    setUsedHintOnCurrent(true);
    const nextHintLevel: 1 | 2 = hintLevel === 0 ? 1 : 2;
    setHintLevel(nextHintLevel);

    const clueText = getDistrictClue(currentTargetMeta, lang);
    const zoneText = getZoneLabel(currentTargetMeta.zona, lang);

    if (mode === 'locate') {
      setFeedback({
        type: 'hint',
        title:
          nextHintLevel === 1
            ? zoneText
            : lang === 'en'
            ? `${currentTargetMeta.name} area is highlighted in blue`
            : `Area ${currentTargetMeta.name} ditandai biru`,
        detail: clueText,
      });
    } else if (mode === 'choice') {
      setFeedback({
        type: 'hint',
        title:
          lang === 'en'
            ? `${zoneText} · Code ${currentTargetMeta.kodeWilayah}`
            : `${zoneText} · Kode ${currentTargetMeta.kodeWilayah}`,
        detail: clueText,
      });
    } else if (mode === 'silhouette') {
      setFeedback({
        type: 'hint',
        title:
          nextHintLevel === 1
            ? lang === 'en'
              ? `${zoneText} · Code ${currentTargetMeta.kodeWilayah}`
              : `${zoneText} · Kode ${currentTargetMeta.kodeWilayah}`
            : lang === 'en'
            ? `Borders ${currentTargetMeta.neighbors.slice(0, 3).join(', ')}`
            : `Berbatasan dengan ${currentTargetMeta.neighbors.slice(0, 3).join(', ')}`,
        detail: clueText,
      });
    }
  }, [currentTargetMeta, hintLevel, isCompleted, lang, mode]);

  const handleSkipCurrent = useCallback(() => {
    if (!currentTargetId || isTransitioningRef.current || isCompleted) return;
    isTransitioningRef.current = true;
    playWrongTone(soundEnabled);

    const nextStatuses: Record<string, DistrictStatus> = {
      ...statuses,
      [currentTargetId]: 'missed',
    };
    setStatuses(nextStatuses);
    setStreak(0);
    setHintLevel(0);

    setFeedback({
      type: 'wrong',
      title: `${lang === 'en' ? 'Skipped' : 'Dilewati'}: ${currentTargetMeta?.name || ''}`,
      detail:
        lang === 'en'
          ? `Located in ${currentTargetMeta ? getZoneLabel(currentTargetMeta.zona, lang) : ''}.`
          : `Lokasi berada di ${currentTargetMeta ? getZoneLabel(currentTargetMeta.zona, lang) : ''}.`,
    });

    advanceTimerRef.current = window.setTimeout(() => {
      advanceQuestion(nextStatuses, score);
    }, 800);
  }, [advanceQuestion, currentTargetId, currentTargetMeta, isCompleted, lang, score, soundEnabled, statuses]);

  const handleFocusDistrict = useCallback(
    (id: string) => {
      if (mode === 'explore') {
        setSelectedExploreId(id);
      } else if (
        isCompleted ||
        (mode === 'nameAll' && nameAllEnded) ||
        (mode === 'ranked' && rankedEnded)
      ) {
        setSelectedResultId(id);
      }
      setFocusRequest({ id, nonce: Date.now() });
      setChecklistOpen(false);
    },
    [isCompleted, mode, nameAllEnded, rankedEnded]
  );

  const selectedExploreMeta = selectedExploreId ? KECAMATAN_META_BY_ID[selectedExploreId] : null;
  const selectedResultMeta = selectedResultId ? KECAMATAN_META_BY_ID[selectedResultId] : null;
  const hoveredMeta = hoveredId ? KECAMATAN_META_BY_ID[hoveredId] : null;
  const isQuizResultMapReady =
    isCompleted || (mode === 'nameAll' && nameAllEnded) || (mode === 'ranked' && rankedEnded);
  const isResultMapView = isCompleted && summaryModalHidden;

  const canRevealHoveredName =
    hoveredId &&
    (mode === 'explore' ||
      mode === 'duel' ||
      isQuizResultMapReady ||
      statuses[hoveredId] !== 'unanswered');

  const activeBestRecord =
    mode === 'explore'
      ? null
      : mode === 'duel'
      ? (duelFormat === 'questions' ? bestRecords.duelQuestions : bestRecords.duelTimed) || null
      : mode === 'ranked'
      ? bestRecords[RANKED_SCOPE_CONFIG[rankedScope].recordKey] || null
      : bestRecords[mode] || null;
  const activeModeLabel = getModeLabel(mode, lang);
  const rankedScopeLabel = getRankedScopeLabel(rankedScope, lang);
  const rankedMetricSublabel =
    rankedMetric === 'penduduk'
      ? copy.rankedSubPop
      : rankedMetric === 'luas'
      ? copy.rankedSubArea
      : copy.rankedSubDensity;

  const duelHighlight: DuelMapHighlight | null = useMemo(() => {
    if (mode !== 'duel' || duelPhase !== 'playing' || !currentDuel) return null;
    return {
      idA: currentDuel.idA,
      idB: currentDuel.idB,
      winnerId: currentDuel.winnerId,
      answered: duelChosenId !== null,
    };
  }, [currentDuel, duelChosenId, duelPhase, mode]);

  const nameAllRemainingSeconds = Math.max(0, NAME_ALL_DURATION_SECONDS - elapsedSeconds);
  const duelRemainingSeconds = Math.max(0, duelTimeLimit - elapsedSeconds);

  const hasAnyRecord = useMemo(() => {
    return Object.values(bestRecords).some(Boolean);
  }, [bestRecords]);

  // =========================================================================
  // 1. HALAMAN AWAL (MENU UTAMA)
  // =========================================================================
  if (screen === 'home') {
    return (
      <div
        className={`min-h-[100dvh] w-full ${tokens.appBg} ${tokens.textPrimary} flex flex-col justify-center px-4 py-6 sm:py-10 transition-colors duration-200`}
      >
        <main className="w-full max-w-xl mx-auto space-y-5">
          {/* Pojok Kanan Atas: Pengaturan Bahasa (ID/EN) + Pilihan Tema (4 Preset) */}
          <div className="flex items-center justify-end gap-2">
            {/* Pill Toggle Bahasa (ID / EN) */}
            <div
              role="group"
              aria-label={copy.languageLabel}
              className={`inline-flex items-center p-0.5 rounded-full border ${tokens.border} ${tokens.surface} shadow-xs`}
            >
              {(['id', 'en'] as const).map((code) => {
                const active = lang === code;
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setLang(code)}
                    className={`min-h-[32px] px-3 rounded-full text-xs font-bold tracking-wide transition-colors ${
                      active
                        ? `${tokens.accentBg} text-white`
                        : `${tokens.textMuted} ${tokens.surfaceHover}`
                    }`}
                  >
                    {code.toUpperCase()}
                  </button>
                );
              })}
            </div>

            {/* Tombol Palet / Tema (4 Preset) */}
            <div ref={themePickerRef} className="relative">
              <button
                type="button"
                aria-label={copy.themeButtonLabel}
                aria-expanded={themeMenuOpen}
                aria-haspopup="menu"
                title={copy.themeButtonLabel}
                onClick={() => setThemeMenuOpen((open) => !open)}
                className={`min-h-[36px] px-2.5 rounded-full border ${tokens.border} ${tokens.surface} ${tokens.textSecondary} ${tokens.surfaceHover} shadow-xs transition-colors flex items-center gap-1.5`}
              >
                <Palette className="w-4 h-4 shrink-0" />
                <span
                  aria-hidden="true"
                  className={`w-3.5 h-3.5 rounded-full border ${tokens.borderStrong}`}
                  style={{
                    background: `linear-gradient(135deg, ${tokens.swatchPrimary} 50%, ${tokens.swatchSecondary} 50%)`,
                  }}
                />
              </button>

              {themeMenuOpen && (
                <div
                  role="menu"
                  aria-label={copy.themeMenuTitle}
                  className={`absolute right-0 mt-2 w-60 rounded-2xl border ${tokens.border} ${tokens.surface} shadow-xl p-2 z-50 space-y-1`}
                >
                  <div className={`px-2.5 py-1.5 text-[11px] font-bold ${tokens.textMuted}`}>
                    {copy.themeMenuTitle}
                  </div>
                  {THEME_ORDER.map((presetId) => {
                    const preset = THEME_CONFIG[presetId];
                    const labels = getThemeLabel(presetId, lang);
                    const isSelected = theme === presetId;

                    return (
                      <button
                        key={presetId}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isSelected}
                        onClick={() => {
                          setTheme(presetId);
                          setThemeMenuOpen(false);
                        }}
                        className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition-colors ${
                          isSelected ? tokens.accentSoftBg : tokens.surfaceHover
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            aria-hidden="true"
                            className={`w-6 h-6 rounded-lg border ${tokens.borderStrong} shrink-0`}
                            style={{
                              background: `linear-gradient(135deg, ${preset.swatchPrimary} 55%, ${preset.swatchSecondary} 55%)`,
                            }}
                          />
                          <div className="min-w-0">
                            <div className={`text-xs font-bold ${tokens.textPrimary} truncate`}>
                              {labels.name}
                            </div>
                            <div className={`text-[10px] ${tokens.textMuted} truncate`}>
                              {labels.sub}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className={`w-4 h-4 ${tokens.accentText} shrink-0`} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <header className="space-y-1.5 text-center sm:text-left">
            <h1 className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${tokens.textPrimary}`}>
              {copy.appTitle}
            </h1>
            <p className={`text-sm sm:text-base ${tokens.textMuted}`}>
              {copy.appSubtitle}
            </p>
          </header>

          <nav aria-label={copy.appTitle} className="space-y-2.5">
            {MODE_CARDS.map((card) => {
              const Icon = card.icon;
              const title = getModeCardTitle(card.id, lang);
              const description = getModeDescription(card.id, lang);
              const rec =
                card.id !== 'explore' && card.id !== 'duel' && card.id !== 'ranked'
                  ? bestRecords[card.id]
                  : undefined;
              const duelQRec = card.id === 'duel' ? bestRecords.duelQuestions : undefined;
              const duelTRec = card.id === 'duel' ? bestRecords.duelTimed : undefined;
              const hasDuelRec = Boolean(duelQRec || duelTRec);

              const rankedAllRec = card.id === 'ranked' ? bestRecords.ranked : undefined;
              const ranked10Rec = card.id === 'ranked' ? bestRecords.ranked10 : undefined;
              const ranked5Rec = card.id === 'ranked' ? bestRecords.ranked5 : undefined;
              const hasRankedRec = Boolean(rankedAllRec || ranked10Rec || ranked5Rec);
              const rankedRecParts: string[] = [];
              if (rankedAllRec)
                rankedRecParts.push(`${getRankedScopeLabel('all', lang)}: ${rankedAllRec.bestScore} ${copy.pts}`);
              if (ranked10Rec)
                rankedRecParts.push(`${getRankedScopeLabel('top10', lang)}: ${ranked10Rec.bestScore} ${copy.pts}`);
              if (ranked5Rec)
                rankedRecParts.push(`${getRankedScopeLabel('top5', lang)}: ${ranked5Rec.bestScore} ${copy.pts}`);

              return (
                <div
                  key={card.id}
                  className={`group relative w-full text-left p-4 rounded-2xl ${tokens.surface} border ${tokens.border} ${tokens.cardHover} shadow-xs transition flex items-center justify-between gap-3.5`}
                >
                  <button
                    type="button"
                    aria-label={title}
                    onClick={() => handleEnterMode(card.id)}
                    className="absolute inset-0 rounded-2xl z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  />

                  <div className="relative z-10 pointer-events-none flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl ${tokens.surfaceMuted} ${tokens.textSecondary} flex items-center justify-center shrink-0 transition-colors mt-0.5`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className={`text-base font-bold ${tokens.textPrimary} leading-tight`}>
                        {title}
                      </div>
                      <p className={`text-xs sm:text-sm ${tokens.textMuted} leading-snug`}>
                        {description}
                      </p>
                      <div className={`text-xs ${tokens.textMuted} pt-0.5 flex items-center gap-1.5 flex-wrap`}>
                        {card.id === 'explore' ? (
                          <span>{copy.exploreCardMeta}</span>
                        ) : card.id === 'duel' ? (
                          hasDuelRec ? (
                            <>
                              <span className={`font-mono tabular-nums font-medium ${tokens.textSecondary}`}>
                                {duelQRec
                                  ? `${copy.quizShort}: ${duelQRec.bestScore} ${copy.pts} (${duelQRec.bestAccuracy}%)`
                                  : ''}
                                {duelQRec && duelTRec ? ' · ' : ''}
                                {duelTRec
                                  ? `${copy.timeShort}: ${duelTRec.bestCorrect ?? 0} ${copy.correctShort}`
                                  : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleResetSingleRecord('duel')}
                                aria-label={copy.deleteSingleRecord(title)}
                                title={copy.deleteSingleRecord(title)}
                                className={`pointer-events-auto inline-flex items-center justify-center w-6 h-6 rounded-md ${tokens.textMuted} hover:text-rose-500 ${tokens.surfaceHover} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span>{copy.noRecord}</span>
                          )
                        ) : card.id === 'ranked' ? (
                          hasRankedRec ? (
                            <>
                              <span className={`font-mono tabular-nums font-medium ${tokens.textSecondary}`}>
                                {rankedRecParts.join(' · ')}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleResetSingleRecord('ranked')}
                                aria-label={copy.deleteSingleRecord(title)}
                                title={copy.deleteSingleRecord(title)}
                                className={`pointer-events-auto inline-flex items-center justify-center w-6 h-6 rounded-md ${tokens.textMuted} hover:text-rose-500 ${tokens.surfaceHover} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span>{copy.noRecord}</span>
                          )
                        ) : rec ? (
                          <>
                            <span className={`font-mono tabular-nums font-medium ${tokens.textSecondary}`}>
                              {copy.bestPrefix}: {rec.bestScore} {copy.pts} · {rec.bestAccuracy}% ·{' '}
                              {formatTimeClock(rec.fastestSeconds)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleResetSingleRecord(card.id as PlayableQuizMode)}
                              aria-label={copy.deleteSingleRecord(title)}
                              title={copy.deleteSingleRecord(title)}
                              className={`pointer-events-auto inline-flex items-center justify-center w-6 h-6 rounded-md ${tokens.textMuted} hover:text-rose-500 ${tokens.surfaceHover} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span>{copy.noRecord}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`relative z-10 pointer-events-none w-5 h-5 ${tokens.textMuted} group-hover:translate-x-0.5 transition shrink-0`} />
                </div>
              );
            })}
          </nav>

          {hasAnyRecord && (
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                onClick={() => setConfirmResetAllOpen(true)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold ${tokens.textMuted} hover:text-rose-500 ${tokens.surfaceHover} transition-colors flex items-center gap-1.5`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {copy.resetAllRecords}
              </button>
            </div>
          )}
        </main>

        {/* DIALOG KONFIRMASI RESET SEMUA REKOR */}
        {confirmResetAllOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-records-title"
            onClick={() => setConfirmResetAllOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-sm ${tokens.surface} rounded-2xl border ${tokens.border} shadow-xl p-5 space-y-4`}
            >
              <div className="space-y-1.5">
                <h2 id="reset-records-title" className={`text-base font-bold ${tokens.textPrimary}`}>
                  {copy.resetAllRecords}
                </h2>
                <p className={`text-sm ${tokens.textMuted} leading-relaxed`}>
                  {copy.resetConfirmBody}
                </p>
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmResetAllOpen(false)}
                  className={`min-h-[44px] px-4 rounded-xl border ${tokens.border} ${tokens.surface} ${tokens.textSecondary} text-sm font-semibold ${tokens.surfaceHover} transition-colors`}
                >
                  {copy.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResetAllRecords}
                  className="min-h-[44px] px-4 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors"
                >
                  {copy.deleteRecords}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. HALAMAN PERMAINAN / EKSPLORASI (FOKUS PENUH)
  // =========================================================================
  return (
    <div
      className={`h-[100dvh] w-full flex flex-col ${tokens.appBg} ${tokens.textPrimary} overflow-hidden transition-colors duration-200`}
    >
      {/* HEADER RINGKAS: Kembali (Kiri) | Progres/Skor (Tengah) | Daftar Kecamatan (Kanan) */}
      <header
        className={`h-14 px-2.5 sm:px-5 ${tokens.surface} border-b ${tokens.border} grid grid-cols-[1fr_auto_1fr] items-center gap-2 shrink-0 z-30`}
      >
        <div className="justify-self-start flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleBackToHome}
            aria-label={copy.backToHomeAria}
            className={`min-h-[44px] px-2.5 rounded-xl text-sm font-semibold ${tokens.textSecondary} ${tokens.surfaceHover} active:scale-[0.98] transition flex items-center gap-1.5 whitespace-nowrap shrink-0`}
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>{copy.back}</span>
          </button>
          <span
            aria-hidden="true"
            className={`hidden md:inline-block h-4 w-px ${tokens.isDark ? 'bg-slate-700' : 'bg-slate-200'} shrink-0`}
          />
          <span
            className={`hidden md:inline text-sm font-extrabold tracking-tight ${tokens.textPrimary} whitespace-nowrap truncate`}
          >
            {copy.appTitleShort}
          </span>
        </div>

        <div className="justify-self-center min-w-0">
          {mode === 'explore' ? (
            <div className={`text-xs sm:text-sm font-bold ${tokens.textPrimary} whitespace-nowrap`}>
              <span className="md:hidden">{copy.appTitleShort} · </span>
              {copy.exploreHeader}
            </div>
          ) : mode === 'nameAll' ? (
            <div
              className={`flex items-center gap-1.5 text-xs sm:text-sm font-mono font-semibold tabular-nums ${tokens.textSecondary} whitespace-nowrap`}
            >
              <span className={`hidden md:inline font-sans font-bold ${tokens.textPrimary} mr-1`}>
                {activeModeLabel}
              </span>
              <span className={`hidden md:inline ${tokens.textMuted} opacity-50`} aria-hidden="true">
                ·
              </span>
              <span>{correctOnlyCount}/23</span>
              <span className={`${tokens.textMuted} opacity-50`} aria-hidden="true">
                ·
              </span>
              <span
                className={
                  nameAllTimed && nameAllRemainingSeconds <= 30 && !nameAllEnded
                    ? 'text-rose-500 font-bold'
                    : ''
                }
              >
                {nameAllTimed
                  ? formatTimeClock(nameAllRemainingSeconds)
                  : formatTimeClock(elapsedSeconds)}
              </span>
            </div>
          ) : mode === 'ranked' ? (
            <div
              className={`flex items-center gap-1.5 text-xs sm:text-sm font-mono font-semibold tabular-nums ${tokens.textSecondary} whitespace-nowrap`}
            >
              <span className={`hidden md:inline font-sans font-bold ${tokens.textPrimary} mr-1`}>
                {activeModeLabel}
              </span>
              <span className={`hidden md:inline ${tokens.textMuted} opacity-50`} aria-hidden="true">
                ·
              </span>
              <span>
                {rankedSolvedCount}/{rankedScopeCfg.count}
              </span>
              <span className={`${tokens.textMuted} opacity-50`} aria-hidden="true">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-rose-500">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                <span>{rankedLives}</span>
              </span>
              <span className={`${tokens.textMuted} opacity-50`} aria-hidden="true">
                ·
              </span>
              <span>{formatTimeClock(elapsedSeconds)}</span>
            </div>
          ) : mode === 'duel' ? (
            duelPhase === 'setup' ? (
              <div className={`text-xs sm:text-sm font-bold ${tokens.textPrimary} whitespace-nowrap`}>
                {copy.duelSetupHeader}
              </div>
            ) : duelFormat === 'timed' ? (
              <div
                className={`flex items-center gap-1.5 text-xs sm:text-sm font-mono font-semibold tabular-nums ${tokens.textSecondary} whitespace-nowrap`}
              >
                <span className={`hidden md:inline font-sans font-bold ${tokens.textPrimary} mr-1`}>
                  {activeModeLabel}
                </span>
                <span className={`hidden md:inline ${tokens.textMuted} opacity-50`} aria-hidden="true">
                  ·
                </span>
                <span>
                  {copy.correct} {duelCorrectCount}
                </span>
                <span className={`${tokens.textMuted} opacity-50`} aria-hidden="true">
                  ·
                </span>
                <span>{score}</span>
                <span className={`${tokens.textMuted} opacity-50`} aria-hidden="true">
                  ·
                </span>
                <span className={duelRemainingSeconds <= 10 ? 'text-rose-500 font-bold' : ''}>
                  {formatTimeClock(duelRemainingSeconds)}
                </span>
              </div>
            ) : (
              <div
                className={`flex items-center gap-1.5 text-xs sm:text-sm font-mono font-semibold tabular-nums ${tokens.textSecondary} whitespace-nowrap`}
              >
                <span className={`hidden md:inline font-sans font-bold ${tokens.textPrimary} mr-1`}>
                  {activeModeLabel}
                </span>
                <span className={`hidden md:inline ${tokens.textMuted} opacity-50`} aria-hidden="true">
                  ·
                </span>
                <span>
                  {duelRoundNum}/{duelQuestionLimit}
                </span>
                <span className={`${tokens.textMuted} opacity-50`} aria-hidden="true">
                  ·
                </span>
                <span>{score}</span>
                <span className={`${tokens.textMuted} opacity-50`} aria-hidden="true">
                  ·
                </span>
                <span>{formatTimeClock(elapsedSeconds)}</span>
              </div>
            )
          ) : (
            <div
              className={`flex items-center gap-1.5 text-xs sm:text-sm font-mono font-semibold tabular-nums ${tokens.textSecondary} whitespace-nowrap`}
            >
              <span className={`hidden md:inline font-sans font-bold ${tokens.textPrimary} mr-1`}>
                {activeModeLabel}
              </span>
              <span className={`hidden md:inline ${tokens.textMuted} opacity-50`} aria-hidden="true">
                ·
              </span>
              <span>{answeredCount}/23</span>
              <span className={`${tokens.textMuted} opacity-50`} aria-hidden="true">
                ·
              </span>
              <span>{score}</span>
              <span className={`${tokens.textMuted} opacity-50`} aria-hidden="true">
                ·
              </span>
              <span>{formatTimeClock(elapsedSeconds)}</span>
            </div>
          )}
        </div>

        <div className="justify-self-end flex items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            aria-label={soundEnabled ? copy.muteSound : copy.enableSound}
            title={soundEnabled ? copy.muteSound : copy.enableSound}
            className={`min-w-[40px] min-h-[44px] flex items-center justify-center rounded-xl ${tokens.textMuted} ${tokens.surfaceHover} transition-colors`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {mode !== 'explore' && !(mode === 'duel' && duelPhase === 'setup') && (
            <button
              type="button"
              onClick={() => startNewRound(mode)}
              aria-label={copy.restartQuiz}
              title={copy.restartQuiz}
              className={`min-w-[40px] min-h-[44px] flex items-center justify-center rounded-xl ${tokens.textMuted} ${tokens.surfaceHover} transition-colors`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setChecklistOpen(true)}
            aria-label={copy.listAria}
            title={copy.listTitle}
            className={`min-w-[44px] min-h-[44px] px-2 sm:px-3 flex items-center justify-center gap-1.5 rounded-xl ${tokens.textSecondary} ${tokens.surfaceHover} transition-colors text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0`}
          >
            <ListChecks className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">{copy.listButton}</span>
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* LAYAR PENGATURAN SINGKAT 'ADU DATA' SEBELUM MULAI                   */}
      {/* =================================================================== */}
      {mode === 'duel' && duelPhase === 'setup' ? (
        <main className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:py-10 flex items-start sm:items-center justify-center">
          <div
            className={`w-full max-w-lg ${tokens.surface} rounded-2xl border ${tokens.border} shadow-xs p-5 sm:p-6 space-y-5`}
          >
            <div className="space-y-1">
              <h2 className={`text-xl font-extrabold ${tokens.textPrimary}`}>
                {copy.duelSetupTitle}
              </h2>
              <p className={`text-xs sm:text-sm ${tokens.textMuted}`}>
                {copy.duelSetupSubtitle}
              </p>
            </div>

            {/* 1. Pilihan Kategori Perbandingan */}
            <div className="space-y-2">
              <div className={`text-xs font-bold ${tokens.textSecondary}`}>
                {copy.duelCatHeading}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'mixed', title: copy.duelMixedTitle, sub: copy.duelMixedSub },
                    { id: 'penduduk', title: copy.duelPopTitle, sub: copy.duelPopSub },
                    { id: 'luas', title: copy.duelAreaTitle, sub: copy.duelAreaSub },
                    { id: 'kepadatan', title: copy.duelDensityTitle, sub: copy.duelDensitySub },
                  ] as const
                ).map((cat) => {
                  const active = duelCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setDuelCategory(cat.id)}
                      className={`p-3 rounded-xl border text-left transition ${
                        active
                          ? `${tokens.accentSoftBg} ${tokens.accentSoftBorder} ${tokens.accentSoftText}`
                          : `${tokens.surface} ${tokens.border} ${tokens.textPrimary} ${tokens.surfaceHover}`
                      }`}
                    >
                      <div className="text-xs sm:text-sm font-bold leading-tight">{cat.title}</div>
                      <div className={`text-[11px] ${tokens.textMuted} mt-0.5 leading-snug`}>
                        {cat.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Pilihan Format Tantangan */}
            <div className="space-y-3">
              <div className={`text-xs font-bold ${tokens.textSecondary}`}>
                {copy.duelFormatHeading}
              </div>

              <div
                role="tablist"
                aria-label={copy.duelFormatHeading}
                className={`grid grid-cols-2 gap-1 p-1 rounded-xl ${tokens.tabContainerBg}`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={duelFormat === 'questions'}
                  onClick={() => setDuelFormat('questions')}
                  className={`min-h-[38px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    duelFormat === 'questions' ? tokens.tabActiveBg : tokens.tabInactiveText
                  }`}
                >
                  {copy.duelFormatQuestions}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={duelFormat === 'timed'}
                  onClick={() => setDuelFormat('timed')}
                  className={`min-h-[38px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    duelFormat === 'timed' ? tokens.tabActiveBg : tokens.tabInactiveText
                  }`}
                >
                  {copy.duelFormatTimed}
                </button>
              </div>

              {duelFormat === 'questions' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    {([10, 15, 20, 25] as const).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setDuelQuestionLimit(cnt)}
                        className={`min-h-[42px] px-2 rounded-xl border text-xs font-bold font-mono tabular-nums transition ${
                          duelQuestionLimit === cnt
                            ? `${tokens.accentBg} border-transparent text-white`
                            : `${tokens.surface} ${tokens.border} ${tokens.textSecondary} ${tokens.surfaceHover}`
                        }`}
                      >
                        {cnt} {copy.questionsSuffix}
                      </button>
                    ))}
                  </div>
                  <div className={`text-xs ${tokens.textMuted} flex items-center justify-between pt-0.5`}>
                    <span>{copy.duelRecordQuestions}</span>
                    <span className={`font-mono tabular-nums font-medium ${tokens.textSecondary}`}>
                      {bestRecords.duelQuestions
                        ? `${bestRecords.duelQuestions.bestScore} ${copy.pts} · ${bestRecords.duelQuestions.bestAccuracy}% · ${formatTimeClock(bestRecords.duelQuestions.fastestSeconds)}`
                        : copy.noRecord}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {([30, 45, 60] as const).map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setDuelTimeLimit(sec)}
                        className={`min-h-[42px] px-2 rounded-xl border text-xs font-bold font-mono tabular-nums transition ${
                          duelTimeLimit === sec
                            ? `${tokens.accentBg} border-transparent text-white`
                            : `${tokens.surface} ${tokens.border} ${tokens.textSecondary} ${tokens.surfaceHover}`
                        }`}
                      >
                        {sec} {copy.secondsSuffix}
                      </button>
                    ))}
                  </div>
                  <p className={`text-[11px] ${tokens.textMuted} leading-snug`}>
                    {copy.duelTimedTip}
                  </p>
                  <div className={`text-xs ${tokens.textMuted} flex items-center justify-between`}>
                    <span>{copy.duelRecordTimed}</span>
                    <span className={`font-mono tabular-nums font-medium ${tokens.textSecondary}`}>
                      {bestRecords.duelTimed
                        ? `${bestRecords.duelTimed.bestCorrect ?? 0} ${copy.correctShort} · ${bestRecords.duelTimed.bestScore} ${copy.pts} · ${bestRecords.duelTimed.bestAccuracy}%`
                        : copy.noRecord}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => startDuelRound()}
              className={`w-full min-h-[48px] px-4 rounded-xl ${tokens.accentBg} ${tokens.accentHover} text-white text-sm font-semibold active:scale-[0.99] transition`}
            >
              {copy.startDuelBtn}
            </button>
          </div>
        </main>
      ) : mode === 'ranked' && !isResultMapView ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Category Switcher + Scope Switcher + Lives Bar */}
          <div className={`${tokens.surface} border-b ${tokens.border} px-3 sm:px-6 py-2 shrink-0`}>
            <div className="max-w-2xl mx-auto space-y-1.5">
              {/* Kategori Peringkat */}
              <div
                role="tablist"
                aria-label={activeModeLabel}
                className={`grid grid-cols-3 gap-1 p-1 rounded-xl ${tokens.tabContainerBg}`}
              >
                {RANKED_METRICS.map((metricId) => (
                  <button
                    key={metricId}
                    type="button"
                    role="tab"
                    aria-selected={rankedMetric === metricId}
                    onClick={() => startNewRound('ranked', { rankedCategory: metricId })}
                    className={`min-h-[34px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      rankedMetric === metricId ? tokens.tabActiveBg : tokens.tabInactiveText
                    }`}
                  >
                    {getMetricLabel(metricId, lang)}
                  </button>
                ))}
              </div>

              {/* Pilihan Cakupan Peringkat (Semua 23 / 10 Besar / 5 Besar) */}
              <div
                role="tablist"
                aria-label="Ranked scope"
                className={`grid grid-cols-3 gap-1 p-1 rounded-xl ${tokens.tabContainerBg}`}
              >
                {RANKED_SCOPE_OPTIONS.map((scopeId) => {
                  const active = rankedScope === scopeId;
                  return (
                    <button
                      key={scopeId}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => startNewRound('ranked', { rankedVariant: scopeId })}
                      className={`min-h-[32px] px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap ${
                        active ? `${tokens.accentBg} text-white shadow-xs` : tokens.tabInactiveText
                      }`}
                    >
                      {getRankedScopeLabel(scopeId, lang)}
                    </button>
                  );
                })}
              </div>

              {/* Status Bar: Aturan Varian + Indikator Nyawa di Atas Layar */}
              <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px]">
                <span className={`${tokens.textMuted} truncate`}>
                  {rankedScopeCfg.sequential
                    ? `${copy.rankedSubSequential} · ${rankedMetricSublabel}`
                    : `${copy.rankedSubFree} (${rankedScopeLabel}) · ${rankedMetricSublabel}`}
                </span>

                <div
                  className="flex items-center gap-1.5 shrink-0"
                  aria-label={`${rankedLives}/${rankedScopeCfg.maxLives} ${copy.livesUnit}`}
                >
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: rankedScopeCfg.maxLives }).map((_, idx) => {
                      const alive = idx < rankedLives;
                      return (
                        <Heart
                          key={idx}
                          className={`w-3.5 h-3.5 transition-colors ${
                            alive
                              ? 'fill-rose-500 text-rose-500'
                              : tokens.isDark
                              ? 'fill-slate-800 text-slate-600'
                              : 'fill-slate-100 text-slate-300'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      rankedLives <= 1 ? 'text-rose-500' : tokens.textSecondary
                    }`}
                  >
                    {rankedLives}/{rankedScopeCfg.maxLives} {copy.livesUnit}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mini Map Kabupaten Bekasi at Top */}
          <div className={`h-36 sm:h-48 w-full border-b ${tokens.border} shrink-0 relative`}>
            <BekasiVectorMap
              mode="ranked"
              statuses={statuses}
              targetId={null}
              wrongFlashId={null}
              hintPulseId={null}
              selectedExploreId={null}
              hoveredId={hoveredId}
              onHoverDistrict={setHoveredId}
              onSelectDistrict={handleMapSelectDistrict}
              compact={true}
              isResultView={rankedEnded || isCompleted}
              selectedResultId={selectedResultId}
              lang={lang}
              theme={theme}
            />
          </div>

          {/* Auto-Match Typing Input (with Fair Validation & Submit) & Surrender */}
          <div className={`${tokens.surface} border-b ${tokens.border} px-3.5 sm:px-6 py-2.5 shrink-0`}>
            <div className="max-w-2xl mx-auto space-y-2">
              {!rankedEnded && !isCompleted ? (
                <form onSubmit={handleSubmitRankedGuess} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={typedGuess}
                    onChange={(e) => handleTypedGuessChange(e.target.value)}
                    placeholder={
                      rankedScopeCfg.sequential
                        ? copy.rankedPlaceholderSeq(rankedActiveIndex + 1)
                        : copy.rankedPlaceholderFree(rankedScopeLabel)
                    }
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label={copy.submitCheck}
                    className={`flex-1 min-w-0 min-h-[44px] px-3.5 rounded-xl border ${tokens.inputBorder} ${tokens.inputBg} text-sm font-medium ${tokens.textPrimary} placeholder:opacity-60 ${tokens.inputFocusBg} focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600`}
                  />
                  <button
                    type="submit"
                    className={`min-h-[44px] px-3.5 rounded-xl ${
                      tokens.isDark ? 'bg-slate-100 text-slate-900 hover:bg-white' : 'bg-slate-900 text-white hover:bg-slate-800'
                    } text-xs sm:text-sm font-semibold active:scale-[0.98] transition whitespace-nowrap shrink-0`}
                  >
                    {copy.submitCheck}
                  </button>
                  <button
                    type="button"
                    onClick={handleSurrenderTypedMode}
                    className={`min-h-[44px] px-3 rounded-xl border text-xs sm:text-sm font-semibold active:scale-[0.98] transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      tokens.isDark
                        ? 'border-rose-800 bg-rose-950/60 text-rose-200 hover:bg-rose-900/70'
                        : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    <Flag className="w-4 h-4" />
                    <span className="hidden sm:inline">{copy.giveUp}</span>
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCompleted(true);
                      setSummaryModalHidden(false);
                    }}
                    className={`flex-1 min-h-[44px] px-4 rounded-xl border ${tokens.borderStrong} ${tokens.surface} ${tokens.textSecondary} text-xs sm:text-sm font-semibold ${tokens.surfaceHover} transition whitespace-nowrap`}
                  >
                    {copy.viewSummary}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startNewRound('ranked', {
                        rankedCategory: rankedMetric,
                        rankedVariant: rankedScope,
                      })
                    }
                    className={`flex-1 min-h-[44px] px-4 rounded-xl ${tokens.accentBg} ${tokens.accentHover} text-white text-xs sm:text-sm font-semibold active:scale-[0.98] transition flex items-center justify-center gap-1.5 whitespace-nowrap`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    {copy.playAgain}
                  </button>
                </div>
              )}

              {feedback && (
                <div
                  className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs border ${
                    feedback.type === 'correct'
                      ? tokens.bannerCorrect
                      : feedback.type === 'wrong'
                      ? tokens.bannerWrong
                      : tokens.bannerInfo
                  }`}
                >
                  <span className="font-semibold truncate">{feedback.title}</span>
                  {feedback.detail && (
                    <span className="font-mono text-[11px] tabular-nums shrink-0 opacity-90">
                      {feedback.detail}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ranked Slots (23 / 10 / 5) */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-6 py-3 pb-safe">
            <div className="max-w-2xl mx-auto space-y-1.5">
              {activeRankedList.map((item, idx) => {
                const rank = idx + 1;
                const status = statuses[item.id] || 'unanswered';
                const isGuessed = status === 'correct-first';
                const isMissed = status === 'missed';
                const isRevealed = isGuessed || isMissed;
                const isJustMatched = lastMatchedId === item.id;
                const isActiveTarget =
                  rankedScopeCfg.sequential &&
                  !rankedEnded &&
                  !isCompleted &&
                  idx === rankedActiveIndex;

                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      rankedSlotRefs.current[idx] = el;
                    }}
                    className={`min-h-[48px] px-3.5 py-2 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                      isActiveTarget
                        ? tokens.isDark
                          ? 'border-2 border-sky-400 bg-sky-950/60 ring-2 ring-sky-900'
                          : 'border-2 border-blue-600 bg-blue-50/70 ring-2 ring-blue-100'
                        : isJustMatched
                        ? tokens.isDark
                          ? 'border bg-emerald-950/70 border-emerald-500'
                          : 'border bg-emerald-50 border-emerald-400'
                        : isGuessed
                        ? tokens.isDark
                          ? `border ${tokens.surface} border-emerald-700`
                          : 'border bg-white border-emerald-200'
                        : isMissed
                        ? tokens.isDark
                          ? 'border bg-rose-950/60 border-rose-800'
                          : 'border bg-rose-50/70 border-rose-200'
                        : `border ${tokens.surfaceSubtle} ${tokens.border}`
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg font-mono text-xs font-bold tabular-nums flex items-center justify-center shrink-0 ${
                          isActiveTarget
                            ? `${tokens.accentBg} text-white`
                            : isGuessed
                            ? 'bg-emerald-600 text-white'
                            : isMissed
                            ? 'bg-rose-600 text-white'
                            : `${tokens.surfaceMuted} ${tokens.textMuted}`
                        }`}
                      >
                        {rank}
                      </span>
                      {isRevealed ? (
                        <div className="min-w-0">
                          <div className={`text-sm font-bold ${tokens.textPrimary} truncate`}>
                            {item.name}
                          </div>
                          <div className={`text-[11px] ${tokens.textMuted}`}>
                            {getZoneLabel(item.zona, lang)}
                          </div>
                        </div>
                      ) : isActiveTarget ? (
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-bold ${
                              tokens.isDark ? 'text-sky-200' : 'text-blue-800'
                            }`}
                          >
                            {copy.rankedTargetTitle(rank)}
                          </div>
                          <div
                            className={`text-[11px] ${
                              tokens.isDark ? 'text-sky-400' : 'text-blue-600'
                            }`}
                          >
                            {copy.rankedTargetSub}
                          </div>
                        </div>
                      ) : (
                        <span className={`text-xs font-medium ${tokens.textMuted} opacity-75`}>
                          {copy.rankedSlotEmpty(rank)}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      {isRevealed ? (
                        <span
                          className={`font-mono text-xs sm:text-sm font-bold tabular-nums ${
                            isMissed
                              ? tokens.isDark
                                ? 'text-rose-300'
                                : 'text-rose-700'
                              : tokens.textPrimary
                          }`}
                        >
                          {formatMetricValue(item, rankedMetric, lang)}
                        </span>
                      ) : isActiveTarget ? (
                        <span
                          className={`font-mono text-xs font-semibold ${
                            tokens.isDark ? 'text-sky-300' : 'text-blue-600'
                          }`}
                        >
                          ?
                        </span>
                      ) : (
                        <span className={`font-mono text-xs ${tokens.textMuted} opacity-50`}>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ================================================================= */
        /* KANVAS PETA UTAMA + PANEL BAWAH (UNTUK 6 MODE LAINNYA)            */
        /* ================================================================= */
        <>
          <main className="relative flex-1 min-h-0 w-full">
            <BekasiVectorMap
              mode={mode}
              statuses={statuses}
              targetId={isQuizResultMapReady ? null : currentTargetId}
              wrongFlashId={isQuizResultMapReady ? null : wrongFlashId}
              hintPulseId={
                mode === 'locate' && hintLevel === 2 && !isQuizResultMapReady
                  ? currentTargetId
                  : null
              }
              selectedExploreId={selectedExploreId}
              hoveredId={hoveredId}
              onHoverDistrict={setHoveredId}
              onSelectDistrict={handleMapSelectDistrict}
              focusRequest={focusRequest}
              choroplethFilter={mode === 'explore' ? choroplethFilter : 'none'}
              duelHighlight={duelHighlight}
              isResultView={isQuizResultMapReady}
              selectedResultId={selectedResultId}
              lang={lang}
              theme={theme}
            />

            {/* Subtle Hover Readout */}
            {hoveredMeta && (
              <div
                className={`pointer-events-none hidden sm:flex items-center gap-2 absolute top-4 right-4 z-20 px-3 py-1.5 rounded-lg ${tokens.surfaceElevated} border ${tokens.border} shadow-xs text-xs font-medium ${tokens.textSecondary}`}
              >
                <span>
                  {canRevealHoveredName
                    ? hoveredMeta.name
                    : mode === 'silhouette'
                    ? copy.silhouetteMapHint
                    : copy.unansweredMapHint}
                </span>
                <span aria-hidden="true" className={`${tokens.textMuted} opacity-50`}>
                  ·
                </span>
                <span className={tokens.textMuted}>
                  {mode === 'silhouette' && !canRevealHoveredName
                    ? copy.guessItsName
                    : mode === 'explore' && choroplethFilter !== 'none'
                    ? formatMetricValue(hoveredMeta, choroplethFilter, lang)
                    : getZoneLabel(hoveredMeta.zona, lang)}
                </span>
              </div>
            )}

            {/* Compact Color Legend (Bottom Left when not exploring Choropleth) */}
            {mode !== 'explore' && mode !== 'duel' && (
              <div
                className={`pointer-events-none hidden sm:flex items-center gap-4 absolute bottom-4 left-5 z-10 text-xs font-medium ${tokens.textMuted}`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                  {copy.correct}
                </span>
                {mode !== 'nameAll' && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                    {copy.assisted}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                  {mode === 'nameAll' ? copy.missedNameAll : copy.missed}
                </span>
              </div>
            )}
          </main>

          {/* KOTAK PERTANYAAN / INPUT / ATLAS DI BAGIAN BAWAH */}
          <section
            aria-label={activeModeLabel}
            className={`${tokens.surface} border-t ${tokens.border} px-3.5 sm:px-6 pt-3 pb-safe shrink-0 z-30`}
          >
            <div className="max-w-2xl mx-auto w-full space-y-2.5">
              {/* Inline Feedback Banner (hidden when completed Result Bar is active) */}
              {feedback && !isCompleted && (
                <div
                  className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs border ${
                    feedback.type === 'correct'
                      ? tokens.bannerCorrect
                      : feedback.type === 'wrong'
                      ? tokens.bannerWrong
                      : feedback.type === 'hint'
                      ? tokens.bannerHint
                      : tokens.bannerInfo
                  }`}
                >
                  {feedback.type === 'correct' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : feedback.type === 'wrong' ? (
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  ) : (
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 leading-snug">
                    <span className="font-semibold">{feedback.title}</span>
                    {feedback.detail && (
                      <span className="block text-[11px] opacity-85 mt-0.5">{feedback.detail}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Result Map Inspection Bar (shown when Quiz is Completed, including 'Lihat Peta Hasil' toggle mode) */}
              {isCompleted && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className={`text-xs font-medium ${tokens.textMuted}`}>
                      {selectedResultMeta ? (
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold ${tokens.textPrimary}`}>
                            {selectedResultMeta.name}
                          </span>
                          <span>· {getZoneLabel(selectedResultMeta.zona, lang)} ·</span>
                          {(() => {
                            const st = statuses[selectedResultMeta.id];
                            if (st === 'correct-first') {
                              return (
                                <span className={tokens.isDark ? 'text-emerald-400 font-semibold' : 'text-emerald-700 font-semibold'}>
                                  {copy.correct}
                                </span>
                              );
                            }
                            if (st === 'correct-assisted') {
                              return (
                                <span className={tokens.isDark ? 'text-amber-400 font-semibold' : 'text-amber-700 font-semibold'}>
                                  {copy.assisted}
                                </span>
                              );
                            }
                            if (st === 'missed') {
                              return (
                                <span className={tokens.isDark ? 'text-rose-400 font-semibold' : 'text-rose-700 font-semibold'}>
                                  {copy.missed}
                                </span>
                              );
                            }
                            return <span>{copy.statusNotInRound}</span>;
                          })()}
                        </span>
                      ) : (
                        copy.resultMapBanner
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 text-xs font-mono tabular-nums">
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                        <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block" />
                        {mode === 'duel'
                          ? duelCorrectCount
                          : mode === 'ranked'
                          ? rankedSolvedCount
                          : Object.values(statuses).filter((s) => s === 'correct-first').length}
                      </span>
                      {mode !== 'nameAll' && mode !== 'duel' && mode !== 'ranked' && (
                        <span className="inline-flex items-center gap-1 text-amber-500 font-semibold">
                          <span className="w-2 h-2 rounded-xs bg-amber-500 inline-block" />
                          {Object.values(statuses).filter((s) => s === 'correct-assisted').length}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-rose-500 font-semibold">
                        <span className="w-2 h-2 rounded-xs bg-rose-500 inline-block" />
                        {mode === 'duel'
                          ? Math.max(
                              0,
                              (duelFormat === 'questions' ? duelQuestionLimit : duelAnsweredCount) -
                                duelCorrectCount
                            )
                          : mode === 'ranked'
                          ? Math.max(0, rankedScopeCfg.count - rankedSolvedCount)
                          : Object.values(statuses).filter((s) => s === 'missed').length}
                      </span>
                      <span className={`font-bold ${tokens.textPrimary}`}>
                        {score} {copy.pts}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSummaryModalHidden(false)}
                      className={`flex-1 min-h-[44px] px-4 rounded-xl border ${tokens.borderStrong} ${tokens.surfaceSubtle} ${tokens.textPrimary} text-xs sm:text-sm font-semibold ${tokens.surfaceHover} active:scale-[0.99] transition flex items-center justify-center gap-1.5 whitespace-nowrap`}
                    >
                      <Award className="w-4 h-4 shrink-0" />
                      {copy.showScoreModal}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startNewRound(mode, {
                          timed: mode === 'nameAll' ? nameAllTimed : undefined,
                          rankedCategory: mode === 'ranked' ? rankedMetric : undefined,
                          rankedVariant: mode === 'ranked' ? rankedScope : undefined,
                        })
                      }
                      className={`flex-1 min-h-[44px] px-4 rounded-xl ${tokens.accentBg} ${tokens.accentHover} text-white text-xs sm:text-sm font-semibold active:scale-[0.99] transition flex items-center justify-center gap-1.5 whitespace-nowrap`}
                    >
                      <RotateCcw className="w-4 h-4 shrink-0" />
                      {copy.playAgain}
                    </button>
                  </div>
                </div>
              )}

              {/* Mode 1: Cari Peta */}
              {!isCompleted && mode === 'locate' && currentTargetMeta && (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-xs font-medium ${tokens.textMuted}`}>
                      {copy.questionOf23(Math.min(currentIndex + 1, 23))}
                    </div>
                    <div className={`text-lg sm:text-xl font-extrabold ${tokens.textPrimary} truncate mt-0.5`}>
                      {currentTargetMeta.name}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleUseHint}
                      className={`min-h-[44px] px-3 sm:px-3.5 rounded-xl border ${tokens.border} ${tokens.surfaceSubtle} ${tokens.textSecondary} text-xs sm:text-sm font-semibold ${tokens.surfaceHover} active:scale-[0.98] transition flex items-center gap-1.5 whitespace-nowrap shrink-0`}
                    >
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      {hintLevel >= 1 ? copy.highlightHint : copy.hint}
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipCurrent}
                      aria-label={copy.skipAria}
                      className={`min-h-[44px] min-w-[44px] px-3 sm:px-3.5 rounded-xl border ${tokens.border} ${tokens.surface} ${tokens.textMuted} text-xs sm:text-sm font-semibold ${tokens.surfaceHover} active:scale-[0.98] transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0`}
                    >
                      <SkipForward className="w-4 h-4" />
                      {copy.skip}
                    </button>
                  </div>
                </div>
              )}

              {/* Mode 2 & 3: Tebak Nama & Tebak Bentuk Wilayah */}
              {!isCompleted && (mode === 'choice' || mode === 'silhouette') && currentTargetId && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-xs sm:text-sm font-semibold ${tokens.textPrimary}`}>
                      <span className={`font-mono ${tokens.textMuted} mr-1.5 tabular-nums`}>
                        {Math.min(currentIndex + 1, 23)}/23
                      </span>
                      {mode === 'silhouette' ? copy.silhouettePrompt : copy.choicePrompt}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {mode === 'choice' && (
                        <button
                          type="button"
                          onClick={() => handleFocusDistrict(currentTargetId)}
                          className={`min-h-[36px] px-2.5 rounded-lg text-xs font-semibold ${tokens.accentText} ${tokens.surfaceHover} transition whitespace-nowrap`}
                        >
                          {copy.focus}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleUseHint}
                        className={`min-h-[36px] px-2.5 rounded-lg text-xs font-semibold ${
                          tokens.isDark ? 'text-amber-400' : 'text-amber-700'
                        } ${tokens.surfaceHover} transition whitespace-nowrap flex items-center gap-1`}
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        {copy.hint}
                      </button>
                      <button
                        type="button"
                        onClick={handleSkipCurrent}
                        className={`min-h-[36px] px-2.5 rounded-lg text-xs font-semibold ${tokens.textMuted} ${tokens.surfaceHover} transition whitespace-nowrap`}
                      >
                        {copy.skip}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {choiceOptions.map((optId) => {
                      const optName = KECAMATAN_META_BY_ID[optId]?.name || '';
                      const isEliminated = eliminatedChoices.includes(optId);
                      const isSuccess = choiceSuccessId === optId;

                      return (
                        <button
                          key={optId}
                          type="button"
                          disabled={isEliminated || Boolean(choiceSuccessId)}
                          onClick={() => handleSelectChoiceOption(optId)}
                          className={`min-h-[44px] px-3 sm:px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold text-left transition flex items-center justify-between gap-1.5 ${
                            isSuccess
                              ? 'bg-emerald-600 border-emerald-700 text-white'
                              : isEliminated
                              ? tokens.isDark
                                ? 'bg-rose-950/50 border-rose-800 text-rose-400 line-through'
                                : 'bg-rose-50 border-rose-200 text-rose-400 line-through'
                              : `${tokens.surface} ${tokens.border} ${tokens.textPrimary} ${tokens.surfaceHover} active:scale-[0.98]`
                          }`}
                        >
                          <span className="truncate">{optName}</span>
                          {isSuccess && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                          {isEliminated && <XCircle className="w-4 h-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mode 4: Sebutkan Semua (Name Them All) */}
              {!isCompleted && mode === 'nameAll' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div
                      role="tablist"
                      aria-label={copy.timer3Min}
                      className={`inline-flex items-center gap-1 p-1 rounded-xl ${tokens.tabContainerBg}`}
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={nameAllTimed}
                        onClick={() => startNewRound('nameAll', { timed: true })}
                        className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap ${
                          nameAllTimed ? tokens.tabActiveBg : tokens.tabInactiveText
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {copy.timer3Min}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={!nameAllTimed}
                        onClick={() => startNewRound('nameAll', { timed: false })}
                        className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          !nameAllTimed ? tokens.tabActiveBg : tokens.tabInactiveText
                        }`}
                      >
                        {copy.relaxedMode}
                      </button>
                    </div>

                    <span className={`text-xs font-mono font-semibold tabular-nums ${tokens.textMuted}`}>
                      {copy.progressLabel}: {correctOnlyCount}/23
                    </span>
                  </div>

                  {!nameAllEnded && !isCompleted ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={typedGuess}
                        onChange={(e) => handleTypedGuessChange(e.target.value)}
                        placeholder={copy.typeDistrictAutoPlaceholder}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        aria-label={copy.typeDistrictAutoPlaceholder}
                        className={`flex-1 min-h-[44px] px-3.5 rounded-xl border ${tokens.inputBorder} ${tokens.inputBg} text-sm font-medium ${tokens.textPrimary} placeholder:opacity-60 ${tokens.inputFocusBg} focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600`}
                      />
                      <button
                        type="button"
                        onClick={handleSurrenderTypedMode}
                        className={`min-h-[44px] px-3.5 rounded-xl border text-xs sm:text-sm font-semibold active:scale-[0.98] transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                          tokens.isDark
                            ? 'border-rose-800 bg-rose-950/60 text-rose-200 hover:bg-rose-900/70'
                            : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        <Flag className="w-4 h-4" />
                        {copy.giveUp}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCompleted(true);
                          setSummaryModalHidden(false);
                        }}
                        className={`flex-1 min-h-[44px] px-4 rounded-xl border ${tokens.borderStrong} ${tokens.surface} ${tokens.textSecondary} text-xs sm:text-sm font-semibold ${tokens.surfaceHover} transition whitespace-nowrap`}
                      >
                        {copy.viewSummary}
                      </button>
                      <button
                        type="button"
                        onClick={() => startNewRound('nameAll', { timed: nameAllTimed })}
                        className={`flex-1 min-h-[44px] px-4 rounded-xl ${tokens.accentBg} ${tokens.accentHover} text-white text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap`}
                      >
                        <RotateCcw className="w-4 h-4" />
                        {copy.playAgain}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 5: Adu Data (Perbandingan 2 Kecamatan) */}
              {!isCompleted && mode === 'duel' && duelPhase === 'playing' && currentDuel && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-xs sm:text-sm font-bold ${tokens.textPrimary}`}>
                      <span className={`font-mono ${tokens.textMuted} mr-1.5 tabular-nums font-semibold`}>
                        {duelFormat === 'questions'
                          ? `${duelRoundNum}/${duelQuestionLimit}`
                          : `#${duelRoundNum}`}
                      </span>
                      {currentDuel.metric === 'penduduk'
                        ? copy.duelQuestionPop
                        : currentDuel.metric === 'luas'
                        ? copy.duelQuestionArea
                        : copy.duelQuestionDensity}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { label: 'A', id: currentDuel.idA, badgeBg: 'bg-blue-700 text-white' },
                      { label: 'B', id: currentDuel.idB, badgeBg: 'bg-orange-600 text-white' },
                    ].map((opt) => {
                      const meta = KECAMATAN_META_BY_ID[opt.id];
                      const answered = duelChosenId !== null;
                      const isChosen = duelChosenId === opt.id;
                      const isWinner = currentDuel.winnerId === opt.id;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={answered}
                          onClick={() => handleAnswerDuel(opt.id)}
                          className={`min-h-[52px] px-3 py-2.5 rounded-xl border text-left transition flex flex-col justify-center gap-1 ${
                            answered
                              ? isWinner
                                ? tokens.isDark
                                  ? 'bg-emerald-950/70 border-emerald-500 text-emerald-100'
                                  : 'bg-emerald-50 border-emerald-500 text-emerald-950'
                                : isChosen
                                ? tokens.isDark
                                  ? 'bg-rose-950/70 border-rose-500 text-rose-100'
                                  : 'bg-rose-50 border-rose-400 text-rose-900'
                                : `${tokens.surfaceSubtle} ${tokens.border} ${tokens.textMuted}`
                              : `${tokens.surface} ${tokens.border} ${tokens.textPrimary} ${tokens.surfaceHover} active:scale-[0.98]`
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 w-full">
                            <span className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-5 h-5 rounded-md text-[11px] font-extrabold flex items-center justify-center shrink-0 ${opt.badgeBg}`}
                              >
                                {opt.label}
                              </span>
                              <span className="text-xs sm:text-sm font-bold truncate">
                                {meta.name}
                              </span>
                            </span>
                            {answered && isWinner && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            )}
                            {answered && isChosen && !isWinner && (
                              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                            )}
                          </div>

                          {answered && (
                            <div
                              className={`font-mono text-xs font-bold tabular-nums pl-7 ${
                                tokens.isDark ? 'text-slate-100' : 'text-slate-800'
                              }`}
                            >
                              {formatMetricValue(meta, currentDuel.metric, lang)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {duelChosenId !== null && duelFormat === 'questions' && (
                    <button
                      type="button"
                      onClick={handleNextDuel}
                      className={`w-full min-h-[44px] px-4 rounded-xl ${tokens.accentBg} ${tokens.accentHover} text-white text-sm font-semibold active:scale-[0.99] transition flex items-center justify-center gap-1.5`}
                    >
                      <span>
                        {duelRoundNum >= duelQuestionLimit
                          ? copy.duelViewResults
                          : copy.duelNextRound}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Mode 6: Jelajah (Atlas Interaktif + Choropleth + Data Demografi) */}
              {mode === 'explore' && (
                <div className="space-y-2.5">
                  {/* Choropleth Filter Segmented Bar */}
                  <div
                    role="tablist"
                    aria-label={copy.exploreHeader}
                    className={`grid grid-cols-4 gap-1 p-1 rounded-xl ${tokens.tabContainerBg}`}
                  >
                    {CHOROPLETH_FILTERS.map((filterId) => (
                      <button
                        key={filterId}
                        type="button"
                        role="tab"
                        aria-selected={choroplethFilter === filterId}
                        onClick={() => setChoroplethFilter(filterId)}
                        className={`min-h-[34px] px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                          choroplethFilter === filterId
                            ? tokens.tabActiveBg
                            : tokens.tabInactiveText
                        }`}
                      >
                        {filterId === 'none'
                          ? copy.standardFilter
                          : getMetricLabel(filterId, lang)}
                      </button>
                    ))}
                  </div>

                  {selectedExploreMeta ? (
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <h2 className={`text-base sm:text-lg font-extrabold ${tokens.textPrimary} truncate`}>
                          {selectedExploreMeta.name}
                        </h2>
                        <span className={`text-xs ${tokens.textMuted} whitespace-nowrap shrink-0`}>
                          {getZoneLabel(selectedExploreMeta.zona, lang)} ·{' '}
                          {selectedExploreMeta.kodeWilayah}
                        </span>
                      </div>

                      {/* 3 Demographic Metrics */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className={`px-2.5 py-2 rounded-xl ${tokens.surfaceSubtle} border ${tokens.border}`}>
                          <div className={`text-[10px] sm:text-[11px] ${tokens.textMuted}`}>
                            {copy.metricPopulation}
                          </div>
                          <div className={`font-mono text-xs sm:text-sm font-bold tabular-nums ${tokens.textPrimary} mt-0.5 leading-snug`}>
                            {formatPenduduk(selectedExploreMeta.penduduk, lang)}
                          </div>
                        </div>
                        <div className={`px-2.5 py-2 rounded-xl ${tokens.surfaceSubtle} border ${tokens.border}`}>
                          <div className={`text-[10px] sm:text-[11px] ${tokens.textMuted}`}>
                            {copy.metricArea}
                          </div>
                          <div className={`font-mono text-xs sm:text-sm font-bold tabular-nums ${tokens.textPrimary} mt-0.5 leading-snug`}>
                            {formatLuas(selectedExploreMeta.luas, lang)}
                          </div>
                        </div>
                        <div className={`px-2.5 py-2 rounded-xl ${tokens.surfaceSubtle} border ${tokens.border}`}>
                          <div className={`text-[10px] sm:text-[11px] ${tokens.textMuted}`}>
                            {copy.metricDensity}
                          </div>
                          <div className={`font-mono text-xs sm:text-sm font-bold tabular-nums ${tokens.textPrimary} mt-0.5 leading-snug`}>
                            {formatKepadatan(selectedExploreMeta.kepadatan, lang)}
                          </div>
                        </div>
                      </div>

                      <p className={`hidden sm:block text-xs ${tokens.textMuted} leading-relaxed`}>
                        {getDistrictClue(selectedExploreMeta, lang)}
                      </p>
                    </div>
                  ) : (
                    <p className={`text-xs sm:text-sm ${tokens.textMuted} py-2`}>
                      {copy.exploreEmptyPrompt}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* DRAWER / BOTTOM SHEET DAFTAR 23 KECAMATAN */}
      {checklistOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={copy.listTitle}
          onClick={() => setChecklistOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full sm:max-w-sm ${tokens.surface} rounded-t-3xl sm:rounded-none border-t sm:border-t-0 sm:border-l ${tokens.border} max-h-[82dvh] sm:max-h-none sm:h-full flex flex-col overflow-hidden shadow-xl`}
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center">
              <div className={`w-10 h-1 rounded-full ${tokens.isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
            </div>
            <div className={`px-5 py-3.5 border-b ${tokens.border} flex items-center justify-between`}>
              <div>
                <h2 className={`text-base font-bold ${tokens.textPrimary}`}>
                  {copy.listTitle}
                </h2>
                <p className={`text-xs ${tokens.textMuted}`}>
                  {mode === 'explore'
                    ? copy.listExploreSub
                    : mode === 'duel'
                    ? copy.listDuelSub
                    : mode === 'ranked'
                    ? copy.listRankedSub(rankedSolvedCount, rankedScopeCfg.count)
                    : copy.listQuizSub(answeredCount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChecklistOpen(false)}
                aria-label={copy.closeListAria}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl ${tokens.textMuted} ${tokens.surfaceHover}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeBestRecord && (
              <div
                className={`px-5 py-2 ${tokens.surfaceSubtle} border-b ${tokens.border} flex items-center justify-between text-xs ${tokens.textMuted}`}
              >
                <span>
                  {copy.bestRecordLabel} (
                  {mode === 'ranked'
                    ? `${activeModeLabel} · ${rankedScopeLabel}`
                    : activeModeLabel}
                  )
                </span>
                <span className={`font-mono font-semibold tabular-nums ${tokens.textPrimary}`}>
                  {activeBestRecord.bestScore} {copy.pts}
                </span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-2 py-1 pb-safe">
              <DistrictChecklist
                mode={mode}
                statuses={statuses}
                selectedExploreId={selectedExploreId}
                onFocusDistrict={handleFocusDistrict}
                isResultView={isQuizResultMapReady}
                lang={lang}
                theme={theme}
              />
            </div>
          </div>
        </div>
      )}

      {/* END OF QUIZ SUMMARY MODAL */}
      <QuizSummaryModal
        isOpen={isCompleted && !summaryModalHidden}
        mode={mode}
        statuses={statuses}
        score={score}
        elapsedSeconds={mode === 'duel' && duelFormat === 'timed' ? duelTimeLimit : elapsedSeconds}
        bestRecord={activeBestRecord}
        isNewBest={isNewBest}
        customTotal={
          mode === 'duel'
            ? duelFormat === 'questions'
              ? duelQuestionLimit
              : duelAnsweredCount
            : mode === 'ranked'
            ? rankedScopeCfg.count
            : undefined
        }
        customFirstTryCount={
          mode === 'duel'
            ? duelCorrectCount
            : mode === 'ranked'
            ? rankedSolvedCount
            : undefined
        }
        customMissedCount={
          mode === 'duel'
            ? (duelFormat === 'questions' ? duelQuestionLimit : duelAnsweredCount) - duelCorrectCount
            : mode === 'ranked'
            ? rankedScopeCfg.count - rankedSolvedCount
            : undefined
        }
        customModeLabel={
          mode === 'duel'
            ? duelFormat === 'questions'
              ? `${activeModeLabel} (${duelQuestionLimit} ${copy.questionsSuffix})`
              : `${activeModeLabel} (Time Attack ${duelTimeLimit} ${copy.secondsSuffix})`
            : mode === 'ranked'
            ? `${activeModeLabel} · ${rankedScopeLabel} (${getMetricLabel(rankedMetric, lang)})`
            : undefined
        }
        customHeadline={
          mode === 'duel'
            ? duelFormat === 'questions'
              ? copy.summaryNQuestionsDone(duelQuestionLimit)
              : lang === 'en'
              ? `Time's Up! (${duelCorrectCount} ${copy.correctShort})`
              : `Waktu Habis! (${duelCorrectCount} Benar)`
            : mode === 'ranked'
            ? rankedLives <= 0
              ? lang === 'en'
                ? `Out of Lives (${rankedSolvedCount}/${rankedScopeCfg.count})`
                : `Nyawa Habis (${rankedSolvedCount}/${rankedScopeCfg.count})`
              : rankedSolvedCount >= rankedScopeCfg.count
              ? lang === 'en'
                ? `${rankedScopeLabel} Completed`
                : `${rankedScopeLabel} Selesai`
              : lang === 'en'
              ? `Session Ended (${rankedSolvedCount}/${rankedScopeCfg.count})`
              : `Sesi Berhenti (${rankedSolvedCount}/${rankedScopeCfg.count})`
            : undefined
        }
        customRecordSummary={
          mode === 'duel' && activeBestRecord
            ? duelFormat === 'timed'
              ? `${activeBestRecord.bestCorrect ?? 0} ${copy.correctShort} · ${activeBestRecord.bestScore} ${copy.pts} · ${activeBestRecord.bestAccuracy}%`
              : `${activeBestRecord.bestScore} ${copy.pts} · ${activeBestRecord.bestAccuracy}% · ${formatTimeClock(activeBestRecord.fastestSeconds)}`
            : undefined
        }
        onPlayAgain={() =>
          startNewRound(mode, {
            timed: mode === 'nameAll' ? nameAllTimed : undefined,
            rankedCategory: mode === 'ranked' ? rankedMetric : undefined,
            rankedVariant: mode === 'ranked' ? rankedScope : undefined,
          })
        }
        onChangeSettings={
          mode === 'duel'
            ? () => {
                clearPendingTimers();
                setIsCompleted(false);
                setSummaryModalHidden(false);
                setSelectedResultId(null);
                setDuelPhase('setup');
              }
            : undefined
        }
        onViewResultMap={() => setSummaryModalHidden(true)}
        onExploreMap={() => {
          setIsCompleted(false);
          setSummaryModalHidden(false);
          setSelectedResultId(null);
          setMode('explore');
        }}
        onInspectDistrict={(id) => {
          setSummaryModalHidden(true);
          setSelectedResultId(id);
          setFocusRequest({ id, nonce: Date.now() });
        }}
        onBackToHome={handleBackToHome}
        lang={lang}
        theme={theme}
      />
    </div>
  );
}
