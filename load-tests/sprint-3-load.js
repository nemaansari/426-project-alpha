import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

// A handful of seeded appointment ids, not just one, so the run produces a
// realistic mix of cache hits and misses instead of settling at 0% or 100%.
const APPOINTMENT_IDS = ["apt-1001", "apt-1002", "apt-1003"];

export const options = {
  vus: 10,
  duration: "30s",
};

export default function () {
  const id = APPOINTMENT_IDS[Math.floor(Math.random() * APPOINTMENT_IDS.length)];
  const res = http.get(`${BASE_URL}/appointments/${id}`);
  check(res, {
    "status is 200": (r) => r.status === 200,
  });
  sleep(1);
}
