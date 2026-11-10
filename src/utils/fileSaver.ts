/**
 * Modern file saver utility with Desktop (바탕화면) folder preference
 * Uses the Web File System Access API (showSaveFilePicker with startIn: 'desktop')
 * and provides seamless fallback to standard anchor download with clear user guidance.
 */

export interface SaveFileResult {
  success: boolean;
  savedToDesktop: boolean;
  cancelled?: boolean;
  filename: string;
  locationMessage: string;
}

export async function saveBlobWithDesktopPicker(
  blob: Blob,
  suggestedFilename: string,
  fileType: 'zip' | 'png' = 'zip'
): Promise<SaveFileResult> {
  const isZip = fileType === 'zip';
  const mimeType = isZip ? 'application/zip' : 'image/png';
  const ext = isZip ? '.zip' : '.png';
  const description = isZip ? 'ZIP 압축 파일' : 'PNG 영수증 이미지';

  // Ensure suggested filename ends with the correct extension
  let safeFilename = suggestedFilename;
  if (!safeFilename.toLowerCase().endsWith(ext)) {
    safeFilename += ext;
  }

  // 1. Try modern File System Access API (window.showSaveFilePicker)
  // Supported in Chrome 86+, Edge 86+, Whale, Opera
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: safeFilename,
        startIn: 'desktop', // Explicitly instructs browser to open in Desktop (바탕화면)
        types: [
          {
            description,
            accept: {
              [mimeType]: [ext]
            }
          }
        ]
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      return {
        success: true,
        savedToDesktop: true,
        filename: safeFilename,
        locationMessage: `바탕화면에 '${safeFilename}' 파일이 안전하게 저장되었습니다.`
      };
    } catch (err: any) {
      // User explicitly clicked "취소" (Cancel) in the native file picker
      if (err.name === 'AbortError') {
        return {
          success: false,
          savedToDesktop: false,
          cancelled: true,
          filename: safeFilename,
          locationMessage: '파일 저장이 취소되었습니다.'
        };
      }
      // If permission or other error occurred, log and continue to fallback
      console.warn('showSaveFilePicker fallback triggered:', err);
    }
  }

  // 2. Standard Browser Download Fallback (Anchor click)
  try {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke object URL after brief delay
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 15000);

    return {
      success: true,
      savedToDesktop: false,
      filename: safeFilename,
      locationMessage: `'${safeFilename}' 파일이 브라우저 다운로드 폴더에 저장되었습니다.`
    };
  } catch (err: any) {
    console.error('File download fallback failed:', err);
    throw new Error('파일 다운로드 실패: ' + (err.message || String(err)));
  }
}
