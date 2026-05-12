# AI 3-Mind Council MVP

AI 3-Mind Council is a decision-support MVP where a user enters an important business decision, three AI personas debate it from different perspectives, and the app produces a final recommendation report.

## MVP Scope

- Decision input form
- Four-round AI debate flow
- Real Claude, GPT, and Gemini council roles
- Role-based debate and open debate modes
- Optional AI banter/inner monologue
- Final recommendation report
- PDF-ready report page
- Supabase storage for decisions, debate rounds, and final reports
- Vercel-ready Next.js structure

## Recommended First Version

- Auth: excluded for the first demo
- AI: Claude, GPT, and Gemini each provide a separate voice
- Database: Supabase PostgreSQL
- PDF: browser print/download first, server PDF later if needed

## Project Structure

```text
.
├─ app/
│  ├─ api/
│  │  └─ debate/
│  │     └─ route.ts
│  ├─ decisions/
│  │  └─ [id]/
│  │     └─ page.tsx
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/
│  ├─ DecisionForm.tsx
│  ├─ DebateTimeline.tsx
│  └─ FinalReport.tsx
├─ docs/
│  ├─ ai-prompts.md
│  ├─ development-plan.md
│  └─ supabase-schema.sql
├─ lib/
│  ├─ ai.ts
│  ├─ supabase.ts
│  └─ types.ts
├─ .env.example
└─ package.json
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
OPENAI_MODEL=
ANTHROPIC_MODEL=
GEMINI_MODEL=
NEXT_PUBLIC_APP_URL=
```

## Supabase Setup

1. Open Supabase project.
2. Go to SQL Editor.
3. Run `docs/supabase-schema.sql`.
4. Copy project URL and anon key into `.env.local`.

## Local Development

This workspace currently has Node available, but npm is not configured in the shell path. On a standard local setup:

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Deployment

1. Push this folder to GitHub.
2. Create a new Vercel project from the GitHub repository.
3. Add the environment variables in Vercel.
4. Deploy.
