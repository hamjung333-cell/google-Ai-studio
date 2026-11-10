export type RouteMode = 'seoul' | 'mukho' | 'both';

export interface TicketData {
  // Purchase Info (구매 정보)
  productType: string; // 상품유형 (기차 승차권)
  travelDate: string; // 이용일자 (e.g. 2026-08-11)
  travelDateFormatted?: string; // e.g. 2026년 08월 11일 (화)
  
  departureStation: string; // 묵호
  departureTime: string; // 19:11
  arrivalStation: string; // 서울
  arrivalTime: string; // 21:49
  
  trainType: string; // KTX-이음
  trainNumber: string; // 846
  
  ticketCount: string; // 1매
  
  ticketPrefix: string; // 82225
  ticketMiddleDate: string; // 0804 (Auto synced from issueDate MMDD)
  ticketSuffix: string; // 10895-34
  
  issueDate: string; // 발행일시 (e.g. 2026-08-04T12:34)
  issueDateFormatted?: string; // e.g. 2026년 08월 04일 (화) 12:34
  
  // Payment Info (결제 정보)
  paymentMethod: string; // 네이버페이
  cardNumber: string; // 47386795****149*(일시불)
  approvalDate: string; // 2026.08.04
  approvalNumber: string; // 55014482
  amount: number; // 27400
  
  // Seller Info (판매자 정보)
  sellerName: string; // 한국철도공사
  sellerTaxId: string; // 314-82-10024
  sellerAddress: string; // 대전광역시 동구 중앙로 240
  salesDate: string; // 2026년 08월 04일 12:37:20
  sellerPhone: string; // 1588-7788
  
  // Custom File Name for Download
  customFileName?: string;
}

export interface GeneratorSettings {
  showRedBoxes: boolean; // Show red borders on editable areas matching sample image
  autoSyncTicketNumberDate: boolean; // Sync middle date in ticket number from issue date
  exportScale: number; // PNG export scale factor (1x, 2x, 3x)
}

