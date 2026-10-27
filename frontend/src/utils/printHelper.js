/**
 * ระบบพิมพ์และส่งออกเอกสารคุณภาพสูง (Print & PDF Export Helper)
 * แก้ปัญหาหน้าขาว (Blank Page) ที่เกิดจาก Chromium Layout Overflow / Stacking Context
 */

export function printElement(elementOrId, options = {}) {
  const { title = 'พิมพ์เอกสาร', customStyles = '' } = options;
  const element = typeof elementOrId === 'string'
    ? document.getElementById(elementOrId)
    : elementOrId;

  if (!element) {
    console.error('Print target element not found:', elementOrId);
    window.print();
    return;
  }

  const isContractDocument = element.classList.contains('contract-document');

  // สร้าง iframe ซ่อนสำหรับพิมพ์โดยเฉพาะ เพื่อไม่ให้โครงสร้าง Layout / Flex / Overflow ของหน้าหลักรบกวน
  const iframe = document.createElement('iframe');
  iframe.id = 'spflim-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '-99999px';
  iframe.style.left = '-99999px';
  iframe.style.width = isContractDocument ? '700px' : '1000px';
  iframe.style.height = '1000px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-99999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  // คัดลอก Stylesheets ทั้งหมดจากหน้าหลัก
  const styleElements = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join('\n');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        ${styleElements}
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: inherit;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .bill-document-actions,
          .no-print,
          .print-hidden,
          [data-print-hidden="true"],
          button {
            display: none !important;
          }
          .bill-document-wrap,
          .contract-document-wrap,
          article {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 8px !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
          }
          img {
            max-width: 100% !important;
            height: auto !important;
          }
          ${customStyles}
        </style>
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  // รอให้รูปภาพและ Fonts ภายใน iframe โหลดเสร็จก่อนสั่งพิมพ์
  const executePrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Error invoking iframe print:', e);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }
  };

  // ตรวจสอบว่ามีรูปภาพใน iframe หรือไม่
  const images = doc.querySelectorAll('img');
  if (images.length === 0) {
    setTimeout(executePrint, 250);
  } else {
    let loadedCount = 0;
    const total = images.length;
    const onImgFinish = () => {
      loadedCount += 1;
      if (loadedCount >= total) {
        setTimeout(executePrint, 200);
      }
    };
    images.forEach((img) => {
      if (img.complete) {
        onImgFinish();
      } else {
        img.onload = onImgFinish;
        img.onerror = onImgFinish;
      }
    });
    // Fallback timeout ป้องกันค้าง
    setTimeout(executePrint, 1200);
  }
}

/**
 * พิมพ์รูปภาพเอกสาร (เช่น สัญญาเช่าที่เป็นไฟล์รูปภาพ) แบบเต็มแผ่น A4 ชัดเจน
 */
export function printImage(imageDataUrl, title = 'สัญญาเช่าห้องพัก') {
  if (!imageDataUrl) return;

  const iframe = document.createElement('iframe');
  iframe.id = 'spflim-image-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '-99999px';
  iframe.style.left = '-99999px';
  iframe.style.width = '1000px';
  iframe.style.height = '1000px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            width: 100%;
            height: 100%;
          }
          .img-container {
            width: 100%;
            max-width: 100%;
            display: flex;
            justify-content: center;
          }
          img {
            max-width: 100%;
            max-height: 96vh;
            object-fit: contain;
            display: block;
            margin: 0 auto;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        </style>
      </head>
      <body>
        <div class="img-container">
          <img src="${imageDataUrl}" alt="${title}" />
        </div>
      </body>
    </html>
  `);
  doc.close();

  const img = doc.querySelector('img');
  const trigger = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }
  };

  if (img?.complete) {
    setTimeout(trigger, 200);
  } else if (img) {
    img.onload = () => setTimeout(trigger, 150);
    img.onerror = trigger;
  } else {
    trigger();
  }
}

/**
 * เปิดดูหรือพิมพ์ไฟล์ PDF
 */
export function openOrPrintPdf(pdfDataUrl, filename = 'เอกสารสัญญา.pdf') {
  if (!pdfDataUrl) return;

  try {
    const parts = pdfDataUrl.split(',');
    const header = parts[0];
    const base64Data = parts[1];
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';

    const byteCharacters = atob(base64Data);
    const byteArrays = [];
    const sliceSize = 512;

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }

    const blob = new Blob(byteArrays, { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    const win = window.open(blobUrl, '_blank');
    if (!win) {
      // หาก Popup ถูกบล็อก ให้ดาวน์โหลดแทน
      downloadDataUrl(pdfDataUrl, filename);
    }
  } catch (err) {
    console.error('Error handling PDF preview:', err);
    downloadDataUrl(pdfDataUrl, filename);
  }
}

/**
 * ดาวน์โหลด Data URL เป็นไฟล์ลงเครื่อง
 */
export function downloadDataUrl(dataUrl, filename = 'เอกสาร') {
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
