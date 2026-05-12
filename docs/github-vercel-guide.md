# GitHub and Vercel Guide

## 1. Create a GitHub Repository

Recommended repository name:

```text
new-ai-toktok-debate
```

Recommended settings:

- Visibility: Private for internal demo, Public only if the company approves
- Add README: off, because this project already has one
- Add .gitignore: off, because this project already has one
- License: none for now

## 2. Upload Project Files

Upload every file and folder in this workspace except files listed in `.gitignore`.

Important folders:

- `app`
- `components`
- `lib`
- `docs`

Important files:

- `README.md`
- `package.json`
- `.env.example`
- `next.config.ts`
- `tailwind.config.ts`
- `tsconfig.json`

## 3. Connect to Vercel

1. Open Vercel.
2. Click `New Project`.
3. Select the GitHub repository.
4. Keep Framework Preset as `Next.js`.
5. Add environment variables.
6. Click `Deploy`.

## 4. Vercel Environment Variables

Add these in Vercel project settings.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
ANTHROPIC_MODEL=claude-sonnet-4-20250514
GEMINI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_APP_URL=
```

After the first deployment, set `NEXT_PUBLIC_APP_URL` to the Vercel URL.

## 5. Supabase Setup

Run this file in Supabase SQL Editor:

```text
docs/supabase-schema.sql
```

## 6. First Demo Check

Open the Vercel URL and test:

1. Enter one debate agenda within 200 characters.
2. Start the 3-view debate.
3. Confirm the page shows the original user text and the AI topic summary.
4. Confirm the speakers are `사회자`, `Claude`, `GPT`, and `Gemini`.
5. Confirm the final conclusion appears with a clear recommendation and evidence sources.
6. Open the same debate URL in another browser to confirm Supabase record sharing works.
