import { AdminEditAlert } from "@/components/AdminEditAlert";

export default function EditAlertPage({ searchParams }) {
  return <AdminEditAlert alertId={searchParams?.id} />;
}