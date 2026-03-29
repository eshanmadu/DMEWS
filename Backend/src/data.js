const MOCK_ALERTS = [
  {
    id: "alt-1",
    type: "flood",
    severity: "warning",
    title: "Heavy rainfall and flood advisory",
    description:
      "Heavy rainfall expected in the next 48 hours. Low-lying areas may experience flooding. Stay updated and avoid unnecessary travel.",
    area: "Central Province, Western Division",
    lat: 7.0,
    lng: 80.5,
    issuedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 46 * 60 * 60 * 1000).toISOString(),
    source: "Meteorology Department",
  },
  {
    id: "alt-2",
    type: "cyclone",
    severity: "watch",
    title: "Cyclone watch – coastal areas",
    description:
      "A developing system may affect coastal regions. Monitor official updates and prepare emergency kits.",
    area: "Northern and Eastern coastal zones",
    lat: 9.5,
    lng: 80.0,
    issuedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    source: "Disaster Management Centre",
  },
];

const MOCK_INCIDENTS = [
  {
    id: "inc-1",
    type: "landslide",
    title: "Landslide on A9 – traffic diverted",
    description:
      "Minor landslide reported on A9 highway. Clearance in progress. Use alternate route.",
    status: "responding",
    area: "Kandy District, A9 km 42",
    lat: 7.3,
    lng: 80.6,
    reportedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    affectedPeople: 0,
  },
  {
    id: "inc-2",
    type: "flood",
    title: "Localized flooding – evacuation support",
    description:
      "Flooding in low-lying wards. Relief camps opened. Medical and supplies en route.",
    status: "assessing",
    area: "Colombo suburbs",
    lat: 6.9,
    lng: 79.9,
    reportedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    affectedPeople: 120,
  },
];

module.exports = {
  MOCK_ALERTS,
  MOCK_INCIDENTS,
};
