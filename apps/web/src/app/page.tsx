import { redirect } from 'next/navigation';
import { OS_BASE_PATH } from '@/os/routes';

export default function RootPage() {
  redirect(OS_BASE_PATH);
}
