import { useContext } from 'react';
import ToastContext from './toastContext';

export default function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast must be used within ToastProvider');
  return notify;
}
