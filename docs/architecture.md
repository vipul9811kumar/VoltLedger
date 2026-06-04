# VoltLedger — System Architecture

## 1. Platform Overview

```mermaid
graph TB
    subgraph Lenders["🏦 Lender Clients"]
        LenderPortal["Lender Portal\n(Next.js 14)\nlocalhost:3002"]
        LenderAPI["External API\n(REST / Webhooks)"]
    end

    subgraph Core["⚙️ VoltLedger Core"]
        API["Fastify API\nlocalhost:3001\n─────────────\n/v1/batteries\n/v1/passport\n/v1/origination\n/v1/fleet\n/v1/ltv · /v1/risk"]
        Scoring["Scoring Engine\n─────────────\nRisk Score\nResidual Value\nLTV\nSecond Life\nDegradation Forecast"]
    end

    subgraph Ingestion["📡 Ingestion Pipeline"]
        Queue["BullMQ Queue\n(Redis 7)"]
        Worker["Telemetry Worker\n+ Scoring Worker"]
        Loader["NDJSON Loader\n/ OEM Webhook"]
    end

    subgraph Passport["🛂 EU Battery Passport Layer"]
        Factory["Resolver Factory\nPASSPORT_RESOLVER env"]
        Mock["Mock Resolver\n✅ Live"]
        CatenaX["Catena-X Resolver\n🔧 Stub"]
        GS1["GS1 Digital Link\n🔧 Stub"]
        DirectOEM["Direct OEM API\n🔧 Stub"]
        Aggregator["3rd-Party Aggregator\n🔧 Stub"]
    end

    subgraph Data["🗄️ Data Layer"]
        PG["PostgreSQL 16\n─────────────\nbatteries\nbattery_telemetry_points\nrisk_scores · ltv\nbattery_passports\norigination_audits"]
        Redis["Redis 7\n(BullMQ)"]
    end

    subgraph External["🌐 External Systems"]
        OEM["OEM Telematics\n(MQTT / REST)"]
        EURegistry["EU Battery Registry\n(post-2027)"]
        Stripe["Stripe\n(Billing)"]
        Clerk["Clerk\n(Auth)"]
        Resend["Resend\n(Email)"]
    end

    LenderPortal -->|"x-service-token"| API
    LenderAPI -->|"x-api-key"| API

    API --> Scoring
    API --> Factory
    API --> PG

    Scoring --> PG

    Factory --> Mock
    Factory --> CatenaX
    Factory --> GS1
    Factory --> DirectOEM
    Factory --> Aggregator

    CatenaX -.->|"EDC Protocol\n(not yet)"| EURegistry
    GS1 -.->|"Digital Link\n(not yet)"| EURegistry
    DirectOEM -.->|"OEM Auth\n(not yet)"| OEM

    Loader --> Queue
    Queue --> Worker
    Worker --> Scoring
    Worker --> Redis

    OEM -->|"MQTT / Webhook"| Loader

    API --> Stripe
    LenderPortal --> Clerk
    API --> Resend

    style Mock fill:#166534,color:#bbf7d0,stroke:#166534
    style CatenaX fill:#1e3a5f,color:#93c5fd,stroke:#1e3a5f
    style GS1 fill:#1e3a5f,color:#93c5fd,stroke:#1e3a5f
    style DirectOEM fill:#1e3a5f,color:#93c5fd,stroke:#1e3a5f
    style Aggregator fill:#1e3a5f,color:#93c5fd,stroke:#1e3a5f
    style PG fill:#1e1b4b,color:#c4b5fd,stroke:#1e1b4b
    style Redis fill:#450a0a,color:#fca5a5,stroke:#450a0a
```

---

## 2. EU Battery Passport — Data Flow

```mermaid
sequenceDiagram
    actor Lender
    participant Dashboard as Lender Portal
    participant API as Fastify API
    participant Factory as Resolver Factory
    participant Resolver as Active Resolver<br/>(Mock / Catena-X / GS1 / OEM)
    participant Scoring as Scoring Engine
    participant DB as PostgreSQL

    Note over Lender,DB: Loan Origination Flow with Passport Verification

    Lender->>Dashboard: Search battery serial
    Dashboard->>API: GET /v1/batteries/:serial/detail
    API->>DB: Fetch battery + latest scores
    DB-->>API: Battery record
    API-->>Dashboard: Battery profile

    Dashboard->>API: GET /v1/passport/battery/:serial
    API->>DB: Check for existing passport
    alt No passport on record
        DB-->>API: null
        API-->>Dashboard: hasPassport: false
        Dashboard-->>Lender: "No EU Passport — pre-regulation asset"
    else Passport exists
        DB-->>API: BatteryPassport record
        API-->>Dashboard: Public + Restricted fields
        Dashboard-->>Lender: Passport panel (tiered)
    end

    Lender->>Dashboard: Resolve passport
    Dashboard->>API: POST /v1/passport/resolve
    API->>Factory: resolvePassport(serial)
    Factory->>Resolver: resolve(identifier)
    Resolver-->>Factory: RawPassportData + tierAccess
    Factory-->>API: PassportResolveResult
    API->>DB: Upsert BatteryPassport
    API-->>Dashboard: passportId + tierAccess

    Lender->>Dashboard: Verify identity
    Dashboard->>API: POST /v1/passport/verify/:batteryId
    API->>DB: Run identity chain checks<br/>(serial ↔ VIN ↔ model ↔ pack)
    DB-->>API: Checks complete
    API->>DB: Upsert PassportVerification<br/>Set isVerified = true
    API-->>Dashboard: identityChainValid + confidenceScore

    Lender->>Dashboard: Score battery
    Dashboard->>API: POST /v1/batteries/:serial/score
    API->>DB: Fetch telemetry + passport
    API->>Scoring: runIntelligenceEngine(telemetry, passportContext)

    Note over Scoring: reconcileSoH()<br/>Verified: 65% passport / 35% telemetry<br/>Unverified: 45% / 55%<br/>Passport only / Telemetry only

    Scoring->>Scoring: computePassportAdjustment()<br/>±30pt from status/temp/discrepancy
    Scoring-->>API: RiskScoreResult<br/>sohSource: BLENDED | TELEMETRY | PASSPORT
    API->>DB: Persist RiskScore with passport fields
    API-->>Dashboard: Score + sohSource badge

    Lender->>Dashboard: Approve loan
    Dashboard->>API: POST /v1/origination/attest
    API->>DB: Freeze evidence snapshot<br/>(battery state + passport fields + scores)
    DB-->>API: OriginationAudit created
    API-->>Dashboard: attestationText + auditId
    Dashboard-->>Lender: Compliance attestation
```

---

## 3. Scoring Engine — SoH Reconciliation

```mermaid
flowchart TD
    T[Telemetry SoH] --> R{reconcileSoH}
    P[Passport SoH\nRestricted tier] --> R

    R --> S1["Source: NONE\nValue: 85% fallback\nConfidence: 0.1"]
    R --> S2["Source: TELEMETRY\nValue: telemetry SoH\nConfidence: 0.7"]
    R --> S3["Source: PASSPORT\nConfidence: 0.8 verified\n0.6 unverified"]
    R --> S4["Source: BLENDED\nVerified: 65% passport + 35% telemetry\nUnverified: 45% + 55%\nConfidence: 0.92 / 0.78"]

    S4 --> Delta{"|Δ| > 8pp?"}
    Delta -->|Yes — fraud signal| LowConf["Confidence reduced\nFlag raised"]
    Delta -->|No| Adj

    S1 --> Adj[computePassportAdjustment]
    S2 --> Adj
    S3 --> Adj

    LowConf --> Adj

    Adj --> Bonus["+3 identity verified\n+1 passport present"]
    Adj --> Penalty["-15 FAULTY status\n-5 DEGRADED status\n-8 lifetime temp > 65°C\n-12 large SoH discrepancy"]

    Bonus --> Final["Final Composite Score\n0 – 1000\nGrade A – F"]
    Penalty --> Final
```

---

## 4. Access Tier Model

```mermaid
flowchart LR
    subgraph Public["🟢 PUBLIC TIER\nAnyone with QR code"]
        P1["Carbon footprint\nkg CO₂e / kWh"]
        P2["Intensity class\nA – G"]
        P3["Material composition\nLi · Co · Ni · Mn %"]
        P4["Recycled content %"]
        P5["Performance specs\nCapacity · Energy density · Cycles"]
        P6["EoL guidance"]
    end

    subgraph Restricted["🟣 RESTRICTED TIER\nLegitimate-interest parties\n(EU Reg 2023/1542 Art. 13)"]
        R1["Unit SoH %\n← underwriting signal"]
        R2["Charge cycle count"]
        R3["Lifetime temp history\nMin · Max · Avg"]
        R4["Battery status\nGOOD · DEGRADED · FAULTY"]
        R5["Negative events\nFaults · Thermal · Deep discharge"]
        R6["Current SoC %"]
    end

    subgraph Confidential["🔴 CONFIDENTIAL TIER\nNotified bodies + regulators only"]
        C1["Test reports"]
        C2["Conformity documents"]
        C3["Detailed cell-level data"]
    end

    VoltLedger["VoltLedger\n(as lender agent)"] -->|"Auto-resolved\nfor all batteries"| Public
    VoltLedger -->|"Requires legitimate-\ninterest authorization\n← Phase 0 decision"| Restricted
    VoltLedger -->|"Out of scope"| Confidential

    style Public fill:#14532d,color:#bbf7d0,stroke:#14532d
    style Restricted fill:#3b0764,color:#e9d5ff,stroke:#3b0764
    style Confidential fill:#450a0a,color:#fecaca,stroke:#450a0a
```

---

## 5. Monorepo Layout

```mermaid
graph LR
    subgraph Apps
        A1["apps/api\nFastify REST API\n:3001"]
        A2["apps/dashboard\nNext.js 14\n:3002"]
        A3["apps/ingestion\nBullMQ workers"]
    end

    subgraph Packages
        P1["packages/db\nPrisma schema\nmigrations · client"]
        P2["packages/scoring\nRisk · RV · LTV\nSecond Life · Passport"]
        P3["packages/types\nShared TypeScript types\nPassportContext · ReconciledSoH"]
    end

    subgraph Tools
        T1["tools/synthetic-generator\n--passports flag\npassport_stream.ndjson"]
        T2["tools/bulk-score\n--serial · --all"]
        T3["tools/generate-key\nAPI key CLI"]
    end

    subgraph Passport["apps/api/src/lib/passport"]
        R1["mock.resolver.ts ✅"]
        R2["catena-x.resolver.ts 🔧"]
        R3["gs1.resolver.ts 🔧"]
        R4["direct-oem.resolver.ts 🔧"]
        R5["aggregator.resolver.ts 🔧"]
        R6["factory.ts\nauto-detect + env override"]
    end

    A1 --> P1
    A1 --> P2
    A1 --> P3
    A2 --> P3
    A3 --> P1
    A3 --> P2
    T1 --> P1
    T2 --> P1
    T2 --> P2
    A1 --> Passport
```
