# ADR-002: AWS Cognito for Authentication
**Date**: 2026-05-01
**Status**: accepted
**Deciders**: Rutuja Mandapmalvi

## Context
The app needs user authentication. Options: build custom auth, use a managed identity provider. The system is already on AWS infrastructure.

## Decision
Use AWS Cognito user pools. Frontend receives ID token (JWT). Backend verifies signature via `aws-jwt-verify` library. `payload.sub` is used as `userId` — tamper-proof.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| AWS Cognito (chosen) | Managed user pool, no password storage, JWT signed by AWS, integrates with ECS | Vendor lock-in, Cognito-specific SDK | — chosen |
| Auth0 | Excellent DX, universal | Additional vendor cost, not native AWS | Cost + extra vendor dependency |
| Custom JWT | Full control | Passwords to store/hash, reset flow to build, token rotation to implement | Security surface too large for one-person team |

## Consequences
- **Positive**: No password storage, no reset flow to build, token signed by AWS (tamper-proof), `payload.sub` is a stable unique userId
- **Negative**: Cognito-specific SDK (`aws-jwt-verify`), Cognito error messages reveal account existence (enumeration risk — document in security review)
- **Risks**: Cognito userPoolId and clientId must come from env vars — never hardcoded in source

## Rationale
Managed auth eliminates the highest-risk surface (password storage, token signing) for a solo-developer project. `payload.sub` as userId is tamper-proof — cannot be spoofed by modifying the request body.
