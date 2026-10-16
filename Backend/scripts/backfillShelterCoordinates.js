require("dotenv").config();
const citiesData = require("../data/cities.json");
const { connectDb } = require("../src/db");
const { Shelter } = require("../src/models/Shelter");

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function run() {
  await connectDb();
  const cities = Array.isArray(citiesData?.cities) ? citiesData.cities : [];
  const cityMap = new Map(
    cities
      .filter((city) => Number.isFinite(Number(city.latitude)) && Number.isFinite(Number(city.longitude)))
      .map((city) => [normalize(city.name_en), city])
  );

  const shelters = await Shelter.find({}).exec();
  let updated = 0;
  let skipped = 0;

  for (const shelter of shelters) {
    if (Number.isFinite(shelter.latitude) && Number.isFinite(shelter.longitude)) {
      skipped += 1;
      continue;
    }

    const city = cityMap.get(normalize(shelter.city));
    if (!city) {
      console.warn(`No city coordinates found for shelter "${shelter.name}" (city: "${shelter.city || ""}")`);
      continue;
    }

    shelter.latitude = Number(city.latitude);
    shelter.longitude = Number(city.longitude);
    await shelter.save({ validateBeforeSave: false });
    updated += 1;
  }

  console.log(`Shelter coordinate backfill complete. Updated: ${updated}; already set: ${skipped}.`);
  await Shelter.db.close();
}

run().catch(async (error) => {
  console.error("Shelter coordinate backfill failed", error);
  try {
    await Shelter.db.close();
  } catch {}
  process.exitCode = 1;
});