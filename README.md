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
| `availability-service`       | 4002      | `curl http://localhost:4002/availability/riverside-clinic` |
| `appointment-audit-sidecar`  | 4003      | `curl http://localhost:4003/audit-log` |

As of Sprint 3, `appointment-service` itself runs as two replicas behind
Caddy rather than on its own host port — see below.

`appointment-audit-sidecar` is a sidecar: it tails `appointment-service`'s
request log from a shared Docker volume and has no effect on
`appointment-service` itself. Hit a couple of `appointment-service`
endpoints first, then check `GET /audit-log` on the sidecar to see them
show up there a few seconds later.

Bring the system down (and drop the shared volume) with:

```
docker compose down -v
```

## Sprint 3: load balancing and load testing

`appointment-service` now runs as two replicas (`appointment-service-a`,
`appointment-service-b`), fronted by Caddy on host port 8080. Caddy
health-checks each replica on `GET /health` and only routes to instances
that are passing.

```
curl http://localhost:8080/appointments/apt-1001
```

Each response includes `servedBy` (the replying container's hostname), so
running that curl repeatedly shows requests landing on different replicas.
Stopping one replica (`docker compose stop appointment-service-b`) leaves
the endpoint fully functional on the other.

Run the k6 load test (10 virtual users, 30s) against it:

```
BASE_URL=http://localhost:8080 k6 run load-tests/sprint-3-load.js
```

See [`results/sprint-3-load-test.md`](results/sprint-3-load-test.md) for
the latency/error-rate results and how they compare against
[`docs/SLO.md`](docs/SLO.md).
