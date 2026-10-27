import { useEffect, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import useToast from '../components/useToast';
import { printElement } from '../utils/printHelper';

const money = (value) => Number(value || 0).toLocaleString('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const thaiDate = (value) => value
  ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  : '-';

const paymentMethodLabel = {
  cash: 'เงินสด',
  bank_transfer: 'โอนเงินผ่านธนาคาร',
  other: 'อื่น ๆ'
};

export default function BillDocument() {
  const { billId } = useParams();
  const notify = useToast();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const role = localStorage.getItem('role');
  const backPath = role === 'admin' ? '/bills' : '/my-dashboard';

  useEffect(() => {
    let cancelled = false;
    api.get(`/bills/${billId}`)
      .then((res) => {
        if (!cancelled) setBill(res.data);
      })
      .catch((err) => {
        if (!cancelled) notify(err.response?.data?.error || 'โหลดเอกสารไม่สำเร็จ', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [billId, notify]);

  if (loading) return <p className="py-8 text-center text-gray-500">กำลังโหลดเอกสาร...</p>;
  if (!bill) {
    return (
      <section className="bill-document mx-auto max-w-3xl bg-white p-8 text-center">
        <p className="text-gray-600">ไม่พบเอกสารบิลนี้ หรือคุณไม่มีสิทธิ์เข้าถึง</p>
        <Link to={backPath} className="mt-4 inline-flex items-center gap-2 text-teal-700">
          <ArrowLeft size={17} /> กลับหน้าก่อน
        </Link>
      </section>
    );
  }

  const isReceipt = bill.payment_status === 'paid';
  const itemRows = [
    { label: 'ค่าเช่าห้องพัก', quantity: 1, unit: 'เดือน', unitPrice: bill.rent_amount, amount: bill.rent_amount },
    {
      label: 'ค่าน้ำประปา',
      quantity: bill.water_unit,
      unit: 'หน่วย',
      unitPrice: bill.water_rate ?? (Number(bill.water_unit) > 0 ? Number(bill.water_amount) / Number(bill.water_unit) : null),
      detail: `มิเตอร์ ${bill.water_old_meter} → ${bill.water_new_meter}`,
      amount: bill.water_amount
    },
    {
      label: 'ค่าไฟฟ้า',
      quantity: bill.electric_unit,
      unit: 'หน่วย',
      unitPrice: bill.electric_rate ?? (Number(bill.electric_unit) > 0 ? Number(bill.electric_amount) / Number(bill.electric_unit) : null),
      detail: `มิเตอร์ ${bill.electric_old_meter} → ${bill.electric_new_meter}`,
      amount: bill.electric_amount
    },
    ...(Array.isArray(bill.extra_charges) ? bill.extra_charges : []).map((charge, index) => ({
      key: `extra-${index}`,
      label: charge.description,
      quantity: 1,
      unit: 'รายการ',
      unitPrice: charge.amount,
      amount: charge.amount
    }))
  ];

  return (
    <div className="bill-document-wrap mx-auto max-w-4xl space-y-4">
      <div className="bill-document-actions flex items-center justify-between">
        <Link to={backPath} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-teal-700">
          <ArrowLeft size={17} /> กลับ
        </Link>
        <button
          type="button"
          onClick={() => printElement('printable-bill-document', { title: `${isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'}-BILL-${String(bill.bill_id).padStart(6, '0')}` })}
          className="inline-flex items-center gap-2 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer shadow-xs transition"
        >
          <Printer size={17} /> พิมพ์ / บันทึก PDF
        </button>
      </div>

      <article id="printable-bill-document" className="bill-document bg-white p-8 shadow-sm sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-teal-700 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{bill.dormitory_name || 'ระบบจัดการหอพัก'}</h1>
            {bill.dormitory_address && <p className="mt-1 max-w-sm whitespace-pre-line text-sm text-gray-600">{bill.dormitory_address}</p>}
            {bill.contact_phone && <p className="mt-1 text-sm text-gray-600">โทร. {bill.contact_phone}</p>}
            <p className="mt-2 text-sm text-gray-500">เอกสารเรียกเก็บค่าเช่าและบริการ</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-900">{isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'}</h2>
            <p className="mt-2 text-sm text-gray-600">เลขที่เอกสาร: BILL-{String(bill.bill_id).padStart(6, '0')}</p>
            <p className="text-sm text-gray-600">รอบบิล: {String(bill.month).padStart(2, '0')}/{bill.year}</p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-gray-200 py-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">เรียกเก็บจาก</h3>
            <p className="font-semibold text-gray-900">{bill.first_name} {bill.last_name}</p>
            <p className="text-sm text-gray-600">ห้อง {bill.room_number} · ชั้น {bill.floor} · {bill.room_type}</p>
            {bill.phone && <p className="text-sm text-gray-600">โทร. {bill.phone}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-gray-600">วันที่ครบกำหนดชำระ: <span className="font-medium text-gray-900">{thaiDate(bill.due_date)}</span></p>
            {isReceipt && <p className="mt-1 text-sm text-gray-600">วันที่รับชำระ: <span className="font-medium text-gray-900">{thaiDate(bill.paid_at)}</span></p>}
            {isReceipt && bill.payment_method && (
              <p className="mt-1 text-sm text-gray-600">
                วิธีชำระเงิน: <span className="font-medium text-gray-900">{paymentMethodLabel[bill.payment_method] || bill.payment_method}</span>
              </p>
            )}
            {isReceipt && bill.payment_reference && (
              <p className="mt-1 text-sm text-gray-600">เลขอ้างอิง: <span className="font-medium text-gray-900">{bill.payment_reference}</span></p>
            )}
            <p className={`mt-3 inline-flex px-3 py-1 text-sm font-semibold ${isReceipt ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {isReceipt ? 'ชำระแล้ว' : 'รอชำระ'}
            </p>
          </div>
        </section>

        <section className="py-6">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-gray-600">
                <th className="py-3 pr-3">รายการ</th>
                <th className="px-3 py-3 text-center">จำนวน</th>
                <th className="px-3 py-3 text-center">หน่วย</th>
                <th className="px-3 py-3 text-right">ราคาต่อหน่วย (บาท)</th>
                <th className="py-3 pl-3 text-right">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.map((item, index) => (
                <tr key={item.key || item.label || index} className="border-b border-gray-100">
                  <td className="py-4 pr-3 font-medium text-gray-800">
                    {item.label}
                    {item.detail && <span className="mt-1 block text-xs font-normal text-gray-500">{item.detail}</span>}
                  </td>
                  <td className="px-3 py-4 text-center text-gray-600">{item.quantity}</td>
                  <td className="px-3 py-4 text-center text-gray-600">{item.unit}</td>
                  <td className="px-3 py-4 text-right text-gray-600">
                    {item.unitPrice == null ? '-' : money(item.unitPrice)}
                  </td>
                  <td className="py-4 pl-3 text-right text-gray-800">{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="ml-auto max-w-sm border-t border-gray-300 pt-4">
          <div className="flex items-center justify-between text-lg font-bold text-gray-900">
            <span>ยอดรวมทั้งสิ้น</span>
            <span>฿{money(bill.total_amount)}</span>
          </div>
          <p className="mt-2 text-right text-sm text-gray-500">สถานะ: {isReceipt ? 'ชำระครบถ้วน' : 'ยังไม่ได้ชำระ'}</p>
        </section>

        {!isReceipt && bill.promptpay_number && (
          <section className="mt-6 rounded-lg border border-teal-200 bg-teal-50 p-4">
            <h3 className="text-sm font-semibold text-teal-900">ช่องทางชำระเงิน</h3>
            <p className="mt-1 text-sm text-gray-800">พร้อมเพย์: <span className="font-semibold">{bill.promptpay_number}</span></p>
            <p className="mt-1 text-xs text-gray-600">โอนตามยอดบิล แล้วแนบสลิปเพื่อแจ้งชำระ</p>
          </section>
        )}

        {isReceipt && bill.notes && (
          <section className="ml-auto mt-5 max-w-sm text-sm text-gray-600">
            <span className="font-semibold text-gray-700">หมายเหตุการรับชำระ:</span> {bill.notes}
          </section>
        )}

        <footer className="mt-16 border-t border-dashed border-gray-300 pt-5 text-center text-xs text-gray-500">
          {bill.payment_instructions && <p className="mb-2 whitespace-pre-line">{bill.payment_instructions}</p>}
          {isReceipt
            ? 'เอกสารฉบับนี้ใช้เป็นหลักฐานการรับชำระเงิน'
            : 'กรุณาชำระเงินภายในวันที่กำหนด และแนบหลักฐานการชำระในระบบ'}
        </footer>
      </article>
    </div>
  );
}
