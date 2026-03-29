export type DisasterType =
  | "earthquake"
  | "flood"
  | "cyclone"
  | "tsunami"
  | "landslide"
  | "wildfire"
  | "drought"
  | "other";

export type AlertSeverity = "critical" | "warning" | "watch" | "info";

export interface Alert {
  id: string;
  type: DisasterType;
  severity: AlertSeverity;
  title: string;
  description: string;
  area: string;
  lat?: number;
  lng?: number;
  issuedAt: string;
  expiresAt?: string;
  source?: string;
}

export interface Incident {
  id: string;
  type: DisasterType;
  title: string;
  description: string;
  status: "reported" | "assessing" | "responding" | "resolved";
  area: string;
  lat?: number;
  lng?: number;
  reportedAt: string;
  updatedAt: string;
  affectedPeople?: number;
  casualties?: number;
}

export interface Resource {
  id: string;
  name: string;
  type: "personnel" | "equipment" | "shelter" | "medical" | "supplies";
  quantity: number;
  unit: string;
  location: string;
  status: "available" | "deployed" | "reserved";
}
