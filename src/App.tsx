/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalculatorView } from './components/CalculatorView';
import { DashboardView } from './components/DashboardView';
import { MarketOverviewView } from './components/MarketOverviewView';
import { MobileShell, TabKey } from './components/MobileShell';
import { ScheduleView } from './components/ScheduleView';
import { CsvMonthlyRow, fetchKpxCsvData } from './data/csvLoader';
import { RegionCode } from './data/powerMarketData';

function getKstTimeInfo() {
  const now = new Date();
  const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const hourFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    hour12: false,
  });
  const formattedTime = kstFormatter.format(now);
  const parsedHour = Number(hourFormatter.format(now)) % 24;
  return {
    currentHour: Number.isNaN(parsedHour) ? 17 : parsedHour,
    currentTimeText: formattedTime,
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [region, setRegion] = useState<RegionCode>('mainland');
  const [timeInfo, setTimeInfo] = useState(() => getKstTimeInfo());

  const [csvRows, setCsvRows] = useState<CsvMonthlyRow[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadCsv = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchKpxCsvData();
      setCsvRows(rows);
      setSelectedPeriod((prev) =>
        prev && rows.some((r) => r.period === prev) ? prev : rows[0]?.period ?? ''
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV 데이터를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCsv();
  }, [loadCsv]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeInfo(getKstTimeInfo());
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const { activeRow, prevRow, prevYearRow } = useMemo(() => {
    if (csvRows.length === 0) {
      return { activeRow: undefined, prevRow: undefined, prevYearRow: undefined };
    }
    const idx = csvRows.findIndex((r) => r.period === selectedPeriod);
    const activeIdx = idx >= 0 ? idx : 0;
    const current = csvRows[activeIdx];
    const previous = csvRows[activeIdx + 1];
    const targetPrevYearPeriod = current
      ? `${current.year - 1}/${String(current.month).padStart(2, '0')}`
      : '';
    const previousYear = csvRows.find((r) => r.period === targetPrevYearPeriod);
    return { activeRow: current, prevRow: previous, prevYearRow: previousYear };
  }, [csvRows, selectedPeriod]);

  return (
    <MobileShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      region={region}
      onRegionChange={setRegion}
      currentTimeText={timeInfo.currentTimeText}
    >
      {activeTab === 'dashboard' && (
        <DashboardView
          region={region}
          currentHour={timeInfo.currentHour}
          currentTimeText={timeInfo.currentTimeText}
          csvRows={csvRows}
          activeRow={activeRow}
          prevRow={prevRow}
          prevYearRow={prevYearRow}
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
          isLoading={isLoading}
          error={error}
          onRetry={() => void loadCsv()}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      )}
      {activeTab === 'schedule' && (
        <ScheduleView
          region={region}
          currentHour={timeInfo.currentHour}
          csvRows={csvRows}
          activeRow={activeRow}
          prevRow={prevRow}
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
        />
      )}
      {activeTab === 'calculator' && (
        <CalculatorView
          region={region}
          currentHour={timeInfo.currentHour}
          activeRow={activeRow}
          prevRow={prevRow}
        />
      )}
      {activeTab === 'market' && (
        <MarketOverviewView
          region={region}
          csvRows={csvRows}
          activeRow={activeRow}
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
        />
      )}
    </MobileShell>
  );
}
