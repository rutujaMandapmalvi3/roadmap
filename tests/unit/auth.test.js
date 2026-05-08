const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

describe("middleware/auth — authMiddleware", () => {
  let authMiddleware;
  let verifyStub;
  let findOneAndUpdateStub;

  const validPayload = { sub: "user-uuid-123", email: "user@example.com" };

  function buildReq(authHeader) {
    return { headers: { authorization: authHeader } };
  }

  function buildRes() {
    const res = {};
    res.status = sinon.stub().returns(res);
    res.json = sinon.stub().returns(res);
    return res;
  }

  beforeEach(() => {
    verifyStub = sinon.stub();
    findOneAndUpdateStub = sinon.stub().resolves();

    authMiddleware = proxyquire("../../middleware/auth", {
      "aws-jwt-verify": {
        CognitoJwtVerifier: {
          create: () => ({ verify: verifyStub }),
        },
      },
      "../models/User": {
        findOneAndUpdate: findOneAndUpdateStub,
      },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  describe("happy path", () => {
    it("sets req.user and calls next when token is valid", async () => {
      // Arrange
      verifyStub.resolves(validPayload);
      const req = buildReq("Bearer valid-token");
      const res = buildRes();
      const next = sinon.spy();

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(req.user).to.deep.equal({ userId: "user-uuid-123", email: "user@example.com" });
      expect(next.calledOnce).to.be.true;
      expect(res.status.called).to.be.false;
    });

    it("upserts user in MongoDB with userId and email from token", async () => {
      // Arrange
      verifyStub.resolves(validPayload);
      const req = buildReq("Bearer valid-token");
      const res = buildRes();
      const next = sinon.spy();

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(findOneAndUpdateStub.calledOnce).to.be.true;
      expect(findOneAndUpdateStub.firstCall.args[0]).to.deep.equal({ userId: "user-uuid-123" });
      expect(findOneAndUpdateStub.firstCall.args[1]).to.deep.equal({ email: "user@example.com" });
      expect(findOneAndUpdateStub.firstCall.args[2]).to.deep.equal({ upsert: true, new: true });
    });
  });

  // ─── Error cases ──────────────────────────────────────────────────────────

  describe("error cases", () => {
    it("returns 401 when Authorization header is missing", async () => {
      // Arrange
      const req = buildReq(undefined);
      const res = buildRes();
      const next = sinon.spy();

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledWith({ error: "No token provided" })).to.be.true;
      expect(next.called).to.be.false;
    });

    it("returns 401 when token verification fails", async () => {
      // Arrange
      verifyStub.rejects(new Error("token expired"));
      const req = buildReq("Bearer expired-token");
      const res = buildRes();
      const next = sinon.spy();

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledWith({ error: "Invalid or expired token" })).to.be.true;
      expect(next.called).to.be.false;
    });

    it("returns 401 when MongoDB upsert fails", async () => {
      // Arrange
      verifyStub.resolves(validPayload);
      findOneAndUpdateStub.rejects(new Error("DB connection lost"));
      const req = buildReq("Bearer valid-token");
      const res = buildRes();
      const next = sinon.spy();

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(res.status.calledWith(401)).to.be.true;
      expect(next.called).to.be.false;
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns 401 when Authorization header has no Bearer prefix", async () => {
      // Arrange — split(' ')[1] returns undefined when no space
      const req = buildReq("invalidtoken");
      const res = buildRes();
      const next = sinon.spy();

      // Act
      await authMiddleware(req, res, next);

      // Assert — verify() receives undefined, should throw, caught as 401
      expect(res.status.calledWith(401)).to.be.true;
      expect(next.called).to.be.false;
    });

    it("returns 401 when Authorization header is empty string", async () => {
      // Arrange
      const req = buildReq("");
      const res = buildRes();
      const next = sinon.spy();

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(res.status.calledWith(401)).to.be.true;
      expect(next.called).to.be.false;
    });
  });
});

// ─── UNTESTABLE ───────────────────────────────────────────────────────────────
// None.
