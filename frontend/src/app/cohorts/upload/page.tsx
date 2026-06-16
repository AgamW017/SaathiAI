import { redirect } from 'next/navigation';

export default function CohortUploadRedirect() {
  redirect('/dashboard/officer/cohorts');
}
