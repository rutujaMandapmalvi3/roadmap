const { CognitoJwtVerifier } = require('aws-jwt-verify');
const User = require('../models/User');

// verifier is created once at startup and reused — it caches Cognito's public keys (JWKS)
// so it doesn't fetch them from AWS on every single request
const verifier = CognitoJwtVerifier.create({
  userPoolId: 'us-east-2_iQY2juKJ5',
  tokenUse: 'id',       // we use the ID token (contains user info like email)
                        // access token would only tell us the user is logged in, not who they are
  clientId: '4vfubuuruohh4sf1l2ihi57os7',
});

const authMiddleware = async (req, res, next) => {
  // frontend sends: Authorization: Bearer <token>
  // split(' ')[1] extracts just the token part after "Bearer "
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    // verify() checks: signature is valid, token is not expired, issuer matches our user pool
    // if any of these fail it throws — caught below and returned as 401
    const payload = await verifier.verify(token);

    // payload.sub = Cognito's unique user ID (UUID) — consistent forever even if email changes
    // attaching to req.user so any route handler can access the logged-in user's identity
    req.user = { userId: payload.sub, email: payload.email };

    // upsert: insert if userId doesn't exist, update email if it does
    // this auto-creates a MongoDB user record the first time someone logs in
    // subsequent requests just update email in case it ever changed in Cognito
    await User.findOneAndUpdate(
      { userId: payload.sub },
      { email: payload.email },
      { upsert: true, new: true }
    );

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;
