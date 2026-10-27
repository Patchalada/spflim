import { useEffect, useState, useCallback } from 'react';
import {
  Building, FileText, Printer, ShieldCheck, User, Calendar,
  ArrowRight, Eye, X, Download, AlertCircle, CheckCircle, Send, PenTool
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import useToast from '../components/useToast';
import SignaturePad from '../components/SignaturePad';
import OfficialContractDocument from '../components/OfficialContractDocument';
import { printElement, printImage, openOrPrintPdf, downloadDataUrl } from '../utils/printHelper';

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(`${String(date).slice(0, 10)}T00:00:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const formatMoney = (val) => Number(val || 0).toLocaleString('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export default function TenantContract() {
  const notify = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedContractIndex, setSelectedContractIndex] = useState(0);
  const [attachedContractDoc, setAttachedContractDoc] = useState(null);
  const [loadingAttachedDoc, setLoadingAttachedDoc] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'attached' | 'renewals'
  const [fullscreenImage, setFullscreenImage] = useState(false);

  // การลงนามฝั่งผู้เช่า
  const [tenantSig, setTenantSig] = useState(null);
  const [tenantFullDoc, setTenantFullDoc] = useState(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submittingSign, setSubmittingSign] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/tenant/me');
      const tenantData = res.data || {};
      setData(tenantData);

      const cList = tenantData.contracts || [];
      const primaryContract = cList[0] || (tenantData.contract_id ? tenantData : null);
      const isPending = (primaryContract?.status || primaryContract?.contract_status) === 'pending_signature';

      if (isPending) {
        setActiveTab('details');
      } else if (tenantData.application_document) {
        setAttachedContractDoc(tenantData.application_document);
      } else if (tenantData.has_kyc_document) {
        setLoadingAttachedDoc(true);
        try {
          const docRes = await api.get('/tenant/my-documents/kyc');
          if (docRes.data?.document) {
            setAttachedContractDoc(docRes.data.document);
          }
        } catch (e) {
          console.error('Could not fetch attached kyc doc:', e);
        } finally {
          setLoadingAttachedDoc(false);
        }
      }
    } catch (err) {
      notify(err.response?.data?.error || 'โหลดข้อมูลสัญญาไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void Promise.resolve().then(loadData).catch(() => {});
  }, [loadData]);

  if (loading) {
    return <p className="py-12 text-center text-slate-500">กำลังโหลดสัญญาเช่าห้องพัก...</p>;
  }

  const contracts = data?.contracts || [];
  const currentContract = contracts[selectedContractIndex] || (data?.contract_id ? data : null);
  const renewalDocs = (data?.documents || []).filter((d) => d.id !== `application-${data?.user_id}`);
  const currentStatus = currentContract?.status || currentContract?.contract_status;
  const isPendingSignature = currentStatus === 'pending_signature';

  const statusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">ใช้งานอยู่ (Active)</span>;
      case 'pending_signature':
        return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">รอคุณลงนามสัญญา (Pending Signature)</span>;
      case 'terminated':
        return <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">สิ้นสุดสัญญาแล้ว</span>;
      case 'expired':
        return <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">หมดอายุ</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{status || '-'}</span>;
    }
  };

  if (!currentContract || !currentContract.contract_id) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <Building size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">ยังไม่มีสัญญาเช่าห้องพักในระบบ</h2>
        <p className="mt-2 text-sm text-slate-500">
          เมื่อผู้ดูแลหอพักได้ตรวจสอบเอกสาร KYC และสร้างสัญญาเช่าให้คุณแล้ว คุณสามารถเข้ามาตรวจสอบและลงนามสัญญาได้ที่หน้านี้
        </p>
        <div className="mt-6">
          <Link
            to="/my-dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition"
          >
            กลับสู่แดชบอร์ด
          </Link>
        </div>
      </div>
    );
  }

  // ส่งการลงนามสัญญา
  const handleSignContract = async (e) => {
    e.preventDefault();
    if (!tenantSig && !tenantFullDoc) {
      notify('กรุณาวาดลายเซ็นสดบนจอ หรืออัปโหลดรูปลายเซ็น / สัญญาที่เซ็นแล้ว', 'error');
      return;
    }
    if (!acceptTerms) {
      notify('กรุณาติ๊กยอมรับข้อตกลงและเงื่อนไขแห่งสัญญา', 'error');
      return;
    }

    setSubmittingSign(true);
    try {
      const res = await api.post(`/tenant/contracts/${currentContract.contract_id}/sign`, {
        tenant_signature: tenantSig,
        signed_document: tenantFullDoc
      });
      notify(res.data?.message || 'ลงนามสัญญาเช่าเรียบร้อยแล้ว สัญญาเริ่มต้นใช้งานทันที', 'success');
      await loadData();
    } catch (err) {
      notify(err.response?.data?.error || 'ไม่สามารถบันทึกการลงนามสัญญาได้', 'error');
    } finally {
      setSubmittingSign(false);
    }
  };

  const handlePrintAttachedDoc = () => {
    if (!attachedContractDoc) return;
    if (attachedContractDoc.startsWith('data:application/pdf;')) {
      openOrPrintPdf(attachedContractDoc, `สัญญาเช่าห้อง-${currentContract.room_number}.pdf`);
    } else {
      printImage(attachedContractDoc, `สัญญาเช่าห้องพัก-${currentContract.room_number}`);
    }
  };

  const handleDownloadAttachedDoc = () => {
    if (!attachedContractDoc) return;
    const isPdf = attachedContractDoc.startsWith('data:application/pdf;');
    const ext = isPdf ? 'pdf' : 'png';
    downloadDataUrl(attachedContractDoc, `สัญญาเช่าห้อง-${currentContract.room_number}.${ext}`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Alert แถบแจ้งเตือนเมื่อรอลงนาม */}
      {isPendingSignature && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm print-hidden">
          <div className="flex items-start gap-3">
            <AlertCircle size={22} className="text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-amber-900 text-sm">
                สัญญาเช่าห้องพักรอการลงนามจากคุณ (Awaiting Signature)
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                ผู้ดูแลหอพักได้ตรวจสอบเอกสาร KYC และส่งร่างสัญญาเช่าห้องพักฉบับจริงมาให้คุณแล้ว
                กรุณาตรวจสอบรายละเอียดในหนังสือสัญญาด้านล่าง และ <strong>ลงนามสัญญาออนไลน์ (วาดสดหรืออัปโหลด)</strong>{' '}
                เพื่อเริ่มต้นสัญญาและเข้าพักอาศัยอย่างเป็นทางการ
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header & Quick Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 print-hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">สัญญาเช่าห้องพักของคุณ</h1>
            {statusBadge(currentStatus)}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            ห้อง {currentContract.room_number} (ชั้น {currentContract.floor}) · {data?.dormitory_name || 'ระบบจัดการหอพัก'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {contracts.length > 1 && (
            <select
              value={selectedContractIndex}
              onChange={(e) => setSelectedContractIndex(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs focus:outline-none"
            >
              {contracts.map((c, i) => (
                <option key={c.contract_id} value={i}>
                  สัญญา #{c.contract_id} (ห้อง {c.room_number}) · {c.status}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => printElement('printable-contract-document', { title: `สัญญาเช่าห้อง-${currentContract.room_number}` })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-teal-800 transition cursor-pointer"
            title="พิมพ์สัญญาเช่า หรือบันทึกเป็น PDF"
          >
            <Printer size={16} /> พิมพ์สัญญา / บันทึก PDF
          </button>
        </div>
      </div>

      {/* Quick Specs Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs text-sm">
        <div className="border-r border-slate-100 pr-2">
          <span className="text-xs text-slate-400 block font-medium">ห้องพัก</span>
          <span className="font-bold text-teal-800 text-base">ห้อง {currentContract.room_number}</span>
          <span className="text-xs text-slate-500 block">ชั้น {currentContract.floor} · {currentContract.room_type || 'ห้องพัก'}</span>
        </div>
        <div className="border-r border-slate-100 pr-2">
          <span className="text-xs text-slate-400 block font-medium">ค่าเช่ารายเดือน</span>
          <span className="font-bold text-slate-800 text-base">฿{formatMoney(currentContract.base_price)}</span>
          <span className="text-xs text-slate-500 block">บาท / เดือน</span>
        </div>
        <div className="border-r border-slate-100 pr-2">
          <span className="text-xs text-slate-400 block font-medium">เงินประกันความเสียหาย</span>
          <span className="font-bold text-slate-800 text-base">฿{formatMoney(currentContract.deposit)}</span>
          <span className="text-xs text-slate-500 block">คืนเมื่อสิ้นสุดสัญญา</span>
        </div>
        <div>
          <span className="text-xs text-slate-400 block font-medium">ระยะเวลาสัญญา</span>
          <span className="font-semibold text-slate-800 text-xs block mt-0.5">
            {formatDate(currentContract.start_date)}
          </span>
          <span className="text-xs text-slate-500 block">ถึง {formatDate(currentContract.end_date)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 print-hidden">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'details'
              ? 'border-teal-700 text-teal-800 bg-teal-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FileText size={17} /> หนังสือสัญญาเช่าห้องพักฉบับจริง
          {isPendingSignature && (
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="รอลงนาม" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attached')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'attached'
              ? 'border-teal-700 text-teal-800 bg-teal-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck size={17} /> เอกสารแนบสมัคร / สัญญาแนบ
          {attachedContractDoc && (
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="มีเอกสารแนบ" />
          )}
        </button>

        {renewalDocs.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('renewals')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'renewals'
                ? 'border-teal-700 text-teal-800 bg-teal-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck size={17} /> ประวัติต่อสัญญา ({renewalDocs.length})
          </button>
        )}
      </div>

      {/* TAB 1: หนังสือสัญญาเช่าฉบับจริง (พร้อม Live Signature Preview บนตัวสัญญา) */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          <OfficialContractDocument
            contract={currentContract}
            dormitory={data}
            tenant={data}
            liveTenantSignature={tenantSig}
            liveTenantFullDoc={tenantFullDoc}
            id="printable-contract-document"
          />

          {/* ฟอร์มลงนามสัญญาสำหรับผู้เช่า (เมื่อสถานะเป็น pending_signature) */}
          {isPendingSignature && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border-2 border-teal-600 space-y-5 print-hidden">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <PenTool size={20} className="text-teal-700" />
                  ลงนามในหนังสือสัญญาเช่าห้องพัก (เซ็นสด หรือ อัปโหลด)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  เมื่อคุณวาดลายเซ็นหรืออัปโหลดรูปลายเซ็นในกรอบด้านล่าง ลายเซ็นจะเข้าไปปรากฏบนตัวสัญญาด้านบนทันที
                </p>
              </div>

              <form onSubmit={handleSignContract} className="space-y-4">
                <SignaturePad
                  label="ลายมือชื่อของคุณ (ผู้เช่า)"
                  allowFullDocument={true}
                  onSignatureChange={(sig) => {
                    setTenantSig(sig);
                    setTenantFullDoc(null);
                  }}
                  onFullDocumentChange={(doc) => {
                    setTenantFullDoc(doc);
                    setTenantSig(null);
                  }}
                />

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs leading-relaxed text-slate-700">
                    <input
                      type="checkbox"
                      required
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5 rounded text-teal-700 focus:ring-teal-600 h-4 w-4"
                    />
                    <span>
                      ข้าพเจ้า <strong>{data?.first_name} {data?.last_name}</strong> ได้อ่าน เข้าใจ และยอมรับข้อตกลง เงื่อนไข อัตราค่าเช่า
                      และเงินประกันความเสียหายแห่งสัญญาเช่าห้องพักอาศัยห้อง {currentContract.room_number} ฉบับนี้ทุกประการ
                      และยินยอมให้ลายมือชื่อดิจิทัลนี้มีผลผูกพันทางกฎหมาย
                    </span>
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submittingSign || (!tenantSig && !tenantFullDoc) || !acceptTerms}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-teal-800 disabled:opacity-50 transition cursor-pointer"
                  >
                    <Send size={16} />
                    {submittingSign ? 'กำลังส่งข้อมูลการลงนาม...' : 'ยืนยันและส่งสัญญาเช่าที่ลงนามแล้ว'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: เอกสารแนบสมัคร / สัญญาแนบ */}
      {activeTab === 'attached' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/90 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-bold text-base text-slate-800">
                เอกสารสัญญาเช่า / หลักฐานที่แนบไว้ในระบบ
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เอกสารที่อัปโหลดไว้สำหรับห้องพักนี้
              </p>
            </div>

            {attachedContractDoc && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintAttachedDoc}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition cursor-pointer"
                >
                  <Printer size={14} /> พิมพ์หน้านี้
                </button>
                <button
                  type="button"
                  onClick={handleDownloadAttachedDoc}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                >
                  <Download size={14} /> ดาวน์โหลด
                </button>
              </div>
            )}
          </div>

          {loadingAttachedDoc ? (
            <p className="py-12 text-center text-sm text-slate-400">กำลังโหลดเอกสารสัญญา...</p>
          ) : attachedContractDoc ? (
            <div className="space-y-3">
              {attachedContractDoc.startsWith('data:application/pdf;') ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <iframe
                    title="สัญญาเช่า PDF"
                    src={attachedContractDoc}
                    className="h-[75vh] w-full border-0"
                  />
                </div>
              ) : (
                <div className="relative group flex justify-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <img
                    src={attachedContractDoc}
                    alt="เอกสารสัญญาเช่า"
                    className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-sm cursor-zoom-in"
                    onClick={() => setFullscreenImage(true)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <FileText size={40} className="mx-auto text-slate-300" />
              <p className="text-sm">ไม่มีไฟล์เอกสารแนบต้นฉบับ</p>
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className="inline-flex items-center gap-1 text-xs text-teal-700 font-semibold hover:underline cursor-pointer mt-2"
              >
                ดูรายละเอียดสัญญาในระบบแทน <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: เอกสารต่อสัญญา */}
      {activeTab === 'renewals' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/90 space-y-4">
          <h2 className="font-bold text-base text-slate-800">ประวัติและเอกสารการต่ออายุสัญญา</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renewalDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={18} className="text-teal-700 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-slate-800 truncate">{doc.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {formatDate(doc.submitted_at)} · {doc.status}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await api.get(`/tenant/my-documents/${doc.id}`);
                      if (res.data?.document) {
                        setAttachedContractDoc(res.data.document);
                        setActiveTab('attached');
                      }
                    } catch (e) {
                      notify('โหลดเอกสารไม่สำเร็จ', 'error');
                    }
                  }}
                  className="inline-flex items-center gap-1 shrink-0 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition cursor-pointer"
                >
                  <Eye size={13} /> เปิดดู
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal ดูภาพขยายเต็มจอ */}
      {fullscreenImage && attachedContractDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative max-h-[95vh] max-w-[95vw] overflow-auto">
            <button
              type="button"
              onClick={() => setFullscreenImage(false)}
              className="fixed top-4 right-4 z-50 rounded-full bg-white/90 p-2 text-slate-800 shadow-lg hover:bg-white cursor-pointer"
              aria-label="ปิดภาพขยาย"
            >
              <X size={20} />
            </button>
            <img
              src={attachedContractDoc}
              alt="สัญญาเช่าห้องพักขนาดเต็ม"
              className="max-h-[92vh] max-w-[92vw] object-contain rounded-xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
