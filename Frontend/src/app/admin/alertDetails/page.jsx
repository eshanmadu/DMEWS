import { AdminAlertDetails } from "@/components/AdminAlertDetails";

export default function AlertDetailsPage({ searchParams }) {
  return <AdminAlertDetails alertId={searchParams?.id} />;
}