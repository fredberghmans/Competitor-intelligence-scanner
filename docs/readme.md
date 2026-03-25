# Competitor Intelligence Scanner

## Overview
AI-powered system to monitor competitors and generate structured insights.

## Stack
- Next.js (App Router)
- Supabase (Postgres)
- Vercel (hosting)
- OpenAI API

## Setup

1. Clone repo
2. Install dependencies:
   npm install

3. Setup environment variables:

NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=

4. Run locally:
npm run dev

## Deployment
- Deploy via Vercel
- Add environment variables

## Architecture
- Serverless functions for crawling + AI
- Diff-based processing to reduce cost

## Notes
- Public data only
- Source linking enforced
- Modular design for Azure migration

## Ownership
- Can be handed over to any engineer
- Fully documented