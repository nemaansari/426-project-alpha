# Initial Service List

This is a first guess at the services our simulation will include (team size
2, so 3 custom services). This list will change as we learn more patterns in
later weeks - Sprint 2 begins with 2 of these, and Sprint 4 adds at least one
more.

- **appointment-service**: Handles creation, rescheduling, and cancellation
  of individual patient appointments, and enforces conflict checks against
  the requested provider and time slot.
- **availability-service**: Maintains the current set of open, booked, and
  blocked time slots per provider and facility, and processes updates when
  slots are reserved, released, or blocked by staff.
- **scheduling-gateway**: The shared entry point that receives patient
  scheduling requests, routes them to the appropriate facility's
  availability-service, and reconciles the outcome with
  appointment-service before responding.
- **prescription-service**: Manages prescription for each personal patient. Accepts query requests from provider/facility
- **prescribe-service**: Routes query requests for prescription (create, update, delete) from provider/facility to appropriate patients