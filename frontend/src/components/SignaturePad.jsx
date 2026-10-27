import { useEffect, useRef, useState } from 'react';
import { PenTool, UploadCloud, RotateCcw, Image as ImageIcon, CheckCircle, FileText, X } from 'lucide-react';

/**
 * Component สำหรับลงลายมือชื่อ รองรับทั้ง:
 * 1. วาดลายเซ็นสดบน Canvas (Touch บนมือถือ/แท็บเล็ต + Mouse บนคอม)
 * 2. อัปโหลดรูปภาพลายเซ็น (PNG, JPG, WebP)
 * 3. (ทางเลือกเสริม) อัปโหลดไฟล์เอกสารสัญญาฉบับเต็มที่เซ็นแล้ว (PDF, Image)
 */
export default function SignaturePad({
  label = 'ลงลายมือชื่อ',
  initialSignature = null,
  onSignatureChange,
  allowFullDocument = false,
  onFullDocumentChange,
  className = ''
}) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const [activeTab, setActiveTab] = useState(initialSignature ? 'upload_sign' : 'draw'); // 'draw' | 'upload_sign' | 'upload_doc'
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedSignPreview, setUploadedSignPreview] = useState(initialSignature || null);
  const [uploadedSignName, setUploadedSignName] = useState(initialSignature ? 'ลายเซ็นที่บันทึกไว้' : '');
  const [uploadedDocName, setUploadedDocName] = useState('');
  const [uploadedDocPreview, setUploadedDocPreview] = useState(null);

  // อัปเดต initialSignature ถ้ามีการส่งเข้ามาจากข้างนอก
  useEffect(() => {
    if (initialSignature && !uploadedSignPreview) {
      setUploadedSignPreview(initialSignature);
      setUploadedSignName('ลายเซ็นที่บันทึกไว้');
      onSignatureChange?.(initialSignature);
    }
  }, [initialSignature, onSignatureChange, uploadedSignPreview]);

  // ตั้งค่าและรีไซส์ Canvas
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = '#0f2b48'; // สีหมึกน้ำเงินเข้มคมชัด
  };

  useEffect(() => {
    if (activeTab === 'draw') {
      const timer = setTimeout(setupCanvas, 60);
      window.addEventListener('resize', setupCanvas);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', setupCanvas);
      };
    }
  }, [activeTab]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) {
      setHasDrawn(true);
    }
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) {
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange?.(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange?.(null);
  };

  // จัดการอัปโหลดรูปลายเซ็น
  const handleUploadSignature = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('กรุณาเลือกไฟล์รูปภาพ JPG, PNG หรือ WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('ไฟล์รูปต้องมีขนาดไม่เกิน 5MB');
      return;
    }

    setUploadedSignName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      setUploadedSignPreview(result);
      onSignatureChange?.(result);
    };
    reader.readAsDataURL(file);
  };

  const removeUploadedSign = () => {
    setUploadedSignPreview(null);
    setUploadedSignName('');
    onSignatureChange?.(null);
  };

  // จัดการอัปโหลดไฟล์สัญญาฉบับเต็ม
  const handleUploadFullDoc = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('กรุณาเลือกไฟล์ PDF หรือรูปภาพ JPG, PNG, WebP');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('ไฟล์ต้องมีขนาดไม่เกิน 10MB');
      return;
    }

    setUploadedDocName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      setUploadedDocPreview(result);
      onFullDocumentChange?.(result);
    };
    reader.readAsDataURL(file);
  };

  const removeUploadedDoc = () => {
    setUploadedDocPreview(null);
    setUploadedDocName('');
    onFullDocumentChange?.(null);
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-xs ${className}`}>
      {/* ส่วนหัวและตัวเลือกแท็บ */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
          <PenTool size={15} className="text-teal-700" />
          {label}
        </label>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => {
              setActiveTab('draw');
              if (hasDrawn && canvasRef.current) {
                onSignatureChange?.(canvasRef.current.toDataURL('image/png'));
              } else {
                onSignatureChange?.(null);
              }
              onFullDocumentChange?.(null);
            }}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
              activeTab === 'draw'
                ? 'bg-white font-semibold text-teal-800 shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            <PenTool size={13} /> เซ็นสดบนจอ
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('upload_sign');
              onSignatureChange?.(uploadedSignPreview || null);
              onFullDocumentChange?.(null);
            }}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
              activeTab === 'upload_sign'
                ? 'bg-white font-semibold text-teal-800 shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            <ImageIcon size={13} /> อัปโหลดรูปลายเซ็น
          </button>

          {allowFullDocument && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('upload_doc');
                onSignatureChange?.(null);
                onFullDocumentChange?.(uploadedDocPreview || null);
              }}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'upload_doc'
                  ? 'bg-white font-semibold text-teal-800 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <FileText size={13} /> แนบไฟล์สัญญาเต็ม
            </button>
          )}
        </div>
      </div>

      {/* เนื้อหาตามแท็บ */}
      <div className="mt-3">
        {/* TAB 1: วาดลายเซ็นสด */}
        {activeTab === 'draw' && (
          <div className="space-y-2">
            <div className="relative rounded-lg border-2 border-dashed border-teal-300 bg-slate-50/70 overflow-hidden">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ touchAction: 'none' }}
                className="h-36 w-full cursor-crosshair bg-transparent"
              />

              {/* เส้นไกด์บอกตำแหน่งเซ็น */}
              <div className="pointer-events-none absolute bottom-4 left-6 right-6 border-b border-slate-300/80 flex items-center justify-between text-[11px] text-slate-400 pb-0.5">
                <span>✕ เซ็นชื่อเหนือเส้นนี้</span>
                <span>ลายมือชื่อ</span>
              </div>

              {!hasDrawn && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400 font-medium">
                  ✍️ ใช้นิ้วหรือเมาส์วาดลายเซ็นของคุณลงในกรอบนี้
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {hasDrawn ? (
                  <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                    <CheckCircle size={14} /> บันทึกลายเซ็นสดแล้ว (ดูตัวอย่างบนสัญญาด้านบนได้ทันที)
                  </span>
                ) : (
                  'ลากเส้นเพื่อวาดลายเซ็น'
                )}
              </span>
              <button
                type="button"
                onClick={clearCanvas}
                disabled={!hasDrawn}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition cursor-pointer"
              >
                <RotateCcw size={13} /> ล้างแล้วเซ็นใหม่
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: อัปโหลดรูปลายเซ็น */}
        {activeTab === 'upload_sign' && (
          <div className="space-y-2">
            {uploadedSignPreview ? (
              <div className="relative flex flex-col items-center justify-center rounded-lg border border-teal-200 bg-teal-50/30 p-4">
                <img
                  src={uploadedSignPreview}
                  alt="ตัวอย่างลายเซ็นที่อัปโหลด"
                  className="max-h-24 max-w-full object-contain"
                />
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-teal-900 truncate max-w-xs">{uploadedSignName}</span>
                  <button
                    type="button"
                    onClick={removeUploadedSign}
                    className="rounded-full bg-rose-50 p-1 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                    title="ลบแล้วเลือกใหม่"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center cursor-pointer hover:border-teal-600 hover:bg-teal-50/30 transition">
                <UploadCloud size={28} className="text-slate-400 mb-1.5" />
                <span className="text-xs font-semibold text-teal-800">คลิกเพื่อเลือกรูปลายเซ็น</span>
                <span className="text-[11px] text-slate-400 mt-0.5">รองรับไฟล์ PNG, JPG หรือ WebP (ไม่เกิน 5MB)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleUploadSignature}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}

        {/* TAB 3: อัปโหลดไฟล์สัญญาฉบับเต็ม (ถ้าเปิดใช้งาน) */}
        {allowFullDocument && activeTab === 'upload_doc' && (
          <div className="space-y-2">
            {uploadedDocPreview ? (
              <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={20} className="text-teal-700 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{uploadedDocName}</p>
                    <p className="text-[11px] text-emerald-700">แนบเอกสารสัญญาเรียบร้อยแล้ว</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeUploadedDoc}
                  className="rounded-full bg-white p-1 text-rose-600 shadow-xs hover:bg-rose-50 transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center cursor-pointer hover:border-teal-600 hover:bg-teal-50/30 transition">
                <FileText size={28} className="text-slate-400 mb-1.5" />
                <span className="text-xs font-semibold text-teal-800">คลิกเพื่ออัปโหลดไฟล์สัญญาที่ลงนามแล้ว</span>
                <span className="text-[11px] text-slate-400 mt-0.5">รองรับไฟล์ PDF หรือรูปภาพ (ไม่เกิน 10MB)</span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleUploadFullDoc}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
