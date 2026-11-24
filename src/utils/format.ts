import type { DemographicMetric, KecamatanMeta, Language } from '../types/quiz';

const intFormatterId = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

const intFormatterEn = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const decimalFormatterId = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const decimalFormatterEn = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPenduduk(value: number, lang: Language = 'id'): string {
  if (lang === 'en') {
    return `${intFormatterEn.format(value)} people`;
  }
  return `${intFormatterId.format(value)} jiwa`;
}

export function formatLuas(value: number, lang: Language = 'id'): string {
  const fmt = lang === 'en' ? decimalFormatterEn : decimalFormatterId;
  return `${fmt.format(value)} km²`;
}

export function formatKepadatan(value: number, lang: Language = 'id'): string {
  if (lang === 'en') {
    return `${decimalFormatterEn.format(value)} /km²`;
  }
  return `${decimalFormatterId.format(value)} jiwa/km²`;
}

export function formatMetricValue(
  meta: KecamatanMeta,
  metric: DemographicMetric,
  lang: Language = 'id'
): string {
  if (metric === 'penduduk') return formatPenduduk(meta.penduduk, lang);
  if (metric === 'luas') return formatLuas(meta.luas, lang);
  return formatKepadatan(meta.kepadatan, lang);
}

export function getMetricRawValue(meta: KecamatanMeta, metric: DemographicMetric): number {
  return meta[metric];
}

export function normalizeDistrictQuery(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function formatTimeClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
