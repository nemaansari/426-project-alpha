import express from "express";

const PORT = process.env.PORT || 3000;
const QUERY_LATENCY_MS = Number(process.env.QUERY_LATENCY_MS) || 200;

const facilities = new Map([
  [
    "riverside-clinic",
    {
      facilityId: "riverside-clinic",
      department: "Primary Care",
      slots: [
        { time: "2026-07-28T13:00:00.000Z", providerId: "prov-118", status: "open" },
        { time: "2026-07-28T13:30:00.000Z", providerId: "prov-118", status: "booked" },
        { time: "2026-07-28T14:00:00.000Z", providerId: "prov-118", status: "open" },
        { time: "2026-07-29T09:00:00.000Z", providerId: "prov-142", status: "open" },
      ],
    },
  ],
  [
    "westside-medical-center",
    {
      facilityId: "westside-medical-center",
      department: "Cardiology",
      slots: [
        { time: "2026-07-29T15:00:00.000Z", providerId: "prov-204", status: "booked" },
        { time: "2026-07-29T15:30:00.000Z", providerId: "prov-204", status: "open" },
        { time: "2026-07-30T10:00:00.000Z", providerId: "prov-204", status: "open" },
      ],
    },
  ],
  [
    "downtown-urgent-care",
    {
      facilityId: "downtown-urgent-care",
      department: "Urgent Care",
      slots: [
        { time: "2026-07-27T18:00:00.000Z", providerId: "prov-311", status: "open" },
        { time: "2026-07-27T18:15:00.000Z", providerId: "prov-311", status: "open" },
        { time: "2026-07-27T18:30:00.000Z", providerId: "prov-311", status: "open" },
      ],
    },
  ],
]);

function simulateLatency(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextAvailable(slots) {
  const open = slots.find((slot) => slot.status === "open");
  return open ? open.time : null;
}

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Simulates the round-trip to the facility's own slot-tracking system.
app.get("/availability/:facilityId", async (req, res) => {
  await simulateLatency(QUERY_LATENCY_MS);

  const facility = facilities.get(req.params.facilityId);
  if (!facility) {
    return res.status(404).json({ error: `unknown facilityId: ${req.params.facilityId}` });
  }

  res.json({
    facilityId: facility.facilityId,
    department: facility.department,
    openCount: facility.slots.filter((slot) => slot.status === "open").length,
    nextAvailable: nextAvailable(facility.slots),
    slots: facility.slots,
  });
});

app.post("/availability/:facilityId/reserve", async (req, res) => {
  await simulateLatency(QUERY_LATENCY_MS);

  const facility = facilities.get(req.params.facilityId);
  if (!facility) {
    return res.status(404).json({ error: `unknown facilityId: ${req.params.facilityId}` });
  }

  const { time } = req.body;
  const slot = facility.slots.find((s) => s.time === time);
  if (!slot) {
    return res.status(404).json({ error: `unknown slot time: ${time}` });
  }
  if (slot.status !== "open") {
    return res.status(409).json({ error: `slot already ${slot.status}`, slot });
  }

  slot.status = "booked";
  res.json({ facilityId: facility.facilityId, slot });
});

app.listen(PORT, () => {
  console.log(`availability-service listening on ${PORT}`);
});
