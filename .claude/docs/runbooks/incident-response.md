# Runbook: Incident Response

---

## Severity Classification

| Severity | Definition | Response Time | Examples |
|----------|-----------|--------------|---------|
| P0 | Total outage — all users affected | Immediate | API returning 500 for all requests, DB connection down |
| P1 | Partial outage or data at risk | < 30 min | Auth failing for subset of users, roadmaps not saving |
| P2 | Degraded performance | < 2 hours | Slow responses, rate limit errors spiking |
| P3 | Minor issue | Next business day | UI glitch, non-critical endpoint down |

---

## P0 / P1 Response Steps

### 1. Detect
```bash
# Check health endpoint
curl -s https://api.yourdomain.com/health | jq .

# Check ECS service state
aws ecs describe-services \
  --cluster mymap-cluster \
  --services mymap-backend-service \
  --query 'services[0].{running:runningCount,desired:desiredCount,deployments:deployments}'

# Check recent CloudWatch errors
aws logs filter-log-events \
  --log-group-name /ecs/mymap-backend \
  --filter-pattern "ERROR" \
  --start-time $(date -d '30 minutes ago' +%s000) \
  | jq '.events[].message'
```

### 2. Isolate
- Is it a recent deploy? → Check if deploy happened in last hour → Rollback (`rollback.md`)
- Is MongoDB down? → Check Atlas dashboard → health endpoint shows `"db": "disconnected"`
- Is Redis down? → Rate limiter falls back to IP-based (logged as WARN) → Check `"redis": "disconnected"`
- Is OpenAI down? → Only `/chat` affected, `/conversations` still works → Return 500 with message

### 3. Communicate
Create GitHub issue immediately with:
```markdown
## Incident: <one-line description>
**Severity**: P0/P1
**Started**: <time>
**Detected via**: health check / alert / user report
**Symptoms**: <what users see>
**Initial hypothesis**: <what you think is wrong>
```

### 4. Mitigate
- Recent deploy → rollback first (see `rollback.md`), debug after
- MongoDB down → Atlas status page, check connection string in ECS task env vars
- Redis down → rate limiter degrades gracefully to IP-based, not a blocking failure
- OpenAI down → `/chat` returns 500 with "OpenAI unavailable" message — expected behavior, no action needed

### 5. Resolve + Post-Mortem
After incident resolved:
- Document: timeline, root cause, what failed, how fixed
- Add regression test if code was the cause
- Update runbook with new finding
- Review if monitoring/alerting gap allowed late detection

---

## Key Resources

| Resource | Where |
|----------|-------|
| ECS cluster | AWS Console → ECS → mymap-cluster |
| CloudWatch logs | /ecs/mymap-backend |
| MongoDB Atlas | atlas.mongodb.com |
| Redis | AWS Console → ElastiCache |
| GitHub Actions | github.com/repo/actions |
| OpenAI status | status.openai.com |
