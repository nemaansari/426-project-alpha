# Team Alpha

## Roster

| Name          | GitHub Username  | UMass Email         |
|---------------|------------------|---------------------|
| Nema Ansari   | nemaansari       | nansari@umass.edu   |
| Nguyen Nguyen | jeffeagle        | nguyenn@umass.edu   |

# Domain description
Our system simulates a regional hospital appointment and patient scheduling platform that coordinates appointments, providers, and clinic availability across multiple healthcare facilities. A single server becomes insufficient during periods of high demand, such as flu season or when appointment slots are released, because thousands of patients may try to book, cancel, or update appointments simultaneously. Building a scalable system helps ensure that scheduling remains responsive and reliable even under heavy load. This project supports the principles of Computing for the Common Good by improving access to healthcare for patients in our local community, particularly older adults and people with chronic conditions who depend on timely appointments. When the system performs well, patients receive care more efficiently; when it is slow or unavailable, delayed appointments and scheduling errors can negatively affect health outcomes.

## Sprint 1 documents

- [Project description](docs/PROJECT.md)
- [Initial service list](docs/SERVICES.md)
- [Service level objectives](docs/SLO.md)

## Sprint 2: running the system

Sprint 2 adds the first two containerized services plus a sidecar. See the
[Sprint 2 system diagram](docs/SERVICES.md#sprint-2-system-diagram) in
`docs/SERVICES.md` for how they connect.

Start everything with Docker Compose from the repository root:

```
docker compose up --build
```

This builds and starts three containers:

| Service                     | Host port | Try it |
|------------------------------|-----------|--------|
| `appointment-service`        | 4001      | `curl http://localhost:4001/appointments/apt-1001` |
| `availability-service`       | 4002      | `curl http://localhost:4002/availability/riverside-clinic` |
| `appointment-audit-sidecar`  | 4003      | `curl http://localhost:4003/audit-log` |

`appointment-audit-sidecar` is a sidecar: it tails `appointment-service`'s
request log from a shared Docker volume and has no effect on
`appointment-service` itself. Hit a couple of `appointment-service`
endpoints first, then check `GET /audit-log` on the sidecar to see them
show up there a few seconds later.

Bring the system down (and drop the shared volume) with:

```
docker compose down -v
```
