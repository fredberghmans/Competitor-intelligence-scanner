# Competitor Intelligence Scanner

## 1. Objective

Build an AI-powered system that continuously monitors competitors and transforms publicly available data into structured, actionable intelligence for product and strategy teams.

The system should reduce manual research, provide executive-level insights, and enable faster, data-driven decision making.

---

## 2. Scope

### In Scope
- Crawling public competitor websites
- Aggregating external public sources (news, blogs, press releases)
- Structuring data into predefined criteria
- Detecting changes over time
- Generating insights and summaries using AI
- Providing comparison views across competitors
- Exporting results (PDF)

### Out of Scope (v1)
- Real-time monitoring
- Internal data integration
- Private or paywalled data sources
- Social media scraping (optional future)

---

## 3. Core Features

### 3.1 Competitor Management (CRUD)

Users can:
- Add, edit, delete competitors

Each competitor includes:
- Name
- Type (crypto exchange, bank, hybrid)
- Region
- Domains (multiple URLs)

---

### 3.2 Criteria Management (CRUD)

Users can:
- Create and manage evaluation criteria

Criteria structure:
- Category → Subcriteria

Example:
- Trading
  - Spot
  - Fees
  - Derivatives

---

### 3.3 Data Collection Layer

#### A. Website Crawling
The system crawls:
- Product pages
- Pricing pages
- Legal pages
- FAQ sections
- Blog / news sections

Data stored:
- Raw HTML
- Cleaned text
- Metadata (URL, timestamp)

#### B. External Data Sources
- News (RSS / APIs)
- Press releases
- Blog aggregations

---

### 3.4 Change Detection (Critical)

The system must:
- Store previous snapshots of pages
- Compute differences between scans

Techniques:
- Page-level hashing
- Section-level diffing

Behavior:
- Only changed content is sent to AI processing

---

### 3.5 AI Processing Pipeline

#### Cheap Models (classification layer)
Used for:
- Content classification into criteria
- Tagging and categorization
- Change relevance detection

#### Advanced Models (insight layer)
Used for:
- Executive summaries
- Strategic insights
- Recommendations

---

### 3.6 Output & Insights Layer

#### A. Executive Overview (per competitor)
- TL;DR summary
- Key strengths and weaknesses
- Recent changes (last scan)
- Strategic positioning

---

#### B. Drill-down View
- Per competitor → per criteria
- Structured values
- Source-linked data
- Confidence scoring:
  - High (explicit)
  - Medium (inferred)
  - Low (external)

---

#### C. Comparison View

Table format:
- Columns = competitors
- Rows = criteria

Purpose:
- Enable side-by-side evaluation

---

#### D. Change Log / Timeline
- Track historical changes
- Show feature launches, pricing updates, messaging shifts

---

#### E. Decision Engine (Key Feature)

System benchmarks competitors against a reference (e.g. "us")

Example output:
- "You are behind Kraken in staking yield by 1.2%"
- "Competitor X offers 3 additional custody options"

---

#### F. Strategic Recommendations

AI-generated:
- Suggested product moves
- Competitive gaps to close
- Opportunities to differentiate

---

### 3.7 Export

- Export to PDF:
  - Executive summary
  - Comparison tables
  - Key insights

---

## 4. Non-Functional Requirements

- Only public data may be processed
- All outputs must include source traceability
- System must minimize hallucinations
- Cost-efficient (diff-based processing)
- Modular architecture
- Designed for portability (future Azure migration)

---

## 5. Architecture Overview

### Frontend
- Next.js (App Router)
- Dashboard UI
- Comparison interface
- Admin panels

### Backend (Serverless)
- Crawling service
- Diff engine
- AI processing pipeline

### Storage
- Supabase (Postgres)

---

## 6. Data Flow

1. Crawl competitor pages
2. Store snapshots
3. Detect changes
4. Process changed content via AI
5. Map results to criteria
6. Generate summaries and insights
7. Store structured outputs
8. Display in UI

---

## 7. Cost Optimization Strategy

- Diff-based processing (skip unchanged pages)
- Chunk-level processing
- Cache previous AI outputs
- Use model tiering (cheap vs advanced)
- Limit crawl depth
- Batch processing

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Hallucinated outputs | Source linking + confidence scoring |
| High API costs | Diff-based + caching |
| Data noise | Criteria structuring |
| Overcomplexity | Modular architecture |
| Vendor dependency | Azure portability |

---

## 9. Future Enhancements

- Alerts / notifications (feature changes, pricing updates)
- Slack / Notion integration
- Embeddings + semantic search
- Internal annotations
- Automated competitor scoring model
- API access for internal tools

---

## 10. Positioning

This system is not just a dashboard.

It is a **decision engine** that transforms raw competitor data into:
- structured intelligence
- strategic insights
- actionable recommendations

Its goal is to become a core asset for product and strategy teams.