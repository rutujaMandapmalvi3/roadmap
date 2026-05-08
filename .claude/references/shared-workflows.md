# Shared Workflows — myMap Backend

> Rules that apply to all work on this service.

---

## Branch Naming

```
type/task-NNN-short-description
```

| Type | When |
|------|------|
| `feature/` | New functionality |
| `fix/` | Bug fix |
| `refactor/` | Code change with no behavior change |
| `chore/` | Tooling, deps, config |
| `docs/` | Documentation only |
| `security/` | Security fix (fast-track review) |

Examples:
- `fix/task-042-ownership-check-conversations`
- `feature/task-055-pagination-get-conversations`
- `security/sec-001-remove-pii-logging`

Always branch from `develop`. Never from `main`.

---

## Commit Format (Conventional Commits — enforced)

```
type(scope): short description

[optional body — why, not what]

[optional footer — Closes #NNN, BREAKING CHANGE: ...]
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `security`
**Scope**: `backend`, `frontend`, `infra`, `ci`, `auth`, `chat`, `conversations`

Examples:
```
fix(auth): add ownership check to GET /conversations/:id

Any authenticated user could read any conversation by guessing MongoDB IDs.
Closes #038

fix(chat): remove console.log of req.body

Logged PII (topic, goal, followUpMessage) to stdout in production.
Closes #039

feat(conversations): add pagination to GET /conversations

Returns page, limit, totalPages, hasMore in response.
Closes #041
```

**BREAKING CHANGE footer** → triggers major semver bump in release pipeline.

---

## PR Rules

### Size
- Max 400 LOC changed per PR
- Larger changes → split into stacked PRs (base PR first, then feature PR on top)

### Required before opening PR
- [ ] Branch up to date with `develop`
- [ ] `npm test` passes locally
- [ ] Lint clean
- [ ] No `console.log(req.body)` or debug code
- [ ] Changelog entry under [Unreleased]
- [ ] Issue linked: `Closes #NNN`

### Required approvals
- 1 approval: small scope (single file, <50 LOC)
- 2 approvals: medium/large scope, or any change to:
  - `middleware/auth.js`
  - `routes/` (security-sensitive)
  - `index.js` (rate limiting, CORS)
  - `.github/workflows/`
  - Any env var changes

### Merge strategy
- Squash merge only (linear history on `develop`)
- Delete branch after merge

### Status checks (all must pass)
- CI: lint
- CI: unit tests
- CI: integration tests (if applicable)
- Security scan: no CRITICAL/HIGH findings
- Coverage: ≥90% line, ≥85% branch

---

## Versioning (Semantic Versioning)

Driven by commit types since last release:
- `fix/docs/refactor/test/chore` → patch bump (1.0.0 → 1.0.1)
- `feat` → minor bump (1.0.0 → 1.1.0)
- `BREAKING CHANGE` footer → major bump (1.0.0 → 2.0.0)

Manual approval required before major version bump deploys.

---

## CODEOWNERS

| Path | Required reviewers |
|------|--------------------|
| `middleware/auth.js` | Security-sensitive — 2 approvals |
| `.github/workflows/` | CI/CD changes — 2 approvals |
| `terraform/` | Infra — 2 approvals |
| `models/` | Schema changes — 1 approval + migration verified |
