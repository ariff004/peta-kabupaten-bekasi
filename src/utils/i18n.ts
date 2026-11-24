import type {
  DemographicMetric,
  KecamatanMeta,
  Language,
  QuizMode,
  RankedScope,
  ThemePreset,
  WilayahZona,
} from '../types/quiz';

export const DISTRICT_CLUES_EN: Record<string, string> = {
  '3216150':
    'Northernmost district along the Java Sea coast, known for mangrove forests and the Citarum River estuary.',
  '3216140':
    'Located in the north, bordering Muara Gembong to the north and Karawang Regency to the east.',
  '3216100':
    'Northwestern coastal district directly bordering North Jakarta and Bekasi City.',
  '3216090':
    'Positioned between Tarumajaya and Sukawangi, bordering Bekasi City along its southern side.',
  '3216111':
    'Agrarian northern district flanked by Babelan to the west and Tambelang to the southeast.',
  '3216121':
    'Located in the north-central area between Sukawangi, Cabangbungin, and Pebayuran.',
  '3216130':
    'Expansive northeastern district stretching along the banks of the Citarum River.',
  '3216110':
    'Compact northern district nestled between Sukawangi, Sukatani, and Tambun Utara.',
  '3216120':
    'Connects the north-central area west of Pebayuran and north of Karangbahagia.',
  '3216082':
    'Situated on the west-central side, bordering Bekasi City to the west and Tambun Selatan to the south.',
  '3216081':
    'Densely populated west-central corridor bordering Bekasi City directly to the west.',
  '3216070':
    'Located right between Tambun Selatan and Cikarang Barat in Bekasi Regency’s central corridor.',
  '3216062':
    'Lies just northeast of Cikarang Utara and southwest of Pebayuran.',
  '3216050':
    'Eastern gateway of Bekasi Regency, sharing a direct border with Karawang Regency.',
  '3216061':
    'Primary commercial hub of Cikarang, surrounded by Cibitung, Cikarang Barat, Karangbahagia, and Cikarang Timur.',
  '3216071':
    'Strategic industrial hub (MM2100) east of Cibitung and north of Setu.',
  '3216041':
    'Home to Wibawa Mukti Stadium, positioned between Cikarang Utara, Kedungwaringin, and Cikarang Pusat.',
  '3216022':
    'Administrative capital of Bekasi Regency (Kota Deltamas), east of Cikarang Selatan.',
  '3216023':
    'Major industrial and residential hub south of Cikarang Barat/Utara, including Lippo Cikarang and EJIP.',
  '3216010':
    'Southwestern district bordering Bekasi City and Bogor Regency.',
  '3216021':
    'Southern district between Setu and Cibarusah, just southwest of Cikarang Pusat.',
  '3216030':
    'Hilly southern district bordering Bogor Regency and Bojongmangu.',
  '3216031':
    'Southernmost district of Bekasi Regency, bordering both Bogor and Karawang Regencies.',
};

export function getDistrictClue(meta: KecamatanMeta, lang: Language): string {
  if (lang === 'en') {
    return DISTRICT_CLUES_EN[meta.id] || meta.clue;
  }
  return meta.clue;
}

export function getZoneLabel(zona: WilayahZona, lang: Language): string {
  if (lang === 'en') {
    if (zona === 'Utara') return 'North Zone';
    if (zona === 'Tengah') return 'Central Zone';
    return 'South Zone';
  }
  return `Zona ${zona}`;
}

export function getMetricLabel(metric: DemographicMetric, lang: Language): string {
  if (lang === 'en') {
    if (metric === 'penduduk') return 'Population';
    if (metric === 'luas') return 'Area';
    return 'Density';
  }
  if (metric === 'penduduk') return 'Penduduk';
  if (metric === 'luas') return 'Luas Area';
  return 'Kepadatan';
}

export function getRankedScopeLabel(scope: RankedScope, lang: Language): string {
  if (lang === 'en') {
    if (scope === 'all') return 'All (23)';
    if (scope === 'top10') return 'Top 10';
    return 'Top 5';
  }
  if (scope === 'all') return 'Semua (23)';
  if (scope === 'top10') return '10 Besar';
  return '5 Besar';
}

export function getModeLabel(mode: QuizMode, lang: Language): string {
  const map: Record<QuizMode, { id: string; en: string }> = {
    locate: { id: 'Cari Peta', en: 'Map Finder' },
    choice: { id: 'Tebak Nama', en: 'Name the District' },
    silhouette: { id: 'Tebak Bentuk Wilayah', en: 'Guess the Shape' },
    nameAll: { id: 'Sebutkan Semua', en: 'Name Them All' },
    ranked: { id: 'Peringkat Wilayah', en: 'District Rankings' },
    duel: { id: 'Adu Data', en: 'Data Duel' },
    explore: { id: 'Jelajah', en: 'Explore' },
  };
  return map[mode][lang];
}

export function getModeDescription(mode: QuizMode, lang: Language): string {
  const map: Record<QuizMode, { id: string; en: string }> = {
    locate: {
      id: 'Tunjuk lokasi kecamatan yang diminta pada peta buta.',
      en: 'Tap the requested district on the blank map.',
    },
    choice: {
      id: 'Pilih nama kecamatan yang tepat untuk wilayah disorot biru.',
      en: 'Pick the correct district name for the highlighted area.',
    },
    silhouette: {
      id: 'Kenali kecamatan hanya dari bentuk batas wilayahnya.',
      en: 'Identify each district solely from its boundary shape.',
    },
    nameAll: {
      id: 'Ketik seluruh 23 nama kecamatan langsung di atas peta buta.',
      en: 'Type all 23 district names directly onto the blank map.',
    },
    ranked: {
      id: 'Lengkapi daftar peringkat 1–23 berdasarkan penduduk, luas, atau kepadatan.',
      en: 'Fill rankings 1–23 by population, land area, or density.',
    },
    duel: {
      id: 'Bandingkan 2 kecamatan di peta berdasarkan data demografi resmi.',
      en: 'Compare 2 districts on the map using official demographic data.',
    },
    explore: {
      id: 'Lihat peta tematik choropleth dan profil lengkap 23 kecamatan.',
      en: 'Explore thematic choropleth maps and all 23 district profiles.',
    },
  };
  return map[mode][lang];
}

export function getModeCardTitle(mode: QuizMode, lang: Language): string {
  if (mode === 'explore') {
    return lang === 'en' ? 'Explore (Interactive Atlas)' : 'Jelajah (Atlas Interaktif)';
  }
  return getModeLabel(mode, lang);
}

export function getThemeLabel(theme: ThemePreset, lang: Language): { name: string; sub: string } {
  const map: Record<ThemePreset, { id: { name: string; sub: string }; en: { name: string; sub: string } }> = {
    light: {
      id: { name: 'Terang (Light)', sub: 'Putih & abu-abu bersih' },
      en: { name: 'Light', sub: 'Clean white & soft slate' },
    },
    dark: {
      id: { name: 'Gelap (Dark Mode)', sub: 'Latar gelap kontras tinggi' },
      en: { name: 'Dark Mode', sub: 'High-contrast dark canvas' },
    },
    sepia: {
      id: { name: 'Kertas Atlas (Sepia)', sub: 'Krem hangat bernuansa klasik' },
      en: { name: 'Atlas Sepia', sub: 'Warm classic paper tone' },
    },
    ocean: {
      id: { name: 'Biru Pesisir (Ocean)', sub: 'Biru lembut & aksen bahari' },
      en: { name: 'Coastal Ocean', sub: 'Soft coastal blue tones' },
    },
  };
  return map[theme][lang];
}

export const UI_COPY = {
  id: {
    pageTitle: 'Peta Kabupaten Bekasi — Kuis 23 Kecamatan',
    appTitle: 'Peta Kabupaten Bekasi',
    appTitleShort: 'Peta Kab. Bekasi',
    appSubtitle: 'Kuis Interaktif 23 Kecamatan Kabupaten Bekasi',
    languageLabel: 'Pilihan bahasa',
    themeButtonLabel: 'Pilih tema latar belakang',
    themeMenuTitle: 'Tema Latar Belakang',
    noRecord: 'Belum ada rekor',
    bestPrefix: 'Rekor',
    pts: 'poin',
    correctShort: 'benar',
    quizShort: 'Soal',
    timeShort: 'Waktu',
    exploreCardMeta: '23 kecamatan · Peta tematik & demografi',
    resetAllRecords: 'Reset Semua Rekor',
    resetConfirmBody: 'Yakin ingin menghapus seluruh rekor skor terbaik?',
    cancel: 'Batal',
    deleteRecords: 'Hapus Rekor',
    deleteSingleRecord: (title: string) => `Hapus rekor ${title}`,
    back: 'Kembali',
    backToHomeAria: 'Kembali ke Menu Utama',
    backToHome: 'Kembali ke Menu Utama',
    exploreHeader: 'Jelajah 23 Kecamatan',
    duelSetupHeader: 'Pengaturan Adu Data',
    muteSound: 'Matikan suara',
    enableSound: 'Aktifkan suara',
    restartQuiz: 'Ulangi kuis',
    listButton: 'Daftar',
    listAria: 'Lihat daftar 23 kecamatan',
    listTitle: 'Daftar 23 Kecamatan',
    closeListAria: 'Tutup daftar',
    listExploreSub: 'Ketuk nama untuk menyorot lokasi di peta',
    listDuelSub: 'Daftar referensi wilayah Kabupaten Bekasi',
    listRankedSub: (done: number, total: number) => `${done} dari ${total} peringkat diselesaikan`,
    listQuizSub: (done: number) => `${done} dari 23 wilayah telah diselesaikan`,
    bestRecordLabel: 'Rekor terbaik',
    correct: 'Tepat',
    assisted: 'Dibantu',
    missed: 'Lewat',
    missedNameAll: 'Belum Tertebak',
    pending: 'Belum',
    unansweredDistrict: 'Kecamatan belum terjawab',
    unansweredMapHint: 'Wilayah belum terjawab',
    silhouetteMapHint: 'Bentuk wilayah kecamatan',
    guessItsName: 'Tebak namanya',
    pinchZoomTip: 'Cubit untuk zoom · Geser untuk pan',
    showLabels: 'Tampilkan label',
    hideLabels: 'Sembunyikan label',
    zoomIn: 'Perbesar peta',
    zoomOut: 'Perkecil peta',
    resetFit: 'Reset posisi peta (Fit Bounds)',
    resetMiniFit: 'Reset posisi peta',
    questionOf23: (n: number) => `Soal ${n} dari 23 · Tunjuk wilayah pada peta`,
    hint: 'Petunjuk',
    highlightHint: 'Tandai',
    skip: 'Lewati',
    skipAria: 'Lewati kecamatan ini',
    focus: 'Fokus',
    choicePrompt: 'Kecamatan manakah yang disorot biru?',
    silhouettePrompt: 'Kecamatan manakah pemilik bentuk wilayah ini?',
    timer3Min: 'Timer 3 Menit',
    relaxedMode: 'Mode Santai',
    progressLabel: 'Progres',
    typeDistrictAutoPlaceholder: 'Ketik nama kecamatan (otomatis cocok)...',
    giveUp: 'Menyerah',
    viewSummary: 'Lihat Ringkasan',
    playAgain: 'Main Lagi',
    submitCheck: 'Cek',
    duelSetupTitle: 'Adu Data Kecamatan',
    duelSetupSubtitle:
      'Pilih kategori perbandingan dan format tantangan sebelum permainan dimulai.',
    duelCatHeading: '1. Kategori Perbandingan',
    duelFormatHeading: '2. Format Tantangan',
    duelMixedTitle: 'Campuran',
    duelMixedSub: 'Penduduk, luas & kepadatan',
    duelPopTitle: 'Jumlah Penduduk',
    duelPopSub: 'Total populasi (jiwa)',
    duelAreaTitle: 'Luas Area',
    duelAreaSub: 'Luas wilayah (km²)',
    duelDensityTitle: 'Kepadatan',
    duelDensitySub: 'Kepadatan (jiwa/km²)',
    duelFormatQuestions: 'Mode Jumlah Soal',
    duelFormatTimed: 'Batas Waktu (Time Attack)',
    questionsSuffix: 'Soal',
    secondsSuffix: 'Detik',
    duelRecordQuestions: 'Rekor Mode Soal',
    duelRecordTimed: 'Rekor Time Attack',
    duelTimedTip:
      'Jawab secepat mungkin sebelum waktu habis (jeda umpan balik otomatis 0,5 detik per soal).',
    startDuelBtn: 'Mulai Adu Data',
    duelQuestionPop: 'Mana yang jumlah penduduknya lebih banyak?',
    duelQuestionArea: 'Mana yang wilayahnya lebih luas?',
    duelQuestionDensity: 'Mana yang lebih padat penduduknya?',
    duelNextRound: 'Lanjut ke Ronde Berikutnya',
    duelViewResults: 'Lihat Hasil Akhir',
    standardFilter: 'Standar',
    metricPopulation: 'Jumlah Penduduk',
    metricArea: 'Luas Area',
    metricDensity: 'Kepadatan',
    exploreEmptyPrompt:
      'Ketuk wilayah mana saja pada peta untuk melihat detail penduduk, luas area, dan kepadatan kecamatan.',
    rankedSubSequential: 'Wajib berurutan #1→#23',
    rankedSubFree: 'Urutan bebas',
    livesUnit: 'Nyawa',
    rankedTargetTitle: (rank: number) => `Target Peringkat #${rank}`,
    rankedTargetSub: 'Ketik nama kecamatan untuk slot ini',
    rankedSlotEmpty: (rank: number) => `Slot peringkat #${rank}`,
    rankedPlaceholderSeq: (rank: number) => `Ketik kecamatan peringkat #${rank}...`,
    rankedPlaceholderFree: (scopeLabel: string) =>
      `Ketik nama kecamatan ${scopeLabel} (urutan bebas)...`,
    rankedSubPop: 'Terbanyak ke Tersedikit',
    rankedSubArea: 'Terluas ke Terkecil',
    rankedSubDensity: 'Terpadat ke Terlenggang',
    summaryPrefix: 'Hasil Kuis',
    summaryAll23Done: '23 Kecamatan Selesai',
    summaryNQuestionsDone: (n: number) => `${n} Soal Selesai`,
    summaryNewBest: (label: string) => `Rekor pribadi baru tercapai untuk ${label}.`,
    summaryScore: 'Skor',
    summaryAccuracy: 'Akurasi',
    summaryTime: 'Waktu',
    summaryBreakdownTitle: 'Rincian Penguasaan',
    summaryCorrectAnswers: 'Jawaban Benar',
    summaryFirstTry: 'Tepat Percobaan Pertama',
    summaryWithHint: 'Dengan Bantuan / Ulang',
    summaryWrongAnswers: 'Jawaban Salah',
    summarySkippedWrong: 'Dilewati / Salah',
    summaryBestRecord: 'Rekor Terbaik',
    summaryReviewTitle: (n: number) => `Perlu Diingat Kembali (${n})`,
    summaryMissedChip: 'Belum Tertebak',
    summaryExploreMap: 'Jelajah Peta',
    summaryChangeSettings: 'Ubah Pengaturan',
    viewResultMap: 'Lihat Peta Hasil',
    showScoreModal: 'Tampilkan Modal Skor',
    resultMapBanner: 'Peta Hasil Kuis · Geser atau perbesar peta untuk melihat warna & nama kecamatan',
    statusNotInRound: 'Di luar cakupan',
  },
  en: {
    pageTitle: 'Bekasi Regency Map — 23 Districts Quiz',
    appTitle: 'Bekasi Regency Map',
    appTitleShort: 'Bekasi Regency',
    appSubtitle: 'Interactive Quiz of 23 Districts in Bekasi Regency',
    languageLabel: 'Language selector',
    themeButtonLabel: 'Choose background theme',
    themeMenuTitle: 'Background Theme',
    noRecord: 'No record yet',
    bestPrefix: 'Best',
    pts: 'pts',
    correctShort: 'correct',
    quizShort: 'Quiz',
    timeShort: 'Timed',
    exploreCardMeta: '23 districts · Thematic maps & demographics',
    resetAllRecords: 'Reset All Records',
    resetConfirmBody: 'Are you sure you want to delete all saved best scores?',
    cancel: 'Cancel',
    deleteRecords: 'Delete Records',
    deleteSingleRecord: (title: string) => `Delete ${title} record`,
    back: 'Back',
    backToHomeAria: 'Back to Main Menu',
    backToHome: 'Back to Main Menu',
    exploreHeader: 'Explore 23 Districts',
    duelSetupHeader: 'Data Duel Setup',
    muteSound: 'Mute sound',
    enableSound: 'Enable sound',
    restartQuiz: 'Restart quiz',
    listButton: 'List',
    listAria: 'View list of 23 districts',
    listTitle: '23 Districts Directory',
    closeListAria: 'Close list',
    listExploreSub: 'Tap a name to highlight it on the map',
    listDuelSub: 'Reference directory of Bekasi Regency districts',
    listRankedSub: (done: number, total: number) => `${done} of ${total} ranks completed`,
    listQuizSub: (done: number) => `${done} of 23 districts completed`,
    bestRecordLabel: 'Best record',
    correct: 'Correct',
    assisted: 'Assisted',
    missed: 'Missed',
    missedNameAll: 'Missed',
    pending: 'Pending',
    unansweredDistrict: 'Unanswered district',
    unansweredMapHint: 'Unanswered district',
    silhouetteMapHint: 'District boundary shape',
    guessItsName: 'Guess its name',
    pinchZoomTip: 'Pinch to zoom · Drag to pan',
    showLabels: 'Show labels',
    hideLabels: 'Hide labels',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    resetFit: 'Reset map view (Fit Bounds)',
    resetMiniFit: 'Reset map view',
    questionOf23: (n: number) => `Question ${n} of 23 · Tap the area on the map`,
    hint: 'Hint',
    highlightHint: 'Highlight',
    skip: 'Skip',
    skipAria: 'Skip this district',
    focus: 'Focus',
    choicePrompt: 'Which district is highlighted in blue?',
    silhouettePrompt: 'Which district matches this boundary shape?',
    timer3Min: '3-Min Timer',
    relaxedMode: 'Relaxed Mode',
    progressLabel: 'Progress',
    typeDistrictAutoPlaceholder: 'Type district name (auto-matches)...',
    giveUp: 'Give Up',
    viewSummary: 'View Summary',
    playAgain: 'Play Again',
    submitCheck: 'Submit',
    duelSetupTitle: 'District Data Duel',
    duelSetupSubtitle: 'Choose a comparison category and challenge format before starting.',
    duelCatHeading: '1. Comparison Category',
    duelFormatHeading: '2. Challenge Format',
    duelMixedTitle: 'Mixed',
    duelMixedSub: 'Population, area & density',
    duelPopTitle: 'Population',
    duelPopSub: 'Total residents',
    duelAreaTitle: 'Land Area',
    duelAreaSub: 'Area size (km²)',
    duelDensityTitle: 'Density',
    duelDensitySub: 'Residents per km²',
    duelFormatQuestions: 'Question Count',
    duelFormatTimed: 'Time Attack',
    questionsSuffix: 'Questions',
    secondsSuffix: 'Secs',
    duelRecordQuestions: 'Question Mode Best',
    duelRecordTimed: 'Time Attack Best',
    duelTimedTip:
      'Answer as fast as possible before time runs out (0.5s auto-advance feedback per round).',
    startDuelBtn: 'Start Data Duel',
    duelQuestionPop: 'Which district has a larger population?',
    duelQuestionArea: 'Which district has a larger land area?',
    duelQuestionDensity: 'Which district has a higher population density?',
    duelNextRound: 'Next Round',
    duelViewResults: 'View Final Results',
    standardFilter: 'Standard',
    metricPopulation: 'Population',
    metricArea: 'Area',
    metricDensity: 'Density',
    exploreEmptyPrompt:
      'Tap any district on the map to view its population, land area, and population density.',
    rankedSubSequential: 'Sequential #1→#23',
    rankedSubFree: 'Any order',
    livesUnit: 'Lives',
    rankedTargetTitle: (rank: number) => `Target Rank #${rank}`,
    rankedTargetSub: 'Type the district name for this rank',
    rankedSlotEmpty: (rank: number) => `Rank #${rank} slot`,
    rankedPlaceholderSeq: (rank: number) => `Type rank #${rank} district...`,
    rankedPlaceholderFree: (scopeLabel: string) =>
      `Type ${scopeLabel} district (any order)...`,
    rankedSubPop: 'Highest to Lowest',
    rankedSubArea: 'Largest to Smallest',
    rankedSubDensity: 'Densest to Least Dense',
    summaryPrefix: 'Quiz Results',
    summaryAll23Done: 'All 23 Districts Completed',
    summaryNQuestionsDone: (n: number) => `${n} Questions Completed`,
    summaryNewBest: (label: string) => `New personal best achieved for ${label}.`,
    summaryScore: 'Score',
    summaryAccuracy: 'Accuracy',
    summaryTime: 'Time',
    summaryBreakdownTitle: 'Mastery Breakdown',
    summaryCorrectAnswers: 'Correct Answers',
    summaryFirstTry: 'First-Try Correct',
    summaryWithHint: 'With Hint / Retry',
    summaryWrongAnswers: 'Wrong Answers',
    summarySkippedWrong: 'Skipped / Wrong',
    summaryBestRecord: 'Best Record',
    summaryReviewTitle: (n: number) => `Review Needed (${n})`,
    summaryMissedChip: 'Missed',
    summaryExploreMap: 'Explore Map',
    summaryChangeSettings: 'Change Settings',
    viewResultMap: 'View Result Map',
    showScoreModal: 'Show Score Modal',
    resultMapBanner: 'Result Map View · Pan or zoom to inspect district colors & names',
    statusNotInRound: 'Outside scope',
  },
} as const;
