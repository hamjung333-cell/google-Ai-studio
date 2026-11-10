import React, { useState, useRef, useMemo, useEffect } from 'react';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { GeneratorSettings, TicketData } from '../types';
import { QuickDatePreset, createPresetTicketData } from '../data/quickPresetDates';
import { ReceiptPreview } from './ReceiptPreview';
import { formatBatchFileName } from './BatchDownloadModal';
import { saveBlobWithDesktopPicker } from '../utils/fileSaver';
import { getSequentialTicketingTime } from '../utils/dateUtils';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  Package,
  Layers,
  Train,
  Loader2,
  Calendar,
  Check,
  Eye,
  FileDown,
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface MultiTicketPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDates: string[]; // YYYY-MM-DD
  onToggleDate: (date: string) => void;
  onClearDates: () => void;
  onSelectAllDates: () => void;
  allPresets: QuickDatePreset[];
  settings: GeneratorSettings;
  initialRouteMode?: 'seoul' | 'mukho' | 'both';
  basePaymentDate?: string;
  configuredTicket?: TicketData;
}

export const MultiTicketPrintModal: React.FC<MultiTicketPrintModalProps> = ({
  isOpen,
  onClose,
  selectedDates,
  onToggleDate,
  onClearDates,
  onSelectAllDates,
  allPresets,
  settings,
  initialRouteMode = 'both',
  basePaymentDate = '2026-10-02T12:34',
  configuredTicket
}) => {
  const [routeMode, setRouteMode] = useState<'seoul' | 'mukho' | 'both'>(initialRouteMode);
  const [printLayout, setPrintLayout] = useState<'single' | 'double'>('double');
  // 기본값을 'use_configured'로 설정하여 사용자가 설정한 결제일(예: 10월 02일)이 다중선택 시 100% 자동 적용되도록 함
  const [paymentDateMode, setPaymentDateMode] = useState<'use_configured' | 'sync_travel'>('use_configured');
  const [modalPaymentDate, setModalPaymentDate] = useState<string>(basePaymentDate);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'dateSelector'>('preview');
  const [saveLocationNotice, setSaveLocationNotice] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; statusText: string }>({
    current: 0,
    total: 0,
    statusText: ''
  });

  const printContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (basePaymentDate) {
      setModalPaymentDate(basePaymentDate);
    }
  }, [basePaymentDate]);

  // Filter and sort selected presets chronologically
  const activePresets = useMemo(() => {
    return allPresets
      .filter((p) => selectedDates.includes(p.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allPresets, selectedDates]);

  // Generate ticket data list for all selected dates and selected route mode
  const ticketsList = useMemo(() => {
    const list: {
      id: string;
      date: string;
      mode: 'seoul' | 'mukho';
      modeLabel: string;
      ticketData: TicketData;
      filename: string;
    }[] = [];

    let globalSeq = 0;
    activePresets.forEach((p, idx) => {
      // paymentDateMode에 따라 설정된 결제일(modalPaymentDate) 또는 이용일 당일 적용
      const targetBaseTime = paymentDateMode === 'sync_travel' ? `${p.date}T12:34` : modalPaymentDate;

      if (routeMode === 'seoul' || routeMode === 'both') {
        const ticketData = createPresetTicketData(p.date, 'seoul', allPresets, targetBaseTime, globalSeq);
        if (configuredTicket) {
          ticketData.paymentMethod = configuredTicket.paymentMethod;
          ticketData.cardNumber = configuredTicket.cardNumber;
          ticketData.sellerName = configuredTicket.sellerName;
          ticketData.sellerTaxId = configuredTicket.sellerTaxId;
          ticketData.sellerAddress = configuredTicket.sellerAddress;
          ticketData.sellerPhone = configuredTicket.sellerPhone;
        }
        const filename = formatBatchFileName('{구분}_{MMDD}', p.date, 'seoul', idx);
        list.push({
          id: `${p.date}-seoul`,
          date: p.date,
          mode: 'seoul',
          modeLabel: '오전 서울 출발 (KTX-이음 841)',
          ticketData,
          filename
        });
        globalSeq++;
      }

      if (routeMode === 'mukho' || routeMode === 'both') {
        const ticketData = createPresetTicketData(p.date, 'mukho', allPresets, targetBaseTime, globalSeq);
        if (configuredTicket) {
          ticketData.paymentMethod = configuredTicket.paymentMethod;
          ticketData.cardNumber = configuredTicket.cardNumber;
          ticketData.sellerName = configuredTicket.sellerName;
          ticketData.sellerTaxId = configuredTicket.sellerTaxId;
          ticketData.sellerAddress = configuredTicket.sellerAddress;
          ticketData.sellerPhone = configuredTicket.sellerPhone;
        }
        const filename = formatBatchFileName('{구분}_{MMDD}', p.date, 'mukho', idx);
        list.push({
          id: `${p.date}-mukho`,
          date: p.date,
          mode: 'mukho',
          modeLabel: '오후 묵호 출발 (KTX-이음 846)',
          ticketData,
          filename
        });
        globalSeq++;
      }
    });

    return list;
  }, [activePresets, routeMode, allPresets, paymentDateMode, modalPaymentDate, configuredTicket]);

  // Group all presets by month for date selector tab
  const monthGroups = useMemo(() => {
    const groups: {
      monthKey: string;
      monthFullLabel: string;
      relativeLabel: '전달' | '지금 달' | '다음달';
      dates: QuickDatePreset[];
    }[] = [];

    const seen = new Set<string>();
    for (const p of allPresets) {
      if (!seen.has(p.monthKey)) {
        seen.add(p.monthKey);
        groups.push({
          monthKey: p.monthKey,
          monthFullLabel: p.monthFullLabel,
          relativeLabel: p.relativeLabel,
          dates: allPresets.filter((item) => item.monthKey === p.monthKey)
        });
      }
    }
    return groups;
  }, [allPresets]);

  if (!isOpen) return null;

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Export selected tickets as ZIP
  const handleExportZip = async () => {
    if (ticketsList.length === 0) return;

    setIsExportingZip(true);
    setSaveLocationNotice(null);
    setExportProgress({
      current: 0,
      total: ticketsList.length,
      statusText: '영수증 이미지 렌더링 준비 중...'
    });

    const zip = new JSZip();

    try {
      const container = printContainerRef.current;
      if (!container) throw new Error('출력 컨테이너를 찾을 수 없습니다.');

      for (let i = 0; i < ticketsList.length; i++) {
        const item = ticketsList[i];
        setExportProgress({
          current: i + 1,
          total: ticketsList.length,
          statusText: `[${i + 1}/${ticketsList.length}] ${item.filename} 고화질 생성 중...`
        });

        const cardElem = container.querySelector(`#print-ticket-card-${item.id}`) as HTMLElement;
        if (!cardElem) {
          console.warn(`Card element not found for ${item.id}`);
          continue;
        }

        // Wait for rendering layout stability
        await new Promise((res) => setTimeout(res, 80));

        const dataUrl = await toPng(cardElem, {
          quality: 0.98,
          pixelRatio: settings.exportScale || 2,
          cacheBust: true,
          style: {
            margin: '0',
            padding: '0'
          }
        });

        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        zip.file(item.filename, base64Data, { base64: true });
      }

      setExportProgress({
        current: ticketsList.length,
        total: ticketsList.length,
        statusText: '바탕화면 저장 창 여는 중...'
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const defaultZipName = `korail_receipts_selected_${ticketsList.length}tickets.zip`;

      const result = await saveBlobWithDesktopPicker(blob, defaultZipName, 'zip');

      if (result.cancelled) {
        setExportProgress({
          current: ticketsList.length,
          total: ticketsList.length,
          statusText: '저장이 취소되었습니다.'
        });
      } else {
        setExportProgress({
          current: ticketsList.length,
          total: ticketsList.length,
          statusText: result.savedToDesktop
            ? '🎉 바탕화면에 저장이 완료되었습니다!'
            : '✅ 다운로드가 완료되었습니다!'
        });
        setSaveLocationNotice(result.locationMessage);
      }
    } catch (err: any) {
      console.error('Multi ticket export error:', err);
      alert('ZIP 압축 생성 중 오류가 발생했습니다: ' + (err.message || '다시 시도해 주세요.'));
    } finally {
      setIsExportingZip(false);
    }
  };

  // Download single ticket PNG
  const handleDownloadSingleTicket = async (itemId: string, filename: string) => {
    const container = printContainerRef.current;
    if (!container) return;
    const cardElem = container.querySelector(`#print-ticket-card-${itemId}`) as HTMLElement;
    if (!cardElem) return;

    try {
      const dataUrl = await toPng(cardElem, {
        quality: 0.98,
        pixelRatio: settings.exportScale || 2,
        cacheBust: true
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await saveBlobWithDesktopPicker(blob, filename, 'png');
    } catch (e) {
      console.error('Failed to download single ticket:', e);
    }
  };

  return (
    <>
      {/* On-screen Modal Dialog (hidden during print) */}
      <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center font-bold text-white shadow-sm shrink-0">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  선택한 날짜 영수증 일괄 출력 / 인쇄
                  <span className="text-xs bg-red-600 text-white px-2.5 py-0.5 rounded-full font-semibold">
                    선택 {selectedDates.length}일 / 영수증 총 {ticketsList.length}장
                  </span>
                </h2>
                <p className="text-xs text-slate-300">
                  클릭하여 선택한 날짜들의 승차권 영수증을 한 번에 인쇄(PDF 저장)하거나 ZIP 파일로 다운로드합니다.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isExportingZip}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Desktop Save Location Guidance Banner */}
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-950">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0 shadow-2xs">
                🖥️
              </span>
              <span>
                <b>저장 위치: 바탕화면 (Desktop)</b> — [ZIP 일괄 다운로드] 시 <b>바탕화면 위치</b>로 저장 대화상자가 자동 연결됩니다.
              </span>
            </div>
            {saveLocationNotice && (
              <span className="font-bold text-emerald-800 bg-white px-2.5 py-0.5 rounded-full border border-emerald-300 text-[11px] shadow-2xs">
                {saveLocationNotice}
              </span>
            )}
          </div>

          {/* Top Controls & Route Selector */}
          <div className="bg-slate-100 border-b border-gray-200 px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Route Mode Switcher */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <Train className="w-3.5 h-3.5 text-red-600" />
                출력 대상:
              </span>
              <div className="bg-white border border-gray-300 rounded-lg p-0.5 flex items-center text-xs">
                <button
                  type="button"
                  onClick={() => setRouteMode('seoul')}
                  className={`px-2.5 py-1 rounded font-bold transition-all ${
                    routeMode === 'seoul'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  오전 서울출발 ({activePresets.length}장)
                </button>
                <button
                  type="button"
                  onClick={() => setRouteMode('mukho')}
                  className={`px-2.5 py-1 rounded font-bold transition-all ${
                    routeMode === 'mukho'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  오후 묵호출발 ({activePresets.length}장)
                </button>
                <button
                  type="button"
                  onClick={() => setRouteMode('both')}
                  className={`px-2.5 py-1 rounded font-bold transition-all ${
                    routeMode === 'both'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  왕복 둘 다 ({activePresets.length * 2}장)
                </button>
              </div>
            </div>

            {/* Payment Date Rule Switcher */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="font-bold text-gray-700 text-[11px] shrink-0">결제일:</span>
              <div className="bg-gray-100 p-0.5 rounded-lg border border-gray-200 flex items-center text-[11px]">
                <button
                  type="button"
                  onClick={() => setPaymentDateMode('use_configured')}
                  className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    paymentDateMode === 'use_configured'
                      ? 'bg-red-600 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="설정한 결제일(예: 10월 02일)로 모든 승차권 4곳 일치 및 1~2분 시간차 적용"
                >
                  ✓ 설정 결제일 ({modalPaymentDate.split('T')[0]})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentDateMode('sync_travel')}
                  className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    paymentDateMode === 'sync_travel'
                      ? 'bg-red-600 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="각 티켓의 결제일(4곳)을 각 이용일 당일로 일치"
                >
                  각 이용일 당일 결제
                </button>
              </div>

              {/* Direct payment date picker in modal when using configured date */}
              {paymentDateMode === 'use_configured' && (
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-0.5 shadow-2xs">
                  <span className="text-[10px] text-gray-400 font-bold">결제일자:</span>
                  <input
                    type="date"
                    value={modalPaymentDate.split('T')[0]}
                    onChange={(e) => {
                      const time = modalPaymentDate.includes('T') ? modalPaymentDate.split('T')[1] : '12:34';
                      setModalPaymentDate(`${e.target.value}T${time}`);
                    }}
                    className="text-xs font-mono font-bold text-gray-900 outline-none bg-transparent"
                  />
                  <input
                    type="time"
                    value={modalPaymentDate.includes('T') ? modalPaymentDate.split('T')[1].substring(0, 5) : '12:34'}
                    onChange={(e) => {
                      const date = modalPaymentDate.split('T')[0];
                      setModalPaymentDate(`${date}T${e.target.value}`);
                    }}
                    className="text-xs font-mono font-bold text-gray-900 outline-none bg-transparent ml-1 border-l border-gray-200 pl-1"
                  />
                </div>
              )}
            </div>

            {/* Tab switch */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-white text-slate-900 shadow-xs border border-gray-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                영수증 미리보기 ({ticketsList.length}장)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dateSelector')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'dateSelector'
                    ? 'bg-white text-slate-900 shadow-xs border border-gray-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-red-600" />
                날짜 추가 / 관리 ({selectedDates.length}/{allPresets.length}일)
              </button>
            </div>
          </div>

          {/* Selected Date Chips Bar */}
          <div className="bg-slate-50 border-b border-gray-200 px-5 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-[11px] font-bold text-gray-500 shrink-0">
                선택된 날짜:
              </span>
              <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-thin">
                {activePresets.length === 0 ? (
                  <span className="text-xs text-red-500 font-bold">
                    선택된 날짜가 없습니다. 날짜를 클릭하여 선택해 주세요.
                  </span>
                ) : (
                  activePresets.map((p) => (
                    <span
                      key={p.date}
                      className="inline-flex items-center gap-1 bg-white border border-gray-300 text-gray-800 text-[11px] font-mono px-2 py-0.5 rounded-md shadow-2xs shrink-0"
                    >
                      <span>{p.label}</span>
                      <button
                        type="button"
                        onClick={() => onToggleDate(p.date)}
                        className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-gray-100"
                        title="선택 해제"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onSelectAllDates}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-200"
              >
                전체 선택
              </button>
              <button
                type="button"
                onClick={onClearDates}
                className="text-[11px] font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 px-2 py-1 rounded border border-gray-200"
              >
                선택 해제
              </button>
            </div>
          </div>

          {/* Modal Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
            {activeTab === 'dateSelector' ? (
              /* Date Selector Tab */
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-900">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>
                      아래 날짜를 클릭하여 출력할 영수증 날짜를 <b>다중 선택/해제</b>할 수 있습니다. (전달 · 지금 달 · 다음달)
                    </span>
                  </div>
                  <span className="font-bold text-blue-700">
                    현재 선택: {selectedDates.length}개 날짜
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {monthGroups.map((group) => {
                    const isCurrent = group.relativeLabel === '지금 달';
                    const groupSelectedCount = group.dates.filter((d) => selectedDates.includes(d.date)).length;
                    const isAllSelected = groupSelectedCount === group.dates.length && group.dates.length > 0;

                    const toggleGroup = () => {
                      if (isAllSelected) {
                        group.dates.forEach((d) => {
                          if (selectedDates.includes(d.date)) onToggleDate(d.date);
                        });
                      } else {
                        group.dates.forEach((d) => {
                          if (!selectedDates.includes(d.date)) onToggleDate(d.date);
                        });
                      }
                    };

                    return (
                      <div
                        key={group.monthKey}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isCurrent
                            ? 'bg-red-50/30 border-red-300 ring-1 ring-red-400/20'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                group.relativeLabel === '지금 달'
                                  ? 'bg-red-600 text-white'
                                  : group.relativeLabel === '전달'
                                  ? 'bg-gray-700 text-white'
                                  : 'bg-blue-800 text-white'
                              }`}
                            >
                              {group.relativeLabel}
                            </span>
                            <span className="font-bold text-xs text-gray-900">
                              {group.monthFullLabel}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={toggleGroup}
                            className="text-[11px] font-semibold text-red-600 hover:text-red-700 underline"
                          >
                            {isAllSelected ? '전체해제' : '월 전체선택'} ({groupSelectedCount}/{group.dates.length})
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {group.dates.map((p) => {
                            const isSelected = selectedDates.includes(p.date);
                            const isSunday = p.dayOfWeek === '일';
                            const isSaturday = p.dayOfWeek === '토';

                            return (
                              <button
                                key={p.date}
                                type="button"
                                onClick={() => onToggleDate(p.date)}
                                className={`px-2 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center justify-between border ${
                                  isSelected
                                    ? 'bg-red-600 text-white border-red-600 font-bold shadow-xs'
                                    : isSunday
                                    ? 'bg-white hover:bg-rose-50 text-gray-900 border-rose-200 hover:border-rose-300'
                                    : isSaturday
                                    ? 'bg-white hover:bg-blue-50 text-gray-900 border-blue-200 hover:border-blue-300'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-100'
                                }`}
                              >
                                <span className="flex items-center gap-0.5">
                                  <span>{p.label.split('(')[0]}</span>
                                  <span
                                    className={`text-[11px] font-bold ${
                                      isSelected
                                        ? 'text-white'
                                        : isSunday
                                        ? 'text-rose-600'
                                        : isSaturday
                                        ? 'text-blue-600'
                                        : 'text-gray-500'
                                    }`}
                                  >
                                    ({p.dayOfWeek})
                                  </span>
                                </span>
                                <div
                                  className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${
                                    isSelected ? 'bg-white text-red-600' : 'border border-gray-300'
                                  }`}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Preview Tab */
              <div className="space-y-6">
                {ticketsList.length === 0 ? (
                  <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-gray-700">선택된 날짜가 없습니다</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      상단의 [날짜 추가 / 관리] 탭을 눌러 원하는 날짜들을 클릭하여 추가해 주세요.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('dateSelector')}
                      className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-xs"
                    >
                      날짜 선택하러 가기
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Print & Export Settings Bar */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                          <Printer className="w-4 h-4 text-red-600" />
                          인쇄 레이아웃:
                        </span>
                        <div className="bg-white border border-gray-300 rounded-lg p-0.5 flex items-center text-xs">
                          <button
                            type="button"
                            onClick={() => setPrintLayout('single')}
                            className={`px-3 py-1 rounded font-bold transition-all ${
                              printLayout === 'single'
                                ? 'bg-slate-900 text-white'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            1페이지당 1장 (단독)
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintLayout('double')}
                            className={`px-3 py-1 rounded font-bold transition-all ${
                              printLayout === 'double'
                                ? 'bg-slate-900 text-white'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            A4 1페이지당 2장 (절약 추천)
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 font-medium">
                        * 브라우저 인쇄 창에서 <b>'PDF로 저장'</b>을 선택하면 바로 다중 페이지 PDF 문서로 저장할 수 있습니다.
                      </div>
                    </div>

                    {/* Ticket Cards Grid Preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
                      {ticketsList.map((item, index) => (
                        <div
                          key={item.id}
                          className="bg-gray-100 rounded-2xl p-4 border border-gray-200 flex flex-col items-center w-full max-w-[400px]"
                        >
                          <div className="w-full flex items-center justify-between mb-2.5 px-1">
                            <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                              <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] flex items-center justify-center font-bold">
                                {index + 1}
                              </span>
                              <span>{item.date}</span>
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                item.mode === 'seoul'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {item.mode === 'seoul' ? '오전 서울' : '오후 묵호'}
                            </span>
                          </div>

                          {/* Live Preview Card */}
                          <div className="transform scale-95 origin-top">
                            <ReceiptPreview
                              ticket={item.ticketData}
                              settings={settings}
                              previewRef={null}
                            />
                          </div>

                          {/* Quick single download */}
                          <div className="w-full mt-3 pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                            <span className="text-gray-500 font-mono text-[11px]">
                              {item.filename}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDownloadSingleTicket(item.id, item.filename)}
                              className="text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 text-[11px]"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              개별 PNG
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Progress Overlay when Exporting ZIP */}
          {isExportingZip && (
            <div className="bg-slate-900/95 text-white p-4 border-t border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-red-500 animate-spin shrink-0" />
                <div>
                  <div className="text-xs font-bold">{exportProgress.statusText}</div>
                  <div className="text-[11px] text-slate-400">
                    {exportProgress.current} / {exportProgress.total} 처리 완료
                  </div>
                </div>
              </div>
              <div className="w-48 bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-red-600 h-2.5 rounded-full transition-all duration-200"
                  style={{
                    width: `${exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="bg-white border-t border-gray-200 px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-gray-600 font-medium">
              총 <b>{ticketsList.length}장</b>의 승차권 영수증이 출력/저장 대기 중입니다.
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isExportingZip}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                닫기
              </button>

              <button
                type="button"
                onClick={handleExportZip}
                disabled={isExportingZip || ticketsList.length === 0}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isExportingZip ? (
                  <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                ) : (
                  <Package className="w-4 h-4 text-red-400" />
                )}
                <span>선택 {ticketsList.length}장 ZIP 일괄 다운로드</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={isExportingZip || ticketsList.length === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>선택 {ticketsList.length}장 즉시 인쇄 / PDF 출력</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Off-screen Render & Dedicated Printable Container */}
      <div
        ref={printContainerRef}
        id="printable-multi-tickets"
        className="printable-area offscreen-render-area"
      >
        <div
          className={`print-container ${
            printLayout === 'double' ? 'print-layout-double' : 'print-layout-single'
          }`}
        >
          {ticketsList.map((item, index) => (
            <div
              key={item.id}
              id={`print-ticket-card-${item.id}`}
              className={`print-ticket-item ${
                printLayout === 'single'
                  ? 'print-page-break'
                  : index % 2 === 1
                  ? 'print-page-break'
                  : 'print-ticket-spacing'
              }`}
            >
              <ReceiptPreview
                ticket={item.ticketData}
                settings={{ ...settings, showRedBoxes: false }}
                previewRef={null}
                isExport={true}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
