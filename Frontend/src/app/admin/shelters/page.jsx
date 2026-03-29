import { AdminShelters } from "@/components/AdminShelters";

export const metadata = {
  title: "Shelters | Admin | DMEWS",
};

export default function AdminSheltersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Shelter management
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Add and manage evacuation shelters. Name, location, district, capacity, and optional contact and notes are stored in the database.
        </p>
      </div>
      <AdminShelters />
    </div>
  );
}
