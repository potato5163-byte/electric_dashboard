import { DayRange, HourlyRatePoint, LoadTier, RegionCode } from './powerMarketData';

export interface CsvMonthlyRow {
  period: string; // e.g. "2026/09"
  year: number;
  month: number;
  mainland: number; // 육지
  jeju: number; // 제주
  integrated: number; // 통합
  blmp: number; // BLMP
}

export const CSV_ASSET_PATH = '/assets/aistudio/kpx_smp_blmp_all_3d33df53.csv';

export function parseKpxCsv(csvText: string): CsvMonthlyRow[] {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rows: CsvMonthlyRow[] = [];

  for (const line of lines) {
    const cols = line.split(',').map((c) => c.trim());
    const period = cols[0];
    // Match YYYY/MM format (skip the 2 header rows)
    if (!/^\d{4}\/\d{2}$/.test(period)) continue;

    const [yearStr, monthStr] = period.split('/');
    const mainland = parseFloat(cols[1] || '0') || 0;
    const jeju = parseFloat(cols[2] || '0') || 0;
    const integrated = parseFloat(cols[3] || '0') || 0;
    const blmp = parseFloat(cols[4] || '0') || 0;

    rows.push({
      period,
      year: Number(yearStr),
      month: Number(monthStr),
      mainland,
      jeju,
      integrated,
      blmp,
    });
  }

  return rows;
}

export async function fetchKpxCsvData(): Promise<CsvMonthlyRow[]> {
  const res = await fetch(CSV_ASSET_PATH);
  if (!res.ok) {
    throw new Error(`CSV 데이터를 불러오지 못했습니다 (HTTP ${res.status})`);
  }
  const text = await res.text();
  const parsed = parseKpxCsv(text);
  if (parsed.length === 0) {
    throw new Error('CSV 파일에 유효한 시세 데이터가 없습니다.');
  }
  return parsed;
}

export function getRegionValue(row: CsvMonthlyRow, region: RegionCode): number {
  const val = region === 'mainland' ? row.mainland : row.jeju;
  return val > 0 ? val : row.integrated;
}

// Normalized 24-hour Korean power load profile weights (mean = 1.0)
const MAINLAND_HOURLY_WEIGHTS = [
  0.84, 0.79, 0.76, 0.75, 0.77, 0.83,
  0.94, 1.03, 1.11, 1.15, 1.11, 1.05,
  0.98, 1.01, 1.07, 1.13, 1.17, 1.21,
  1.28, 1.25, 1.19, 1.09, 0.97, 0.90,
];

// Jeju reflects midday solar duck-curve & evening peak (mean = 1.0)
const JEJU_HOURLY_WEIGHTS = [
  0.83, 0.78, 0.75, 0.74, 0.77, 0.85,
  0.96, 1.06, 1.12, 1.10, 0.98, 0.88,
  0.78, 0.72, 0.81, 0.95, 1.12, 1.26,
  1.34, 1.30, 1.21, 1.08, 0.96, 0.88,
];

function classifyHourlyTier(
  hour: number,
  smp: number,
  baseAvg: number,
  region: RegionCode
): LoadTier {
  if (smp >= baseAvg * 1.14 || (hour >= 17 && hour <= 20)) return 'peak';
  if (smp <= baseAvg * 0.88 || hour <= 5 || (region === 'jeju' && hour >= 12 && hour <= 14)) {
    return 'off-peak';
  }
  return 'mid-peak';
}

/**
 * Generates an intraday 24-hour SMP series anchored precisely to the selected
 * real CSV monthly SMP value and previous month's CSV value.
 */
export function buildHourlySeriesFromCsv(
  activeRow: CsvMonthlyRow,
  prevRow: CsvMonthlyRow | undefined,
  region: RegionCode
): Record<DayRange, HourlyRatePoint[]> {
  const activeAvg = getRegionValue(activeRow, region);
  const prevAvg = prevRow ? getRegionValue(prevRow, region) : activeAvg * 0.97;
  const weights = region === 'mainland' ? MAINLAND_HOURLY_WEIGHTS : JEJU_HOURLY_WEIGHTS;

  const makeDay = (dayAvg: number, compareAvg: number, forecastScale: number): HourlyRatePoint[] => {
    const baseDemand = region === 'mainland' ? 63500 : 810;
    return weights.map((w, hour) => {
      const smp = Number((dayAvg * w).toFixed(2));
      const forecast = Number((smp * forecastScale + Math.cos(hour * 0.65) * 1.4).toFixed(2));
      const yesterdaySmp = Number((compareAvg * w).toFixed(2));
      const demandMw = Math.round(baseDemand * (0.76 + (w - 0.74) * 0.62));
      const tier = classifyHourlyTier(hour, smp, dayAvg, region);
      const renewableSurplus =
        region === 'jeju'
          ? hour >= 11 && hour <= 14
          : hour >= 12 && hour <= 13 && w <= 1.02;

      return {
        hour,
        label: `${String(hour).padStart(2, '0')}시`,
        smp,
        forecast,
        yesterdaySmp,
        demandMw,
        tier,
        renewableSurplus,
      };
    });
  };

  return {
    yesterday: makeDay(prevAvg, prevAvg * 0.98, 1.0),
    today: makeDay(activeAvg, prevAvg, 1.01),
    tomorrow: makeDay(Number((activeAvg * 1.015).toFixed(2)), activeAvg, 1.0),
  };
}

export interface YearlySummary {
  year: number;
  mainlandAvg: number;
  jejuAvg: number;
  integratedAvg: number;
  count: number;
}

export function computeYearlySummaries(rows: CsvMonthlyRow[]): YearlySummary[] {
  const byYear = new Map<number, CsvMonthlyRow[]>();
  for (const r of rows) {
    const list = byYear.get(r.year) ?? [];
    list.push(r);
    byYear.set(r.year, list);
  }

  return Array.from(byYear.entries())
    .sort((a, b) => b[0] - a[0])
    .slice(0, 6)
    .map(([year, list]) => {
      const mainlandValid = list.filter((x) => x.mainland > 0);
      const jejuValid = list.filter((x) => x.jeju > 0);
      const mainlandAvg =
        mainlandValid.length > 0
          ? mainlandValid.reduce((s, x) => s + x.mainland, 0) / mainlandValid.length
          : 0;
      const jejuAvg =
        jejuValid.length > 0
          ? jejuValid.reduce((s, x) => s + x.jeju, 0) / jejuValid.length
          : 0;
      const integratedAvg =
        list.reduce((s, x) => s + x.integrated, 0) / list.length;

      return {
        year,
        mainlandAvg: Number(mainlandAvg.toFixed(2)),
        jejuAvg: Number(jejuAvg.toFixed(2)),
        integratedAvg: Number(integratedAvg.toFixed(2)),
        count: list.length,
      };
    });
}
