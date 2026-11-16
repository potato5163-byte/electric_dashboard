import React from 'react';
import { BarChart3, Calculator, Clock, Globe2, Zap } from 'lucide-react';
import { RegionCode } from '../data/powerMarketData';

export type TabKey = 'dashboard' | 'schedule' | 'calculator' | 'market';

interface MobileShellProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  region: RegionCode;
  onRegionChange: (region: RegionCode) => void;
  currentTimeText: string;
  children: React.ReactNode;
}

const NAV_ITEMS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'dashboard', label: '실시간 시세', icon: Zap },
  { key: 'schedule', label: '시간표·예보', icon: Clock },
  { key: 'calculator', label: '요금 계산기', icon: Calculator },
  { key: 'market', label: '시장 현황', icon: BarChart3 },
];

export const MobileShell: React.FC<MobileShellProps> = ({
  activeTab,
  onTabChange,
  region,
  onRegionChange,
  currentTimeText,
  children,
}) => {
  return (
    <div className="min-h-[100dvh] w-full bg-[#EEF2F7] sm:py-4 sm:px-3 flex justify-center">
      <div className="relative w-full max-w-[430px] min-h-[100dvh] sm:min-h-[calc(100dvh-2rem)] bg-[#F8FAFC] sm:rounded-[28px] sm:border sm:border-[#E2E8F0] sm:shadow-[0_20px_50px_rgba(15,23,42,0.10)] flex flex-col overflow-x-clip">
        {/* Sticky Top App Bar (52px) */}
        <header className="sticky top-0 z-30 h-[52px] px-4 bg-white/92 backdrop-blur-md border-b border-[#E2E8F0] flex items-center justify-between gap-2 sm:rounded-t-[28px]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#FF6B00] flex items-center justify-center shrink-0 shadow-[0_2px_6px_rgba(255,107,0,0.28)]">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-[15px] font-bold tracking-[-0.02em] text-[#0F172A] whitespace-nowrap truncate">
                실시간 전기 시세
              </h1>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF7ED] text-[#EA580C] text-[11px] font-semibold whitespace-nowrap shrink-0"
                title={`기준 시각 ${currentTimeText}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00] animate-live-dot" />
                실시간
              </span>
            </div>
          </div>

          {/* Region Segmented Switcher */}
          <div
            role="group"
            aria-label="지역 선택"
            className="inline-flex items-center p-0.5 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] shrink-0"
          >
            <button
              type="button"
              onClick={() => onRegionChange('mainland')}
              className={`px-2.5 py-1 rounded-[6px] text-[12px] font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[30px] ${
                region === 'mainland'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              육지
            </button>
            <button
              type="button"
              onClick={() => onRegionChange('jeju')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[12px] font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[30px] ${
                region === 'jeju'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Globe2 className="w-3 h-3" />
              제주
            </button>
          </div>
        </header>

        {/* Scrollable Content Viewport */}
        <main className="flex-1 pb-[76px]">
          {children}
        </main>

        {/* Fixed Bottom Tab Bar (58px) */}
        <nav
          aria-label="하단 메뉴"
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 h-[58px] bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] sm:rounded-b-[28px] px-2 grid grid-cols-4 items-center"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`relative flex flex-col items-center justify-center min-h-[44px] rounded-xl transition-colors ${
                  isActive
                    ? 'text-[#FF6B00]'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`w-[19px] h-[19px] ${isActive ? 'stroke-[2.3]' : 'stroke-[1.9]'}`} />
                <span className={`text-[10.5px] mt-0.5 tracking-tight whitespace-nowrap ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute top-1 w-4 h-[2.5px] rounded-full bg-[#FF6B00]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
