import { Link } from 'react-router-dom';
import { EmptyState } from '../components/common/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      title="ไม่พบหน้านี้"
      hint="ลิงก์อาจไม่ถูกต้อง หรือข้อมูลถูก Reset ไปแล้ว"
      action={<Link className="btn btn-primary btn-md" to="/">กลับไป Dashboard</Link>}
    />
  );
}
