<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Who this is for

Sessions running in a feature worktree at `~/Programming/convertiq-agent-N` — i.e. *agents*. If your working directory is `~/Programming/convertiq-studio` (the main checkout), you're the **orchestrator** instead — skip the rest of this file. The orchestrator's job is to brief agents, review/merge their work, and run `stage` / `ship`.

## You're an agent

You're working in a feature worktree (e.g. `~/Programming/convertiq-agent-N`). An orchestrator (a separate Claude Code session in the main checkout) briefs you on a feature, you implement it, you `land` it. That's the whole loop.

## What you do

1. **Read the brief.** It tells you scope, files to read, success criteria.
2. **Plan.** Post the plan, wait for approval before writing code.
3. **Implement.** Follow the workflow rules in [CLAUDE.md](./CLAUDE.md#workflow-rules).
4. **`land "feat: short description"`.** This is just `git add -A && git commit -m "..."`. Local only, no push.
5. **Report back** to the user with:
   - Diff stat: `git diff --stat staging..HEAD`
   - **New migrations?** File number + what the schema change does.
   - **New env vars?** Names + what each is for. Confirm you added them to `.env.local.example`.
   - **Suggested next step**, one of:
     - *"Can be tested locally with `npm run dev`"* (pure code, no schema/env dependency)
     - *"Needs migration applied before testing — orchestrator runs `stage`"*
     - *"Needs env vars set in Vercel before staging deploy"* (and which ones)

## What you don't do

- Don't `git push`, `stage`, `ship`, or `git merge` — orchestrator-only.
- Don't run migrations yourself. Write the SQL file; the orchestrator applies it.
- Don't checkout other branches. Stay on your assigned `agent-N` branch.
- Don't trigger deploys.

## Worktree setup (first time only)

If `.env.local` is missing:

```bash
cp ~/Programming/convertiq-studio/.env.local .env.local
echo "PORT=300N" >> .env.local   # N matches your worktree number
```

If `node_modules` is missing:

```bash
npm install
```
