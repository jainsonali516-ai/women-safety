import { TrackingView } from "@/components/TrackingView";

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrackingView alertId={id} />;
}
