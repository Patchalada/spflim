import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Tenants from './pages/Tenants';
import Bills from './pages/Bills';
import TenantDashboard from './pages/TenantDashboard';
import TenantContract from './pages/TenantContract';
import KYCApproval from './pages/KYCApproval'; // 1. เพิ่ม Import ตรงนี้
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import BillDocument from './pages/BillDocument';
import TenantServices from './pages/TenantServices';
import { ToastProvider } from './components/ToastProvider';
import { SocketProvider } from './context/SocketProvider';

// คอมโพเนนต์ช่วยเลือก Redirect ไปยัง Dashboard ตาม Role
function RoleBasedRedirect() {
  const role = localStorage.getItem('role');
  return role === 'tenant' 
    ? <Navigate to="/my-dashboard" replace /> 
    : <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <Router>
      <ToastProvider>
        <SocketProvider>
          <Routes>
          {/* หน้า Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* หน้า Protected Route (ต้องล็อกอิน) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              {/* Redirect หน้าแรกตาม Role */}
              <Route index element={<RoleBasedRedirect />} />
              
              {/* Route สำหรับ Admin */}
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="kyc-approval" element={<KYCApproval />} /> {/* 2. เพิ่ม Route ตรงนี้ */}
              <Route path="rooms" element={<Rooms />} />
              <Route path="tenants" element={<Tenants />} />
              <Route path="bills" element={<Bills />} />
              <Route path="bills/:billId" element={<BillDocument />} />
              <Route path="settings" element={<Settings />} />
              <Route path="reports" element={<Reports />} />
              <Route path="tenant-services" element={<TenantServices />} />

              {/* Route สำหรับ Tenant */}
              <Route path="my-dashboard" element={<TenantDashboard />} />
              <Route path="my-contract" element={<TenantContract />} />
            </Route>
          </Route>

          {/* Fallback สำหรับ Route ที่ไม่มีอยู่จริง */}
          <Route path="*" element={<RoleBasedRedirect />} />
          </Routes>
        </SocketProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;