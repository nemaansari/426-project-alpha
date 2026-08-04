import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createClient } from "redis";

const PORT = process.env.PORT || 3000;
const AUDIT_LOG_DIR = process.env.AUDIT_LOG_DIR || "./data";
const BOOKING_LATENCY_MS = Number(process.env.BOOKING_LATENCY_MS) || 250;
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 20;

const auditLogFile = path.join(AUDIT_LOG_DIR, "access.log");

const redis = createClient({ url: REDIS_URL });
redis.on("error", (err) => console.error(`[CACHE] redis error: ${err.message}`));
await redis.connect();

// Two Redis namespaces, not one. `data` is the permanent shared record every
// replica reads and writes, so a create or cancel on one replica is visible
// on the other. `cache` is the short-TTL copy the read handler checks
// first, and is what produces the hit/miss behavior.
const dataKey = (appointmentId) => `appointment:data:${appointmentId}`;
const cacheKey = (appointmentId) => `appointment:cache:${appointmentId}`;
const IDS_KEY = "appointment:ids";
const NEXT_ID_KEY = "appointment:next_id";

const FACILITIES = ["riverside-clinic", "westside-medical-center", "downtown-urgent-care"];
const DEPARTMENTS = ["Primary Care", "Cardiology", "Pediatrics", "Orthopedics"];

// Seed data only. The real, live record for each appointment lives in
// Redis under dataKey() from here on.
const SEED_APPOINTMENTS = [
  {
    appointmentId: "apt-1001",
    patientId: "pat-2044",
    providerId: "prov-118",
    facility: "riverside-clinic",
    department: "Primary Care",
    timeSlot: "2026-07-28T13:30:00.000Z",
    status: "confirmed",
    reason: "Annual physical",
  },
  {
    appointmentId: "apt-1002",
    patientId: "pat-2091",
    providerId: "prov-204",
    facility: "westside-medical-center",
    department: "Cardiology",
    timeSlot: "2026-07-29T15:00:00.000Z",
    status: "confirmed",
    reason: "Follow-up on blood pressure medication",
  },
  {
    appointmentId: "apt-1003",
    patientId: "pat-2153",
    providerId: "prov-118",
    facility: "riverside-clinic",
    department: "Primary Care",
    timeSlot: "2026-07-30T09:00:00.000Z",
    status: "cancelled",
    reason: "Sore throat, possible strep",
  },
];

// Every replica runs this on boot; SET NX and SADD are both safe to repeat,
// so whichever replica starts first seeds the data and the rest are no-ops.
async function seedAppointments() {
  for (const appointment of SEED_APPOINTMENTS) {
    await redis.set(dataKey(appointment.appointmentId), JSON.stringify(appointment), { NX: true });
    await redis.sAdd(IDS_KEY, appointment.appointmentId);
  }
  await redis.set(NEXT_ID_KEY, "1003", { NX: true });
}

async function getAppointment(appointmentId) {
  const raw = await redis.get(dataKey(appointmentId));
  return raw ? JSON.parse(raw) : null;
}

function simulateLatency(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recordAudit({ action, appointmentId, patientId, status }) {
  const line = `[AUDIT] ${new Date().toISOString()} action=${action} appointmentId=${appointmentId || "-"} patientId=${patientId || "-"} status=${status || "-"}\n`;
  await fs.mkdir(AUDIT_LOG_DIR, { recursive: true });
  await fs.appendFile(auditLogFile, line);
}

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/appointments", async (req, res) => {
  const ids = await redis.sMembers(IDS_KEY);
  const records = ids.length ? await redis.mGet(ids.map(dataKey)) : [];
  const list = records.filter(Boolean).map((raw) => JSON.parse(raw));
  await recordAudit({ action: "list" });
  res.json({ count: list.length, appointments: list });
});

// Cache hit: skip the simulated DB round-trip and answer immediately.
// Cache miss: simulate the round-trip, then read the shared record and cache it.
app.get("/appointments/:id", async (req, res) => {
  const key = cacheKey(req.params.id);
  const cached = await redis.get(key);

  if (cached) {
    console.log(`[CACHE HIT] appointmentId=${req.params.id}`);
    const appointment = JSON.parse(cached);
    await recordAudit({
      action: "read",
      appointmentId: appointment.appointmentId,
      patientId: appointment.patientId,
      status: appointment.status,
    });
    return res.json({ ...appointment, servedBy: os.hostname(), cache: "HIT" });
  }

  console.log(`[CACHE MISS] appointmentId=${req.params.id}`);
  await simulateLatency(BOOKING_LATENCY_MS);
  const appointment = await getAppointment(req.params.id);
  if (!appointment) {
    await recordAudit({ action: "read", appointmentId: req.params.id, status: "not_found" });
    return res.status(404).json({ error: `unknown appointmentId: ${req.params.id}` });
  }
  await redis.set(key, JSON.stringify(appointment), { EX: CACHE_TTL_SECONDS });
  await recordAudit({
    action: "read",
    appointmentId: appointment.appointmentId,
    patientId: appointment.patientId,
    status: appointment.status,
  });
  res.json({ ...appointment, servedBy: os.hostname(), cache: "MISS" });
});

app.post("/appointments", async (req, res) => {
  const { patientId, providerId, facility, department, timeSlot, reason } = req.body;

  if (!FACILITIES.includes(facility)) {
    return res.status(400).json({ error: `unknown facility: ${facility}` });
  }

  await simulateLatency(BOOKING_LATENCY_MS);

  // INCR is atomic in Redis, so concurrent creates on both replicas can
  // never be handed the same id.
  const appointmentId = `apt-${await redis.incr(NEXT_ID_KEY)}`;
  const appointment = {
    appointmentId,
    patientId,
    providerId,
    facility,
    department: department || DEPARTMENTS[0],
    timeSlot,
    status: "confirmed",
    reason,
  };
  await redis.set(dataKey(appointmentId), JSON.stringify(appointment));
  await redis.sAdd(IDS_KEY, appointmentId);

  await recordAudit({
    action: "create",
    appointmentId,
    patientId,
    status: appointment.status,
  });

  res.status(201).json(appointment);
});

app.post("/appointments/:id/cancel", async (req, res) => {
  await simulateLatency(BOOKING_LATENCY_MS);

  const appointment = await getAppointment(req.params.id);
  if (!appointment) {
    return res.status(404).json({ error: `unknown appointmentId: ${req.params.id}` });
  }

  appointment.status = "cancelled";
  // Update the shared record, not just this replica's local map, and drop
  // the cache entry rather than writing through it — the next miss (on
  // either replica) now reads the correct shared record, so it can't
  // repopulate the cache with stale data the way a per-replica map could.
  await redis.set(dataKey(appointment.appointmentId), JSON.stringify(appointment));
  await redis.del(cacheKey(appointment.appointmentId));

  await recordAudit({
    action: "cancel",
    appointmentId: appointment.appointmentId,
    patientId: appointment.patientId,
    status: appointment.status,
  });

  res.json(appointment);
});

await seedAppointments();
app.listen(PORT, () => {
  console.log(`appointment-service listening on ${PORT}`);
});
