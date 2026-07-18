# Project Description

## Domain

Our system simulates a regional hospital appointment and patient scheduling
platform. It coordinates appointment booking, provider schedules, and slot
availability across multiple healthcare facilities in a single region — for
example, a primary care clinic, a specialist's office, and an urgent care
center that share a referral network. It serves three groups directly:
patients booking, rescheduling, or canceling appointments; front-desk staff
and providers managing their day's schedule; and the network's scheduling
coordinators who need an accurate, up-to-date view of capacity across sites
so they can redirect patients when one facility is full.

## Scalability problem

A single server becomes insufficient at specific, predictable moments, not
just under generic "high traffic":

- **Slot-release spikes.** When a clinic releases next month's appointment
  slots at a fixed time (e.g. 8:00 AM on the first of the month), thousands
  of patients hit the booking endpoint within the same few minutes, racing
  for the same limited set of slots. Two patients requesting the same open
  slot within milliseconds of each other must not both succeed — the
  system needs a coordination point that can serialize conflicting writes
  to shared availability data even though requests arrive at different
  nodes.
- **Seasonal demand surges.** During flu season or a regional illness
  outbreak, appointment volume at urgent care and primary care facilities
  rises far above baseline for weeks at a time, so the system must scale
  horizontally rather than rely on a single node sized for average load.
- **Facility or node failure.** If the availability service for one
  facility goes down, the system must not silently show that facility as
  fully booked (which wrongly turns away patients) or fully open (which
  causes overbooking once it recovers) — it needs a defined degraded-mode
  behavior and a reconciliation step when the node returns.
- **Cross-facility data sharing.** A patient's cancellation at one facility
  should be able to free up a same-day slot recommendation at a nearby
  facility, which requires availability data to be shared and kept
  consistent across nodes rather than siloed per facility.

## Computing for the Common Good framing

When the system works correctly, patients get a scheduling experience that
is fast and trustworthy enough that they actually use it instead of calling
the front desk or giving up — this matters most for people who depend on
regular, timely care: older adults managing multiple chronic conditions,
patients on a fixed treatment schedule (e.g. dialysis or oncology
follow-ups), and people in the referral network's more rural service area
who have fewer nearby alternatives if a booking fails. Reliable
cross-facility availability also means the coordinators can actually
redirect patients to open capacity instead of guessing.

When the system fails or is slow, the harm is concrete: a booking request
that times out and silently fails can mean a patient believes they have an
appointment when they do not and misses a follow-up for a chronic
condition; a double-booked slot caused by a race condition means a provider
loses time reconciling two patients scheduled for the same window, and one
of those patients is turned away or delayed; and a slow slot-release rush
that locks up disproportionately favors whoever has the fastest connection
or a script, rather than serving patients fairly on a first-come basis.
