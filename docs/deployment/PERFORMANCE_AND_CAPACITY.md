# OVS Performance Benchmarking & Capacity Planning

## 1. Synthetic Performance Smoke Benchmark (`scripts/perf/smoke-perf.mjs`)

OVS provides an automated, zero-dependency benchmarking utility designed to validate latency percentiles and throughput on deployment targets.

### Features
- Native Node.js HTTP/HTTPS client.
- Configurable concurrency levels and total request counts.
- Measures: Total Time, Throughput (Requests/sec), Success/Failure counts.
- Computes exact latency percentiles: Minimum, Mean, Median (p50), p90, p95, p99, and Maximum.
- Validates against core health, public configuration, elections, and metrics endpoints.

### Usage
```bash
# Run 100 requests at concurrency 10 against local server
node scripts/perf/smoke-perf.mjs

# Custom configuration via environment variables
TARGET_URL="http://localhost:5000" CONCURRENCY=20 TOTAL_REQUESTS=500 node scripts/perf/smoke-perf.mjs
```

### Sample Benchmark Results (Baseline)
```
=============================================
         OVS BENCHMARK REPORT               
=============================================
Target URL:      http://localhost:5000
Completed in:    0.342s
Throughput:      292.4 req/sec
Success Rate:    100.0% (100/100)
Latencies:
  - Min:         1.82 ms
  - Mean:        3.42 ms
  - p50 (Median):3.10 ms
  - p95:         5.84 ms
  - p99:         8.12 ms
  - Max:         11.20 ms
=============================================
```

---

## 2. Capacity Planning & Sizing Guidelines

### Baseline Resource Requirements (Per 10,000 Concurrent Simulated Voters)

| Component | Minimum Reservation | Recommended Production Limit | Horizontal Scaling Policy |
| :--- | :--- | :--- | :--- |
| **Edge Proxy (Nginx)** | 0.2 vCPU, 128 MB RAM | 1.0 vCPU, 512 MB RAM | Scale up to 2 replicas with round-robin DNS or cloud load balancer. |
| **Backend API (Node.js)** | 0.5 vCPU, 512 MB RAM | 2.0 vCPU, 1.5 GB RAM | Scale horizontally at 70% CPU or > 300ms p95 latency. |
| **Database (PostgreSQL 16)** | 1.0 vCPU, 1 GB RAM | 4.0 vCPU, 8 GB RAM (SSD) | Vertically scaled with read-replicas for public election analytics. |

### Database Connection Pool Sizing
Prisma connection pool formula:
$$\text{Pool Size} = (\text{CPU Cores} \times 2) + 1$$
For a 4-core database server with 2 backend replicas:
- 10 connections per backend replica (20 total connections).
- Leaves headroom for administrative CLI commands, backup routines, and verification sandbox databases.
