import { redirect } from 'next/navigation';

export default function MessagingRedirect() {
  // Since auth is client-side (localStorage), redirect to officer dashboard
  // The layout auth guard handles role enforcement
  redirect('/dashboard/officer');
}
