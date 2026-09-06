# k6 Load Testing Suite (1,000 Concurrent Virtual Users)

This suite uses **Grafana k6** to stress-test the logistics platform backend under heavy concurrency (1,000 simultaneous users).

---

## 1. Test Scenarios Simulated

The load test simulates full end-to-end user traffic:
1. **User Authentication (`POST /api/v1/auth/login`)**: 1,000 concurrent virtual users logging in and acquiring JWT tokens.
2. **Pricing Quote Generation (`POST /api/v1/pricing/quote`)**: High-throughput fare calculation using pickup/dropoff coordinates and vehicle multipliers.
3. **Delivery Order Placement (`POST /api/v1/deliveries`)**: Concurrent database writes creating delivery shipments.
4. **Read Queries (`GET /api/v1/deliveries`)**: High-concurrency reads fetching active orders.

---

## 2. Ramping Schedule (1,000 Users)

| Duration | Target Virtual Users (VUs) | Phase |
| :--- | :--- | :--- |
| **0s – 30s** | 0 $\rightarrow$ 100 VUs | Warm-up Ramp |
| **30s – 1m30s** | 100 $\rightarrow$ 500 VUs | Moderate Load Ramp |
| **1m30s – 3m30s** | **1,000 VUs** | Peak Stress Load (Sustained 2 Mins) |
| **3m30s – 4m00s** | 1,000 $\rightarrow$ 0 VUs | Graceful Ramp-down |

---

## 3. Performance Thresholds (Pass/Fail Criteria)

* **Latency Threshold**: 95% of all HTTP requests must finish in **< 500ms** (`http_req_duration: p(95)<500`).
* **Error Rate Threshold**: HTTP error failures must remain below **1%** (`http_req_failed: rate<0.01`).

---

## 4. How to Run the Load Test

### Local Execution (Default: `http://localhost:5000/api/v1`)
Run this command from your terminal:
```bash
k6 run infrastructure/k6/load_test_1000_users.js
```

### Staging / Production Execution
To point the test against a remote staging server:
```bash
k6 run -e BASE_URL=https://api.yourdomain.com/api/v1 infrastructure/k6/load_test_1000_users.js
```
