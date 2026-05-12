# AI Talk Talk

AI Talk Talk is a private 3-view logic debate service. A user writes one natural-language agenda, then Claude, GPT, and Gemini discuss it from optimistic, skeptical, and balanced viewpoints. The service ends with a practical decision, reasons, risks, action direction, and evidence sources when relevant.

## Current Product Direction

- Product name: `AI Talk Talk`
- Debate style: expert meeting, not casual chat
- Input: one agenda field, up to 200 characters
- Participants: Claude, GPT, Gemini
- Moderator: separate agenda interpretation and meeting flow
- Login: fixed internal accounts only, no public signup
- Archive: separated by login ID

## Important Name Policy

The visible product name is `AI Talk Talk`.

The existing technical slug `new-ai-toktok-debate` is intentionally kept for GitHub, Vercel, local folder paths, and some storage/cache identifiers so existing deployment links and saved records do not break.

See `docs/handoff/10-project-naming-ai-talk-talk.md` for the handoff note.

## Environment Variables

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
APP_LOGIN_USERS=
AUTH_SECRET=
OPENAI_MODEL=
ANTHROPIC_MODEL=
GEMINI_MODEL=
NEXT_PUBLIC_APP_URL=
```

## Login Policy

- No public signup.
- Only accounts listed in `APP_LOGIN_USERS` can log in.
- Each account sees only its own debate archive.
- If the same ID logs in on a new device, the older device is signed out after the Supabase session table is created.
- Changing a password means editing `APP_LOGIN_USERS` in Vercel and redeploying.

Example format:

```text
APP_LOGIN_USERS=user1:password1:Name One,user2:password2:Name Two,user3:password3:Name Three
```

## Supabase Setup

1. Open the Supabase project.
2. Go to SQL Editor.
3. Run `docs/supabase-schema.sql`.
4. For an existing database, run `docs/supabase-v0.5.0-owner-session.sql` once to add account-owned archives and session locking.
5. Copy the project URL and publishable/anon key into Vercel environment variables.

## Local Development

```bash
npm install
npm run dev -- -p 3010
```

Then open:

```text
http://localhost:3010/
```

## Verification

```bash
npx tsc --noEmit
npm run build
```

## Deployment

This project is connected to GitHub and Vercel.

- GitHub repository: `https://github.com/uniconsultingbang-sketch/new-ai-toktok-debate.git`
- Vercel production URL: `https://new-ai-toktok-debate.vercel.app/`

When a new version is ready, push `main` and the version tag, then confirm the Vercel production deployment is ready.
