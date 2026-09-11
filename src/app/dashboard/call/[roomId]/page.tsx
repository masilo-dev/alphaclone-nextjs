import { redirect } from 'next/navigation';

/** Legacy links used `/dashboard/call/:id` — canonical route is `/call/:id`. */
export default async function DashboardCallRedirect({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  redirect(`/call/${roomId}`);
}
