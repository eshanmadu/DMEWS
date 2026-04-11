const express = require("express");
const cors = require("cors");

const alertRoutes = require("./routes/alert.routes");
const incidentsRoutes = require("./routes/incidents.routes");
const healthRoutes = require("./routes/health.routes");
const weatherRoutes = require("./routes/weather.routes");
const publicForecastRoutes = require("./routes/publicForecast.routes");
const riskLevelsRoutes = require("./routes/riskLevels.routes");
const sheltersRoutes = require("./routes/shelters.routes");
const authRoutes = require("./routes/auth.routes");
const volunteersRoutes = require("./routes/volunteers.routes");
const sosRoutes = require("./routes/sos.routes");
const missionsRoutes = require("./routes/missions.routes");
const missingPersonsRoutes = require("./routes/missingPersons.routes");
const riskPredictionsRoutes = require("./routes/riskPredictions.routes");
const adminUsersRoutes = require("./routes/adminUsers.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/alerts", alertRoutes);
app.use("/incidents", incidentsRoutes);
app.use("/health", healthRoutes);
app.use("/weather", weatherRoutes);
app.use("/", publicForecastRoutes);
app.use("/risk-levels", riskLevelsRoutes);
app.use("/shelters", sheltersRoutes);
app.use("/auth", authRoutes);
app.use("/volunteers", volunteersRoutes);
app.use("/sos", sosRoutes);
app.use("/missions", missionsRoutes);
app.use("/missing-persons", missingPersonsRoutes);
app.use("/risk-predictions", riskPredictionsRoutes);
app.use("/admin/users", adminUsersRoutes);

module.exports = app;

