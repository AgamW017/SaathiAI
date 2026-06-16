import { redirect } from 'next/navigation';

export default function CohortDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/dashboard/officer/cohorts/${params.id}`);
}
