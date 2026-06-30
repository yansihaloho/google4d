import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./src/backend/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.NODE_ENV === "production" ? 3000 : 3001;

app.use(cors());
app.use(express.json());

// ─── API Endpoints ──────────────────────────────────────────────────────────

// GET /api/toto/latest
app.get("/api/toto/latest", (req, res) => {
  try {
    const latest = db.getTotoLatest();
    res.json(latest);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/toto/months
app.get("/api/toto/months", (req, res) => {
  try {
    const months = db.getTotoMonths();
    res.json(months);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/toto/schedule
app.get("/api/toto/schedule", (req, res) => {
  try {
    const drawTimes = ["00:01", "13:00", "16:00", "19:00", "22:00", "23:00"];
    res.json({ drawTimes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/toto/nomor-taruhan
app.get("/api/toto/nomor-taruhan", (req, res) => {
  try {
    res.json(db.getNomorTaruhan());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/toto/nomor-taruhan
app.put("/api/toto/nomor-taruhan", (req, res) => {
  try {
    const { numbers } = req.body as { numbers: string[] };
    res.json(db.updateNomorTaruhan(numbers || []));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/toto/refresh
app.post("/api/toto/refresh", async (req, res) => {
  try {
    const count = await db.syncWithLiveWebsite();
    res.json({ success: true, message: `Toto Macau data refreshed successfully. Synchronized ${count} records.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/toto/sync-status
app.get("/api/toto/sync-status", (req, res) => {
  try {
    res.json(db.getSyncStatus());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/toto/verify
app.get("/api/toto/verify", (req, res) => {
  try {
    const report = db.verifyAndRepairData(false);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/toto/repair
app.post("/api/toto/repair", (req, res) => {
  try {
    const report = db.verifyAndRepairData(true);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/predictions
app.get("/api/predictions", (req, res) => {
  try {
    res.json(db.getPredictions());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/predictions
app.post("/api/predictions", (req, res) => {
  try {
    const prediction = db.savePrediction(req.body);
    res.status(201).json(prediction);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/predictions/:id
app.delete("/api/predictions/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid prediction ID" });
      return;
    }
    db.deletePrediction(id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Automated Scheduler ───────────────────────────────────────────────────

// Periodically check if there are newly passed WIB draw times and trigger a state refresh
setInterval(() => {
  try {
    db.refreshTotoData();
  } catch (err) {
    console.error("Failed to run scheduled auto-refresh check:", err);
  }
}, 60 * 1000); // Check once per minute

// ─── Serving Frontend Static Assets ──────────────────────────────────────────

// Serve compiled react production bundles
app.use(express.static(path.join(__dirname, "dist")));

// Fallback to react routing for SPA
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
  } else {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  }
});

// ─── Server Start ────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`====================================================`);
  console.log(` Macau Toto Prediction server started on port ${PORT}`);
  console.log(` Serving full-stack API and frontend SPA!`);
  console.log(`====================================================`);
});
