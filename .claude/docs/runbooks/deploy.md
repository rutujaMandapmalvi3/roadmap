# Runbook: Backend Deploy

**Trigger**: Merge to `main` with changes under `myMap/**` — GitHub Actions runs `deploy-backend.yml` automatically.

---

## Pre-Deploy Checklist (verify before merging to main)

- [ ] All tests passing locally: `npm test`
- [ ] Traceability audit clear (zero ❌ in `.claude/docs/traceability.md`)
- [ ] No open CRITICAL or HIGH security findings
- [ ] No `.env` committed: `git grep -i "MONGODB_URI\|OPENAI_API_KEY" -- '*.js'`
- [ ] PR approved by required CODEOWNERS
- [ ] Changelog updated under [Unreleased]

---

## Automated Pipeline Steps

GitHub Actions `deploy-backend.yml` runs in order:

1. **Test job**: `npm ci && npm test` — fails fast, blocks deploy
2. **Build**: `docker build -f docker/backend.Dockerfile`
3. **Push**: `docker push <ECR_REPO>:<git-sha>`
4. **Deploy**: `aws ecs update-service` — rolling update, 50% min healthy
5. **Wait**: `aws ecs wait services-stable` — blocks until stable
6. **Smoke test**: `bash scripts/smoke-test.sh`

---

## Manual Deploy (emergency only)

```bash
# 1. Build and push image
SHA=$(git rev-parse --short HEAD)
ECR="<account-id>.dkr.ecr.us-east-1.amazonaws.com/mymap-backend"

docker build -f docker/backend.Dockerfile -t $ECR:$SHA .
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR
docker push $ECR:$SHA

# 2. Update ECS service
aws ecs update-service \
  --cluster mymap-cluster \
  --service mymap-backend-service \
  --task-definition mymap-backend \
  --force-new-deployment

# 3. Wait for stable
aws ecs wait services-stable --cluster mymap-cluster --services mymap-backend-service

# 4. Smoke test
bash scripts/smoke-test.sh $BACKEND_URL
```

---

## Verify Deploy Success

```bash
# Health check
curl -s https://api.yourdomain.com/health | jq .
# Expected: { "status": "ok", "db": "connected", "redis": "connected" }

# Check ECS service
aws ecs describe-services \
  --cluster mymap-cluster \
  --services mymap-backend-service \
  --query 'services[0].{running:runningCount,desired:desiredCount,pending:pendingCount}'
# Expected: running == desired, pending == 0
```

---

## Post-Deploy

```bash
# Tag release
git tag v<semver> && git push origin v<semver>

# Create GitHub release
gh release create v<semver> --generate-notes
```

If anything fails → see `rollback.md`.
