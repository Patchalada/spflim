import { useEffect, useState } from 'react';
import {
  Printer, X, FileText, ShieldCheck,
  Download, ExternalLink, Maximize2
} from 'lucide-react';
import api from '../api/axios';
import useToast from './useToast';
import OfficialContractDocument from './OfficialContractDocument';
import { printElement, printImage, openOrPrintPdf, downloadDataUrl } from '../utils/printHelper';

export default function ContractDocumentModal({ contract, onClose, documents = [] }) {
  const notify = useToast();
  // เปิดมาที่หนังสือสัญญาฉบับจริงในระบบเป็นค่าเริ่มต้นเสมอ
  const [activeTab, setActiveTab] = useState('contract'); // 'contract' | 'attached'
  const [attachedDoc, setAttachedDoc] = useState(
    contract?.signed_document || contract?.application_document || null
  );
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(false);

  useEffect(() => {
    if (contract?.signed_document) {
      setAttachedDoc(contract.signed_document);
      return;
    }
    if (contract?.application_document) {
      setAttachedDoc(contract.application_document);
      return;
    }

    const role = localStorage.getItem('role');
    const tenantId = contract?.tenant_id || contract?.user_id;

    if (contract?.has_kyc_document || documents.some((d) => d.id?.startsWith('application-'))) {
      setLoadingDoc(true);
      const url = role === 'admin' && tenantId
        ? `/tenant/admin/tenants/${tenantId}/documents/application-${tenantId}`
        : `/tenant/my-documents/kyc`;

      api.get(url)
        .then((res) => {
          if (res.data?.document) {
            setAttachedDoc(res.data.document);
          }
        })
        .catch(() => {})
        .finally(() => {
          setLoadingDoc(false);
        });
    }
  }, [contract, documents]);

  if (!contract) return null;

  const isSignedDoc = Boolean(attachedDoc && contract?.signed_document === attachedDoc);

  const handlePrint = () => {
    if (activeTab === 'attached' && attachedDoc) {
      if (attachedDoc.startsWith('data:application/pdf;')) {
        openOrPrintPdf(attachedDoc, `สัญญาเช่าห้อง-${contract.room_number}.pdf`);
      } else {
        printImage(attachedDoc, `สัญญาเช่าห้องพัก-${contract.room_number}`);
      }
    } else {
      printElement('printable-modal-contract', {
        title: `หนังสือสัญญาเช่าห้องพัก-${contract.room_number}`
      });
    }
  };

  const handleDownload = () => {
    if (!attachedDoc) return;
    const isPdf = attachedDoc.startsWith('data:application/pdf;');
    const ext = isPdf ? 'pdf' : 'png';
    downloadDataUrl(attachedDoc, `สัญญาเช่าห้อง-${contract.room_number}.${ext}`);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
          {/* Modal Header Actions */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-3.5 gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('contract')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'contract'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <FileText size={15} /> หนังสือสัญญาเช่าฉบับจริง (พร้อมลายเซ็น)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('attached')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'attached'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <ShieldCheck size={15} /> {isSignedDoc ? 'ไฟล์สัญญาที่แนบมา (PDF/รูป)' : 'เอกสารแนบตอนสมัคร'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'attached' && attachedDoc && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  title="ดาวน์โหลดไฟล์เอกสาร"
                >
                  <Download size={14} /> ดาวน์โหลด
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-800 transition cursor-pointer"
                title="พิมพ์สัญญา หรือบันทึกเป็น PDF"
              >
                <Printer size={15} /> พิมพ์สัญญา / บันทึก PDF
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={19} />
              </button>
            </div>
          </div>

          {/* Modal Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            {/* VIEW 1: หนังสือสัญญาเช่าห้องพักฉบับจริง (ใช้ OfficialContractDocument ตัวเดียวกับ TenantContract.jsx) */}
            {activeTab === 'contract' && (
              <div className="mx-auto max-w-3xl">
                <OfficialContractDocument
                  contract={contract}
                  id="printable-modal-contract"
                />
              </div>
            )}

            {/* VIEW 2: เอกสารแนบ / สัญญาฉบับสแกน */}
            {activeTab === 'attached' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">
                      {isSignedDoc ? 'เอกสารสัญญาเช่าที่ลงนามแล้ว' : 'เอกสารยืนยันตัวตน / บัตรประชาชน (แนบตอนสมัคร)'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isSignedDoc ? 'ไฟล์เอกสารสัญญาที่ผู้เช่าอัปโหลดกลับมา' : 'เอกสารที่ผู้สมัครอัปโหลดไว้สำหรับยืนยันตัวตน KYC'}
                    </p>
                  </div>
                  {attachedDoc && !attachedDoc.startsWith('data:application/pdf;') && (
                    <button
                      type="button"
                      onClick={() => setFullscreenImage(true)}
                      className="text-xs text-teal-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Maximize2 size={13} /> ดูภาพขยาย
                    </button>
                  )}
                </div>

                {loadingDoc ? (
                  <p className="py-12 text-center text-sm text-slate-400">กำลังโหลดเอกสาร...</p>
                ) : attachedDoc ? (
                  attachedDoc.startsWith('data:application/pdf;') ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg text-xs text-slate-600">
                        <span>ไฟล์เอกสารรูปแบบ PDF</span>
                        <button
                          type="button"
                          onClick={() => openOrPrintPdf(attachedDoc, `เอกสารห้อง-${contract.room_number}.pdf`)}
                          className="inline-flex items-center gap-1 text-teal-700 font-semibold hover:underline cursor-pointer"
                        >
                          <ExternalLink size={13} /> เปิดในแท็บใหม่
                        </button>
                      </div>
                      <iframe
                        title="เอกสาร PDF"
                        src={attachedDoc}
                        className="w-full h-[68vh] min-h-[500px] rounded-xl border border-slate-200"
                      />
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-center items-center overflow-auto max-h-[72vh]">
                      <img
                        src={attachedDoc}
                        alt="เอกสารแนบ"
                        className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-sm border border-slate-200 bg-white"
                      />
                    </div>
                  )
                ) : (
                  <div className="py-12 text-center space-y-2">
                    <p className="text-sm text-slate-500">ไม่มีไฟล์เอกสารแนบ</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('contract')}
                      className="text-xs text-teal-700 font-semibold hover:underline cursor-pointer"
                    >
                      ดูหนังสือสัญญาเช่าทางการในระบบแทน
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal ดูภาพขยายเต็มจอ */}
      {fullscreenImage && attachedDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="relative max-h-[95vh] max-w-[95vw] overflow-auto">
            <button
              type="button"
              onClick={() => setFullscreenImage(false)}
              className="fixed top-4 right-4 z-[70] rounded-full bg-white/90 p-2 text-slate-800 shadow-lg hover:bg-white cursor-pointer"
              aria-label="ปิดภาพขยาย"
            >
              <X size={20} />
            </button>
            <img
              src={attachedDoc}
              alt="เอกสารขนาดเต็ม"
              className="max-h-[92vh] max-w-[92vw] object-contain rounded-xl mx-auto"
            />
          </div>
        </div>
      )}
    </>
  );
}
