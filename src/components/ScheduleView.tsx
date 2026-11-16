import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Clock, FileSpreadsheet, Search } from 'lucide-react';
import {
  buildHourlySeriesFromCsv,
  CsvMonthlyRow,
  getRegionValue,
} from '../data/csvLoader';
import { LoadTier, MARKET_DATA, RegionCode } from '../data/powerMarketData';

interface ScheduleViewProps {
  region: RegionCode;
  currentHour: number;
  csvRows: CsvMonthlyRow[];
  activeRow: CsvMonthlyRow | undefined;
  prevRow: CsvMonthlyRow | undefined;
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
}

type ViewMode = 'monthly-csv' | 'hourly';
type PeriodFilter = 'recent12' | '2024-2026' | '2020-2023' | 'all';
type TierFilter = 'all' | 'off-peak' | 'peak';

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  region,
  currentHour,
  csvRows,
  activeRow,
  prevRow,
  selectedPeriod,
  onSelectPeriod,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly-csv');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('recent12');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');

  const snapshot = MARKET_DATA[region];

  const filteredCsvRows = useMemo(() => {
    let list = csvRows;
    if (periodFilter === 'recent12') {
      list = csvRows.slice(0, 12);
    } else if (periodFilter === '2024-2026') {
      list = csvRows.filter((r) => r.year >= 2024);
    } else if (periodFilter === '2020-2023') {
      list = csvRows.filter((r) => r.year >= 2020 && r.year <= 2023);
    }

    const q = searchQuery.trim();
    if (q) {
      list = list.filter((r) => r.period.includes(q));
    }
    return list;
  }, [csvRows, periodFilter, searchQuery]);

  const hourlySeries = useMemo(() => {
    if (!activeRow) return snapshot.hourlyByDay.today;
    return buildHourlySeriesFromCsv(activeRow, prevRow, region).today;
  }, [activeRow, prevRow, region, snapshot.hourlyByDay.today]);

  const filteredHourly = useMemo(() => {
    if (tierFilter === 'all') return hourlySeries;
    if (tierFilter === 'off-peak') {
      return hourlySeries.filter((pt) => pt.tier === 'off-peak' || pt.renewableSurplus);
    }
    return hourlySeries.filter((pt) => pt.tier === 'peak');
  }, [hourlySeries, tierFilter]);

  const getTierStyle = (tier: LoadTier, surplus: boolean) => {
    if (surplus) return { text: '신재생 잉여', cls: 'bg-[#ECFDF5] text-[#059669]' };
    if (tier === 'peak') return { text: '피크 부하', cls: 'bg-[#FFF1F2] text-[#E11D48]' };
    if (tier === 'off-peak') return { text: '경부하(절약)', cls: 'bg-[#ECFDF5] text-[#10B981]' };
    return { text: '중간 부하', cls: 'bg-[#F1F5F9] text-[#475569]' };
  };

  return (
    <div className="px-4 pt-3 pb-4 space-y-3">
      {/* Header & Mode Switch */}
      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-bold text-[#0F172A] tracking-tight">
              전력 시세 데이터 · 시간표
            </h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              KPX 월별 실측 CSV ({csvRows.length}개월) 및 {selectedPeriod} 시간대 분포
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] flex items-center justify-center shrink-0">
            {viewMode === 'monthly-csv' ? (
              <FileSpreadsheet className="w-4 h-4 text-[#FF6B00]" />
            ) : (
              <Clock className="w-4 h-4 text-[#FF6B00]" />
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#F1F5F9]">
          <button
            type="button"
            onClick={() => setViewMode('monthly-csv')}
            className={`py-1.5 rounded-[6px] text-[12px] font-semibold transition-all min-h-[34px] ${
              viewMode === 'monthly-csv'
                ? 'bg-white text-[#0F172A] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            월별 CSV 이력 ({csvRows.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('hourly')}
            className={`py-1.5 rounded-[6px] text-[12px] font-semibold transition-all min-h-[34px] ${
              viewMode === 'hourly'
                ? 'bg-white text-[#0F172A] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            24시간 환산표 ({selectedPeriod})
          </button>
        </div>

        {viewMode === 'monthly-csv' ? (
          <div className="mt-3 space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="연월 검색 (예: 2026/08, 2022/12)"
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#CBD5E1] bg-white text-[12.5px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#FF6B00] focus:ring-3 focus:ring-[#FF6B00]/20"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  { key: 'recent12', label: '최근 1년' },
                  { key: '2024-2026', label: '2024~2026' },
                  { key: '2020-2023', label: '2020~2023' },
                  { key: 'all', label: '전체 (2001~2026)' },
                ] as { key: PeriodFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setPeriodFilter(f.key)}
                  className={`px-3 py-1 rounded-full text-[11.5px] font-semibold transition-colors min-h-[30px] whitespace-nowrap shrink-0 ${
                    periodFilter === f.key
                      ? 'bg-[#0F172A] text-white'
                      : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex items-center gap-1.5">
            {(
              [
                { key: 'all', label: '전체 24시간' },
                { key: 'off-peak', label: '절약 추천' },
                { key: 'peak', label: '피크 주의' },
              ] as { key: TierFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setTierFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-colors min-h-[32px] whitespace-nowrap ${
                  tierFilter === f.key
                    ? 'bg-[#0F172A] text-white'
                    : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Data Table Card */}
      {viewMode === 'monthly-csv' ? (
        <section className="surface-card overflow-hidden">
          <div className="px-3.5 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] grid grid-cols-12 text-[11px] font-semibold text-[#64748B]">
            <div className="col-span-3">기간</div>
            <div className="col-span-3 text-right">육지</div>
            <div className="col-span-3 text-right">제주</div>
            <div className="col-span-3 text-right">통합</div>
          </div>

          <div className="divide-y divide-[#F1F5F9] max-h-[540px] overflow-y-auto">
            {filteredCsvRows.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#64748B]">
                검색 조건에 해당하는 기간 데이터가 없습니다.
              </div>
            ) : (
              filteredCsvRows.map((row) => {
                const isSelected = row.period === selectedPeriod;
                return (
                  <button
                    key={row.period}
                    type="button"
                    onClick={() => onSelectPeriod(row.period)}
                    className={`w-full px-3.5 py-2.5 grid grid-cols-12 items-center text-left transition-colors ${
                      isSelected ? 'bg-[#FFF7ED]' : 'bg-white hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="col-span-3 flex items-center gap-1 tabular-nums-strict">
                      {isSelected && <Check className="w-3 h-3 text-[#FF6B00] shrink-0" />}
                      <span
                        className={`text-[12.5px] font-bold ${
                          isSelected ? 'text-[#EA580C]' : 'text-[#0F172A]'
                        }`}
                      >
                        {row.period}
                      </span>
                    </div>
                    <div
                      className={`col-span-3 text-right text-[12.5px] tabular-nums-strict ${
                        region === 'mainland' && isSelected
                          ? 'font-extrabold text-[#FF6B00]'
                          : 'font-semibold text-[#0F172A]'
                      }`}
                    >
                      {row.mainland > 0 ? row.mainland.toFixed(2) : '-'}
                    </div>
                    <div
                      className={`col-span-3 text-right text-[12.5px] tabular-nums-strict ${
                        region === 'jeju' && isSelected
                          ? 'font-extrabold text-[#FF6B00]'
                          : 'font-semibold text-[#334155]'
                      }`}
                    >
                      {row.jeju > 0 ? row.jeju.toFixed(2) : '-'}
                    </div>
                    <div className="col-span-3 text-right text-[12.5px] font-medium text-[#64748B] tabular-nums-strict">
                      {row.integrated.toFixed(2)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="px-3.5 py-2 bg-[#F8FAFC] border-t border-[#E2E8F0] text-[11px] text-[#64748B] flex items-center justify-between">
            <span>행을 탭하면 대시보드 기준월로 적용됩니다</span>
            <span className="font-semibold text-[#EA580C] tabular-nums-strict">
              선택: {selectedPeriod} ({activeRow ? getRegionValue(activeRow, region).toFixed(2) : '-'}원)
            </span>
          </div>
        </section>
      ) : (
        <section className="surface-card overflow-hidden">
          <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] grid grid-cols-12 text-[11px] font-semibold text-[#64748B]">
            <div className="col-span-4">시간대</div>
            <div className="col-span-3 text-center">부하 구분</div>
            <div className="col-span-3 text-right">SMP (원)</div>
            <div className="col-span-2 text-right">전월비</div>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {filteredHourly.map((pt) => {
              const isNow = pt.hour === currentHour;
              const delta = pt.smp - pt.yesterdaySmp;
              const isUp = delta >= 0;
              const badge = getTierStyle(pt.tier, pt.renewableSurplus);

              return (
                <div
                  key={pt.hour}
                  className={`px-4 py-3 grid grid-cols-12 items-center transition-colors ${
                    isNow ? 'bg-[#FFF7ED]' : 'bg-white hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="col-span-4 flex items-center gap-1.5 tabular-nums-strict">
                    {isNow && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00] shrink-0" />}
                    <div>
                      <div
                        className={`text-[13px] font-bold ${
                          isNow ? 'text-[#EA580C]' : 'text-[#0F172A]'
                        }`}
                      >
                        {String(pt.hour).padStart(2, '0')}:00~{String((pt.hour + 1) % 24).padStart(2, '0')}:00
                      </div>
                      <div className="text-[10.5px] text-[#64748B]">
                        수요 {pt.demandMw.toLocaleString()} MW
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex justify-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold whitespace-nowrap ${badge.cls}`}
                    >
                      {badge.text}
                    </span>
                  </div>

                  <div className="col-span-3 text-right tabular-nums-strict">
                    <span
                      className={`text-[14px] font-extrabold ${
                        isNow ? 'text-[#FF6B00]' : 'text-[#0F172A]'
                      }`}
                    >
                      {pt.smp.toFixed(2)}
                    </span>
                  </div>

                  <div className="col-span-2 text-right tabular-nums-strict">
                    <span
                      className={`inline-flex items-center justify-end gap-0.5 text-[11px] font-semibold ${
                        isUp ? 'text-[#E11D48]' : 'text-[#10B981]'
                      }`}
                    >
                      {isUp ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {Math.abs(delta).toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
