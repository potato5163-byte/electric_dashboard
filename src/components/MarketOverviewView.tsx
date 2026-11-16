import React, { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Globe2, Layers, TrendingUp } from 'lucide-react';
import {
  computeYearlySummaries,
  CsvMonthlyRow,
  getRegionValue,
} from '../data/csvLoader';
import { GENERATION_MIX, GLOSSARY_ITEMS, RegionCode } from '../data/powerMarketData';

interface MarketOverviewViewProps {
  region: RegionCode;
  csvRows: CsvMonthlyRow[];
  activeRow: CsvMonthlyRow | undefined;
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
}

export const MarketOverviewView: React.FC<MarketOverviewViewProps> = ({
  region,
  csvRows,
  activeRow,
  selectedPeriod,
  onSelectPeriod,
}) => {
  const [openGlossaryIdx, setOpenGlossaryIdx] = useState<number | null>(0);

  const trailing12 = useMemo(() => {
    if (csvRows.length === 0) return [];
    const idx = csvRows.findIndex((r) => r.period === selectedPeriod);
    const start = idx >= 0 ? idx : 0;
    return csvRows.slice(start, start + 12).reverse();
  }, [csvRows, selectedPeriod]);

  const yearlySummaries = useMemo(() => computeYearlySummaries(csvRows), [csvRows]);

  const mainlandVal = activeRow
    ? activeRow.mainland > 0
      ? activeRow.mainland
      : activeRow.integrated
    : 0;
  const jejuVal = activeRow
    ? activeRow.jeju > 0
      ? activeRow.jeju
      : activeRow.integrated
    : 0;
  const spread = jejuVal - mainlandVal;

  const maxTrend = Math.max(
    1,
    ...trailing12.map((r) => getRegionValue(r, region))
  );

  const allGlossary = useMemo(
    () => [
      ...GLOSSARY_ITEMS,
      {
        term: 'BLMP (기저한계가격)',
        fullName: 'Base Load Marginal Price',
        summary:
          '2006년 12월까지 기저발전기(원자력·유연탄)에 적용되던 별도의 정산 한계가격으로, 2007년부터는 SMP로 일원화되었습니다.',
        tip: '첨부된 KPX CSV 데이터의 2001~2006년 구간에서 실제 BLMP 이력을 확인할 수 있습니다.',
      },
    ],
    []
  );

  return (
    <div className="px-4 pt-3 pb-4 space-y-3">
      {/* Mainland vs Jeju CSV Comparison Card */}
      <section className="surface-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F172A]">육지 · 제주 · 통합 SMP 비교</h2>
            <p className="text-[11.5px] text-[#64748B] mt-0.5 tabular-nums-strict">
              {selectedPeriod} KPX CSV 실측 단가 (원/kWh)
            </p>
          </div>
          <Globe2 className="w-4 h-4 text-[#64748B]" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div
            className={`p-3 rounded-xl border ${
              region === 'mainland'
                ? 'bg-[#FFF7ED] border-[#FF6B00]/50'
                : 'bg-[#F8FAFC] border-[#E2E8F0]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-[#475569]">육지 SMP</span>
              {region === 'mainland' && (
                <span className="text-[10px] font-bold text-[#EA580C]">선택됨</span>
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-1 tabular-nums-strict">
              <span className="text-[22px] font-extrabold text-[#0F172A]">
                {mainlandVal.toFixed(2)}
              </span>
              <span className="text-[11px] text-[#64748B]">원</span>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              region === 'jeju'
                ? 'bg-[#FFF7ED] border-[#FF6B00]/50'
                : 'bg-[#F8FAFC] border-[#E2E8F0]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-[#475569]">제주 SMP</span>
              {region === 'jeju' && (
                <span className="text-[10px] font-bold text-[#EA580C]">선택됨</span>
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-1 tabular-nums-strict">
              <span className="text-[22px] font-extrabold text-[#0F172A]">
                {jejuVal.toFixed(2)}
              </span>
              <span className="text-[11px] text-[#64748B]">원</span>
            </div>
          </div>
        </div>

        <div className="mt-2.5 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-[12px] tabular-nums-strict">
          <span className="text-[#64748B]">
            통합 {activeRow?.integrated.toFixed(2) ?? '-'}원 · 지역차 (제주-육지)
          </span>
          <span className={`font-bold ${spread >= 0 ? 'text-[#EA580C]' : 'text-[#10B981]'}`}>
            {spread >= 0 ? '+' : ''}
            {spread.toFixed(2)} 원
          </span>
        </div>
      </section>

      {/* 12-Month Real CSV Trend Chart */}
      <section className="surface-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F172A]">최근 12개월 월간 SMP 추이</h2>
            <p className="text-[11.5px] text-[#64748B] mt-0.5">
              {region === 'mainland' ? '육지' : '제주'} CSV 실측 · 막대를 터치해 기준월 변경
            </p>
          </div>
          <TrendingUp className="w-4 h-4 text-[#FF6B00]" />
        </div>

        <div className="mt-4 h-[142px] flex items-end justify-between gap-1.5 pt-4 border-b border-[#E2E8F0] pb-1">
          {trailing12.map((item) => {
            const val = getRegionValue(item, region);
            const heightPct = Math.max(18, Math.round((val / maxTrend) * 100));
            const isSelected = item.period === selectedPeriod;
            return (
              <button
                key={item.period}
                type="button"
                onClick={() => onSelectPeriod(item.period)}
                className="flex-1 h-full flex flex-col items-center justify-end gap-1 focus:outline-none group"
                title={`${item.period}: ${val.toFixed(2)}원`}
              >
                <span
                  className={`text-[9px] font-bold tabular-nums-strict ${
                    isSelected ? 'text-[#EA580C]' : 'text-[#64748B]'
                  }`}
                >
                  {Math.round(val)}
                </span>
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full max-w-[20px] rounded-t-[4px] transition-all ${
                    isSelected
                      ? 'bg-[#FF6B00] accent-halo'
                      : 'bg-[#E2E8F0] group-hover:bg-[#CBD5E1]'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[9.5px] font-medium text-[#64748B] tabular-nums-strict">
          {trailing12.map((item) => (
            <div
              key={item.period}
              className={`flex-1 text-center ${
                item.period === selectedPeriod ? 'font-bold text-[#EA580C]' : ''
              }`}
            >
              {String(item.month).padStart(2, '0')}월
            </div>
          ))}
        </div>
      </section>

      {/* Yearly Average SMP Summary from CSV */}
      <section className="surface-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F172A]">연도별 평균 SMP (CSV 집계)</h2>
            <p className="text-[11.5px] text-[#64748B] mt-0.5">최근 6개년 월평균 도매단가 비교</p>
          </div>
        </div>

        <div className="divide-y divide-[#F1F5F9]">
          <div className="pb-2 grid grid-cols-12 text-[11px] font-semibold text-[#64748B]">
            <div className="col-span-3">연도</div>
            <div className="col-span-3 text-right">육지 평균</div>
            <div className="col-span-3 text-right">제주 평균</div>
            <div className="col-span-3 text-right">통합 평균</div>
          </div>
          {yearlySummaries.map((y) => (
            <div
              key={y.year}
              className="py-2.5 grid grid-cols-12 items-center text-[12.5px] tabular-nums-strict"
            >
              <div className="col-span-3 font-bold text-[#0F172A]">
                {y.year}년
                <span className="ml-1 text-[10px] font-normal text-[#94A3B8]">({y.count})</span>
              </div>
              <div className="col-span-3 text-right font-semibold text-[#0F172A]">
                {y.mainlandAvg.toFixed(2)}
              </div>
              <div className="col-span-3 text-right font-semibold text-[#334155]">
                {y.jejuAvg.toFixed(2)}
              </div>
              <div className="col-span-3 text-right font-medium text-[#64748B]">
                {y.integratedAvg.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Generation Mix */}
      <section className="surface-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F172A]">전원별 발전 비중 참고</h2>
            <p className="text-[11.5px] text-[#64748B] mt-0.5">
              전국 계통 발전 믹스 구성 비율
            </p>
          </div>
          <Layers className="w-4 h-4 text-[#64748B]" />
        </div>

        <div className="mt-3 h-3 w-full rounded-full overflow-hidden flex gap-0.5 bg-[#F1F5F9]">
          {GENERATION_MIX.map((src) => (
            <div
              key={src.id}
              style={{ width: `${src.sharePercent}%`, backgroundColor: src.color }}
              className="h-full first:rounded-l-full last:rounded-r-full"
              title={`${src.name} ${src.sharePercent}%`}
            />
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {GENERATION_MIX.map((src) => (
            <div key={src.id} className="flex items-center justify-between text-[12.5px]">
              <div className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: src.color }}
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                />
                <span className="font-medium text-[#334155]">{src.name}</span>
              </div>
              <div className="flex items-center gap-3 tabular-nums-strict">
                <span className="text-[11.5px] text-[#64748B]">{src.outputGw} GW</span>
                <span className="font-bold text-[#0F172A] w-11 text-right">
                  {src.sharePercent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Beginner Market Glossary */}
      <section className="surface-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-[#FF6B00]" />
          <h2 className="text-[16px] font-bold text-[#0F172A]">전력 시장 용어 가이드</h2>
        </div>

        <div className="divide-y divide-[#F1F5F9]">
          {allGlossary.map((item, idx) => {
            const isOpen = openGlossaryIdx === idx;
            return (
              <div key={item.term} className="py-2.5 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => setOpenGlossaryIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-2 text-left min-h-[38px]"
                >
                  <div>
                    <div className="text-[13.5px] font-bold text-[#0F172A]">{item.term}</div>
                    <div className="text-[11px] text-[#64748B]">{item.fullName}</div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#64748B] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#64748B] shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="mt-2 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                    <p className="text-[12.5px] leading-[18.5px] text-[#334155]">
                      {item.summary}
                    </p>
                    <p className="text-[11.5px] font-semibold text-[#EA580C]">
                      참고: {item.tip}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
