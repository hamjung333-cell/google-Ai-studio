import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { TicketData, GeneratorSettings, RouteMode } from './types';
import { INITIAL_TICKET_DATA } from './data/defaultTicket';
import { ReceiptPreview } from './components/ReceiptPreview';
import { TicketForm } from './components/TicketForm';
import { BatchDownloadModal } from './components/BatchDownloadModal';
import { MultiTicketPrintModal } from './components/MultiTicketPrintModal';
import {
  createPresetTicketData,
  getQuickPresetDates,
  QuickDatePreset
} from './data/quickPresetDates';
import {
  getDefaultFileName,
  formatKoreanDate,
  formatSalesDate,
  getSequentialTicketingTime,
  getSequentialTransactionDetails
} from './utils/dateUtils';
import { saveBlobWithDesktopPicker } from './utils/fileSaver';
import {
  Train,
  CheckCircle2,
  AlertCircle,
  Download,
  Image as ImageIcon,
  Sparkles,
  HelpCircle,
  Package,
  Printer,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  ArrowRightLeft
} from 'lucide-react';

export default function App() {
  const [ticket, setTicket] = useState<TicketData>(INITIAL_TICKET_DATA);
  const [settings, setSettings] = useState<GeneratorSettings>({
    showRedBoxes: true, // 미리보기에서 고정 항목 빨간색 표시 (출력 및 저장 시에는 100% 자동 제외)
    autoSyncTicketNumberDate: true,
    exportScale: 2
  });

  // Selected dates for multi-selection (Defaults to current travel date)
  const [selectedDates, setSelectedDates] = useState<string[]>([
    INITIAL_TICKET_DATA.travelDate || '2026-08-11'
  ]);
  // 여정 노선 선택: 'seoul'(서울>묵호) | 'mukho'(묵호>서울) | 'both'(왕복 둘 다 한 번에)
  const [routeMode, setRouteMode] = useState<RouteMode>('both');
  const [currentTicketIdx, setCurrentTicketIdx] = useState<number>(0);
  const [baseIssueDate, setBaseIssueDate] = useState<string>(
    INITIAL_TICKET_DATA.issueDate || '2026-08-04T12:34'
  );

  const [isDownloading, setIsDownloading] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isMultiPrintModalOpen, setIsMultiPrintModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Dynamic 3-month presets: 전달, 지금 달, 다음달 (월화수목금토일 7일 전체)
  const presetDates = useMemo(() => {
    return getQuickPresetDates(new Date(), 'all');
  }, []);

  // Multi-selected tickets sequence (selectedDates x routeMode)
  const activeTicketsList = useMemo(() => {
    const list: {
      date: string;
      mode: 'seoul' | 'mukho';
      label: string;
      seqIndex: number;
    }[] = [];

    const sortedDates = [...selectedDates].sort();
    let seq = 0;
    sortedDates.forEach((d) => {
      if (routeMode === 'seoul' || routeMode === 'both') {
        list.push({
          date: d,
          mode: 'seoul',
          label: '오전 서울 출발 (청량리 07:05 → 묵호 09:20)',
          seqIndex: seq++
        });
      }
      if (routeMode === 'mukho' || routeMode === 'both') {
        list.push({
          date: d,
          mode: 'mukho',
          label: '오후 묵호 출발 (묵호 19:11 → 서울 21:49)',
          seqIndex: seq++
        });
      }
    });
    return list;
  }, [selectedDates, routeMode]);

  const safeTicketIdx = Math.min(
    currentTicketIdx,
    Math.max(0, activeTicketsList.length - 1)
  );
  const currentTicketItem = activeTicketsList[safeTicketIdx];

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sync payment date to match travel date
  const handleSyncPaymentWithTravelDate = () => {
    const cleanDate = ticket.travelDate ? ticket.travelDate.split('T')[0] : '2026-08-22';
    const [y, m, d] = cleanDate.split('-');
    const mmdd = `${m.padStart(2, '0')}${d.padStart(2, '0')}`;
    const approvalFormatted = `${y}.${m.padStart(2, '0')}.${d.padStart(2, '0')}`;
    const currentTime =
      ticket.issueDate && ticket.issueDate.includes('T')
        ? ticket.issueDate.split('T')[1].substring(0, 5)
        : '12:34';
    const newIssueDate = `${cleanDate}T${currentTime}`;

    setBaseIssueDate(newIssueDate);
    setTicket((prev) => ({
      ...prev,
      issueDate: newIssueDate,
      ticketMiddleDate: mmdd,
      approvalDate: approvalFormatted,
      salesDate: formatSalesDate(newIssueDate)
    }));
    showToast(`결제 날짜를 이용일(${cleanDate})과 동일하게 맞췄습니다.`);
  };

  // Reset to default original image data
  const handleResetDefaults = () => {
    setTicket(INITIAL_TICKET_DATA);
    setSelectedDates([INITIAL_TICKET_DATA.travelDate || '2026-08-11']);
    setRouteMode('both');
    setCurrentTicketIdx(0);
    setBaseIssueDate(INITIAL_TICKET_DATA.issueDate || '2026-08-04T12:34');
    setSettings({
      showRedBoxes: true,
      autoSyncTicketNumberDate: true,
      exportScale: 2
    });
    showToast('첨부 이미지 원본 데이터로 복원되었습니다.');
  };

  // Select ticket from batch modal gallery
  const handleSelectTicketForEdit = (date: string, mode: 'seoul' | 'mukho') => {
    const preset = createPresetTicketData(date, mode, presetDates, baseIssueDate, 0);
    setTicket((prev) => ({
      ...prev,
      travelDate: preset.travelDate,
      departureStation: preset.departureStation,
      departureTime: preset.departureTime,
      arrivalStation: preset.arrivalStation,
      arrivalTime: preset.arrivalTime,
      trainType: preset.trainType,
      trainNumber: preset.trainNumber,
      amount: mode === 'seoul' ? 29100 : 30700
      // 결제일 관련 항목은 기존 설정값 유지
    }));
    if (!selectedDates.includes(date)) {
      setSelectedDates((prev) => [...prev, date]);
    }
    setRouteMode(mode);
    showToast(`${date} (${mode === 'seoul' ? '오전 서울 출발' : '오후 묵호 출발'}) 영수증을 불러왔습니다.`);
  };

  // Download PNG image (출력 및 저장 시 빨간 표시 절대 안 보임)
  const handleDownloadPng = useCallback(async () => {
    const targetElem = exportRef.current || previewRef.current;
    if (!targetElem) return;

    setIsDownloading(true);
    try {
      // Small timeout to allow potential DOM renders
      await new Promise((res) => setTimeout(res, 80));

      const dataUrl = await toPng(targetElem, {
        quality: 0.98,
        pixelRatio: settings.exportScale || 2,
        cacheBust: true,
        style: {
          margin: '0',
          padding: '0'
        }
      });

      // Format filename e.g., 서울_0810.png or custom name
      const baseName =
        ticket.customFileName && ticket.customFileName.trim()
          ? ticket.customFileName.trim()
          : getDefaultFileName(ticket);
      const filename = baseName.endsWith('.png') ? baseName : `${baseName}.png`;

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const saveResult = await saveBlobWithDesktopPicker(blob, filename, 'png');

      if (saveResult.cancelled) {
        showToast('저장이 취소되었습니다.');
        return;
      }

      showToast(saveResult.locationMessage);
    } catch (err) {
      console.error('PNG download error:', err);
      showToast('PNG 이미지 생성 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsDownloading(false);
    }
  }, [settings.exportScale, ticket]);

  // Handle ticket changes from TicketForm
  const handleTicketChange = (newTicket: TicketData) => {
    setTicket(newTicket);
    if (newTicket.issueDate) {
      setBaseIssueDate(newTicket.issueDate);
    }
  };

  // Flip through selected tickets in the preview with progressive ticketing time
  const handleNavigateTicket = (direction: 'prev' | 'next') => {
    if (activeTicketsList.length === 0) return;
    let nextIdx = 0;
    if (direction === 'prev') {
      nextIdx = (safeTicketIdx - 1 + activeTicketsList.length) % activeTicketsList.length;
    } else {
      nextIdx = (safeTicketIdx + 1) % activeTicketsList.length;
    }
    setCurrentTicketIdx(nextIdx);

    const targetItem = activeTicketsList[nextIdx];
    const preset = createPresetTicketData(
      targetItem.date,
      targetItem.mode,
      presetDates,
      baseIssueDate,
      nextIdx
    );

    setTicket((prev) => ({
      ...prev,
      travelDate: preset.travelDate,
      departureStation: preset.departureStation,
      departureTime: preset.departureTime,
      arrivalStation: preset.arrivalStation,
      arrivalTime: preset.arrivalTime,
      trainType: preset.trainType,
      trainNumber: preset.trainNumber,
      amount: targetItem.mode === 'seoul' ? 29100 : 30700,
      issueDate: preset.issueDate,
      salesDate: preset.salesDate,
      ticketMiddleDate: preset.ticketMiddleDate,
      approvalDate: preset.approvalDate,
      ticketSuffix: preset.ticketSuffix,
      approvalNumber: preset.approvalNumber
    }));
  };

  // Switch direction for current date when in 'both' mode
  const handleSwitchDirection = (targetMode: 'seoul' | 'mukho') => {
    const targetDate = ticket.travelDate;
    const foundIdx = activeTicketsList.findIndex(
      (item) => item.date === targetDate && item.mode === targetMode
    );
    const targetIdx = foundIdx >= 0 ? foundIdx : safeTicketIdx;
    setCurrentTicketIdx(targetIdx);

    const preset = createPresetTicketData(
      targetDate,
      targetMode,
      presetDates,
      baseIssueDate,
      targetIdx
    );

    setTicket((prev) => ({
      ...prev,
      travelDate: preset.travelDate,
      departureStation: preset.departureStation,
      departureTime: preset.departureTime,
      arrivalStation: preset.arrivalStation,
      arrivalTime: preset.arrivalTime,
      trainType: preset.trainType,
      trainNumber: preset.trainNumber,
      amount: targetMode === 'seoul' ? 29100 : 30700,
      issueDate: preset.issueDate,
      salesDate: preset.salesDate,
      ticketMiddleDate: preset.ticketMiddleDate,
      approvalDate: preset.approvalDate,
      ticketSuffix: preset.ticketSuffix,
      approvalNumber: preset.approvalNumber
    }));
  };

  return (
    <div className="min-h-screen bg-slate-100 text-gray-900 font-sans flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight text-gray-900 flex items-center gap-2">
                승차권 가상 영수증 생성기
                <span className="text-[11px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-bold">
                  실제 크기 지원
                </span>
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                한국철도공사 KTX/기차 승차권 영수증 양식 맞춤 제작기
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              title="지정된 32장 전체 한 번에 일괄 저장"
            >
              <Package className="w-3.5 h-3.5 text-red-500" />
              <span className="hidden sm:inline">전체 32장 일괄 저장</span>
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>초기화</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isDownloading}
              className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PNG 저장</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: 좌측 인터페이스, 우측 미리보기 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ─────────────────────────────────────────────────────────────
              LEFT COLUMN: 인터페이스 (7 cols on lg)
              1) 결제 날짜 (최상단)
              2) 결제 정보 (최상단)
              3) 이용일 다중 클릭 선택 (최상단)
              4) 기타 상세 설정
             ───────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-7">
            <TicketForm
              ticket={ticket}
              onChangeTicket={handleTicketChange}
              settings={settings}
              onChangeSettings={setSettings}
              onDownloadPng={handleDownloadPng}
              onResetDefaults={handleResetDefaults}
              isDownloading={isDownloading}
              onOpenBatchModal={() => setIsBatchModalOpen(true)}
              selectedDates={selectedDates}
              onChangeSelectedDates={setSelectedDates}
              routeMode={routeMode}
              onChangeRouteMode={setRouteMode}
              onOpenMultiPrintModal={() => setIsMultiPrintModalOpen(true)}
            />
          </div>

          {/* ─────────────────────────────────────────────────────────────
              RIGHT COLUMN: 고정 실시간 미리보기 (5 cols on lg)
              - Sticky on large screens
              - 실시간 승차권 영수증 미리보기
              - 고정 항목 빨간 테두리 표시 (출력 시 자동 제거)
              - 다중 선택 및 왕복 모드 시 티켓 넘김 & 시간차 반영 지원
              - PNG 저장 & A4 일괄 인쇄 & ZIP 다운로드 버튼
             ───────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col items-center">
              {/* Header Badge */}
              <div className="w-full flex items-center justify-between mb-3.5 pb-2.5 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-red-600" />
                  실시간 승차권 미리보기
                </span>
                <span className="text-[11px] bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  빨간 테두리 = 고정 항목
                </span>
              </div>

              {/* Multi-Ticket Switcher (다중 날짜 또는 왕복 둘 다 선택 시) */}
              {activeTicketsList.length > 1 && (
                <div className="w-full bg-slate-900 text-white p-3 rounded-xl border border-slate-800 mb-3 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleNavigateTicket('prev')}
                      className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white font-bold transition-colors cursor-pointer"
                      title="이전 승차권 보기"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="text-center flex items-center gap-2 flex-wrap justify-center">
                      <span className="font-mono font-bold text-white text-sm">
                        {ticket.travelDate}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          ticket.departureStation.includes('서울') || ticket.departureStation.includes('청량리')
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {ticket.departureStation.includes('서울') || ticket.departureStation.includes('청량리')
                          ? '🌅 오전 서울➔묵호'
                          : '🌆 오후 묵호➔서울'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        ({safeTicketIdx + 1}/{activeTicketsList.length}장)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleNavigateTicket('next')}
                      className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white font-bold transition-colors cursor-pointer"
                      title="다음 승차권 보기"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 차표 끊는 시간차 안내 */}
                  <div className="text-[11px] text-slate-300 bg-slate-800/90 px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5 truncate">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>차표 끊는 시간: <b className="text-white font-mono">{ticket.issueDate.includes('T') ? ticket.issueDate.split('T')[1] : '12:34'}</b> (발권 {safeTicketIdx + 1}번째)</span>
                    </span>
                    <span className="text-emerald-400 font-semibold text-[10px] shrink-0">
                      ✓ 1~2분 시간차 적용
                    </span>
                  </div>

                  {/* 왕복 둘 다 선택 시 당일 노선 원클릭 전환 탭 */}
                  {routeMode === 'both' && (
                    <div className="pt-1 flex items-center justify-center gap-1.5 border-t border-slate-800 text-[11px]">
                      <span className="text-slate-400 text-[10px]">당일 노선 전환:</span>
                      <button
                        type="button"
                        onClick={() => handleSwitchDirection('seoul')}
                        className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          ticket.departureStation.includes('서울') || ticket.departureStation.includes('청량리')
                            ? 'bg-amber-400 text-slate-950 shadow-2xs'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        오전 서울➔묵호 (29,100원)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchDirection('mukho')}
                        className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          ticket.departureStation.includes('묵호')
                            ? 'bg-rose-500 text-white shadow-2xs'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        오후 묵호➔서울 (30,700원)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Receipt Preview Canvas */}
              <div className="bg-gray-100/70 p-3 rounded-xl border border-gray-200 flex justify-center">
                <ReceiptPreview
                  ticket={ticket}
                  settings={settings}
                  previewRef={previewRef}
                />
              </div>

              {/* Explanation of red boxes & print cleanup */}
              <div className="mt-3.5 space-y-1.5 w-full text-center">
                <div className="text-[11px] text-red-700 font-semibold bg-red-50/90 border border-red-200 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                  <span>
                    고정 항목 (승차권 번호 중간 4자리, 발행일시, 승인일자, 판매일자)
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  * <b>출력 및 다운로드 시</b>에는 빨간 표시가 100% 자동 제외되어 실제 원본 승차권 영수증으로 깔끔하게 저장됩니다.
                </p>
              </div>

              {/* Action Buttons Right Under Preview */}
              <div className="w-full pt-4 mt-3 border-t border-gray-100 space-y-2">
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={isDownloading}
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>현재 영수증 고화질 PNG 저장</span>
                </button>

                {selectedDates.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsMultiPrintModalOpen(true)}
                      className="py-2 px-3 bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs rounded-xl border border-gray-300 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-red-600" />
                      <span>A4 일괄 인쇄 ({routeMode === 'both' ? selectedDates.length * 2 : selectedDates.length}장)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMultiPrintModalOpen(true)}
                      className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5 text-red-400" />
                      <span>ZIP 저장 ({routeMode === 'both' ? selectedDates.length * 2 : selectedDates.length}장)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Hidden Pristine Off-screen Container for Single PNG Export (출력 시 빨간 표시 절대 미포함) */}
      <div
        className="fixed top-[-9999px] left-[-9999px] opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        <ReceiptPreview
          ticket={ticket}
          settings={{ ...settings, showRedBoxes: false }}
          isExport={true}
          previewRef={exportRef}
        />
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 mt-12 text-center text-xs text-gray-500">
        <p>승차권 영수증 가상 생성기 — 한국철도공사 승차권 영수증 양식 맞춤 제작</p>
      </footer>

      {/* Multi Ticket Print & Batch Output Modal */}
      <MultiTicketPrintModal
        isOpen={isMultiPrintModalOpen}
        onClose={() => setIsMultiPrintModalOpen(false)}
        selectedDates={selectedDates}
        onToggleDate={(d) => {
          setSelectedDates((prev) =>
            prev.includes(d) ? prev.filter((item) => item !== d) : [...prev, d]
          );
        }}
        onClearDates={() => setSelectedDates([])}
        onSelectAllDates={() => setSelectedDates(presetDates.map((p) => p.date))}
        allPresets={presetDates}
        settings={settings}
        initialRouteMode={routeMode}
        basePaymentDate={ticket.issueDate || baseIssueDate}
        configuredTicket={ticket}
      />

      {/* Batch Download Modal (All 32 items gallery) */}
      <BatchDownloadModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        settings={settings}
        onSelectTicketForEdit={handleSelectTicketForEdit}
        basePaymentDate={ticket.issueDate || baseIssueDate}
        configuredTicket={ticket}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-medium animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
