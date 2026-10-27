/**
 * คำนวณหา Route ปลายทางที่เหมาะสมตามเนื้อหาของการแจ้งเตือนและ Role ของผู้ใช้
 * รองรับ:
 * 1. กรณีที่ link เป็น null / undefined / ไม่มีค่าในระบบ
 * 2. กรณี Role ไม่ตรงกัน (เช่น ผู้เช่าส่งแจ้งเตือน แอดมินเปิดดู จะได้ไม่เด้งไป /my-dashboard)
 * 3. มี Fallback อัตโนมัติตาม Keyword (บิล, ชำระ, ซ่อม, kyc, ห้องพัก ฯลฯ)
 */
export function resolveNotificationRoute(notif, userRole) {
  const role = userRole || (typeof window !== 'undefined' ? localStorage.getItem('role') : null) || 'admin';
  const rawLink = typeof notif === 'string' ? notif : notif?.link;
  const title = String(notif?.title || '').toLowerCase();
  const message = String(notif?.message || '').toLowerCase();
  const text = `${title} ${message}`;

  // 1. ถ้ามี rawLink ระบุมา ตรวจสอบว่าตรงกับสิทธิ์ (Role) หรือไม่
  if (rawLink && typeof rawLink === 'string') {
    const trimmed = rawLink.trim();

    if (role === 'admin') {
      // หน้าเฉพาะผู้เช่า แอดมินเข้าไม่ได้ ให้ map ไปหน้าที่เกี่ยวข้องของแอดมิน
      if (trimmed.startsWith('/my-contract')) {
        return '/tenants';
      }
      if (trimmed.startsWith('/my-dashboard')) {
        if (text.includes('ซ่อม') || text.includes('ปัญหา') || text.includes('ticket') || text.includes('ต่อสัญญา')) {
          return '/tenant-services';
        }
        if (text.includes('สัญญา')) {
          return '/tenants';
        }
        return '/bills';
      }
      return trimmed;
    } else {
      // หน้าเฉพาะแอดมิน ผู้เช่าเข้าไม่ได้ ให้ map ไปหน้าที่เกี่ยวข้องของผู้เช่า
      if (trimmed.startsWith('/contracts') || trimmed.startsWith('/tenants')) {
        return '/my-contract';
      }
      if (
        trimmed.startsWith('/bills') ||
        trimmed.startsWith('/dashboard') ||
        trimmed.startsWith('/kyc-approval') ||
        trimmed.startsWith('/rooms') ||
        trimmed.startsWith('/settings') ||
        trimmed.startsWith('/reports')
      ) {
        if (text.includes('ซ่อม') || text.includes('ปัญหา') || text.includes('ticket') || text.includes('ต่อสัญญา')) {
          return '/tenant-services';
        }
        if (text.includes('สัญญา')) {
          return '/my-contract';
        }
        return '/my-dashboard';
      }
      return trimmed;
    }
  }

  // 2. ถ้า link เป็น null หรือไม่มีค่า ให้ใช้ Smart Resolver อิงตามข้อความ
  if (
    text.includes('ต่อสัญญา') ||
    text.includes('ซ่อม') ||
    text.includes('ปัญหา') ||
    text.includes('ticket') ||
    text.includes('คำร้อง')
  ) {
    return '/tenant-services';
  }

  if (text.includes('สัญญาเช่า') || text.includes('สัญญา')) {
    return role === 'admin' ? '/tenants' : '/my-contract';
  }

  if (text.includes('kyc') || text.includes('เอกสาร') || text.includes('ยืนยันตัวตน') || text.includes('บัตรประชาชน')) {
    return role === 'admin' ? '/kyc-approval' : '/my-dashboard';
  }

  if (
    text.includes('บิล') ||
    text.includes('ชำระ') ||
    text.includes('สลิป') ||
    text.includes('จ่าย') ||
    text.includes('ค่าเช่า') ||
    text.includes('เงิน')
  ) {
    return role === 'admin' ? '/bills' : '/my-dashboard';
  }

  if (text.includes('ห้องพัก') || text.includes('มิเตอร์') || text.includes('ห้อง')) {
    return role === 'admin' ? '/rooms' : '/my-dashboard';
  }

  if (text.includes('ผู้เช่า')) {
    return role === 'admin' ? '/tenants' : '/my-dashboard';
  }

  // ค่า Default ตาม Role
  return role === 'admin' ? '/dashboard' : '/my-dashboard';
}

/**
 * ดำเนินการนำทางไปยังหน้าเป้าหมาย พร้อมยิง Event รีโหลดข้อมูล และเลื่อนหน้าจอ
 */
export function executeNotificationNavigation(navigate, notif, userRole, onComplete) {
  if (typeof onComplete === 'function') {
    onComplete();
  }

  const targetRoute = resolveNotificationRoute(notif, userRole);
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

  // กระจาย Event ให้หน้าที่เปิดอยู่ (ทั้งหน้าปัจจุบัน และหน้าที่กำลังจะไป) รีเฟรชข้อมูลล่าสุด
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('dormitory-refresh-page', {
        detail: {
          target: targetRoute,
          notif
        }
      })
    );

    if (currentPath === targetRoute) {
      // ถ้าอยู่หน้านั้นอยู่แล้ว ให้เลื่อนกลับขึ้นด้านบนแบบ Smooth
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // กระจาย Event เพิ่มเติมสำหรับ Feedback
      window.dispatchEvent(
        new CustomEvent('dormitory-highlight-content', {
          detail: {
            target: targetRoute,
            notif
          }
        })
      );
    } else if (typeof navigate === 'function') {
      // ถ้าอยู่คนละหน้า ให้นำทางไปหน้านั้นทันที
      navigate(targetRoute);
    }
  }
}
