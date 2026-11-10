import React, { useState, useRef, useMemo } from 'react';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { GeneratorSettings, TicketData } from '../types';
import { QUICK_PRESET_DATES, createPresetTicketData } from '../data/quickPresetDates';
import { ReceiptPreview } from './ReceiptPreview';
import { saveBlobWithDesktopPicker } from '../utils/fileSaver';
import {
  X,
  Download,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
  Train,
  Loader2,
  Eye,
  Calendar,
  FileText,
  Folder,
  Printer
} from 'lucide-react';

interface BatchDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GeneratorSettings;
  onSelectTicketForEdit: (date: string, mode: 'seoul' | 'mukho') => void;
  basePaymentDate?: string;
  configuredTicket?: TicketData;
}

export function formatBatchFileName(
  pattern: string,
  dateStr: string,
  mode: 'seoul' | 'mukho',
  index: number
): string {
  if (!pattern || !pattern.trim()) {
    pattern = '{구분}_{MMDD}';
  }
  const datePart = (dateStr || '2026-08-10').split('T')[0];
  const parts = datePart.split('-');
  const mmdd = parts.length >= 3 ? `${parts[1].padStart(2, '0')}${parts[2].padStart(2, '0')}` : '0810';
  const yyyymmdd = parts.length >= 3 ? `${parts[0]}${mmdd}` : '20260810';
  const tag = mode === 'seoul' ? '서울' : '묵호';
  const num = String(index + 1).padStart(2, '0');
  const trainNum = mode === 'seoul' ? '841' : '846';

  let res = pattern
    .replace(/\{구분\}/g, tag)
    .replace(/\{MMDD\}/g, mmdd)
    .replace(/\{YYYYMMDD\}/g, yyyymmdd)
    .replace(/\{순번\}/g, num)
    .replace(/\{열차번호\}/g, trainNum);

  if (!res.toLowerCase().endsWith('.png')) {
    res += '.png';
  }
  return res;
}

export const BatchDownloadModal: React.FC<BatchDownloadModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSelectTicketForEdit,
  basePaymentDate = '2026-10-02T12:34',
  configuredTicket
}) => {
  const [selectedBatchType, setSelectedBatchType] = useState<'seoul' | 'mukho' | 'both'>('both');
  const [fileNamePattern, setFileNamePattern] = useState<string>('{구분}_{MMDD}');
  const [useFolderStructure, setUseFolderStructure] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [monthFilter, setMonthFilter] = useState<'all' | 'prev' | 'curr' | 'next'>('all');
  const [progress, setProgress] = useState<{ current: number; total: number; statusText: string }>({
    current: 0,
    total: 0,
    statusText: ''
  });
  const [activeTab, setActiveTab] = useState<'export' | 'gallery'>('export');
  const [galleryFilter, setGalleryFilter] = useState<'seoul' | 'mukho'>('seoul');

  // Active presets filtered by month
  const activePresets = useMemo(() => {
    if (monthFilter === 'prev') return QUICK_PRESET_DATES.filter((p) => p.relativeLabel === '전달');
    if (monthFilter === 'curr') return QUICK_PRESET_DATES.filter((p) => p.relativeLabel === '지금 달');
    if (monthFilter === 'next') return QUICK_PRESET_DATES.filter((p) => p.relativeLabel === '다음달');
    return QUICK_PRESET_DATES;
  }, [monthFilter]);

  const prevMonthItem = QUICK_PRESET_DATES.find((p) => p.relativeLabel === '전달');
  const currMonthItem = QUICK_PRESET_DATES.find((p) => p.relativeLabel === '지금 달');
  const nextMonthItem = QUICK_PRESET_DATES.find((p) => p.relativeLabel === '다음달');

  // Hidden batch render container ref
  const hiddenRenderContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Prepare ticket list for export
  const getTicketBatchList = () => {
    const list: { filename: string; ticketData: ReturnType<typeof createPresetTicketData> }[] = [];

    let globalSeq = 0;
    if (selectedBatchType === 'seoul' || selectedBatchType === 'both') {
      activePresets.forEach((p, index) => {
        const ticketData = createPresetTicketData(p.date, 'seoul', activePresets, basePaymentDate, globalSeq);
        if (configuredTicket) {
          ticketData.paymentMethod = configuredTicket.paymentMethod;
          ticketData.cardNumber = configuredTicket.cardNumber;
          ticketData.sellerName = configuredTicket.sellerName;
          ticketData.sellerTaxId = configuredTicket.sellerTaxId;
          ticketData.sellerAddress = configuredTicket.sellerAddress;
          ticketData.sellerPhone = configuredTicket.sellerPhone;
        }
        const leafName = formatBatchFileName(fileNamePattern, p.date, 'seoul', index);
        const filename = useFolderStructure ? `서울출발/${leafName}` : leafName;
        list.push({ filename, ticketData });
        globalSeq++;
      });
    }

    if (selectedBatchType === 'mukho' || selectedBatchType === 'both') {
      activePresets.forEach((p, index) => {
        const ticketData = createPresetTicketData(p.date, 'mukho', activePresets, basePaymentDate, globalSeq);
        if (configuredTicket) {
          ticketData.paymentMethod = configuredTicket.paymentMethod;
          ticketData.cardNumber = configuredTicket.cardNumber;
          ticketData.sellerName = configuredTicket.sellerName;
          ticketData.sellerTaxId = configuredTicket.sellerTaxId;
          ticketData.sellerAddress = configuredTicket.sellerAddress;
          ticketData.sellerPhone = configuredTicket.sellerPhone;
        }
        const leafName = formatBatchFileName(fileNamePattern, p.date, 'mukho', index);
        const filename = useFolderStructure ? `묵호출발/${leafName}` : leafName;
        list.push({ filename, ticketData });
        globalSeq++;
      });
    }

    return list;
  };

  // Run Batch Zip Generation
  const handleStartBatchExport = async () => {
    const batchList = getTicketBatchList();
    if (batchList.length === 0) return;

    setIsProcessing(true);
    setProgress({
      current: 0,
      total: batchList.length,
      statusText: '영수증 이미지 렌더링 준비 중...'
    });

    const zip = new JSZip();

    try {
      const container = hiddenRenderContainerRef.current;
      if (!container) throw new Error('렌더링 컨테이너를 찾을 수 없습니다.');

      for (let i = 0; i < batchList.length; i++) {
        const item = batchList[i];
        setProgress({
          current: i + 1,
          total: batchList.length,
          statusText: `[${i + 1}/${batchList.length}] 영수증 생성 중: ${item.filename.split('/').pop()}`
        });

        // Target individual card element
        const cardElem = container.querySelector(`#batch-card-${i}`) as HTMLElement;
        if (!cardElem) continue;

        // Small pause for layout rendering
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

      setProgress({
        current: batchList.length,
        total: batchList.length,
        statusText: 'ZIP 압축 파일 생성 중...'
      });

      const content = await zip.generateAsync({ type: 'blob' });

      // Trigger ZIP download
      const zipFilename =
        selectedBatchType === 'seoul'
          ? `korail_receipts_seoul_${activePresets.length}.zip`
          : selectedBatchType === 'mukho'
          ? `korail_receipts_mukho_${activePresets.length}.zip`
          : `korail_receipts_all_${activePresets.length * 2}_complete.zip`;

      const result = await saveBlobWithDesktopPicker(content, zipFilename, 'zip');

      if (result.cancelled) {
        setProgress({
          current: batchList.length,
          total: batchList.length,
          statusText: '저장이 취소되었습니다.'
        });
      } else {
        setProgress({
          current: batchList.length,
          total: batchList.length,
          statusText: result.savedToDesktop
            ? '🎉 바탕화면에 저장이 성공적으로 완료되었습니다!'
            : '✅ 다운로드가 성공적으로 완료되었습니다!'
        });
      }
    } catch (err) {
      console.error('Batch export error:', err);
      alert('일괄 저장 도중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  const batchListForExport = getTicketBatchList();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center font-bold text-white shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                지정 날짜 전체 일괄 영수증 생성기
                <span className="text-xs bg-red-600 text-white px-2.5 py-0.5 rounded-full font-semibold">
                  32개 날짜 / 총 64장 지원
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                8월, 9월, 10월 지정된 모든 날짜의 승차권 영수증을 한 번에 ZIP 파일로 압축 다운로드합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="bg-slate-100 border-b border-gray-200 px-6 py-2 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'export'
                ? 'bg-white text-slate-900 shadow-xs border border-gray-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Download className="w-4 h-4 text-red-600" />
            일괄 ZIP 다운로드
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'gallery'
                ? 'bg-white text-slate-900 shadow-xs border border-gray-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Eye className="w-4 h-4 text-blue-600" />
            전체 영수증 한눈에 미리보기 (갤러리)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'export' ? (
            <div className="space-y-6">
              {/* 1. Month range selector (전달, 지금 달, 다음달) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-red-600" />
                    <span>1. 다운로드 대상 월 선택 (지금 달 기준 3개월):</span>
                  </label>
                  <span className="text-[11px] font-bold text-red-600 bg-red-100/70 border border-red-200 px-2 py-0.5 rounded-full">
                    선택된 날짜: {activePresets.length}일
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setMonthFilter('all')}
                    className={`py-2 px-2.5 rounded-lg font-bold border transition-all text-center ${
                      monthFilter === 'all'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    3개월 전체 ({QUICK_PRESET_DATES.length}일)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthFilter('prev')}
                    className={`py-2 px-2.5 rounded-lg font-bold border transition-all text-center ${
                      monthFilter === 'prev'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    전달 ({prevMonthItem?.month || '이전 달'})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthFilter('curr')}
                    className={`py-2 px-2.5 rounded-lg font-bold border transition-all text-center ${
                      monthFilter === 'curr'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    ★ 지금 달 ({currMonthItem?.month || '현재 달'})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthFilter('next')}
                    className={`py-2 px-2.5 rounded-lg font-bold border transition-all text-center ${
                      monthFilter === 'next'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    다음달 ({nextMonthItem?.month || '다음 달'})
                  </button>
                </div>
              </div>

              {/* 2. Batch selection cards */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  2. 다운로드 대상 코스 및 수량 선택:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Option 1: Seoul Only */}
                  <button
                    type="button"
                    onClick={() => setSelectedBatchType('seoul')}
                    disabled={isProcessing}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedBatchType === 'seoul'
                        ? 'border-red-600 bg-red-50/50 ring-2 ring-red-500/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                        오전 {activePresets.length}장
                      </span>
                      {selectedBatchType === 'seoul' && (
                        <CheckCircle2 className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div className="font-bold text-sm text-gray-900">오전 서울 출발 {activePresets.length}장</div>
                    <p className="text-xs text-gray-500 mt-1">
                      청량리 07:05 → 묵호 09:20 (KTX-이음 841)
                    </p>
                    <div className="mt-3 text-[11px] font-medium text-gray-600 border-t border-gray-200/80 pt-2">
                      지정 {activePresets.length}개 날짜 포함 (ZIP 다운로드)
                    </div>
                  </button>

                  {/* Option 2: Mukho Only */}
                  <button
                    type="button"
                    onClick={() => setSelectedBatchType('mukho')}
                    disabled={isProcessing}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedBatchType === 'mukho'
                        ? 'border-red-600 bg-red-50/50 ring-2 ring-red-500/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        오후 {activePresets.length}장
                      </span>
                      {selectedBatchType === 'mukho' && (
                        <CheckCircle2 className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div className="font-bold text-sm text-gray-900">오후 묵호 출발 {activePresets.length}장</div>
                    <p className="text-xs text-gray-500 mt-1">
                      묵호 19:11 → 서울 21:49 (KTX-이음 846)
                    </p>
                    <div className="mt-3 text-[11px] font-medium text-gray-600 border-t border-gray-200/80 pt-2">
                      지정 {activePresets.length}개 날짜 포함 (ZIP 다운로드)
                    </div>
                  </button>

                  {/* Option 3: Both */}
                  <button
                    type="button"
                    onClick={() => setSelectedBatchType('both')}
                    disabled={isProcessing}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedBatchType === 'both'
                        ? 'border-red-600 bg-red-50/50 ring-2 ring-red-500/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        총 {activePresets.length * 2}장 (추천)
                      </span>
                      {selectedBatchType === 'both' && (
                        <CheckCircle2 className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div className="font-bold text-sm text-gray-900">오전 + 오후 총 {activePresets.length * 2}장 전체</div>
                    <p className="text-xs text-gray-500 mt-1">
                      모든 날짜 서울출발 + 묵호출발 영수증 완벽 일괄 생성
                    </p>
                    <div className="mt-3 text-[11px] font-medium text-gray-600 border-t border-gray-200/80 pt-2">
                      {useFolderStructure ? '폴더별 구분 저장' : '한 폴더 일괄 저장'}
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Custom Filename Pattern Settings */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-red-600" />
                    <span>2. 저장 파일명 포맷 설정 (개별 PNG 저장명)</span>
                  </label>
                  <span className="text-[11px] text-gray-500">
                    기본 예시: <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-red-600 font-bold font-mono">서울_0810.png</code> / <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-blue-600 font-bold font-mono">묵호_0810.png</code>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setFileNamePattern('{구분}_{MMDD}')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-left ${
                      fileNamePattern === '{구분}_{MMDD}'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-[10px] opacity-80">기본 포맷 (요청)</div>
                    <div>서울_0810 / 묵호_0810</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFileNamePattern('{MMDD}_{구분}')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-left ${
                      fileNamePattern === '{MMDD}_{구분}'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-[10px] opacity-80">날짜 우선형</div>
                    <div>0810_서울 / 0810_묵호</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFileNamePattern('{순번}_{구분}_{MMDD}')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-left ${
                      fileNamePattern === '{순번}_{구분}_{MMDD}'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-[10px] opacity-80">순시 번호 포함</div>
                    <div>01_서울_0810</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFileNamePattern('{구분}출발_{YYYYMMDD}')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-left ${
                      fileNamePattern === '{구분}출발_{YYYYMMDD}'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-[10px] opacity-80">연월일 상세</div>
                    <div>서울출발_20260810</div>
                  </button>
                </div>

                {/* Custom Pattern Input */}
                <div className="pt-1 space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-600">
                    직접 파일명 패턴 수정 (사용 가능한 태그: <code className="text-red-600 font-mono">{`{구분}`}</code>, <code className="text-red-600 font-mono">{`{MMDD}`}</code>, <code className="text-red-600 font-mono">{`{YYYYMMDD}`}</code>, <code className="text-red-600 font-mono">{`{순번}`}</code>)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={fileNamePattern}
                      onChange={(e) => setFileNamePattern(e.target.value)}
                      placeholder="{구분}_{MMDD}"
                      className="flex-1 px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg font-mono font-bold text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setFileNamePattern('{구분}_{MMDD}')}
                      className="px-3 py-2 text-xs font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg shrink-0"
                    >
                      서울_0810 기본형 복원
                    </button>
                  </div>
                </div>

                {/* ZIP Folder Structure Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-gray-200/80 text-xs">
                  <span className="font-bold text-gray-700 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-slate-600" />
                    ZIP 내 저장 형태:
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-gray-700">
                      <input
                        type="radio"
                        name="folderStructure"
                        checked={!useFolderStructure}
                        onChange={() => setUseFolderStructure(false)}
                        className="text-red-600 focus:ring-red-500"
                      />
                      한 폴더에 모으기 (<code className="text-red-600 font-mono font-bold">서울_0810.png</code>)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-gray-700">
                      <input
                        type="radio"
                        name="folderStructure"
                        checked={useFolderStructure}
                        onChange={() => setUseFolderStructure(true)}
                        className="text-red-600 focus:ring-red-500"
                      />
                      하위 폴더 구분 (<code className="text-gray-600 font-mono">서울출발/서울_0810.png</code>)
                    </label>
                  </div>
                </div>

                {/* File preview sample */}
                <div className="text-[11px] text-gray-600 bg-white p-2.5 rounded-lg border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span>생성될 파일명 예시:</span>
                  <div className="font-mono font-bold text-slate-800 flex items-center gap-3">
                    <span className="text-red-600">{formatBatchFileName(fileNamePattern, '2026-08-10', 'seoul', 0)}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-blue-600">{formatBatchFileName(fileNamePattern, '2026-08-10', 'mukho', 0)}</span>
                  </div>
                </div>
              </div>

              {/* Detail Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-red-600" />
                  자동 생성 및 매칭 규칙 안내:
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed">
                  <li>
                    <b>발행일시 및 승인일자 연동 (3곳 일치):</b> 모든 영수증의 발행일시가 <b>8월 22일 오후 3시 이후</b>로 고정되며(1~5분 이내 랜덤 텀 부여), 승차권 번호 중간 날짜(<b>0822</b>) 및 카드 결제 승인일자(<b>2026.08.22</b>), 판매일자가 3곳 모두 완벽하게 일치 연동됩니다.
                  </li>
                  <li>
                    <b>승차권 번호 및 승인번호 고유화:</b> 개별 승차권마다 <b>승차권 번호(앞자리/중간MMDD/뒷자리)</b>와 <b>카드 승인번호(8자리)</b>가 모두 고유하게 자동 생성됩니다.
                  </li>
                  <li>
                    <b>고화질 PNG 변환:</b> 실제 모바일 화면 380px 표준 가로 규격 기준 고해상도 PNG 파일로 zip 압축됩니다.
                  </li>
                </ul>
              </div>

              {/* Progress bar area if processing */}
              {isProcessing && (
                <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      {progress.statusText}
                    </span>
                    <span className="font-mono text-red-400 font-bold">
                      {Math.round((progress.current / (progress.total || 1)) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-600 transition-all duration-150"
                      style={{
                        width: `${(progress.current / (progress.total || 1)) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons: ZIP Download & Batch Print */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleStartBatchExport}
                  disabled={isProcessing}
                  className="py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      영수증 이미지 압축 생성 중...
                    </>
                  ) : (
                    <>
                      <Package className="w-5 h-5 text-red-400" />
                      {selectedBatchType === 'seoul' && `오전 서울출발 ${activePresets.length}장 ZIP 저장`}
                      {selectedBatchType === 'mukho' && `오후 묵호출발 ${activePresets.length}장 ZIP 저장`}
                      {selectedBatchType === 'both' && `전체 ${activePresets.length * 2}장 ZIP 저장`}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={isProcessing}
                  className="py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <Printer className="w-5 h-5" />
                  <span>A4 영수증 일괄 인쇄 / PDF 출력 ({batchListForExport.length}장)</span>
                </button>
              </div>
            </div>
          ) : (
            /* Gallery tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGalleryFilter('seoul')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      galleryFilter === 'seoul'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    오전 서울 출발 ({activePresets.length}장)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryFilter('mukho')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      galleryFilter === 'mukho'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    오후 묵호 출발 ({activePresets.length}장)
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  원하는 날짜 영수증을 클릭하면 개별 편집 화면으로 불러옵니다.
                </div>
              </div>

              {/* Gallery Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {activePresets.map((p, idx) => {
                  const tData = createPresetTicketData(p.date, galleryFilter, activePresets);
                  return (
                    <div
                      key={p.date}
                      className="bg-gray-100 border border-gray-200 rounded-xl p-3 flex flex-col items-center hover:border-red-500 hover:shadow-md transition-all group relative"
                    >
                      <div className="w-full flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-red-600" />
                          {p.label}
                        </span>
                        <span className="text-[10px] bg-red-50 border border-red-200 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold">
                          {formatBatchFileName(fileNamePattern, p.date, galleryFilter, idx)}
                        </span>
                      </div>

                      {/* Scaled receipt thumbnail */}
                      <div className="transform scale-[0.68] origin-top my-[-50px] pointer-events-none">
                        <ReceiptPreview ticket={tData} settings={settings} />
                      </div>

                      <div className="w-full pt-2 border-t border-gray-200/80 mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-gray-700 font-mono">
                          {tData.amount.toLocaleString()}원
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTicketForEdit(p.date, galleryFilter);
                            onClose();
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-md transition-colors"
                        >
                          편집 화면으로 불러오기
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden off-screen render container for fast batch image rendering */}
      <div className="fixed top-[-9999px] left-[-9999px] opacity-0 pointer-events-none">
        <div ref={hiddenRenderContainerRef} className="flex flex-col gap-10">
          {batchListForExport.map((item, index) => (
            <div id={`batch-card-${index}`} key={index} className="inline-block bg-white p-0 m-0">
              <ReceiptPreview
                ticket={item.ticketData}
                settings={{ ...settings, showRedBoxes: false }}
                isExport={true}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
