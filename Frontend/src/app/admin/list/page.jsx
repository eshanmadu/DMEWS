import { AdminAlertList } from "@/components/AdminAlertList";

export default async function AlertListPage({ params }) {
  return <AdminAlertList alertId={params.id} />;
}