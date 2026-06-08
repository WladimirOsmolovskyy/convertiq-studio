<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Who this is for

Sessions running in a feature worktree at `~/Programming/convertiq-agent-N` — i.e. *agents*. If your working directory is `~/Programming/convertiq-studio` (the main checkout), you're the **orchestrator** instead — skip the rest of this file. The orchestrator's job is to brief agents, review/merge their work, and run `stage` / `ship`.

## You're an agent

You're working in a feature worktree (e.g. `~/Programming/convertiq-agent-N`). An orchestrator (a separate Claude Code session in the main checkout) briefs you on a feature, you implement it, and you **land it yourself**. The orchestrator later reviews and merges.

## What you do

1. **Read the brief.** It tells you scope, files to read, success criteria.
2. **Plan.** Post the plan, wait for approval before writing code.
3. **Implement.** Follow the workflow rules in [CLAUDE.md](./CLAUDE.md#workflow-rules).
4. **Land it.** Run `land "<message>"` yourself (it's `git add -A && git commit`). One commit per coherent logical change — if your work has two distinct concerns, make two commits. Write the message per the rules below.
5. **Report.** Post a short summary:
   - The `land` message(s) you used.
   - **New migrations?** File number + what the schema change does.
   - **New env vars?** Names + what each is for. Confirm you added them to `.env.local.example`.
   - **Next step**: *testable locally* / *needs migration (orchestrator runs `stage`)* / *needs env vars in Vercel*.
   - Whether you're done or more is coming.

### Your land message IS the changelog

Your commit subject is read verbatim into `CHANGELOG.md` on every staging deploy, and that changelog goes to the user's manager. So the message is documentation, not a note to yourself. Rules:

- **Conventional format:** `type(scope): description` — `type ∈ {feat, fix, docs, refactor, chore}`.
- **Describe the user-facing change in plain language** — what it does, feature-level. Good: `feat(design): add image background option with upload + fit controls`. Bad: `wip`, `updates`, `fix stuff`.
- **Be faithful to the actual diff.** The changelog is generated from your message, NOT from the code — nobody re-reads the diff. So the message must accurately reflect what changed: don't undersell (omitting a real change) or oversell (claiming more than you did). If the diff does two things, that's two commits with two honest messages.
- **One line.** No multi-paragraph bodies; the subject carries it.

## What you don't do

- Don't `git push`, `stage`, `ship`, or `git merge` — orchestrator-only.
- Don't run migrations yourself. Write the SQL file; the orchestrator applies it.
- Don't checkout other branches. Stay on your assigned `agent-N` branch.
- Don't trigger deploys.

## After a sync

Your worktree may be reset to the latest `staging` between tasks (the orchestrator runs `ciq-s sync`). When that happens, a **`SYNC_NOTES.md`** appears in your worktree root listing the commits + files that just landed.

If `SYNC_NOTES.md` exists: read it first, account for those changes (especially edits to files you're working on), then delete it. Don't commit it — it's gitignored, but delete it so a stale note doesn't linger.

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
