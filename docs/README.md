# Logistics Platform Documentation

Welcome to the central repository for the logistics platform documentation.

## Overview
This folder contains all design, architecture, API, and setup documentation for reference by developers, product managers, and system administrators.

## Proposed Structure
```
docs/
├── architecture/         # System design, data flow diagrams, database schemas
├── api/                  # API specifications (OpenAPI, GraphQL schemas, examples)
├── guides/               # Getting started guides, onboarding tutorials
├── deployment/           # Release notes, scaling guides, operations runbooks
└── README.md             # This file (hub)
```

## Documentation Guides
- [Map & Live Tracking Architecture](guides/map_and_tracking_architecture.md) — Comprehensive guide on Leaflet, OpenStreetMap, OSRM turn-by-turn routing, GPS telemetry, and the live courier simulation engine.
- [Pricing & Payments Architecture](guides/pricing_and_payments.md) — Mathematical formulas for Haversine distance, dynamic rates, and Paystack UPR engine.
- [Security Architecture](guides/security_architecture.md) — Defense-in-depth security model and Cloudflare edge rules.
- [Account Deletion & Regulatory Compliance](ACCOUNT_DELETION_AND_REGULATORY_COMPLIANCE.md) — Multi-jurisdiction GDPR / NDPR compliant anonymization lifecycle.

## Getting Started
For developers onboarding to the project:
1. Review the architecture guides in `docs/guides/`.
2. Follow the setup instructions in each subproject (`backend/`, `mobile-app/`, `admin-dashboard/`).
3. Check the API contracts in `docs/api/`.
