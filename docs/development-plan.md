# Development Plan

## Phase 1: Development Starter

Status: completed in this workspace.

- Create Next.js file structure
- Create Supabase SQL schema
- Create environment variable example
- Create AI prompt guide
- Create MVP README

## Phase 2: Working Local MVP

Goal: make the app run locally.

- Install dependencies
- Run development server
- Verify input form
- Verify debate API route
- Verify final report page
- Add real Supabase insert/select

## Phase 3: AI Integration

Goal: connect real AI output.

- Add OpenAI API key
- Add Anthropic API key
- Add Google AI API key
- Add role-based debate mode
- Add open debate mode
- Add banter level control
- Improve JSON response validation
- Add error handling for malformed AI responses
- Tune prompts with three sample decisions

## Phase 4: Supabase Persistence

Goal: save and reload decisions.

- Insert decision row
- Insert four debate rounds
- Insert final report
- Add history page
- Add decision detail page data loading

## Phase 5: Demo Polish

Goal: representative-ready demo.

- Keep only two required inputs: title and decision question
- Treat background, options, risks, and focus areas as optional context
- Improve empty/loading/error states
- Add sample decision presets
- Add PDF print styling
- Add Vercel deployment guide

## Phase 6: Deployment

Goal: shareable public URL.

- Push to GitHub
- Connect Vercel
- Add environment variables
- Deploy
- Test public URL
