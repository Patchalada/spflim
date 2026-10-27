import { useState } from 'react';
import { Eye, FileText, X } from 'lucide-react';
import api from '../api/axios';
import useToast from './useToast';

const formatDate = (date) => date ? new Date(date).toLocaleDateString('th-TH') : 'วันที่สมัคร';

export default function TenantDocumentsModal({ data, onClose }) {
  const notify = useToast();
  const [preview, setPreview] = useState(null);
  const [loadingDocumentId, setLoadingDocumentId] = useState(null);
  if (!data) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-5 shadow-xl">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="font-bold text-gray-800">เอกสารของ {data.tenant.first_name} {data.tenant.last_name}</h2>
              <p className="text-xs text-gray-500">{data.tenant.username}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="ปิด"><X size={18} /></button>
          </div>
          <div className="max-h-[65dvh] space-y-2 overflow-y-auto">
            {data.documents.map((document) => (
              <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-teal-700" />
                  <div><p className="text-sm font-medium text-gray-800">{document.title}</p><p className="text-xs text-gray-500">{formatDate(document.submitted_at)} · {document.status}</p></div>
                </div>
                <button type="button" disabled={loadingDocumentId === document.id} onClick={async () => {
                  setLoadingDocumentId(document.id);
                  try {
                    const response = await api.get(`/tenant/admin/tenants/${data.tenant.user_id}/documents/${document.id}`);
                    setPreview(response.data.document);
                  } catch (error) {
                    notify(error.response?.data?.error || 'โหลดเอกสารไม่สำเร็จ', 'error');
                  } finally {
                    setLoadingDocumentId(null);
                  }
                }} className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 disabled:opacity-50">
                  <Eye size={15} /> เปิดดู
                </button>
              </div>
            ))}
            {!data.documents.length && <p className="p-6 text-center text-sm text-gray-400">ผู้เช่ายังไม่ได้แนบเอกสาร</p>}
          </div>
          <div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm text-gray-700">ปิด</button></div>
        </div>
      </div>
      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-3">
              <h3 className="font-semibold text-gray-800">ตัวอย่างเอกสาร</h3>
              <button type="button" onClick={() => setPreview(null)} aria-label="ปิดตัวอย่าง" className="rounded-lg p-2 hover:bg-gray-100"><X size={18} /></button>
            </div>
            {preview.startsWith('data:application/pdf;') ? (
              <iframe title="เอกสาร PDF" src={preview} className="min-h-[75dvh] w-full" />
            ) : (
              <div className="overflow-auto p-4 text-center"><img src={preview} alt="เอกสารแนบ" className="mx-auto max-h-[78dvh] max-w-full object-contain" /></div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
