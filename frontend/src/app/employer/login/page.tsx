import { redirect } from 'next/navigation';

export default function EmployerLoginRedirect() {
  redirect('/signin');
}
