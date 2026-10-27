import { Building, User, CheckCircle } from 'lucide-react';

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

const statusBadge = (status) => {
  switch (status) {
    case 'active':
      return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">ใช้งานอยู่ (Active)</span>;
    case 'pending_signature':
      return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">รอผู้เช่าลงนามสัญญา (Pending)</span>;
    case 'terminated':
      return <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">สิ้นสุดสัญญาแล้ว</span>;
    case 'expired':
      return <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">หมดอายุ</span>;
    default:
      return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{status || '-'}</span>;
  }
};

/**
 * Component กลางสำหรับแสดง "หนังสือสัญญาเช่าห้องพักอาศัยฉบับจริง (Official Lease Agreement)"
 * เป็นเอกสารตัวเดียวกัน 100% ทั้งใน:
 * 1. TenantContract.jsx (หน้าสัญญาของผู้เช่า)
 * 2. ContractDocumentModal.jsx (หน้าต่างดูสัญญาของแอดมินในหน้า Tenants / Rooms / Dashboard)
 * 3. KYCApproval.jsx (ตอนแอดมินพรีวิวออกสัญญา)
 */
export default function OfficialContractDocument({
  contract = {},
  dormitory = {},
  tenant = {},
  liveTenantSignature = null,
  liveTenantFullDoc = null,
  liveAdminSignature = null,
  id = 'printable-contract-document',
  className = ''
}) {
  // ดึงข้อมูลหอพักอย่างยืดหยุ่น (รองรับทุกโครงสร้างข้อมูล)
  const dormName = dormitory.dormitory_name || contract.dormitory_name || contract.settings?.dormitory_name || 'ระบบจัดการหอพัก';
  const dormAddress = dormitory.dormitory_address || contract.dormitory_address || contract.settings?.dormitory_address || '';
  const dormPhone = dormitory.contact_phone || contract.contact_phone || contract.settings?.contact_phone || '';
  const waterRate = contract.water_rate ?? dormitory.water_rate ?? contract.settings?.water_rate ?? 18;
  const electricRate = contract.electricity_rate ?? contract.electric_rate ?? dormitory.electric_rate ?? dormitory.electricity_rate ?? contract.settings?.electric_rate ?? 8;

  // ดึงข้อมูลผู้เช่า
  const firstName = contract.first_name || tenant.first_name || '';
  const lastName = contract.last_name || tenant.last_name || '';
  const tenantFullName = `${firstName} ${lastName}`.trim() || 'ผู้เช่า';
  const tenantPhone = contract.phone || tenant.phone || '-';
  const tenantUsername = contract.username || tenant.username || '-';

  // ข้อมูลสัญญา
  const contractId = contract.contract_id ? `CONTRACT-#${String(contract.contract_id).padStart(6, '0')}` : 'CONTRACT-DRAFT';
  const roomNumber = contract.room_number || '-';
  const floor = contract.floor || '-';
  const roomType = contract.room_type || 'ห้องพัก';
  const basePrice = contract.base_price || 0;
  const deposit = contract.deposit || 0;
  const startDate = contract.start_date;
  const endDate = contract.end_date;
  const status = contract.status || contract.contract_status || 'active';
  const isPendingSignature = status === 'pending_signature';

  // ข้อมูลลายเซ็น (รองรับทั้งจาก DB และ Live Preview)
  const adminSig = liveAdminSignature || contract.admin_signature;
  const adminSignedAt = contract.admin_signed_at || (contract.admin_signature ? contract.start_date : null);

  const tenantSig = liveTenantSignature || contract.tenant_signature;
  const tenantSignedAt = contract.tenant_signed_at || (contract.tenant_signature ? contract.start_date : null);
  const hasSignedDoc = Boolean(contract.signed_document || liveTenantFullDoc);

  return (
    <article
      id={id}
      className={`contract-document bg-white p-6 sm:p-10 rounded-2xl shadow-xs border border-slate-200 text-slate-800 space-y-6 ${className}`}
    >
      {/* 1. หัวหนังสือสัญญา */}
      <div className="text-center pb-6 border-b-2 border-teal-800">
        <span className="text-xs font-semibold uppercase tracking-widest text-teal-700">Official Lease Agreement</span>
        <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          หนังสือสัญญาเช่าห้องพักอาศัย
        </h2>
        <p className="mt-1 text-base font-semibold text-teal-900">
          {dormName}
        </p>
        {dormAddress && (
          <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line">
            {dormAddress}
          </p>
        )}
        {dormPhone && (
          <p className="text-xs text-slate-500 mt-0.5">โทร. {dormPhone}</p>
        )}
      </div>

      {/* 2. สรุปเลขที่สัญญา วันที่ และสถานะ */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-wider block">เลขที่สัญญา</span>
          <span className="font-bold text-slate-800 text-base">{contractId}</span>
        </div>
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-wider block">วันที่เริ่มสัญญา</span>
          <span className="font-semibold text-slate-700">{formatDate(startDate)}</span>
        </div>
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-wider block">วันที่สิ้นสุดสัญญา</span>
          <span className="font-semibold text-slate-700">{formatDate(endDate)}</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 uppercase tracking-wider block">สถานะสัญญา</span>
          {statusBadge(status)}
        </div>
      </div>

      {/* 3. ข้อมูลคู่สัญญา */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <h3 className="font-bold text-slate-800 flex items-center gap-1.5 mb-2 text-teal-800">
            <Building size={16} /> ผู้ให้เช่า (หอพัก)
          </h3>
          <p><span className="text-slate-500">ชื่อหอพัก:</span> <span className="font-medium text-slate-800">{dormName}</span></p>
          <p><span className="text-slate-500">เบอร์โทรศัพท์:</span> {dormPhone || '-'}</p>
          <p className="text-xs text-slate-500 mt-1">ผู้มีอำนาจลงนามและบริหารจัดการห้องพัก</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <h3 className="font-bold text-slate-800 flex items-center gap-1.5 mb-2 text-teal-800">
            <User size={16} /> ผู้เช่า (Tenant)
          </h3>
          <p><span className="text-slate-500">ชื่อ-นามสกุล:</span> <span className="font-medium text-slate-800">{tenantFullName}</span></p>
          <p><span className="text-slate-500">เบอร์โทรศัพท์:</span> {tenantPhone}</p>
          <p><span className="text-slate-500">ชื่อผู้ใช้ระบบ:</span> @{tenantUsername}</p>
        </div>
      </div>

      {/* 4. ข้อมูลห้องพักและการเงิน */}
      <div className="space-y-3">
        <h3 className="font-bold text-base text-slate-900 border-b pb-1">
          ข้อมูลห้องพักและเงื่อนไขค่าใช้จ่าย
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 block">ห้องพัก</span>
            <span className="font-bold text-teal-800 text-lg">ห้อง {roomNumber}</span>
            <span className="text-xs text-slate-500 block">ชั้น {floor} · {roomType}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 block">ค่าเช่ารายเดือน</span>
            <span className="font-bold text-slate-800 text-lg">฿{formatMoney(basePrice)}</span>
            <span className="text-xs text-slate-500 block">บาท / เดือน</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 block">เงินประกันความเสียหาย</span>
            <span className="font-bold text-slate-800 text-lg">฿{formatMoney(deposit)}</span>
            <span className="text-xs text-slate-500 block">คืนเมื่อสิ้นสุดสัญญา</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 block">อัตราค่าน้ำ / ค่าไฟ</span>
            <span className="font-semibold text-slate-800 block text-xs mt-1">น้ำ: ฿{waterRate}/หน่วย</span>
            <span className="font-semibold text-slate-800 block text-xs">ไฟ: ฿{electricRate}/หน่วย</span>
          </div>
        </div>
      </div>

      {/* 5. ข้อกำหนดและเงื่อนไขแห่งสัญญา */}
      <div className="space-y-2.5 pt-2 text-xs leading-relaxed text-slate-700 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
        <h4 className="font-bold text-slate-900 text-sm mb-2">ข้อกำหนดและเงื่อนไขแห่งสัญญาเช่า:</h4>
        <ol className="list-decimal pl-4 space-y-1.5">
          <li>
            <strong>วัตถุประสงค์แห่งการเช่า:</strong> ผู้เช่าตกลงเช่าห้องพักเพื่อการพักอาศัยส่วนบุคคลเท่านั้น ห้ามนำห้องพักไปประกอบการค้าที่ผิดกฎหมาย หรือให้บุคคลภายนอกเช่าช่วงโดยไม่ได้รับความยินยอมเป็นลายลักษณ์อักษรจากผู้ให้เช่า
          </li>
          <li>
            <strong>การชำระค่าเช่า:</strong> ผู้เช่าตกลงชำระค่าเช่าห้องพัก พร้อมค่าน้ำประปา ค่าไฟฟ้า และค่าใช้จ่ายส่วนกลางตามรอบบิลที่กำหนด ภายในระยะเวลาไม่เกินกำหนดชำระของทุกเดือน
          </li>
          <li>
            <strong>เงินประกันความเสียหาย:</strong> เงินประกันความเสียหายจะได้รับการคืนเมื่อสิ้นสุดสัญญาเช่าและผู้เช่าส่งมอบห้องพักในสภาพเรียบร้อย หลังจากหักค่าใช้จ่ายค้างชำระหรือค่าเสียหายตามจริง
          </li>
          <li>
            <strong>การดูแลรักษาห้องพัก:</strong> ผู้เช่ามีหน้าที่ดูแลรักษาความสะอาดและความเรียบร้อยของห้องพัก อุปกรณ์ และเฟอร์นิเจอร์ให้อยู่ในสภาพใช้งานได้ดี
          </li>
          <li>
            <strong>การต่ออายุสัญญา:</strong> ผู้เช่าสามารถยื่นความประสงค์ต่อสัญญาเช่าล่วงหน้าผ่านระบบได้ 30 วันก่อนวันสิ้นสุดสัญญา
          </li>
        </ol>
      </div>

      {/* 6. ลายมือชื่อคู่สัญญา (แสดงผลจริงพร้อมภาพลายเซ็น) */}
      <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs border-t border-slate-200">
        {/* ฝั่งผู้ให้เช่า (Admin) */}
        <div className="flex flex-col items-center justify-end min-h-[140px]">
          {adminSig ? (
            <div className="mb-2 animate-in fade-in zoom-in-95">
              <img
                src={adminSig}
                alt="ลายมือชื่อผู้ให้เช่า"
                className="max-h-16 max-w-[200px] object-contain mx-auto"
              />
              <p className="text-[10px] text-emerald-700 font-bold mt-1">
                {liveAdminSignature && !contract.admin_signature
                  ? '✓ ตัวอย่างลายเซ็นผู้ให้เช่า (จะปรากฏบนสัญญานี้)'
                  : `✓ ผู้ให้เช่าลงนามแล้วเมื่อ ${formatDate(adminSignedAt || new Date())}`}
              </p>
            </div>
          ) : (
            <div className="h-14 flex items-end justify-center mb-1">
              <span className="text-slate-400 italic text-[11px]">(ประทับตรารับรอง)</span>
            </div>
          )}
          <p className="font-bold text-slate-800 border-t border-slate-300 pt-1.5 w-48">
            ลงชื่อ ผู้ให้เช่า
          </p>
          <p className="text-slate-600 mt-0.5">({dormName})</p>
        </div>

        {/* ฝั่งผู้เช่า (Tenant) — แสดงผลทั้งลายเซ็นที่บันทึกแล้ว หรือ Live Preview ขณะเซ็น */}
        <div className={`flex flex-col items-center justify-end min-h-[140px] rounded-xl p-2 transition ${
          isPendingSignature && !contract.tenant_signature ? 'border-2 border-dashed border-teal-400 bg-teal-50/30' : ''
        }`}>
          {contract.tenant_signature ? (
            <div className="mb-2">
              <img
                src={contract.tenant_signature}
                alt="ลายมือชื่อผู้เช่า"
                className="max-h-16 max-w-[200px] object-contain mx-auto"
              />
              <p className="text-[10px] text-emerald-700 font-bold mt-1">
                ✓ ผู้เช่าลงนามแล้วเมื่อ ${formatDate(tenantSignedAt)}
              </p>
            </div>
          ) : liveTenantSignature ? (
            <div className="mb-2 animate-in fade-in zoom-in-95">
              <img
                src={liveTenantSignature}
                alt="ตัวอย่างลายมือชื่อผู้เช่า"
                className="max-h-16 max-w-[200px] object-contain mx-auto"
              />
              <p className="text-[10px] text-emerald-700 font-bold mt-1 flex items-center justify-center gap-1">
                <CheckCircle size={12} /> ลายเซ็นของคุณจะอยู่ตรงนี้บนสัญญา
              </p>
            </div>
          ) : hasSignedDoc ? (
            <div className="mb-2">
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                <CheckCircle size={14} /> แนบเอกสารสัญญาที่ลงนามแล้ว
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {tenantSignedAt ? formatDate(tenantSignedAt) : 'รอผู้เช่ายืนยัน'}
              </p>
            </div>
          ) : (
            <div className="h-14 flex items-center justify-center mb-1">
              <span className="text-teal-700 font-medium text-[11px] bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                ✍️ {isPendingSignature ? 'เมื่อคุณเซ็นด้านล่าง ลายเซ็นจะมาปรากฏตรงนี้' : 'รอผู้เช่าลงนาม'}
              </span>
            </div>
          )}
          <p className="font-bold text-slate-800 border-t border-slate-300 pt-1.5 w-48">
            ลงชื่อ ผู้เช่า
          </p>
          <p className="text-slate-600 mt-0.5">({tenantFullName})</p>
        </div>
      </div>
    </article>
  );
}
