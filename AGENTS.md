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
4. **Decide whether to land — yourself. Never ask.** You make the call based on whether you actually changed code:
   - **Land** when you made a real, code-level change worth recording (a feature, fix, refactor, migration, etc.). One commit per coherent change — two distinct concerns → two commits.
   - **Do NOT land** when there was no net code change: you only chatted/answered questions, only read files, or you reverted/discarded work you never committed. Just reply normally with no `land`.
5. **Report.** Short summary: new migrations (number + what), new env vars (names + purpose, confirm added to `.env.local.example`), next step (*testable locally* / *needs migration* / *needs env vars in Vercel*), and whether you're done or more is coming.

### MUST: end with the exact `land` command

When you land, the **final line of your reply is the literal `land` command(s) you ran** — verbatim, exactly as typed, nothing after it. The user copies/relies on that line. Example ending:

```
land "feat(logic): add operator dropdown to branch conditions"
```

If you made two commits, the last two lines are the two `land` commands. If you did **not** land (trivial / no code change), there is no `land` line at all — and you still never ask whether to land.

### Your land message IS the changelog

Your commit subject is read **verbatim** into `CHANGELOG.md` on every staging deploy, and that changelog goes to the user's manager. Nobody re-reads the diff — the message is the only record. So it must be self-contained documentation, written so a non-engineer knows what changed without opening the code.

**Fixed structure — every line reads the same shape:**

```
type(scope): <imperative verb> <what changed in plain terms>
```

- `type ∈ {feat, fix, refactor, docs, chore}`
- `scope` = the product area, so entries can be grouped later: `design`, `result`, `integrations`, `leads`, `audiences`, `tools`, `settings`, `infra`
- Start with a verb (add / wire / fix / replace / remove / rename). Describe the **user-facing effect**, not the implementation.
- **Length:** aim ≤ 70 characters, one line, lowercase after the colon, no trailing period.
- One closely-related sub-part may follow with ` + ` (at most one): `feat(design): add image background + object-fit controls`.

**How to split — one commit = one thing a reader would name:**

- Split by user-facing **capability**, not by file or technical step.
- If you'd need "and" to join two *unrelated* things → that's two commits.
- A feature and its own migration = **one** commit (one capability). A feature plus an unrelated drive-by fix = **two**.
- A pure internal refactor (no user-facing change) gets its own terse `refactor(scope):` commit so it's clearly not a feature.

**Examples**

Good:
- `feat(integrations): add GoHighLevel OAuth connect + field mapping`
- `fix(leads): keep search filter when switching audience tabs`
- `refactor(result): consolidate inspector into one sectioned component`

Too big — split it:
- ✗ `feat: add background remover and fix lead search and tweak sidebar`
- ✓ `feat(tools): add background remover with brush refinement`
- ✓ `fix(leads): restore search after audience switch`
- ✓ `refactor(design): make left sidebar resizable`

**Be faithful to the diff.** Don't undersell (omitting a real change) or oversell (claiming more than you did). If you can't describe the commit in one ≤70-char line, it's doing too much — split it.

## What you don't do

- Don't `git push`, `stage`, `ship`, or `git merge` — orchestrator-only.
- Don't run migrations yourself. Write the SQL file; the orchestrator applies it.
- Don't checkout other branches. Stay on your assigned `agent-N` branch.
- Don't trigger deploys.

## After a sync

Your worktree may be reset to the latest `staging` between tasks (the orchestrator runs `ciq-s sync`). When that happens, a **`SYNC_NOTES.md`** appears in your worktree root.

**It lists OTHER agents' work, not yours.** Those commits were made by other sessions and merged into staging so your worktree stays current. Read them only to stay compatible with files you touch — then delete the file. **Never count anything in `SYNC_NOTES.md` as your own work**, and never repeat it in a handoff or status summary.

## Writing a handoff

When your context fills and the user asks for a handoff to the next session on your topic, summarize **only your own work** — never the synced-in changes from other agents.

Include:
1. **What you did this session** — drawn from *this conversation's* actions, not from git or `SYNC_NOTES.md`. This is the authoritative record of your work.
2. **Open threads on your topic** — what's half-done, decisions pending, next steps.
3. *(Optional continuity)* Prior shipped work on your **same topic/scope**, via:
   ```bash
   git log --pretty='- %s' | grep -E '\((design|brand)\)'   # ← use YOUR scope(s)
   ```
   Label this clearly as "previously shipped on this topic," distinct from what you did this session.

Exclude anything outside your scope (other agents' result-page, logic, integrations, etc. work) even though it now exists in your worktree. If you're unsure what your scope is, it's stated in your brief — ask rather than guess.

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
