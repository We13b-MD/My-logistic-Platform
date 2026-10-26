const PDFDocument = require("pdfkit");
const fs = require("fs");

const doc = new PDFDocument({ size: "A4", margin: 40 });
doc.pipe(fs.createWriteStream("Backend-Mastery-Timetable.pdf"));

const C = { dark: "#1e293b", accent: "#4f46e5", light: "#eef2ff", grey: "#64748b", line: "#cbd5e1", green: "#059669" };
const W = doc.page.width - 80;

const SLOT = {
  Mon: "Mon 4-7am", Tue: "Tue 4-7am", Wed: "Wed 7-10am", Fri: "Fri 7-10am",
};

function ensure(h) {
  if (doc.y + h > doc.page.height - 50) doc.addPage();
}
function h1(t) {
  ensure(50);
  doc.moveDown(0.5).fillColor(C.accent).font("Helvetica-Bold").fontSize(18).text(t);
  doc.moveTo(40, doc.y + 2).lineTo(40 + W, doc.y + 2).strokeColor(C.accent).lineWidth(1.5).stroke();
  doc.moveDown(0.6);
}
function p(t, o = {}) {
  doc.fillColor(o.color || C.dark).font(o.bold ? "Helvetica-Bold" : "Helvetica").fontSize(o.size || 10).text(t, { width: W, ...o });
  doc.moveDown(0.3);
}
function bullet(t) {
  ensure(16);
  doc.fillColor(C.dark).font("Helvetica").fontSize(10).text("•  " + t, { width: W, indent: 8 });
}

function weekBlock(w) {
  const rowsH = w.s.map(([d, t]) => doc.heightOfString(t, { width: W - 100, fontSize: 9.5 }) + 10);
  const total = 26 + rowsH.reduce((a, b) => a + b, 0) + (w.goal ? 18 : 0) + 8;
  ensure(total);
  let y = doc.y;
  doc.rect(40, y, W, 22).fill(C.accent);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(10.5)
    .text(`Week ${w.n}  |  ${w.dates}  |  ${w.title}`, 48, y + 6, { width: W - 16 });
  y += 22;
  w.s.forEach(([d, t], i) => {
    const h = rowsH[i];
    doc.rect(40, y, W, h).fill(i % 2 ? "#fff" : C.light);
    doc.rect(40, y, W, h).strokeColor(C.line).lineWidth(0.5).stroke();
    doc.fillColor(C.accent).font("Helvetica-Bold").fontSize(9).text(SLOT[d], 46, y + 5, { width: 88 });
    doc.fillColor(C.dark).font("Helvetica").fontSize(9.5).text(t, 140, y + 5, { width: W - 100 });
    y += h;
  });
  if (w.goal) {
    doc.fillColor(C.green).font("Helvetica-BoldOblique").fontSize(9).text("Weekly goal: " + w.goal, 44, y + 4, { width: W - 8 });
    y += 18;
  }
  doc.y = y + 10;
  doc.x = 40;
}

// ---------- COVER ----------
doc.rect(0, 0, doc.page.width, 200).fill(C.dark);
doc.fillColor("#fff").font("Helvetica-Bold").fontSize(28).text("Backend Mastery Timetable", 40, 60);
doc.font("Helvetica").fontSize(13).fillColor("#c7d2fe").text("TypeScript • Node • PostgreSQL • MongoDB • React • System Design", 40, 105);
doc.fontSize(11).text("14 Oct 2026  →  29 Jan 2027   |   16 weeks   |   3 portfolio projects", 40, 135);
doc.fillColor(C.dark);
doc.y = 225; doc.x = 40;

h1("1. Weekly Schedule");
p("Mon & Tue: 4:00am - 7:00am     Wed & Fri: 7:00am - 10:00am     (12 hours per week, about 190 hours total)");
p("How each 3-hour session is used:", { bold: true });
bullet("Hour 1: Theory (concept + why it exists + how it can be asked in an interview)");
bullet("Hours 2 to 2.5: You write the code. I review and correct. I don't write it for you.");
bullet("Last 30 min: Recall. Close everything and explain what you built out loud, from memory.");
doc.moveDown(0.5);
p("Ground rules", { bold: true });
bullet("You type all the code. I point out mistakes and explain why they are mistakes.");
bullet("Every feature: ask 'What is the time complexity?' and 'What happens at 1 million users?'");
bullet("Every project ends with a README, an architecture diagram and an oral defence with me as interviewer.");
bullet("Every Friday: one Big-O/DSA exercise and one mini system design question.");
bullet("Commit to GitHub after every session. Your commit history is proof that you built it.");
bullet("Wk 11 (Christmas) is a buffer week. Use it to catch up. Missed sessions slide into it.");

h1("2. Roadmap at a Glance");
const overview = [
  ["Block 1", "Wk 1-5   | 14 Oct - 13 Nov", "TS refresher, Node, Express, REST, PostgreSQL, Prisma, auth, React basics", "Project 1: Task & Notes Manager"],
  ["Block 2", "Wk 6-11  | 16 Nov - 25 Dec", "MongoDB, transactions, security, testing, Redis, queues, payments", "Project 2: E-commerce Platform (Postgres + Mongo)"],
  ["Block 3", "Wk 12-16 | 28 Dec - 29 Jan", "System design, WebSockets, Docker, CI/CD, scaling, deployment", "Project 3: Logistics Tracking Platform (capstone)"],
];
overview.forEach(([a, b, c, d]) => {
  const hh = doc.heightOfString(c, { width: 230 }) + 14;
  ensure(hh);
  const y = doc.y;
  doc.rect(40, y, W, hh).strokeColor(C.line).stroke();
  doc.fillColor(C.accent).font("Helvetica-Bold").fontSize(10).text(a, 46, y + 6, { width: 50 });
  doc.fillColor(C.grey).font("Helvetica").fontSize(9).text(b, 98, y + 6, { width: 125 });
  doc.fillColor(C.dark).fontSize(9).text(c, 228, y + 6, { width: 170 });
  doc.fillColor(C.green).font("Helvetica-Bold").fontSize(9).text(d, 405, y + 6, { width: W - 370 });
  doc.y = y + hh; doc.x = 40;
});
doc.moveDown(0.5);

// ---------- WEEKS ----------
const weeks = [
  { n: 1, dates: "14-16 Oct", title: "TypeScript Refresher", block: 1,
    goal: "Write typed TS comfortably without looking things up.",
    s: [["Wed", "Setup: Node, VS Code, Git, GitHub, tsconfig. Types, interfaces, type vs interface, unions, narrowing, enums. Mini task: typed functions."],
        ["Fri", "Generics, utility types (Partial, Pick, Omit, Record), classes, async/await typing. Build a typed CLI todo app. Big-O intro: O(1) vs O(n)."]] },
  { n: 2, dates: "19-23 Oct", title: "HTTP, Node.js and Express", block: 1,
    goal: "A working CRUD REST API (in-memory data).",
    s: [["Mon", "How the internet works: client/server, DNS, IP, ports. HTTP methods, status codes, headers, cookies. Big-O: O(n), O(log n)."],
        ["Tue", "Node internals: event loop, call stack, promises, streams, fs, modules, env variables. Why Node is non-blocking."],
        ["Wed", "Express: routing, middleware, controllers/services structure, project layout with TS."],
        ["Fri", "REST design, Zod validation, global error middleware, custom errors. Build the CRUD API. Recall: explain a request's lifecycle."]] },
  { n: 3, dates: "26-30 Oct", title: "PostgreSQL and SQL", block: 1,
    goal: "Express API reading and writing to a real PostgreSQL database.",
    s: [["Mon", "Relational model: tables, primary/foreign keys, 1:1, 1:N, M:N. Install Postgres, pgAdmin/psql. Design the Project 1 ERD."],
        ["Tue", "SQL: SELECT, WHERE, JOINs, GROUP BY, HAVING, aggregates, subqueries. Practice 20 queries."],
        ["Wed", "Normalization, indexes (B-tree), EXPLAIN ANALYZE. Big-O of indexed vs full table scan."],
        ["Fri", "Prisma: schema, migrations, seeding, relations. Connect the API to the DB. Recall: why do indexes make reads faster and writes slower?"]] },
  { n: 4, dates: "2-6 Nov", title: "Authentication and API Quality", block: 1,
    goal: "Secure API with login, roles, pagination, plus React project setup.",
    s: [["Mon", "Password hashing (bcrypt/argon2), sessions vs JWT, access + refresh tokens, httpOnly cookies."],
        ["Tue", "Auth middleware, protected routes, basic RBAC (user/admin), register/login/logout flow."],
        ["Wed", "Pagination, filtering, sorting, search, logging (pino), Helmet, CORS, rate limiting, Swagger docs."],
        ["Fri", "React + Vite + TypeScript: components, props, state, hooks, React Router. Big-O: hash maps."]] },
  { n: 5, dates: "9-13 Nov", title: "PROJECT 1: Task & Notes Manager", block: 1,
    goal: "Project 1 deployed, documented and defended.",
    s: [["Mon", "TanStack Query for data fetching, React Hook Form + Zod, typed API client."],
        ["Tue", "Client auth flow: login page, token refresh, protected routes, error/loading states."],
        ["Wed", "Finish features: tags, search, pagination UI. Fix bugs. Deploy (Render/Railway + Vercel)."],
        ["Fri", "README + architecture diagram. ORAL DEFENCE: explain the project end to end with no notes. Block 1 review."]] },

  { n: 6, dates: "16-20 Nov", title: "MongoDB and NoSQL", block: 2,
    goal: "Know when to pick Postgres and when to pick MongoDB.",
    s: [["Mon", "NoSQL concepts, documents vs rows, BSON, Mongo shell/Compass. Install Mongo (or Atlas)."],
        ["Tue", "Mongoose: schemas, models, CRUD, validation, embedding vs referencing."],
        ["Wed", "Aggregation pipeline, indexes in Mongo, text search."],
        ["Fri", "Postgres vs Mongo trade-offs. Design Project 2: requirements, ERD (orders/users in Postgres, catalog/reviews in Mongo), API list."]] },
  { n: 7, dates: "23-27 Nov", title: "Advanced SQL: Transactions and Performance", block: 2,
    goal: "Product catalogue and cart modules working; no race conditions.",
    s: [["Mon", "Transactions, ACID, isolation levels, rollback."],
        ["Tue", "Race conditions, row locks, optimistic vs pessimistic locking. Reproduce and fix an overselling-stock bug."],
        ["Wed", "N+1 problem, connection pooling, query optimisation. Big-O: sorting and binary search."],
        ["Fri", "Build catalogue (Mongo) and cart modules. Mini system design: URL shortener."]] },
  { n: 8, dates: "30 Nov - 4 Dec", title: "Security and Testing", block: 2,
    goal: "Orders module with transactions and tests passing.",
    s: [["Mon", "OWASP Top 10: SQL injection, XSS, CSRF, IDOR, broken auth. Attack and fix your own API."],
        ["Tue", "Full RBAC (customer/seller/admin), OAuth2 Google login, secrets management."],
        ["Wed", "Testing: Vitest, Supertest, test database, mocking. Write tests for auth and cart."],
        ["Fri", "Order module using DB transactions + tests. Big-O: stacks and queues."]] },
  { n: 9, dates: "7-11 Dec", title: "Redis, Queues and Payments", block: 2,
    goal: "Cached catalogue, background emails, working payment flow.",
    s: [["Mon", "Redis: data types, TTL, cache-aside, cache invalidation. Cache the product list."],
        ["Tue", "Background jobs with BullMQ: email on order, retries, cron jobs."],
        ["Wed", "Paystack/Stripe: checkout, webhooks, idempotency, signature verification."],
        ["Fri", "File uploads (Cloudinary/S3), Swagger docs. Start admin dashboard in React."]] },
  { n: 10, dates: "14-18 Dec", title: "PROJECT 2: E-commerce Platform", block: 2,
    goal: "Project 2 live, documented and defended.",
    s: [["Mon", "Admin dashboard: product CRUD, orders table, basic charts."],
        ["Tue", "Customer storefront: product list, cart, checkout, order history."],
        ["Wed", "Integration tests, bug fixing, Docker file draft, deploy."],
        ["Fri", "README + architecture diagram. ORAL DEFENCE. Mini system design: notification system."]] },
  { n: 11, dates: "21-25 Dec", title: "Buffer Week (Christmas) and Revision", block: 2,
    goal: "Fill every gap from Blocks 1 and 2. Rest if you are on track.",
    s: [["Mon", "Revise weakest topics (list from defences). Redo missed exercises."],
        ["Tue", "DSA: trees, graphs (BFS/DFS), heaps. Solve 5 problems."],
        ["Wed", "Docker basics: images, containers, volumes, docker-compose with Postgres, Mongo, Redis."],
        ["Fri", "Optional / rest. Light review of Block 2 notes."]] },

  { n: 12, dates: "28 Dec - 1 Jan", title: "System Design Method and Project 3 Kickoff", block: 3,
    goal: "Design doc draft + project skeleton (monorepo, auth, shipments).",
    s: [["Mon", "System design framework: requirements, estimation (QPS, storage, bandwidth), API, data model, scaling, trade-offs."],
        ["Tue", "Design the Logistics Platform: components, ERD, API, state diagram for shipments."],
        ["Wed", "WebSockets and Socket.io: rooms, events, auth on sockets, scaling sockets."],
        ["Fri", "Bootstrap Project 3 (1 Jan is a holiday, optional shorter session): repo, auth, users/drivers/shipments modules."]] },
  { n: 13, dates: "4-8 Jan", title: "Real-time and Core Logistics Features", block: 3,
    goal: "Live shipment tracking working end to end.",
    s: [["Mon", "Shipment lifecycle as a state machine (created, assigned, in transit, delivered). Validation of transitions."],
        ["Tue", "Driver assignment algorithm. Big-O: priority queue/heap, nearest driver search, geo indexes."],
        ["Wed", "Real-time tracking: Socket.io + Redis pub/sub, location updates."],
        ["Fri", "Notifications through queue (email/SMS), webhooks. Mini system design: chat app."]] },
  { n: 14, dates: "11-15 Jan", title: "DevOps, Performance and Frontend", block: 3,
    goal: "Dockerised app with CI pipeline and live tracking UI.",
    s: [["Mon", "Dockerise app: multi-stage Dockerfile, docker-compose for all services."],
        ["Tue", "CI/CD with GitHub Actions: lint, test, build, deploy."],
        ["Wed", "React tracking UI: map, live updates, admin and driver views."],
        ["Fri", "Caching, rate limiting, monitoring, Sentry, health checks. Load test with autocannon/k6."]] },
  { n: 15, dates: "18-22 Jan", title: "Scaling and Deployment", block: 3,
    goal: "Capstone deployed and stable.",
    s: [["Mon", "Monolith vs modular monolith vs microservices. Load balancers, horizontal vs vertical scaling."],
        ["Tue", "CAP theorem, replication, sharding, CDN, API gateway. Apply these to the logistics design."],
        ["Wed", "Hardening: tests, error handling, security review, backups and migrations."],
        ["Fri", "Deploy: Render/Railway or VPS with Nginx, HTTPS, env management."]] },
  { n: 16, dates: "25-29 Jan", title: "PROJECT 3: Final Defence", block: 3,
    goal: "Explain your system with no material, at interview level.",
    s: [["Mon", "System design document: diagrams, trade-offs, scaling plan. Final README."],
        ["Tue", "Mock interview 1: system design (design a delivery tracking app from scratch)."],
        ["Wed", "Mock interview 2: explain your three projects cold, plus Big-O and database questions."],
        ["Fri", "Final presentation. Clean GitHub, CV, LinkedIn, portfolio site. Plan the job-hunt."]] },
];

const blockNames = { 1: "BLOCK 1  |  Foundations to Project 1", 2: "BLOCK 2  |  Databases, Security and Project 2", 3: "BLOCK 3  |  System Design and Capstone" };
let lastBlock = 0;
weeks.forEach((w) => {
  if (w.block !== lastBlock) { doc.addPage(); h1(blockNames[w.block]); lastBlock = w.block; }
  weekBlock(w);
});

// ---------- PROJECTS ----------
doc.addPage();
h1("3. The Three Projects");
const projects = [
  ["Project 1: Task & Notes Manager (end of Wk 5)", ["Register/login with JWT access + refresh tokens", "Tasks, notes, tags, search, pagination, filtering", "PostgreSQL + Prisma, Zod validation, Swagger docs", "React + TS frontend with protected routes", "You can explain: request lifecycle, auth flow, indexes, REST design"]],
  ["Project 2: E-commerce Platform (end of Wk 10)", ["Products and reviews in MongoDB; users, orders and payments in PostgreSQL", "Roles: customer, seller, admin; Google login", "Transactional checkout with no overselling", "Redis caching, BullMQ emails, Paystack/Stripe with webhooks", "Tests with Vitest/Supertest; React storefront + admin dashboard", "You can explain: transactions, race conditions, caching, queues, security"]],
  ["Project 3: Logistics Tracking Platform (end of Wk 16)", ["Customers, drivers, admins; shipment lifecycle state machine", "Driver assignment, live tracking with Socket.io + Redis pub/sub", "Queued notifications, webhooks, rate limiting, monitoring", "Docker, CI/CD, deployed live", "A written system design document with scaling plan", "You can explain: the entire architecture, trade-offs, and how it would handle 1M users"]],
];
projects.forEach(([t, items]) => {
  ensure(30 + items.length * 14);
  p(t, { bold: true, color: C.accent, size: 12 });
  items.forEach(bullet);
  doc.moveDown(0.6);
});

h1("4. Progress Checklist (tick as you finish)");
const checks = [
  "Wk 1: TS refresher done", "Wk 5: Project 1 defended", "Wk 6: Mongo basics done",
  "Wk 8: Own API hacked and fixed", "Wk 10: Project 2 defended", "Wk 12: System design doc drafted",
  "Wk 14: App Dockerised + CI", "Wk 16: Project 3 defended, mock interviews done",
];
checks.forEach((c) => bullet("[   ]  " + c));
doc.moveDown(1);
p("Rule: the day you stop understanding why, you stop typing. Ask me first.", { color: C.grey, oblique: true });

doc.end();
console.log("PDF created");
