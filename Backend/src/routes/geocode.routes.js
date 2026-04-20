const express = require("express");
const router = express.Router();

router.get("/suggest", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query || query.length < 3) {
      return res.json({ suggestions: [] });
    }

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=5&countrycodes=lk`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "DMEWS-Project", // REQUIRED by Nominatim
      },
    });

    const data = await response.json();

    const suggestions = Array.isArray(data)
      ? data.map((item, index) => ({
          id: index,
          name: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        }))
      : [];

    res.json({ suggestions });
  } catch (error) {
    console.error("Geocode error:", error);
    res.status(500).json({ message: "Failed to fetch location suggestions." });
  }
});

module.exports = router;