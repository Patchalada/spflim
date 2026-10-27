import { useCallback, useState, useEffect } from 'react';
import { UserPlus, X, User, Edit2, Search, LogOut, FileText } from 'lucide-react';
import api from '../api/axios';
import useToast from '../components/useToast';
import Pagination from '../components/Pagination';
import ContractAssignmentModal from '../components/ContractAssignmentModal';
import TenantDocumentsModal from '../components/TenantDocumentsModal';
import ContractDocumentModal from '../components/ContractDocumentModal';

const oneYearAfter = (value) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  const month = date.getMonth();
  date.setFullYear(date.getFullYear() + 1);
  if (date.getMonth() !== month) date.setDate(0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function Tenants() {
  const notify = useToast();
  const [contracts, setContracts] = useState([]);
  const [tenantDirectory, setTenantDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [assignmentTenant, setAssignmentTenant] = useState(null);
  const [editingTenant, setEditingTenant] = useState(null);
  const [editingContract, setEditingContract] = useState(null);
  const [tenantDocuments, setTenantDocuments] = useState(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [selectedContractDoc, setSelectedContractDoc] = useState(null);
  const [contractDocuments, setContractDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [contractPage, setContractPage] = useState(1);
  const [directoryPage, setDirectoryPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [contractTotal, setContractTotal] = useState(0);
  const [directoryTotal, setDirectoryTotal] = useState(0);
  const [tenantForm, setTenantForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [contractForm, setContractForm] = useState({ start_date: '', end_date: '', deposit: '', status: 'active' });

  const requestTenantData = useCallback(() => Promise.all([
        api.get('/contracts', { params: { page: contractPage, page_size: pageSize, search } }),
        api.get('/reports/tenants', { params: { page: directoryPage, page_size: pageSize, search } })
      ]), [contractPage, directoryPage, pageSize, search]);

  const applyTenantData = useCallback(([resContracts, resDirectory]) => {
      setContracts(resContracts.data.items);
      setContractTotal(resContracts.data.pagination.total);
      setTenantDirectory(resDirectory.data.items);
      setDirectoryTotal(resDirectory.data.pagination.total);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const data = await requestTenantData();
      applyTenantData(data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [applyTenantData, requestTenantData]);

  useEffect(() => {
    void Promise.resolve().then(fetchData).catch(() => {});
  }, [fetchData]);

  const openTenantEditor = (contract) => {
    setEditingTenant({ ...contract, tenant_id: contract.tenant_id || contract.user_id });
    setTenantForm({
      first_name: contract.first_name || '',
      last_name: contract.last_name || '',
      phone: contract.phone || ''
    });
  };

  const saveTenant = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/tenant/admin/tenants/${editingTenant.tenant_id}`, tenantForm);
      setEditingTenant(null);
      await fetchData();
    } catch (err) {
      notify(err.response?.data?.error || 'บันทึกข้อมูลผู้เช่าไม่สำเร็จ', 'error');
    }
  };

  const openTenantDocuments = async (tenant) => {
    setLoadingDocuments(true);
    try {
      const response = await api.get(`/tenant/admin/tenants/${tenant.user_id}/documents`);
      setTenantDocuments(response.data);
    } catch (err) {
      notify(err.response?.data?.error || 'โหลดเอกสารผู้เช่าไม่สำเร็จ', 'error');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleViewContract = async (contractItem) => {
    try {
      const [contractRes, docsRes] = await Promise.all([
        api.get(`/contracts/${contractItem.contract_id}`),
        contractItem.tenant_id
          ? api.get(`/tenant/admin/tenants/${contractItem.tenant_id}/documents`).catch(() => ({ data: { documents: [] } }))
          : Promise.resolve({ data: { documents: [] } })
      ]);
      setSelectedContractDoc(contractRes.data);
      setContractDocuments(docsRes.data?.documents || []);
    } catch (err) {
      notify(err.response?.data?.error || 'ไม่สามารถโหลดสัญญาเช่าได้', 'error');
    }
  };

  const openContractEditor = (contract) => {
    setEditingContract(contract);
    setContractForm({
      start_date: String(contract.start_date).slice(0, 10),
      end_date: String(contract.end_date).slice(0, 10),
      deposit: contract.deposit,
      status: contract.status
    });
  };

  const saveContract = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/contracts/${editingContract.contract_id}`, {
        ...contractForm,
        end_date: contractForm.status === 'active' ? oneYearAfter(contractForm.start_date) : contractForm.end_date,
        deposit: Number(contractForm.deposit)
      });
      setEditingContract(null);
      await fetchData();
    } catch (err) {
      notify(err.response?.data?.error || 'บันทึกสัญญาไม่สำเร็จ', 'error');
    }
  };

  const handleMoveOut = async (contract) => {
    if (!confirm(`ยืนยันย้ายผู้เช่าห้อง ${contract.room_number} ออก? ระบบจะสิ้นสุดสัญญาวันนี้และเก็บประวัติบิล/สัญญาไว้`)) return;
    try {
      await api.put(`/contracts/${contract.contract_id}`, {
        status: 'terminated'
      });
      notify(`บันทึกย้ายออกแล้ว ห้อง ${contract.room_number} กลับเป็นห้องว่าง`, 'success');
      await fetchData();
    } catch (err) {
      notify(err.response?.data?.error || 'ไม่สามารถบันทึกการย้ายออกได้', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการผู้เช่าและสัญญา</h1>
          <p className="text-sm text-gray-500">จัดสรรห้องพักให้กับผู้เช่าที่สมัครสมาชิกเข้ามา</p>
        </div>
        <button 
          onClick={() => { setAssignmentTenant(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg transition shadow-sm font-medium cursor-pointer"
        >
          <UserPlus size={18} /> จัดสรรห้องให้ผู้เช่า
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">ข้อมูลผู้เช่าทั้งหมด</h2>
          <p className="text-sm text-gray-500">รวมผู้เช่าที่ยังไม่ได้รับการจัดสรรห้อง</p>
        </div>
        <div className="relative max-w-sm">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setDirectoryPage(1);
              setContractPage(1);
            }}
            placeholder="ค้นหาชื่อ เบอร์โทร ชื่อผู้ใช้ หรือห้อง"
            className="w-full rounded-lg border p-2.5 pl-9 text-sm"
          />
        </div>
        {loading ? (
          <p className="text-center py-4 text-gray-500">กำลังโหลดข้อมูล...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 border-b">
                <tr><th className="p-3">ชื่อผู้เช่า</th><th className="p-3">เบอร์โทร</th><th className="p-3">ห้องปัจจุบัน</th><th className="p-3">สถานะบัญชี</th><th className="p-3 text-left">จัดการ</th></tr>
              </thead>
              <tbody>
                {tenantDirectory.map((tenant) => (
                  <tr key={tenant.user_id} className="border-b">
                    <td className="p-3 font-medium text-gray-800">{tenant.first_name} {tenant.last_name}<span className="ml-2 text-xs text-gray-400">{tenant.username}</span></td>
                    <td className="p-3">{tenant.phone || '-'}</td>
                    <td className="p-3">{tenant.room_number ? `ห้อง ${tenant.room_number}` : 'ยังไม่ได้จัดสรร'}</td>
                    <td className="p-3">{tenant.account_status || '-'}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-start gap-1">
                        <button type="button" onClick={() => openTenantDocuments(tenant)} disabled={loadingDocuments} className="rounded-lg p-2 text-teal-700 hover:bg-teal-50 disabled:opacity-50" title="ดูเอกสารและสัญญาที่แนบ" aria-label={`ดูเอกสารของ ${tenant.first_name} ${tenant.last_name}`}>
                          <FileText size={16} />
                        </button>
                        <button onClick={() => openTenantEditor(tenant)} className="inline-flex items-center gap-1 rounded-lg p-2 text-indigo-600 hover:bg-indigo-50" title="แก้ไขข้อมูลผู้เช่า">
                          <Edit2 size={16} /> แก้ไข
                        </button>
                        {!tenant.room_number && (
                          <button
                            type="button"
                            onClick={() => { setAssignmentTenant(tenant); setShowModal(true); }}
                            className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                            title="เลือกห้องและทำสัญญาให้ผู้เช่า"
                          >
                            <UserPlus size={15} /> จัดสรรห้อง
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!tenantDirectory.length && <tr><td colSpan="5" className="p-5 text-center text-gray-400">{directoryTotal ? 'ไม่พบผู้เช่าที่ค้นหา' : 'ยังไม่มีข้อมูลผู้เช่า'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <Pagination
            page={directoryPage}
            pageSize={pageSize}
            total={directoryTotal}
            onPageChange={setDirectoryPage}
            onPageSizeChange={(size) => { setPageSize(size); setDirectoryPage(1); setContractPage(1); }}
          />
        )}

        {editingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <form onSubmit={saveTenant} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold">แก้ไขข้อมูลผู้เช่า</h3>
                <button type="button" onClick={() => setEditingTenant(null)} className="text-gray-400" aria-label="ปิด">
                  <X size={20} />
                </button>
              </div>
              <label className="block text-sm">ชื่อ
                <input required value={tenantForm.first_name} onChange={(e) => setTenantForm({ ...tenantForm, first_name: e.target.value })} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="block text-sm">นามสกุล
                <input required value={tenantForm.last_name} onChange={(e) => setTenantForm({ ...tenantForm, last_name: e.target.value })} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="block text-sm">เบอร์โทรศัพท์
                <input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength="10" value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <button type="submit" className="w-full rounded-lg bg-indigo-600 py-2 text-white">บันทึกข้อมูล</button>
            </form>
          </div>
        )}

        {editingContract && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <form onSubmit={saveContract} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold">แก้ไขสัญญา #{editingContract.contract_id}</h3>
                <button type="button" onClick={() => setEditingContract(null)} className="text-gray-400" aria-label="ปิด">
                  <X size={20} />
                </button>
              </div>
              <label className="block text-sm">วันเริ่มสัญญา
                <input type="date" required value={contractForm.start_date} onChange={(e) => setContractForm({
                  ...contractForm,
                  start_date: e.target.value,
                  end_date: contractForm.status === 'active' ? oneYearAfter(e.target.value) : contractForm.end_date
                })} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="block text-sm">วันสิ้นสุดสัญญา
                <input type="date" required readOnly={contractForm.status === 'active'} value={contractForm.status === 'active' ? oneYearAfter(contractForm.start_date) : contractForm.end_date} onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })} className={`mt-1 w-full rounded-lg border p-2 ${contractForm.status === 'active' ? 'bg-gray-100' : ''}`} />
                {contractForm.status === 'active' && <span className="mt-1 block text-xs text-gray-500">สัญญาที่ใช้งานกำหนดระยะเวลา 1 ปี</span>}
              </label>
              <label className="block text-sm">เงินประกัน
                <input type="number" min="0" required value={contractForm.deposit} onChange={(e) => setContractForm({ ...contractForm, deposit: e.target.value })} className="mt-1 w-full rounded-lg border p-2" />
              </label>
              <label className="block text-sm">สถานะสัญญา
                <select value={contractForm.status} onChange={(e) => setContractForm({ ...contractForm, status: e.target.value })} className="mt-1 w-full rounded-lg border p-2">
                  <option value="active">กำลังเช่า</option>
                  <option value="terminated">สิ้นสุดสัญญา</option>
                  <option value="expired">หมดอายุ</option>
                </select>
              </label>
              <button type="submit" className="w-full rounded-lg bg-indigo-600 py-2 text-white">บันทึกสัญญา</button>
            </form>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        {loading ? (
          <p className="text-center py-6 text-gray-500">กำลังโหลดข้อมูล...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase border-b">
                <tr>
                  <th className="p-3">เลขที่สัญญา</th>
                  <th className="p-3">ห้องพัก</th>
                  <th className="p-3">ผู้เช่า</th>
                  <th className="p-3">เบอร์โทร</th>
                  <th className="p-3">เงินประกัน</th>
                  <th className="p-3">ระยะเวลาสัญญา</th>
                  <th className="p-3">สถานะ</th>
                  <th className="p-3 text-left">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.contract_id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-800">#{c.contract_id}</td>
                    <td className="p-3 font-semibold text-indigo-600">ห้อง {c.room_number}</td>
                    <td className="p-3 font-medium text-gray-800">{c.first_name} {c.last_name}</td>
                    <td className="p-3">{c.phone || '-'}</td>
                    <td className="p-3">฿{Number(c.deposit).toLocaleString()}</td>
                    <td className="p-3 text-xs text-gray-500">
                      {c.start_date ? new Date(c.start_date).toLocaleDateString('th-TH') : ''} - {c.end_date ? new Date(c.end_date).toLocaleDateString('th-TH') : ''}
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        c.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'pending_signature'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {c.status === 'active' ? 'กำลังเช่าอยู่' : c.status === 'pending_signature' ? 'รอผู้เช่าลงนาม' : c.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-start gap-1">
                        <button
                          type="button"
                          onClick={() => handleViewContract(c)}
                          className="p-2 text-teal-700 hover:bg-teal-50 rounded-lg"
                          title="ดูสัญญาเช่าฉบับเต็ม / พิมพ์"
                          aria-label={`ดูสัญญา ห้อง ${c.room_number}`}
                        >
                          <FileText size={16} />
                        </button>
                        {c.status === 'active' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openTenantEditor(c)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                              title="แก้ไขข้อมูลผู้เช่า"
                            >
                              <User size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openContractEditor(c)}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
                              title="แก้ไขสัญญา"
                            >
                              <Edit2 size={16} />
                            </button>
                          <button
                            type="button"
                            onClick={() => handleMoveOut(c)}
                            className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                            title="บันทึกย้ายออกและสิ้นสุดสัญญา"
                            aria-label={`บันทึกย้ายออก ห้อง ${c.room_number}`}
                          >
                            <LogOut size={16} />
                          </button>
                          </>
                        )}
                      </div>

                    </td>
                  </tr>
                ))}
                {!contracts.length && (
                  <tr><td colSpan="8" className="p-5 text-center text-gray-400">
                    {contractTotal ? 'ไม่พบสัญญาที่ค้นหา' : 'ยังไม่มีข้อมูลสัญญา'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <Pagination
            page={contractPage}
            pageSize={pageSize}
            total={contractTotal}
            onPageChange={setContractPage}
            onPageSizeChange={(size) => { setPageSize(size); setDirectoryPage(1); setContractPage(1); }}
          />
        )}
      </div>

      <TenantDocumentsModal data={tenantDocuments} onClose={() => setTenantDocuments(null)} />

      {showModal && (
        <ContractAssignmentModal
          initialTenant={assignmentTenant}
          onClose={() => setShowModal(false)}
          onAssigned={fetchData}
        />
      )}

      {selectedContractDoc && (
        <ContractDocumentModal
          contract={selectedContractDoc}
          documents={contractDocuments}
          onClose={() => setSelectedContractDoc(null)}
        />
      )}
    </div>
  );
}