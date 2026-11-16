import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BatteryCharging,
  Calendar,
  FileSpreadsheet,
  Info,
  Leaf,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  buildHourlySeriesFromCsv,
  CsvMonthlyRow,
  getRegionValue,
} from '../data/csvLoader';
import { DayRange, HourlyRatePoint, MARKET_DATA, RegionCode } from '../data/powerMarketData';
import { RealTimePowerSupplySection } from './RealTimePowerSupplySection';

interface DashboardViewProps {
  region: RegionCode;
  currentHour: number;
  currentTimeText: string;
  csvRows: CsvMonthlyRow[];
  activeRow: CsvMonthlyRow | undefined;
  prevRow: CsvMonthlyRow | undefined;
  prevYearRow: CsvMonthlyRow | undefined;
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onNavigateTab: (tab: 'schedule' | 'calculator' | 'market') => void;
}

const DAY_LABELS: { key: DayRange; label: string }[] = [
  { key: 'yesterday', label: '전월 패턴' },
  { key: 'today', label: '기준월 (24H)' },
  { key: 'tomorrow', label: '익월 전망' },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  region,
  currentHour,
  currentTimeText,
  csvRows,
  activeRow,
  prevRow,
  prevYearRow,
  selectedPeriod,
  onSelectPeriod,
  isLoading,
  error,
  onRetry,
  onNavigateTab,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayRange>('today');
  const [selectedHour, setSelectedHour] = useState<number>(currentHour);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const snapshot = MARKET_DATA[region];

  const hourlyByDay = useMemo(() => {
    if (!activeRow) return snapshot.hourlyByDay;
    return buildHourlySeriesFromCsv(activeRow, prevRow, region);
  }, [activeRow, prevRow, region, snapshot.hourlyByDay]);

  const chartSeries = hourlyByDay[selectedDay];
  const currentPoint = hourlyByDay.today[currentHour] ?? hourlyByDay.today[17];
  const inspectedPoint: HourlyRatePoint =
    chartSeries[selectedHour] ?? chartSeries[currentHour] ?? chartSeries[0];

  const csvStats = useMemo(() => {
    if (!activeRow || csvRows.length === 0) {
      return {
        currentMonthSmp: currentPoint.smp,
        prevMonthDiff: 0,
        prevMonthPct: 0,
        prevYearDiff: 0,
        prevYearPct: 0,
        trailing12Avg: 0,
        trailing12Max: { val: 0, period: '-' },
        trailing12Min: { val: 0, period: '-' },
        allTimeMax: { val: 0, period: '-' },
      };
    }

    const activeIdx = csvRows.findIndex((r) => r.period === activeRow.period);
    const slice12 = csvRows.slice(
      Math.max(0, activeIdx),
      Math.min(csvRows.length, Math.max(0, activeIdx) + 12)
    );

    const currentMonthSmp = getRegionValue(activeRow, region);
    const prevMonthSmp = prevRow ? getRegionValue(prevRow, region) : currentMonthSmp;
    const prevYearSmp = prevYearRow ? getRegionValue(prevYearRow, region) : currentMonthSmp;

    const prevMonthDiff = currentMonthSmp - prevMonthSmp;
    const prevMonthPct = prevMonthSmp > 0 ? (prevMonthDiff / prevMonthSmp) * 100 : 0;

    const prevYearDiff = currentMonthSmp - prevYearSmp;
    const prevYearPct = prevYearSmp > 0 ? (prevYearDiff / prevYearSmp) * 100 : 0;

    const vals12 = slice12.map((r) => ({
      val: getRegionValue(r, region),
      period: r.period,
    }));
    const trailing12Avg =
      vals12.length > 0 ? vals12.reduce((s, x) => s + x.val, 0) / vals12.length : currentMonthSmp;

    const trailing12Max = vals12.reduce(
      (best, cur) => (cur.val > best.val ? cur : best),
      vals12[0] ?? { val: currentMonthSmp, period: activeRow.period }
    );
    const trailing12Min = vals12.reduce(
      (best, cur) => (cur.val < best.val ? cur : best),
      vals12[0] ?? { val: currentMonthSmp, period: activeRow.period }
    );

    const allValid = csvRows
      .map((r) => ({ val: getRegionValue(r, region), period: r.period }))
      .filter((x) => x.val > 0);
    const allTimeMax = allValid.reduce(
      (best, cur) => (cur.val > best.val ? cur : best),
      allValid[0] ?? { val: currentMonthSmp, period: activeRow.period }
    );

    return {
      currentMonthSmp,
      prevMonthDiff,
      prevMonthPct,
      prevYearDiff,
      prevYearPct,
      trailing12Avg,
      trailing12Max,
      trailing12Min,
      allTimeMax,
    };
  }, [activeRow, csvRows, currentPoint.smp, prevRow, prevYearRow, region]);

  const chartMax = useMemo(() => {
    const rawMax = Math.max(...chartSeries.map((p) => Math.max(p.smp, p.forecast)));
    return Math.max(40, Math.ceil(rawMax / 20) * 20);
  }, [chartSeries]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setSelectedHour(currentHour);
    onRetry();
    window.setTimeout(() => setIsRefreshing(false), 380);
  };

  const isMonthUp = csvStats.prevMonthDiff >= 0;
  const isYearUp = csvStats.prevYearDiff >= 0;

  const getTierBadge = (tier: HourlyRatePoint['tier'], surplus: boolean) => {
    if (surplus) {
      return { label: '신재생 잉여', className: 'bg-[#ECFDF5] text-[#059669]' };
    }
    if (tier === 'peak') {
      return { label: '피크 주의', className: 'bg-[#FFF1F2] text-[#E11D48]' };
    }
    if (tier === 'off-peak') {
      return { label: '절약 시간대', className: 'bg-[#ECFDF5] text-[#10B981]' };
    }
    return { label: '보통 부하', className: 'bg-[#F1F5F9] text-[#475569]' };
  };

  const heroStatusBadge =
    csvStats.prevMonthPct <= -5
      ? { label: '전월 대비 하락', className: 'bg-[#ECFDF5] text-[#10B981]' }
      : csvStats.prevMonthPct >= 5
        ? { label: '전월 대비 상승', className: 'bg-[#FFF1F2] text-[#E11D48]' }
        : { label: '시세 안정', className: 'bg-[#FFF7ED] text-[#EA580C]' };

  const inspectedBadge = getTierBadge(inspectedPoint.tier, inspectedPoint.renewableSurplus);

  if (isLoading) {
    return (
      <div className="px-4 pt-3 pb-4 space-y-3">
        <div className="h-6 w-48 rounded-md bg-[#E2E8F0] animate-pulse" />
        <div className="surface-card p-4 h-[196px] animate-pulse bg-white" />
        <div className="surface-card p-4 h-[290px] animate-pulse bg-white" />
      </div>
    );
  }

  if (error || !activeRow) {
    return (
      <div className="px-4 pt-6">
        <div className="surface-card p-5 text-center space-y-3">
          <p className="text-[14px] font-semibold text-[#E11D48]">
            {error ?? 'CSV 데이터를 불러올 수 없습니다.'}
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            className="px-4 py-2 rounded-lg bg-[#FF6B00] text-white text-[13px] font-semibold"
          >
            다시 불러오기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-3 pb-4">
      {/* Sub-header meta & CSV month selector */}
      <div className="px-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11.5px] text-[#64748B] font-medium tabular-nums-strict min-w-0">
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
          <span className="truncate">
            KPX CSV ({csvRows.length}개월) · {currentTimeText}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative flex items-center">
            <Calendar className="w-3 h-3 text-[#64748B] absolute left-2 pointer-events-none" />
            <select
              aria-label="기준 월 선택"
              value={selectedPeriod}
              onChange={(e) => onSelectPeriod(e.target.value)}
              className="h-[30px] pl-6 pr-2 rounded-lg bg-white border border-[#E2E8F0] text-[11.5px] font-bold text-[#0F172A] tabular-nums-strict focus:outline-none focus:border-[#FF6B00]"
            >
              {csvRows.map((row) => (
                <option key={row.period} value={row.period}>
                  {row.period}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-lg bg-white border border-[#E2E8F0] text-[#334155] hover:bg-[#F1F5F9] active:scale-[0.98] transition-all"
            aria-label="시세 새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#FF6B00]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Market Tickers (100% CSV derived) */}
      <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar px-4 pb-0.5">
        <div className="surface-card px-3.5 py-2.5 shrink-0 min-w-[134px]">
          <div className="text-[11px] font-medium text-[#64748B] whitespace-nowrap">
            12개월 최고 ({csvStats.trailing12Max.period})
          </div>
          <div className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap tabular-nums-strict">
            <span className="text-[16px] font-bold text-[#F43F5E]">
              {csvStats.trailing12Max.val.toFixed(2)}
            </span>
            <span className="text-[11px] font-medium text-[#64748B]">원/kWh</span>
          </div>
        </div>

        <div className="surface-card px-3.5 py-2.5 shrink-0 min-w-[134px]">
          <div className="text-[11px] font-medium text-[#64748B] whitespace-nowrap">
            12개월 최저 ({csvStats.trailing12Min.period})
          </div>
          <div className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap tabular-nums-strict">
            <span className="text-[16px] font-bold text-[#10B981]">
              {csvStats.trailing12Min.val.toFixed(2)}
            </span>
            <span className="text-[11px] font-medium text-[#64748B]">원/kWh</span>
          </div>
        </div>

        <div className="surface-card px-3.5 py-2.5 shrink-0 min-w-[126px]">
          <div className="text-[11px] font-medium text-[#64748B] whitespace-nowrap">
            12개월 평균 SMP
          </div>
          <div className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap tabular-nums-strict">
            <span className="text-[16px] font-bold text-[#0F172A]">
              {csvStats.trailing12Avg.toFixed(2)}
            </span>
            <span className="text-[11px] font-medium text-[#64748B]">원/kWh</span>
          </div>
        </div>

        <div className="surface-card px-3.5 py-2.5 shrink-0 min-w-[126px]">
          <div className="text-[11px] font-medium text-[#64748B] whitespace-nowrap">
            통합 SMP ({activeRow.period})
          </div>
          <div className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap tabular-nums-strict">
            <span className="text-[16px] font-bold text-[#0F172A]">
              {activeRow.integrated.toFixed(2)}
            </span>
            <span className="text-[11px] font-medium text-[#64748B]">원/kWh</span>
          </div>
        </div>
      </div>

      {/* Main Stack Container */}
      <div className="px-4 space-y-3">
        {/* Hero Metric Summary Card */}
        <section className="surface-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold tracking-[0.02em] text-[#64748B]">
              {activeRow.period} {snapshot.regionName} 계통한계가격 (SMP)
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${heroStatusBadge.className}`}
            >
              {heroStatusBadge.label}
            </span>
          </div>

          <div className="mt-2.5 flex items-baseline gap-1.5 tabular-nums-strict">
            <span className="text-[40px] font-extrabold leading-[44px] tracking-[-0.03em] text-[#0F172A]">
              {csvStats.currentMonthSmp.toFixed(2)}
            </span>
            <span className="text-[18px] font-semibold text-[#64748B] leading-[26px]">
              원/kWh
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {prevRow && (
              <span
                className={`inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold tabular-nums-strict ${
                  isMonthUp
                    ? 'bg-[#FFF1F2] text-[#E11D48]'
                    : 'bg-[#ECFDF5] text-[#10B981]'
                }`}
              >
                {isMonthUp ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {isMonthUp ? '+' : ''}
                {csvStats.prevMonthPct.toFixed(1)}% ({isMonthUp ? '+' : ''}
                {csvStats.prevMonthDiff.toFixed(2)}원) vs 전월({prevRow.period})
              </span>
            )}
            {prevYearRow && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums-strict ${
                  isYearUp
                    ? 'bg-[#FFF7ED] text-[#EA580C]'
                    : 'bg-[#F1F5F9] text-[#475569]'
                }`}
              >
                전년동월 {isYearUp ? '+' : ''}
                {csvStats.prevYearPct.toFixed(1)}%
              </span>
            )}
          </div>

          {/* CSV Grounded Insight */}
          <div className="mt-3.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
            <p className="text-[12.5px] leading-[18.5px] text-[#334155] tabular-nums-strict">
              {activeRow.period} {snapshot.regionName} SMP는{' '}
              <strong className="text-[#0F172A]">{csvStats.currentMonthSmp.toFixed(2)}원/kWh</strong>
              이며, 현재 {String(currentHour).padStart(2, '0')}시 시간대 추정 단가는{' '}
              <strong className="text-[#FF6B00]">{currentPoint.smp.toFixed(2)}원/kWh</strong>입니다.
              {activeRow.mainland === 0 && (
                <span> (2010년 이전 구간은 통합 SMP 기준을 표시합니다.)</span>
              )}
            </p>
          </div>
        </section>

        {/* Intraday 24H Chart Card (Anchored to CSV Monthly SMP) */}
        <section className="surface-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-bold tracking-[-0.015em] text-[#0F172A]">
                시간대별 환산 전기 시세 (24H)
              </h2>
              <p className="text-[11.5px] text-[#64748B] mt-0.5">
                {activeRow.period} 실측 평균({csvStats.currentMonthSmp.toFixed(2)}원) 기반 시간대 분포
              </p>
            </div>
          </div>

          {/* Day/Pattern Selector */}
          <div className="mt-3 grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#F1F5F9]">
            {DAY_LABELS.map((d) => {
              const active = selectedDay === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDay(d.key)}
                  className={`py-1.5 px-2 rounded-[6px] text-[12px] font-semibold transition-all min-h-[34px] whitespace-nowrap ${
                    active
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* Selected Hour Inspector */}
          <div className="mt-3 p-3 rounded-xl surface-popover flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-bold text-[#0F172A] tabular-nums-strict">
                  {String(inspectedPoint.hour).padStart(2, '0')}:00 ~{' '}
                  {String((inspectedPoint.hour + 1) % 24).padStart(2, '0')}:00
                </span>
                {selectedDay === 'today' && inspectedPoint.hour === currentHour && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#FFF7ED] text-[#EA580C] text-[10px] font-bold">
                    현재 시간
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${inspectedBadge.className}`}
                >
                  {inspectedBadge.label}
                </span>
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748B] tabular-nums-strict">
                전월 동시간 {inspectedPoint.yesterdaySmp.toFixed(2)}원 · 수요{' '}
                {inspectedPoint.demandMw.toLocaleString()} MW
              </div>
            </div>

            <div className="text-right shrink-0 tabular-nums-strict">
              <div className="text-[20px] font-extrabold text-[#0F172A] leading-tight">
                {inspectedPoint.smp.toFixed(2)}
              </div>
              <div className="text-[11px] font-medium text-[#64748B]">원/kWh</div>
            </div>
          </div>

          {/* 24-Hour Vertical Bar Chart */}
          <div className="mt-4">
            <div className="relative h-[156px] flex items-end justify-between gap-[3px] pt-4 pb-1 border-b border-[#E2E8F0]">
              <div className="pointer-events-none absolute inset-x-0 top-4 bottom-1 flex flex-col justify-between">
                {[1, 0.5, 0].map((ratio, idx) => (
                  <div
                    key={idx}
                    className="w-full border-t border-dashed border-[#E2E8F0]/80 relative"
                  >
                    <span className="absolute -top-2.5 left-0 text-[9.5px] font-medium text-[#94A3B8] bg-white pr-1 tabular-nums-strict">
                      {Math.round(chartMax * ratio)}
                    </span>
                  </div>
                ))}
              </div>

              {chartSeries.map((pt) => {
                const heightPct = Math.max(12, Math.round((pt.smp / chartMax) * 100));
                const isCurrentHour = selectedDay === 'today' && pt.hour === currentHour;
                const isSelected = pt.hour === selectedHour;

                let barColor = 'bg-[#E2E8F0] hover:bg-[#CBD5E1]';
                if (pt.tier === 'peak') {
                  barColor = 'bg-[#FECDD3] hover:bg-[#FDA4AF]';
                } else if (pt.renewableSurplus || pt.tier === 'off-peak') {
                  barColor = 'bg-[#D1FAE5] hover:bg-[#A7F3D0]';
                }

                if (isCurrentHour) {
                  barColor = 'bg-[#FF6B00] accent-halo';
                } else if (isSelected) {
                  barColor = 'bg-[#0F172A]';
                }

                return (
                  <button
                    key={pt.hour}
                    type="button"
                    onClick={() => setSelectedHour(pt.hour)}
                    aria-label={`${pt.label} SMP ${pt.smp}원`}
                    className="relative z-10 flex-1 h-full flex items-end justify-center group focus:outline-none"
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[11px] rounded-t-[4px] transition-all duration-150 ${barColor}`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[10.5px] font-medium text-[#64748B] tabular-nums-strict px-0.5">
              <span>00시</span>
              <span>06시</span>
              <span>12시</span>
              <span>18시</span>
              <span>23시</span>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] text-[#64748B]">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-[#FF6B00]" />
                  현재 시각
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-[#D1FAE5]" />
                  절약·잉여
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-[#FECDD3]" />
                  피크
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('schedule')}
                className="text-[11.5px] font-semibold text-[#EA580C] hover:underline whitespace-nowrap"
              >
                CSV 전체 이력 →
              </button>
            </div>
          </div>
        </section>

        {/* Secondary CSV Metric Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('market')}
            className="surface-card-interactive p-3.5 text-left"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11.5px] font-semibold text-[#64748B]">역대 최고 SMP</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#FFF1F2] text-[#E11D48] text-[10px] font-semibold">
                {csvStats.allTimeMax.period}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1 tabular-nums-strict">
              <span className="text-[22px] font-extrabold text-[#0F172A] tracking-tight">
                {csvStats.allTimeMax.val.toFixed(2)}
              </span>
              <span className="text-[11px] font-medium text-[#64748B]">원</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#64748B] font-medium">
              <TrendingUp className="w-3.5 h-3.5 text-[#F43F5E]" />
              2001~2026 최고 기록
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('market')}
            className="surface-card-interactive p-3.5 text-left"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11.5px] font-semibold text-[#64748B]">육지·제주 차이</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] text-[10px] font-semibold">
                {activeRow.period}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1 tabular-nums-strict">
              <span className="text-[22px] font-extrabold text-[#0F172A] tracking-tight">
                {activeRow.mainland > 0
                  ? (activeRow.jeju - activeRow.mainland >= 0 ? '+' : '') +
                    (activeRow.jeju - activeRow.mainland).toFixed(2)
                  : '0.00'}
              </span>
              <span className="text-[11px] font-medium text-[#64748B]">원</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#64748B] font-medium tabular-nums-strict">
              <Leaf className="w-3.5 h-3.5 text-[#10B981]" />
              REC {snapshot.recPrice.toLocaleString()}원
            </div>
          </button>
        </div>

        {/* Optimal Savings Time Card + CTA to Calculator */}
        <section className="surface-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] flex items-center justify-center shrink-0">
                <Leaf className="w-4 h-4 text-[#10B981]" />
              </div>
              <div>
                <div className="text-[12px] font-semibold text-[#64748B]">
                  {activeRow.period} 기준 절약 골든타임
                </div>
                <div className="text-[16px] font-bold text-[#0F172A] tabular-nums-strict">
                  {snapshot.optimalWindow}
                </div>
              </div>
            </div>
            <div className="text-right tabular-nums-strict">
              <div className="text-[15px] font-extrabold text-[#10B981]">
                {Math.min(...hourlyByDay.today.map((p) => p.smp)).toFixed(2)}원
              </div>
              <div className="text-[10.5px] text-[#64748B]">최저 시간 단가</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('calculator')}
            className="mt-3.5 w-full h-11 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] active:scale-[0.98] text-white text-[13.5px] font-semibold flex items-center justify-center gap-2 transition-all shadow-[0_2px_8px_rgba(255,107,0,0.24)]"
          >
            <BatteryCharging className="w-4 h-4" />
            {activeRow.period} 시세로 가전·전기차 요금 계산하기
          </button>
        </section>

        {/* Real-Time Power Supply API Section */}
        <RealTimePowerSupplySection region={region} currentHour={currentHour} />
      </div>
    </div>
  );
};
