# Service Level Objectives

## appointment-service

- **Latency SLO:** `POST /appointments` (create, reschedule, or cancel)
  must respond within **400 ms at p95** under normal load, and within
  **800 ms at p95** during flu-season peak windows. This is the request a
  patient is actively waiting on in the booking UI before they either
  confirm or abandon the flow, and a provider's front desk is waiting on
  it to check a walk-in against the schedule.
- **Reliability SLO:** The create/cancel endpoints must succeed at least
  **99.9%** of the time and must be idempotent under retry — a repeated
  request carrying the same idempotency key must not create a duplicate
  appointment or double-cancel an existing one. A failed lookup is just
  annoying to retry; a duplicate booking silently wastes a slot another
  patient could have used, and a duplicate cancellation can release a slot
  that is actually still occupied.

## availability-service

- **Latency SLO:** `GET /availability/{facility}` must respond within
  **300 ms at p95**. It is queried on every scheduling attempt, so a slow
  slot lookup here directly delays every booking flow built on top of it.
- **Reliability SLO:** Slot query and update endpoints must succeed at
  least **99.5%** of the time, and slot decrement/release operations must
  be **at-most-once**: applying the same "slot freed" event twice must not
  free capacity that is already booked. Over-counting available slots here
  causes real-world overbooking, not just a stale read.

## scheduling-gateway

- **Latency SLO:** An end-to-end patient request routed through the
  gateway (including its calls to availability-service and
  appointment-service) must complete within **600 ms at p95**. This is the
  total wait time the patient actually experiences, regardless of which
  backend service is slow.
- **Reliability SLO:** The gateway must maintain at least a **99.9%**
  success rate for routed requests, and must forward requests in a
  retry-safe (idempotent) way — a network blip between the gateway and
  appointment-service must never result in the same booking being applied
  twice on retry.

## prescription-service
- **Latency SLO:** Endpoint `GET /prescription/{patient}` must respond within **300 ms at p95**. The user of this endpoint would be patients who have used **appointment-service** and are retreiving doctor's notes from those appointments. Many patients would be accessing this endpoint hence exceeding threshold would result in delay to all the patients accessing the service
- **Reliability SLO:** The **prescription-service** endpoint must succeed **at least 99.9%** of the time. A failed lookup means a retry, which is time consuming and annoying, especially for patients

## prescribe-service
- **Latency SLO:** Endpoint `POST /prescribe/{patient}` must respond within **500 ms at p95**. The user of this endpoint are doctors, providers, facility who are trying to list prescription and instruction to appropriate patients. Exceeding this endpoint result in a delay in their realtime appointment, and can consequentially affect their appointment schedule and time

- **Reliability SLO:** **prescribe-service** endpoint must succeeed **at least 99.9%** of the time. Failing to perform a query request also means realtime delay for provider and can consequentially affect their appointment availability and schedule. Additionally, if queries were to be duplicated, it would result in a data integrity problem.