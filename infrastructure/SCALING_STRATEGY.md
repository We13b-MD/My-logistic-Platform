# Infrastructure Scaling Strategy & Database Evolution

> **Document Scope**: Platform Scaling Roadmap, Storage Architectural Trade-offs, and System Evolution (Startup $\rightarrow$ Delivery Hero Scale)

---

## 1. Executive Summary

This document outlines the **database evolution and infrastructure scaling strategy** for the logistics and dispatch platform. It explains the transition from the current PostgreSQL setup to hyper-scale architectures (ClickHouse / Cassandra / Kafka) required at enterprise scale ($100,000+$ active drivers, millions of daily orders).

---

## 2. Platform Growth Stages & Architecture Evolution

```mermaid
graph LR
    subgraph Phase 1: Current Architecture
        P1_App[Node.js / Express API] --> P1_DB[(PostgreSQL + Prisma)]
        P1_App --> P1_WS[Socket.io Realtime]
    end

    subgraph Phase 2: Growth Stage (10k - 100k Orders/Day)
        P2_App[Stateless API Cluster] --> P2_DB[(PostgreSQL - Core Transactions)]
        P2_App --> P2_Redis[(Redis Cluster - GeoSpatial & Locks)]
        P2_App --> P2_S3[S3 Cold Storage Archive]
    end

    subgraph Phase 3: Delivery Hero / Hyper-Scale (100k+ Orders/Day)
        P3_App[Microservices & Ingestion] --> P3_Kafka[[Kafka Event Stream]]
        P3_Kafka --> P3_Redis[(Redis - Live State)]
        P3_Kafka --> P3_ClickHouse[(ClickHouse - Analytics)]
        P3_Kafka --> P3_Cassandra[(Cassandra - Append-only GPS)]
        P3_App --> P3_DB[(PostgreSQL - Billing & Core DB)]
    end

    Phase 1 --> Phase 2 --> Phase 3
```

---

## 3. Database Technology Roles Breakdown

| Database Engine | Primary Role in Platform | When to Introduce | Key Advantage |
| :--- | :--- | :--- | :--- |
| **PostgreSQL (PostGIS)** | Core Transactions, Orders, Tenant Profiles, Billing | **Phase 1 (Current)** | ACID Compliance, Relational Integrity, Easy Querying |
| **Redis Cluster** | Ephemeral Driver Location, Distributed Locking (`SETNX`), Active Cache | **Phase 2** | Sub-millisecond Latency, In-Memory Spatial Search (`GEOSEARCH`) |
| **Apache Cassandra** | Continuous High-Throughput GPS Ingestion ($20\text{k}+$ writes/sec) | **Phase 3 (Enterprise)** | Masterless Architecture, Infinite Horizontal Write Scale |
| **ClickHouse** | Historical GPS Breadcrumbs, Route Analytics, Heatmaps, Audit Logs | **Phase 3 (Enterprise)** | Columnar Store, Query Billions of GPS Rows in Milliseconds |

---

## 4. Detailed Component Analysis

### A. Phase 1: Current Setup (PostgreSQL + Prisma)
* **How it works**: Driver emits GPS via Socket.io $\rightarrow$ Express backend saves directly to PostgreSQL (`LocationBreadcrumb` table via Prisma).
* **Capacity**: Supports **up to ~10,000 deliveries per day**.
* **Pros**: Simple operational overhead, zero complex infrastructure costs.
* **Bottleneck at Scale**: High-frequency GPS updates ($>1,000\text{ writes/sec}$) cause disk I/O lock contention on primary transactional tables.

---

### B. Phase 2: Growth Scale (10,000 – 100,000 Deliveries / Day)
* **Architectural Change**: Decouple real-time driver locations from transactional database.
* **Implementation**:
  1. Live driver location updates are stored **only in Redis** using `GEOADD`.
  2. PostgreSQL stores permanent order milestones (`PENDING`, `PICKED_UP`, `DELIVERED`).
  3. Historical `LocationBreadcrumb` rows older than 30 days are automatically archived to low-cost Object Storage (AWS S3 / Google Cloud Storage).

---

### C. Phase 3: Hyper-Scale / Delivery Hero Tier (100,000+ Active Drivers)
* **Architectural Change**: Event-Driven Stream Ingestion via Apache Kafka + Columnar/NoSQL Time-Series DB.
* **Implementation**:
  1. **Ingestion Layer**: Drivers push GPS pings to a lightweight WebSocket Gateway cluster.
  2. **Streaming Pipeline**: Pings are published to an Apache Kafka topic `driver-location-stream`.
  3. **Dual-Write Consumers**:
     - **Cassandra / ClickHouse Consumer**: Batch-writes GPS coordinates into ClickHouse/Cassandra asynchronously (e.g., 5,000 pings per bulk write).
     - **Redis Consumer**: Updates current spatial index (`drivers:locations:<tenant_id>`).
  4. **PostgreSQL Role**: Retained strictly for ACID financial records, subscription status, invoice line items, and tenant configurations.

---

## 5. Decision Matrix: When to Migrate Storage Engine

```mermaid
decisionDiagram
    node1["Is PostgreSQL Disk I/O Utilization > 75%?"]
    node1 -->|Yes| node2["Move Live GPS Caching to Redis Cluster"]
    node1 -->|No| node3["Maintain PostgreSQL + Prisma Setup"]
    node2 --> node4["Are GPS Ingestion Writes > 10,000 / sec?"]
    node4 -->|Yes| node5["Deploy Kafka + ClickHouse / Cassandra Pipeline"]
    node4 -->|No| node6["Maintain Redis + PostgreSQL Architecture"]
```

---

## 6. Summary Checklist for System Design & Engineering

1. **Rule of Separation**: Never mix ultra-high frequency telemetry (GPS pings every 3s) with core financial/billing tables in the same relational database at scale.
2. **Write Scaling**: Use **Cassandra / ClickHouse** for append-only logs (breadcrumbs), **Redis** for state caching, and **PostgreSQL** for business logic & financial accounting.
3. **Cost Efficiency**: Scale infrastructure progressively as order volume demands—avoid over-engineering in early phases while maintaining a decoupled architecture ready for Kafka/ClickHouse integration.
