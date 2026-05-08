# Runbook: Backend Rollback

**Use when**: Health check fails, smoke tests fail, error spike in CloudWatch after deploy.

**Decision time**: If health check fails within 5 minutes of deploy — roll back immediately. Do not debug in production.

---

## Option A: Trigger GitHub Actions Rollback (preferred)

```bash
# Trigger rollback workflow with previous SHA
gh workflow run deploy-backend-rollback.yml \
  -f target_sha=$(git rev-parse HEAD~1)
```

Wait for workflow to complete, then verify:
```bash
bash scripts/smoke-test.sh $BACKEND_URL
```

---

## Option B: Manual ECS Task Rollback

```bash
# Find previous task definition revision
aws ecs describe-task-definition --task-definition mymap-backend \
  --query 'taskDefinition.revision'
# Note current revision N. Previous = N-1.

# Roll back to N-1
aws ecs update-service \
  --cluster mymap-cluster \
  --service mymap-backend-service \
  --task-definition mymap-backend:<N-1>

# Wait for stable
aws ecs wait services-stable --cluster mymap-cluster --services mymap-backend-service

# Verify
bash scripts/smoke-test.sh $BACKEND_URL
```

---

## After Rollback

1. Create GitHub issue: `fix(backend): rollback v<N> — <reason>`
2. Add to issue: what failed, error from CloudWatch, reproduction steps
3. Do NOT re-deploy same SHA — fix first, then re-deploy
4. Update traceability matrix: mark release as rolled back

---

## What Not To Do

- Do not debug the broken version in production — rollback first, then investigate
- Do not skip smoke tests after rollback
- Do not delete the broken ECR image — keep for post-mortem
