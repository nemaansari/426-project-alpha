import express from "express";
import fs from "node:fs/promises";
import path from "node:path";

const PORT = process.env.PORT || 3000;
const AUDIT_LOG_DIR = process.env.AUDIT_LOG_DIR || "/data";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 3000;

const accessLogFile = path.join(AUDIT_LOG_DIR, "access.log");
const LINE_PATTERN = /^\[AUDIT\] (\S+) action=(\S+) appointmentId=(\S+) patientId=(\S+) status=(\S+)$/;

const entries = [];
let processedLines = 0;

async function readLines(file) {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return raw.split("\n").filter((line) => line.length > 0);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function poll() {
  const lines = await readLines(accessLogFile);
  const newLines = lines.slice(processedLines);

  for (const line of newLines) {
    const match = line.match(LINE_PATTERN);
    if (!match) continue;
    const [, timestamp, action, appointmentId, patientId, status] = match;
    const entry = { timestamp, action, appointmentId, patientId, status };
    entries.push(entry);
    console.log(`[sidecar] observed action=${action} appointmentId=${appointmentId} status=${status}`);
  }

  processedLines = lines.length;
}

async function tick() {
  try {
    await poll();
  } catch (err) {
    console.error("appointment-audit-sidecar error:", err);
  }
}

const app = express();

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/audit-log", (req, res) => {
  res.json({ count: entries.length, entries });
});

app.get("/audit-log/summary", (req, res) => {
  const byAction = {};
  for (const entry of entries) {
    byAction[entry.action] = (byAction[entry.action] || 0) + 1;
  }
  res.json({ count: entries.length, byAction });
});

await tick();
setInterval(tick, POLL_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`appointment-audit-sidecar listening on ${PORT}, watching ${accessLogFile}`);
});
