import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building, Users, AlertCircle, TrendingUp } from 'lucide-react';
import api from '../api/axios';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [monthlyFinancial, setMonthlyFinancial] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.allSettled([
      api.get('/reports/dashboard'),
      api.get('/reports/monthly-financial')
    ])
      .then(([summaryResult, financialResult]) => {
        if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value.data);
        else console.error(summaryResult.reason);
        if (financialResult.status === 'fulfilled') setMonthlyFinancial(financialResult.value.data);
        else console.error(financialResult.reason);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center py-8 text-gray-500">กำลังโหลดข้อมูลแดชบอร์ด...</p>;

  const vacantCount = summary?.room_summary?.find(r => r.status === 'vacant')?.count || 0;
  const occupiedCount = summary?.room_summary?.find(r => r.status === 'occupied')?.count || 0;
  const totalRooms = (summary?.room_summary || []).reduce((total, room) => total + Number(room.count), 0);
  const netProfit = Number(summary?.financial_summary?.net_profit || 0);
  const unpaidCount = Number(summary?.pending_bills_summary?.unpaid_count || 0);
  const now = new Date();
  const recentMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const record = monthlyFinancial.find((item) => item.month === key);
    return {
      key,
      label: date.toLocaleDateString('th-TH', { month: 'short' }),
      income: Number(record?.income || 0),
      expense: Number(record?.expense || 0)
    };
  });
  const maxFinancialAmount = Math.max(1, ...recentMonths.flatMap(({ income, expense }) => [income, expense]));
  const occupancy = (summary?.room_summary || []).map((room) => ({
    status: room.status || 'other',
    count: Number(room.count || 0)
  })).filter((room) => room.count > 0);
  const occupancyColors = { occupied: '#10b981', vacant: '#f59e0b' };
  const totalOccupancy = occupancy.reduce((total, room) => total + room.count, 0);
  const occupancyGradient = occupancy.reduce((gradient, room, index) => {
    const end = gradient.offset + room.count / Math.max(totalOccupancy, 1) * 100;
    const color = occupancyColors[room.status] || ['#6366f1', '#06b6d4', '#f43f5e'][index % 3];
    return {
      offset: end,
      slices: [...gradient.slices, `${color} ${gradient.offset}% ${end}%`]
    };
  }, { offset: 0, slices: [] }).slices.join(', ');
  const occupancyLabels = { occupied: 'มีผู้เช่า', vacant: 'ห้องว่าง', other: 'สถานะอื่น' };

  const stats = [
    { title: 'ห้องพักทั้งหมด', value: totalRooms, unit: 'ห้อง', icon: Building, color: 'bg-blue-500' },
    { title: 'ห้องที่มีผู้เช่า', value: occupiedCount, unit: 'ห้อง', icon: Users, color: 'bg-emerald-500' },
    { title: 'ห้องว่าง', value: vacantCount, unit: 'ห้อง', icon: AlertCircle, color: 'bg-amber-500' },
    { title: 'กำไรสุทธิ', value: netProfit.toLocaleString(), unit: 'บาท', icon: TrendingUp, color: 'bg-indigo-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">แดชบอร์ดภาพรวม</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`${stat.color} p-4 rounded-lg text-white`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{stat.title}</p>
              <h3 className="text-2xl font-bold text-gray-800">
                {stat.value} <span className="text-xs text-gray-400 font-normal">{stat.unit}</span>
              </h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">รายรับและรายจ่ายรายเดือน</h2>
              <p className="text-sm text-gray-500">เปรียบเทียบรายการย้อนหลัง 6 เดือน</p>
            </div>
            <div className="flex gap-4 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />รายรับ</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-rose-400" />รายจ่าย</span>
            </div>
          </div>
          <div className="flex h-52 items-end justify-between gap-2 border-b border-gray-200 px-1 sm:gap-4">
            {recentMonths.map((month) => (
              <div key={month.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div className="flex h-40 items-end justify-center gap-1 sm:gap-2" title={`${month.label}: รายรับ ฿${month.income.toLocaleString()} · รายจ่าย ฿${month.expense.toLocaleString()}`}>
                  <div className="w-3 rounded-t bg-emerald-500 sm:w-5" style={{ height: `${Math.max(month.income ? 3 : 0, month.income / maxFinancialAmount * 100)}%` }} />
                  <div className="w-3 rounded-t bg-rose-400 sm:w-5" style={{ height: `${Math.max(month.expense ? 3 : 0, month.expense / maxFinancialAmount * 100)}%` }} />
                </div>
                <span className="h-8 pt-2 text-center text-xs text-gray-500">{month.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:text-sm">
            <p className="text-gray-600">รายรับ 6 เดือน <strong className="text-emerald-700">฿{recentMonths.reduce((sum, month) => sum + month.income, 0).toLocaleString()}</strong></p>
            <p className="text-gray-600">รายจ่าย 6 เดือน <strong className="text-rose-600">฿{recentMonths.reduce((sum, month) => sum + month.expense, 0).toLocaleString()}</strong></p>
          </div>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800">สัดส่วนสถานะห้องพัก</h2>
          <p className="text-sm text-gray-500">จำนวนห้องตามสถานะปัจจุบัน</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-6 sm:justify-start xl:flex-col">
            {totalOccupancy > 0 ? (
              <>
                <div
                  className="h-36 w-36 shrink-0 rounded-full"
                  style={{ background: `conic-gradient(${occupancyGradient})` }}
                  role="img"
                  aria-label="กราฟวงกลมแสดงสัดส่วนสถานะห้องพัก"
                >
                  <div className="m-5 flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
                    <strong className="text-2xl text-gray-800">{totalOccupancy}</strong>
                    <span className="text-xs text-gray-500">ห้องทั้งหมด</span>
                  </div>
                </div>
                <ul className="min-w-36 space-y-2">
                  {occupancy.map((room, index) => {
                    const color = occupancyColors[room.status] || ['#6366f1', '#06b6d4', '#f43f5e'][index % 3];
                    return (
                      <li key={room.status} className="flex items-center justify-between gap-4 text-sm">
                        <span className="inline-flex items-center gap-2 text-gray-600"><i className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />{occupancyLabels[room.status] || room.status}</span>
                        <strong className="text-gray-800">{room.count} <span className="font-normal text-gray-400">({Math.round(room.count / totalOccupancy * 100)}%)</span></strong>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : <p className="py-10 text-sm text-gray-500">ยังไม่มีข้อมูลห้องพัก</p>}
          </div>
        </section>
      </div>

      {summary?.pending_bills_summary && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">สถานะการชำระเงิน</h2>
          <Link to="/bills?status=pending&all_periods=1" className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 transition hover:bg-amber-100">
            <span>มีบิลค้างชำระทั้งหมด {summary.pending_bills_summary.unpaid_count || 0} รายการ (รวม ฿{Number(summary.pending_bills_summary.unpaid_amount || 0).toLocaleString()})</span>
            <span aria-hidden="true">ดูรายการ →</span>
          </Link>
        </div>
      )}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">สรุปการเงิน</h2>
        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          <Link to="/bills?status=paid&all_periods=1" className="rounded-lg p-2 text-gray-600 transition hover:bg-emerald-50 hover:text-emerald-800">
            รายรับสะสม: <strong className="text-emerald-700">฿{Number(summary?.financial_summary?.total_income || 0).toLocaleString()}</strong>
            <span className="mt-1 block text-xs">ดูบิลที่ชำระแล้ว →</span>
          </Link>
          <Link to="/reports#expense-transactions" className="rounded-lg p-2 text-gray-600 transition hover:bg-rose-50 hover:text-rose-700">
            รายจ่ายสะสม: <strong className="text-rose-600">฿{Number(summary?.financial_summary?.total_expense || 0).toLocaleString()}</strong>
            <span className="mt-1 block text-xs">ดูรายการรายจ่าย →</span>
          </Link>
          <Link to="/bills?status=pending&all_periods=1" className="rounded-lg p-2 text-gray-600 transition hover:bg-amber-50 hover:text-amber-800">
            บิลค้างชำระ: <strong className="text-amber-700">{unpaidCount} รายการ</strong>
            <span className="mt-1 block text-xs">ดูรายการบิลค้าง →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}