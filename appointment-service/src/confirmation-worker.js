import express from "express";
import amqplib from "amqplib";

const PORT = process.env.PORT || 3000;
const RABBIT_URL = process.env.RABBIT_URL || "amqp://localhost";
const QUEUE_NAME = "appointment-confirmations";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function consumeConfirmations() {
  const connection = await amqplib.connect(RABBIT_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.prefetch(1);

  console.log(`confirmation-worker waiting for jobs on ${QUEUE_NAME}`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;
    const job = JSON.parse(msg.content.toString());
    console.log(`[WORKER] picked up confirmation job: appointmentId=${job.appointmentId} patientId=${job.patientId}`);

    // Simulates the time it takes to actually send an email/SMS confirmation.
    await delay(300);

    console.log(`[WORKER] sent confirmation: appointmentId=${job.appointmentId} facility=${job.facility}`);
    channel.ack(msg);
  });
}

consumeConfirmations().catch((err) => {
  console.error("confirmation-worker error:", err);
  process.exit(1);
});

// A small health endpoint alongside the consumer loop, same as every other
// service in this system, so docker compose ps can report this one healthy.
const app = express();
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
app.listen(PORT, () => {
  console.log(`confirmation-worker health endpoint listening on ${PORT}`);
});
