import http from 'k6/http';
import { check, sleep } from 'k6';

// -----------------------------------------------------------------------------
// k6 Load Test Configuration: 1,000 Concurrent Virtual Users (VUs)
// -----------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp up to 100 Virtual Users
    { duration: '1m',  target: 500 },  // Ramp up to 500 Virtual Users
    { duration: '2m',  target: 1000 }, // Sustain 1,000 Concurrent Users
    { duration: '30s', target: 0 },    // Ramp down gracefully to 0
  ],
  thresholds: {
    // 95% of requests must complete under 2000ms under 1,000 VU concurrency
    http_req_duration: ['p(95)<2000'],
    // HTTP error rate must remain under 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

export default function () {
  // 1. Authenticate / Login User
  const loginPayload = JSON.stringify({
    email: 'dispatcher@swift.com',
    password: 'password123',
  });

  const loginParams = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, loginParams);

  const loginSuccess = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'has token': (r) => r.json('data.token') !== undefined,
  });

  if (!loginSuccess) {
    sleep(1);
    return;
  }

  const token = loginRes.json('data.token');
  const authHeaders = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  sleep(1);

  // 2. Request Delivery Fare Quote (Calculation Engine Load)
  const quotePayload = JSON.stringify({
    pickupLatitude: 6.5244,
    pickupLongitude: 3.3792,
    dropoffLatitude: 6.6018,
    dropoffLongitude: 3.3515,
    vehicleType: 'BIKE',
  });

  const quoteRes = http.post(`${BASE_URL}/pricing/estimate`, quotePayload, authHeaders);

  check(quoteRes, {
    'estimate status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });

  sleep(1);

  // 3. Create Delivery Order (Database Insert Load)
  const orderPayload = JSON.stringify({
    pickupAddress: 'Ikeja City Mall, Ikeja, Lagos',
    pickupLatitude: 6.6018,
    pickupLongitude: 3.3515,
    senderPhone: '+2348012345678',
    dropoffAddress: 'Victoria Island, Lagos',
    dropoffLatitude: 6.4281,
    dropoffLongitude: 3.4219,
    recipientName: 'k6 Test Recipient',
    recipientPhone: '+2348098765432',
    recipientEmail: 'recipient@test.com',
  });

  const orderRes = http.post(`${BASE_URL}/deliveries`, orderPayload, authHeaders);

  check(orderRes, {
    'delivery created status is 201 or 200': (r) => r.status === 201 || r.status === 200,
  });

  sleep(1);

  // 4. Fetch Deliveries List (Read Query Load)
  const listRes = http.get(`${BASE_URL}/deliveries`, authHeaders);

  check(listRes, {
    'deliveries list status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
