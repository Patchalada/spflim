import { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, FileText, MessageCircle, Wrench, X } from 'lucide-react';
import api from '../api/axios';
import useToast from '../components/useToast';
import Pagination from '../components/Pagination';

const formatDate = (date) => date ? new Date(`${String(date).slice(0, 10)}T00:00:00`).toLocaleDateString('th-TH') : '-';
const oneYearLater = (date) => {
  const value = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  const month = value.getMonth();
  value.setFullYear(value.getFullYear() + 1);
  if (value.getMonth() !== month) value.setDate(0);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

const statusLabels = {
  pending: 'รอพิจารณา',
  awaiting_tenant: 'รอผู้เช่าเซ็น',
  awaiting_admin: 'รอตรวจเอกสารที่เซ็นแล้ว',
  approved: 'ต่อสัญญาแล้ว',
  rejected: 'ไม่อนุมัติ',
  open: 'เปิดเคส',
  in_progress: 'กำลังดำเนินการ',
  resolved: 'แก้ไขแล้ว',
  closed: 'ปิดเคส'
};

const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
  reader.readAsDataURL(file);
});

function DocumentPreview({ document, onClose }) {
  if (!document) return null;
  const isPdf = document.startsWith('data:application/pdf;');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold text-gray-800">เอกสารแนบ</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="ปิด">
            <X size={18} />
          </button>
        </div>
        {isPdf ? (
          <iframe title="เอกสาร PDF" src={document} className="min-h-[70dvh] w-full" />
        ) : (
          <div className="overflow-auto p-4 text-center">
            <img src={document} alt="เอกสารแนบ" className="mx-auto max-h-[75dvh] max-w-full object-contain" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function TenantServices() {
  const notify = useToast();
  const role = localStorage.getItem('role');
  const isAdmin = role === 'admin';
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState(null);
  const [renewals, setRenewals] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [renewalPage, setRenewalPage] = useState(1);
  const [ticketPage, setTicketPage] = useState(1);
  const [renewalPageSize, setRenewalPageSize] = useState(10);
  const [ticketPageSize, setTicketPageSize] = useState(10);
  const [renewalTotal, setRenewalTotal] = useState(0);
  const [ticketTotal, setTicketTotal] = useState(0);
  const [renewalStatus, setRenewalStatus] = useState('');
  const [ticketStatus, setTicketStatus] = useState('open');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [renewalForm, setRenewalForm] = useState({ tenant_note: '' });
  const [ticketForm, setTicketForm] = useState({ category: 'ซ่อมบำรุง', subject: '', description: '', priority: 'normal' });
  const [preview, setPreview] = useState(null);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [reviewRenewal, setReviewRenewal] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [sendAgreementRequest, setSendAgreementRequest] = useState(null);
  const [agreementForm, setAgreementForm] = useState({ proposed_end_date: '', admin_note: '' });
  const [reviewSignedRequest, setReviewSignedRequest] = useState(null);
  const [editTicket, setEditTicket] = useState(null);

  const fetchTenantData = useCallback(async () => {
    setLoading(true);
    try {
      const [renewalResponse, ticketResponse] = await Promise.all([
        api.get('/tenant/renewals'),
        api.get('/tenant/support-tickets')
      ]);
      setContract(renewalResponse.data.contract);
      setRenewals(renewalResponse.data.requests);
      setTickets(ticketResponse.data);
    } catch (error) {
      notify(error.response?.data?.error || 'โหลดข้อมูลบริการผู้เช่าไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [renewalResponse, ticketResponse] = await Promise.all([
        api.get('/renewals', { params: { page: renewalPage, page_size: renewalPageSize, status: renewalStatus } }),
        api.get('/support-tickets', { params: { page: ticketPage, page_size: ticketPageSize, status: ticketStatus } })
      ]);
      setRenewals(renewalResponse.data.items);
      setRenewalTotal(renewalResponse.data.pagination.total);
      setTickets(ticketResponse.data.items);
      setTicketTotal(ticketResponse.data.pagination.total);
    } catch (error) {
      notify(error.response?.data?.error || 'โหลดรายการต่อสัญญาหรือแจ้งปัญหาไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, renewalPage, renewalPageSize, renewalStatus, ticketPage, ticketPageSize, ticketStatus]);

  useEffect(() => {
    if (isAdmin) void Promise.resolve().then(fetchAdminData).catch(() => {});
    else void Promise.resolve().then(fetchTenantData).catch(() => {});
  }, [isAdmin, fetchAdminData, fetchTenantData]);

  // รับ Event แจ้งเตือนแบบ Real-time และการคลิกจากการแจ้งเตือนเพื่อรีเฟรชเคสและคำขอต่อสัญญาทันที
  useEffect(() => {
    const handleRealtimeUpdate = () => {
      if (isAdmin) void Promise.resolve().then(fetchAdminData).catch(() => {});
      else void Promise.resolve().then(fetchTenantData).catch(() => {});
    };

    window.addEventListener('dormitory-refresh-page', handleRealtimeUpdate);
    window.addEventListener('dormitory-realtime-notification', handleRealtimeUpdate);

    return () => {
      window.removeEventListener('dormitory-refresh-page', handleRealtimeUpdate);
      window.removeEventListener('dormitory-realtime-notification', handleRealtimeUpdate);
    };
  }, [isAdmin, fetchAdminData, fetchTenantData]);

  const handleRenewalSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/tenant/renewals', renewalForm);
      notify('ส่งคำขอต่อสัญญาแล้ว', 'success');
      setRenewalForm({ tenant_note: '' });
      await fetchTenantData();
    } catch (error) {
      notify(error.response?.data?.error || error.message || 'ส่งคำขอต่อสัญญาไม่สำเร็จ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitSignedAgreement = async (event, requestId) => {
    event.preventDefault();
    if (!file) {
      notify('กรุณาเลือกไฟล์สัญญาที่ลงนามแล้ว', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const signedDocument = await readFile(file);
      await api.put(`/tenant/renewals/${requestId}/signed-document`, { signed_document: signedDocument });
      notify('ส่งสัญญาที่ลงนามแล้วให้ผู้ดูแลตรวจสอบ', 'success');
      setFile(null);
      await fetchTenantData();
    } catch (error) {
      notify(error.response?.data?.error || error.message || 'ส่งสัญญาที่ลงนามแล้วไม่สำเร็จ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const completeRenewal = async () => {
    if (!reviewSignedRequest) return;
    try {
      await api.put(`/renewals/${reviewSignedRequest.request_id}/complete`);
      notify('ตรวจเอกสารและต่อสัญญาเรียบร้อยแล้ว', 'success');
      setReviewSignedRequest(null);
      await fetchAdminData();
    } catch (error) {
      notify(error.response?.data?.error || 'ยืนยันการต่อสัญญาไม่สำเร็จ', 'error');
    }
  };

  const openRenewalDocument = async (requestId, kind) => {
    setLoadingDocument(true);
    try {
      const prefix = isAdmin ? '/renewals' : '/tenant/renewals';
      const response = await api.get(`${prefix}/${requestId}/document/${kind}`);
      setPreview(response.data.document);
      return response.data.document;
    } catch (error) {
      notify(error.response?.data?.error || 'โหลดเอกสารไม่สำเร็จ', 'error');
      return null;
    } finally {
      setLoadingDocument(false);
    }
  };

  const downloadRenewalAgreement = async (requestId) => {
    const document = await openRenewalDocument(requestId, 'agreement');
    if (!document) return;
    const extension = document.slice(5).split(';')[0].split('/')[1];
    const link = window.document.createElement('a');
    link.href = document;
    link.download = `renewal-${requestId}.${extension}`;
    link.click();
    setPreview(null);
  };

  const handleTicketSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/tenant/support-tickets', ticketForm);
      notify('เปิดเคสแจ้งปัญหาแล้ว', 'success');
      setTicketForm({ category: 'ซ่อมบำรุง', subject: '', description: '', priority: 'normal' });
      await fetchTenantData();
    } catch (error) {
      notify(error.response?.data?.error || 'เปิดเคสแจ้งปัญหาไม่สำเร็จ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const closeTicket = async (ticketId) => {
    try {
      await api.put(`/tenant/support-tickets/${ticketId}/close`);
      notify('ปิดเคสเรียบร้อยแล้ว', 'success');
      await fetchTenantData();
    } catch (error) {
      notify(error.response?.data?.error || 'ปิดเคสไม่สำเร็จ', 'error');
    }
  };

  const submitRenewalReview = async (status) => {
    if (!reviewRenewal) return;
    try {
      await api.put(`/renewals/${reviewRenewal.request_id}`, { status, admin_note: reviewNote });
      notify(status === 'approved' ? 'อนุมัติการต่อสัญญาแล้ว' : 'ปฏิเสธคำขอต่อสัญญาแล้ว', 'success');
      setRenewalStatus(status === 'approved' ? 'awaiting_tenant' : 'rejected');
      setRenewalPage(1);
      setReviewRenewal(null);
      setReviewNote('');
      await fetchAdminData();
    } catch (error) {
      notify(error.response?.data?.error || 'พิจารณาคำขอไม่สำเร็จ', 'error');
    }
  };

  const submitAgreement = async (event) => {
    event.preventDefault();
    if (!sendAgreementRequest || !file) {
      notify('กรุณาเลือกไฟล์สัญญาก่อนส่งให้ผู้เช่า', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const agreementDocument = await readFile(file);
      await api.put(`/renewals/${sendAgreementRequest.request_id}/agreement`, {
        ...agreementForm,
        agreement_document: agreementDocument
      });
      notify('ส่งสัญญาให้ผู้เช่าแล้ว รอการยืนยัน', 'success');
      setSendAgreementRequest(null);
      setAgreementForm({ proposed_end_date: '', admin_note: '' });
      setFile(null);
      await fetchAdminData();
    } catch (error) {
      notify(error.response?.data?.error || error.message || 'ส่งสัญญาให้ผู้เช่าไม่สำเร็จ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const saveTicketReview = async (event) => {
    event.preventDefault();
    try {
      await api.put(`/support-tickets/${editTicket.ticket_id}`, {
        status: editTicket.status,
        admin_response: editTicket.admin_response
      });
      notify('บันทึกการอัปเดตเคสแล้ว', 'success');
      setEditTicket(null);
      await fetchAdminData();
    } catch (error) {
      notify(error.response?.data?.error || 'อัปเดตเคสไม่สำเร็จ', 'error');
    }
  };

  const handleDocumentFile = (event) => {
    const selected = event.target.files?.[0] || null;
    event.target.value = '';
    if (selected && (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 10 * 1024 * 1024)) {
      notify('เลือกไฟล์ PDF, JPG, PNG หรือ WebP ขนาดไม่เกิน 10MB', 'error');
      return;
    }
    setFile(selected);
  };

  if (loading) return <p className="py-8 text-center text-gray-500">กำลังโหลดข้อมูล...</p>;

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ดูแลผู้เช่า</h1>
          <p className="text-sm text-gray-500">พิจารณาต่อสัญญาและจัดการเคสแจ้งซ่อม/ปัญหาจากผู้เช่า</p>
        </div>

        <section className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800"><FileText size={19} /> คำขอต่อสัญญา</h2>
              <p className="text-sm text-gray-500">พิจารณาคำขอก่อน แล้วส่งสัญญาฉบับใหม่ให้ผู้เช่ายืนยัน</p>
            </div>
            <select value={renewalStatus} onChange={(event) => { setRenewalStatus(event.target.value); setRenewalPage(1); }} className="rounded-lg border p-2 text-sm">
              <option value="">คำขอทั้งหมด</option><option value="pending">รอพิจารณา</option><option value="awaiting_tenant">รอส่งร่าง / รอผู้เช่าเซ็น</option><option value="awaiting_admin">รอตรวจสัญญาที่เซ็นแล้ว</option><option value="approved">ต่อสัญญาแล้ว</option><option value="rejected">ไม่อนุมัติ</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b bg-gray-50"><tr><th className="p-3">ผู้เช่า / ห้อง</th><th className="p-3">วันที่ส่งคำขอ</th><th className="p-3">หมายเหตุ</th><th className="p-3">สัญญาใหม่</th><th className="p-3">การดำเนินการ</th></tr></thead>
              <tbody>
                {renewals.map((request) => (
                  <tr key={request.request_id} className="border-b">
                    <td className="p-3 font-medium text-gray-800">{request.first_name} {request.last_name}<span className="block text-xs text-gray-500">ห้อง {request.room_number} · {request.phone || '-'}</span></td>
                    <td className="p-3">{formatDate(request.submitted_at)}</td>
                    <td className="max-w-52 p-3">{request.tenant_note || '-'}</td>
                    <td className="p-3">
                      {request.has_signed_document ? (
                        <button type="button" disabled={loadingDocument} onClick={() => openRenewalDocument(request.request_id, 'signed')} className="inline-flex items-center gap-1 text-teal-700 hover:underline disabled:opacity-50"><FileText size={15} /> ดูฉบับที่เซ็นแล้ว</button>
                      ) : request.has_agreement_document ? (
                        <button type="button" disabled={loadingDocument} onClick={() => openRenewalDocument(request.request_id, 'agreement')} className="inline-flex items-center gap-1 text-teal-700 hover:underline disabled:opacity-50"><FileText size={15} /> ดูร่างสัญญา</button>
                      ) : '-'}
                    </td>
                    <td className="p-3">
                      {request.status === 'pending' ? (
                        <button type="button" onClick={() => { setReviewRenewal(request); setReviewNote(''); }} className="rounded-lg bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100">พิจารณา</button>
                      ) : request.status === 'awaiting_tenant' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSendAgreementRequest(request);
                            setAgreementForm({
                              proposed_end_date: request.proposed_end_date || oneYearLater(request.current_end_date),
                              admin_note: request.has_agreement_document ? request.admin_note : ''
                            });
                            setFile(null);
                          }}
                          className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          {request.has_agreement_document ? 'ส่งสัญญาใหม่' : 'ส่งสัญญาให้ผู้เช่า'}
                        </button>
                      ) : request.status === 'awaiting_admin' ? (
                        <button type="button" onClick={() => setReviewSignedRequest(request)} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">ตรวจฉบับที่เซ็นแล้ว</button>
                      ) : <span>{statusLabels[request.status]}{request.admin_note && <span className="block text-xs text-gray-500">{request.admin_note}</span>}</span>}
                    </td>
                  </tr>
                ))}
                {!renewals.length && <tr><td colSpan="5" className="p-6 text-center text-gray-400">ไม่มีคำขอในสถานะนี้</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={renewalPage} pageSize={renewalPageSize} total={renewalTotal} onPageChange={setRenewalPage} onPageSizeChange={(size) => { setRenewalPageSize(size); setRenewalPage(1); }} />
        </section>

        <section className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800"><Wrench size={19} /> เคสแจ้งปัญหา</h2>
              <p className="text-sm text-gray-500">ตอบกลับผู้เช่าและปรับสถานะเคสจนปิดงาน</p>
            </div>
            <select value={ticketStatus} onChange={(event) => { setTicketStatus(event.target.value); setTicketPage(1); }} className="rounded-lg border p-2 text-sm">
              <option value="open">เปิดเคส</option><option value="in_progress">กำลังดำเนินการ</option><option value="resolved">แก้ไขแล้ว</option><option value="closed">ปิดเคส</option>
            </select>
          </div>
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <article key={ticket.ticket_id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold text-gray-800">#{ticket.ticket_id} · {ticket.subject}</p><p className="mt-1 text-xs text-gray-500">{ticket.first_name} {ticket.last_name} · ห้อง {ticket.room_number || '-'} · {ticket.category} · {formatDate(ticket.created_at)}</p></div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">{statusLabels[ticket.status]} · {ticket.priority}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{ticket.description}</p>
                {ticket.admin_response && <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">ตอบกลับล่าสุด: {ticket.admin_response}</p>}
                <button type="button" onClick={() => setEditTicket({ ...ticket })} className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100">อัปเดตเคส / ตอบกลับ</button>
              </article>
            ))}
            {!tickets.length && <p className="p-6 text-center text-gray-400">ไม่มีเคสในสถานะนี้</p>}
          </div>
          <Pagination page={ticketPage} pageSize={ticketPageSize} total={ticketTotal} onPageChange={setTicketPage} onPageSizeChange={(size) => { setTicketPageSize(size); setTicketPage(1); }} />
        </section>

        {reviewRenewal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800">พิจารณาต่อสัญญา · ห้อง {reviewRenewal.room_number}</h2><button type="button" onClick={() => setReviewRenewal(null)} aria-label="ปิด"><X size={18} /></button></div>
              <p className="text-sm text-gray-600">{reviewRenewal.first_name} {reviewRenewal.last_name} ส่งคำขอต่อสัญญา</p>
              <label className="block text-sm">ข้อความถึงผู้เช่า<textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border p-2" /></label>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => submitRenewalReview('rejected')} className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">ไม่อนุมัติ</button><button type="button" onClick={() => submitRenewalReview('approved')} className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white">อนุมัติ</button></div>
            </div>
          </div>
        )}
        {sendAgreementRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <form onSubmit={submitAgreement} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-800">ส่งสัญญาใหม่ · ห้อง {sendAgreementRequest.room_number}</h2>
                <button type="button" onClick={() => setSendAgreementRequest(null)} aria-label="ปิด"><X size={18} /></button>
              </div>
              <p className="text-sm text-gray-600">ผู้เช่า: {sendAgreementRequest.first_name} {sendAgreementRequest.last_name}</p>
              <label className="block text-sm">วันสิ้นสุดสัญญาใหม่
                <input required type="date" readOnly value={oneYearLater(sendAgreementRequest.current_end_date)} className="mt-1 w-full rounded-lg border bg-gray-100 p-2" />
                <span className="mt-1 block text-xs text-gray-500">ต่ออายุอัตโนมัติ 1 ปีจากวันสิ้นสุดสัญญาปัจจุบัน</span>
              </label>
              <label className="block text-sm">ไฟล์สัญญาที่จัดทำแล้ว
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleDocumentFile} className="mt-1 w-full rounded-lg border p-2 text-xs" />
                <span className="mt-1 block text-xs text-gray-500">{file ? file.name : 'PDF, JPG, PNG หรือ WebP ไม่เกิน 10MB'}</span>
              </label>
              <label className="block text-sm">ข้อความถึงผู้เช่า<textarea value={agreementForm.admin_note} onChange={(event) => setAgreementForm({ ...agreementForm, admin_note: event.target.value })} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border p-2" /></label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSendAgreementRequest(null)} className="rounded-lg border px-4 py-2 text-sm">ยกเลิก</button>
                <button type="submit" disabled={submitting || !file} className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white disabled:opacity-50">ส่งสัญญาให้ผู้เช่า</button>
              </div>
            </form>
          </div>
        )}
        {reviewSignedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-800">ตรวจสัญญาที่ลงนามแล้ว</h2>
                  <p className="text-sm text-gray-500">{reviewSignedRequest.first_name} {reviewSignedRequest.last_name} · ห้อง {reviewSignedRequest.room_number}</p>
                </div>
                <button type="button" onClick={() => setReviewSignedRequest(null)} aria-label="ปิด"><X size={18} /></button>
              </div>
              <button type="button" disabled={loadingDocument} onClick={() => openRenewalDocument(reviewSignedRequest.request_id, 'signed')} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-teal-800 hover:bg-teal-50 disabled:opacity-50">
                <FileText size={16} /> เปิดเอกสารฉบับที่ผู้เช่าเซ็นแล้ว
              </button>
              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" onClick={() => setReviewSignedRequest(null)} className="rounded-lg border px-4 py-2 text-sm">ปิด</button>
                <button type="button" onClick={completeRenewal} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">ยืนยันเอกสารและบันทึกต่อสัญญา</button>
              </div>
            </div>
          </div>
        )}
        {editTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <form onSubmit={saveTicketReview} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800">อัปเดตเคส #{editTicket.ticket_id}</h2><button type="button" onClick={() => setEditTicket(null)} aria-label="ปิด"><X size={18} /></button></div>
              <p className="text-sm text-gray-600">{editTicket.subject} · {editTicket.first_name} {editTicket.last_name}</p>
              <label className="block text-sm">สถานะ<select value={editTicket.status} onChange={(event) => setEditTicket({ ...editTicket, status: event.target.value })} className="mt-1 w-full rounded-lg border p-2"><option value="open">เปิดเคส</option><option value="in_progress">กำลังดำเนินการ</option><option value="resolved">แก้ไขแล้ว</option><option value="closed">ปิดเคส</option></select></label>
              <label className="block text-sm">ข้อความตอบกลับ<textarea value={editTicket.admin_response} onChange={(event) => setEditTicket({ ...editTicket, admin_response: event.target.value })} maxLength={5000} rows={4} className="mt-1 w-full rounded-lg border p-2" /></label>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditTicket(null)} className="rounded-lg border px-4 py-2 text-sm">ยกเลิก</button><button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white">บันทึก</button></div>
            </form>
          </div>
        )}
        <DocumentPreview document={preview} onClose={() => setPreview(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-800">บริการผู้เช่า</h1><p className="text-sm text-gray-500">ติดตามการต่อสัญญาและแจ้งปัญหาการพักอาศัย</p></div>

      <section className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800"><FileText size={19} /> ต่อสัญญาเช่า</h2><p className="text-sm text-gray-500">ส่งคำขอได้ภายใน 30 วันก่อนหมดสัญญา จากนั้นรอผู้ดูแลส่งสัญญาฉบับใหม่มาให้ตรวจและยืนยัน</p></div>
        {contract ? (
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
            <p>ห้อง {contract.room_number} · สัญญาปัจจุบันสิ้นสุด {formatDate(contract.end_date)}</p>
            {contract.renewal_window_open && !contract.has_pending_request ? (
              <form onSubmit={handleRenewalSubmit} className="mt-4 space-y-3">
                <label className="block text-sm">หมายเหตุถึงผู้ดูแล (ไม่บังคับ)
                  <textarea rows={2} maxLength={2000} value={renewalForm.tenant_note} onChange={(event) => setRenewalForm({ tenant_note: event.target.value })} className="mt-1 w-full rounded-lg border p-2" />
                </label>
                <button type="submit" disabled={submitting} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">ส่งคำขอต่อสัญญา</button>
              </form>
            ) : contract.has_pending_request ? (
              <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-amber-700">
                <Clock3 size={16} />
                {renewals.some((request) => request.status === 'awaiting_admin')
                  ? 'ส่งสัญญาที่เซ็นแล้ว รอผู้ดูแลตรวจสอบ'
                  : renewals.some((request) => request.status === 'awaiting_tenant' && request.has_agreement_document)
                    ? 'ผู้ดูแลส่งร่างสัญญาแล้ว กรุณาดาวน์โหลด เซ็น และอัปโหลดกลับ'
                    : renewals.some((request) => request.status === 'awaiting_tenant')
                      ? 'คำขอได้รับอนุมัติแล้ว รอผู้ดูแลส่งร่างสัญญา'
                      : 'ส่งคำขอแล้ว รอผู้ดูแลพิจารณา'}
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-500">ปุ่มต่อสัญญาจะเปิดให้ใช้ในช่วง 30 วันก่อนวันหมดสัญญา</p>
            )}
          </div>
        ) : <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">ไม่พบสัญญาที่ยังใช้งานอยู่</p>}
        <div className="space-y-2">
          {renewals.map((request) => (
            <div key={request.request_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>คำขอ #{request.request_id} · ห้อง {request.room_number}{request.proposed_end_date ? ` · สัญญาสิ้นสุด ${formatDate(request.proposed_end_date)}` : ''}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${request.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : request.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
                {request.status === 'approved' ? <Check size={13} /> : <Clock3 size={13} />}
                {request.status === 'awaiting_tenant'
                  ? (request.has_agreement_document ? 'รอผู้เช่าเซ็น' : 'อนุมัติแล้ว · รอส่งร่างสัญญา')
                  : statusLabels[request.status]}
              </span>
              {request.admin_note && <p className="w-full text-xs text-gray-500">ข้อความจากผู้ดูแล: {request.admin_note}</p>}
              {request.status === 'awaiting_tenant' && request.has_agreement_document && (
                <div className="flex w-full flex-wrap items-center gap-2 border-t pt-3">
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={loadingDocument} onClick={() => openRenewalDocument(request.request_id, 'agreement')} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50">
                      <FileText size={14} /> ดูร่างสัญญา
                    </button>
                    <button type="button" disabled={loadingDocument} onClick={() => downloadRenewalAgreement(request.request_id)} className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      ดาวน์โหลด
                    </button>
                  </div>
                  <form onSubmit={(event) => submitSignedAgreement(event, request.request_id)} className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      เลือกฉบับที่เซ็นแล้ว
                      <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleDocumentFile} className="sr-only" />
                    </label>
                    {file && <span className="max-w-44 truncate text-xs text-gray-500">{file.name}</span>}
                    <button type="submit" disabled={submitting || !file} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">อัปโหลดให้แอดมินตรวจ</button>
                  </form>
                </div>
              )}
              {request.status === 'awaiting_admin' && <p className="w-full border-t pt-3 text-xs font-medium text-amber-800">ส่งเอกสารที่เซ็นแล้วแล้ว · รอผู้ดูแลตรวจสอบ</p>}
            </div>
          ))}
        </div>
      </section>
      <DocumentPreview document={preview} onClose={() => setPreview(null)} />

      <section className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800"><MessageCircle size={19} /> แจ้งปัญหาที่พัก</h2><p className="text-sm text-gray-500">เปิดเคสเพื่อแจ้งซ่อมหรือแจ้งปัญหา พร้อมติดตามสถานะและข้อความตอบกลับ</p></div>
        <form onSubmit={handleTicketSubmit} className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">ประเภท<select value={ticketForm.category} onChange={(event) => setTicketForm({ ...ticketForm, category: event.target.value })} className="mt-1 w-full rounded-lg border p-2"><option>ซ่อมบำรุง</option><option>ระบบน้ำ</option><option>ระบบไฟฟ้า</option><option>ความสะอาด</option><option>เสียงรบกวน</option><option>ความปลอดภัย</option><option>อื่น ๆ</option></select></label>
          <label className="text-sm">ความเร่งด่วน<select value={ticketForm.priority} onChange={(event) => setTicketForm({ ...ticketForm, priority: event.target.value })} className="mt-1 w-full rounded-lg border p-2"><option value="low">ไม่เร่งด่วน</option><option value="normal">ปกติ</option><option value="high">เร่งด่วน</option><option value="urgent">ฉุกเฉิน</option></select></label>
          <label className="text-sm md:col-span-2">หัวข้อ<input required maxLength={160} value={ticketForm.subject} onChange={(event) => setTicketForm({ ...ticketForm, subject: event.target.value })} className="mt-1 w-full rounded-lg border p-2" placeholder="เช่น น้ำรั่วบริเวณอ่างล้างหน้า" /></label>
          <label className="text-sm md:col-span-2">รายละเอียด<textarea required rows={4} maxLength={5000} value={ticketForm.description} onChange={(event) => setTicketForm({ ...ticketForm, description: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
          <button type="submit" disabled={submitting} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2">เปิดเคสแจ้งปัญหา</button>
        </form>
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <article key={ticket.ticket_id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-gray-800">#{ticket.ticket_id} · {ticket.subject}</h3><p className="mt-1 text-xs text-gray-500">{ticket.category} · {formatDate(ticket.created_at)}{ticket.room_number ? ` · ห้อง ${ticket.room_number}` : ''}</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs">{statusLabels[ticket.status]}</span></div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{ticket.description}</p>
              {ticket.admin_response && <p className="mt-3 rounded-lg bg-teal-50 p-3 text-sm text-teal-900"><strong>ข้อความจากผู้ดูแล:</strong> {ticket.admin_response}</p>}
              {['open', 'resolved'].includes(ticket.status) && <button type="button" onClick={() => closeTicket(ticket.ticket_id)} className="mt-3 rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">ปิดเคส</button>}
            </article>
          ))}
          {!tickets.length && <p className="rounded-lg bg-gray-50 p-5 text-center text-sm text-gray-400">ยังไม่มีเคสแจ้งปัญหา</p>}
        </div>
      </section>
    </div>
  );
}
