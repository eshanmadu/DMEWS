const express = require("express");
const router = express.Router();
const Alert = require("../models/Alert");

function getDisasterTypeKey(type = "") {
  const value = String(type).trim().toLowerCase();

  if (value.includes("flood")) return "flood";
  if (value.includes("landslide")) return "landslide";
  if (value.includes("fire") || value.includes("wildfire")) return "wildfire";
  if (value.includes("storm")) return "storm";
  if (value.includes("cyclone")) return "cyclone";
  if (value.includes("tsunami")) return "tsunami";
  if (value.includes("drought")) return "drought";
  if (value.includes("heat")) return "heatwave";
  if (value.includes("earthquake")) return "earthquake";
  if (value.includes("volcan")) return "volcanic";

  return "default";
}

function randomBetween(min, max, decimals = 1) {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

function buildSensorData(typeKey) {
  switch (typeKey) {
    case "flood":
      return {
        currentValue: randomBetween(3.2, 5.8),
        dangerThreshold: 4.0,
        maxValue: 6.5,
        primaryValue: randomBetween(90, 210),
        secondaryValue: randomBetween(240, 420),
        trend: "Rising",
        status: "Active",
        sourceName: "River Flood Detector",
      };

    case "landslide":
      return {
        currentValue: randomBetween(60, 92),
        dangerThreshold: 75,
        maxValue: 100,
        primaryValue: randomBetween(70, 96),
        secondaryValue: randomBetween(4, 18),
        trend: "Unstable",
        status: "Active",
        sourceName: "Slope Stability Detector",
      };

    case "wildfire":
      return {
        currentValue: randomBetween(55, 95),
        dangerThreshold: 70,
        maxValue: 100,
        primaryValue: randomBetween(34, 48),
        secondaryValue: randomBetween(40, 88),
        trend: "Spreading",
        status: "Active",
        sourceName: "Fire Watch Sensor",
      };

    case "storm":
      return {
        currentValue: randomBetween(45, 92),
        dangerThreshold: 70,
        maxValue: 100,
        primaryValue: randomBetween(50, 120),
        secondaryValue: randomBetween(40, 170),
        trend: "Strengthening",
        status: "Active",
        sourceName: "Weather Storm Sensor",
      };

    case "cyclone":
      return {
        currentValue: randomBetween(55, 96),
        dangerThreshold: 72,
        maxValue: 100,
        primaryValue: randomBetween(90, 180),
        secondaryValue: randomBetween(950, 990),
        trend: "Intensifying",
        status: "Active",
        sourceName: "Cyclone Tracking Sensor",
      };

    case "tsunami":
      return {
        currentValue: randomBetween(50, 95),
        dangerThreshold: 75,
        maxValue: 100,
        primaryValue: randomBetween(1.2, 5.8),
        secondaryValue: randomBetween(120, 780),
        trend: "Critical",
        status: "Active",
        sourceName: "Coastal Sea-Level Detector",
      };

    case "drought":
      return {
        currentValue: randomBetween(55, 94),
        dangerThreshold: 70,
        maxValue: 100,
        primaryValue: randomBetween(32, 40),
        secondaryValue: randomBetween(18, 58),
        trend: "Worsening",
        status: "Active",
        sourceName: "Climate Stress Monitor",
      };

    case "heatwave":
      return {
        currentValue: randomBetween(58, 97),
        dangerThreshold: 72,
        maxValue: 100,
        primaryValue: randomBetween(35, 44),
        secondaryValue: randomBetween(55, 88),
        trend: "High Heat",
        status: "Active",
        sourceName: "Heat Stress Sensor",
      };

    case "earthquake":
      return {
        currentValue: randomBetween(35, 82),
        dangerThreshold: 60,
        maxValue: 100,
        primaryValue: randomBetween(25, 75),
        secondaryValue: randomBetween(10, 120),
        trend: "Aftershock Risk",
        status: "Monitoring",
        sourceName: "Seismic Monitor",
      };

    case "volcanic":
      return {
        currentValue: randomBetween(48, 94),
        dangerThreshold: 68,
        maxValue: 100,
        primaryValue: randomBetween(22, 80),
        secondaryValue: randomBetween(20, 150),
        trend: "Elevated",
        status: "Active",
        sourceName: "Volcanic Activity Monitor",
      };

    default:
      return {
        currentValue: randomBetween(40, 85),
        dangerThreshold: 65,
        maxValue: 100,
        primaryValue: randomBetween(20, 80),
        secondaryValue: randomBetween(20, 80),
        trend: "Monitoring",
        status: "Active",
        sourceName: "Hazard Monitoring Sensor",
      };
  }
}

router.get("/by-alert/:id", async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: "Alert not found." });
    }

    const typeKey = getDisasterTypeKey(alert.disasterType || alert.type || "");
    const sensorData = buildSensorData(typeKey);

    res.json(sensorData);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sensor data." });
  }
});

module.exports = router;