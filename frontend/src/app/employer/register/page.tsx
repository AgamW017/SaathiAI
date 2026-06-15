import { redirect } from 'next/navigation';

export default function EmployerRegisterRedirect() {
  redirect('/signin');
}
