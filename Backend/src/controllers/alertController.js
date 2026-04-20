const Alert = require("../models/Alert");

async function getAlerts(_req, res) {
  try {
    await Alert.updateMany(
      {
        expectedEndTime: { $lt: new Date() },
        status: "Active",
      },
      { status: "Expired" }
    );

    const alerts = await Alert.find().sort({ createdAt: -1 });
    return res.status(200).json(alerts);
  } catch (error) {
    console.error("getAlerts error:", error);
    return res.status(500).json({
      message: "Failed to fetch alerts.",
    });
  }
}

async function createAlert(req, res) {
  try {
    const {
      disasterType,
      severity,
      affectedArea,
      startTime,
      expectedEndTime,
      description,
      safetyInstructions,
      status,
      createdBy,
      latitude,
      longitude,
    } = req.body;

    if (
      !disasterType ||
      !severity ||
      !affectedArea ||
      !startTime ||
      !expectedEndTime ||
      !description ||
      !safetyInstructions
    ) {
      return res.status(400).json({
        message: "All required fields must be provided.",
      });
    }

    const start = new Date(startTime);
    const end = new Date(expectedEndTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        message: "Invalid date format.",
      });
    }

    if (end <= start) {
      return res.status(400).json({
        message: "Expected end time must be later than start time.",
      });
    }

    const alert = await Alert.create({
      disasterType,
      severity,
      affectedArea,
      startTime: start,
      expectedEndTime: end,
      description,
      safetyInstructions,
      status: status || "Active",
      latitude,
      longitude,
      createdBy: createdBy || "Admin",
    });

    return res.status(201).json(alert);
  } catch (error) {
    console.error("createAlert error:", error);
    return res.status(500).json({
      message: "Failed to create alert.",
    });
  }
}

async function getAlertById(req, res) {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        message: "Alert not found.",
      });
    }

    return res.status(200).json(alert);
  } catch (error) {
    console.error("getAlertById error:", error);
    return res.status(500).json({
      message: "Failed to fetch alert.",
    });
  }
}

async function updateAlert(req, res) {
  try {
    const {
      disasterType,
      severity,
      affectedArea,
      startTime,
      expectedEndTime,
      description,
      safetyInstructions,
      status,
      latitude,
      longitude,
    } = req.body;

    if (
      !disasterType ||
      !severity ||
      !affectedArea ||
      !startTime ||
      !expectedEndTime ||
      !description ||
      !safetyInstructions
    ) {
      return res.status(400).json({
        message: "All required fields must be provided.",
      });
    }

    const start = new Date(startTime);
    const end = new Date(expectedEndTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        message: "Invalid date format.",
      });
    }

    if (end <= start) {
      return res.status(400).json({
        message: "Expected end time must be later than start time.",
      });
    }

    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        disasterType,
        severity,
        affectedArea,
        startTime: start,
        expectedEndTime: end,
        description,
        safetyInstructions,
        status,
        latitude,
        longitude,
      },
      { new: true, runValidators: true }
    );

    if (!alert) {
      return res.status(404).json({
        message: "Alert not found.",
      });
    }

    return res.status(200).json(alert);
  } catch (error) {
    console.error("updateAlert error:", error);
    return res.status(500).json({
      message: "Failed to update alert.",
    });
  }
}

async function updateAlertStatus(req, res) {
  try {
    const { status } = req.body;

    if (!["Active", "Expired", "Cancelled", "Archived"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status value.",
      });
    }

    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        message: "Alert not found.",
      });
    }

    return res.status(200).json(alert);
  } catch (error) {
    console.error("updateAlertStatus error:", error);
    return res.status(500).json({
      message: "Failed to update alert status.",
    });
  }
}

async function deleteAlert(req, res) {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        message: "Alert not found.",
      });
    }

    if (alert.status !== "Cancelled") {
      return res.status(400).json({
        message: "Only cancelled alerts can be deleted.",
      });
    }

    await Alert.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      message: "Alert deleted successfully.",
    });
  } catch (error) {
    console.error("deleteAlert error:", error);
    return res.status(500).json({
      message: "Failed to delete alert.",
    });
  }
}

module.exports = {
  getAlerts,
  createAlert,
  getAlertById,
  updateAlert,
  updateAlertStatus,
  deleteAlert,
};