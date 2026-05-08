const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();
const express = require("express");
const request = require("supertest");

describe("routes/conversations", () => {
  let app;
  let findStub;
  let findByIdStub;
  let createStub;
  let findByIdAndUpdateStub;

  const mockConvoList = [
    { _id: "id-1", topic: "React", createdAt: "2026-05-07", updatedAt: "2026-05-07" },
    { _id: "id-2", topic: "Python", createdAt: "2026-05-01", updatedAt: "2026-05-06" },
  ];

  const mockFullConvo = {
    _id: "id-1",
    userId: "user-uuid-123",
    topic: "React",
    messages: [{ role: "user", content: "hello" }],
    roadmap: { phases: [] },
  };

  beforeEach(() => {
    findStub = sinon.stub();
    findByIdStub = sinon.stub();
    createStub = sinon.stub();
    findByIdAndUpdateStub = sinon.stub();

    // chain stub for .find().select().sort()
    const chainable = {
      select: sinon.stub().returnsThis(),
      sort: sinon.stub().resolves(mockConvoList),
    };
    findStub.returns(chainable);

    const conversationsRouter = proxyquire("../../routes/conversations", {
      "../models/Conversation": {
        find: findStub,
        findById: findByIdStub,
        create: createStub,
        findByIdAndUpdate: findByIdAndUpdateStub,
      },
    });

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { userId: "user-uuid-123" };
      next();
    });
    app.use("/", conversationsRouter);
  });

  afterEach(() => {
    sinon.restore();
  });

  // ─── GET / ────────────────────────────────────────────────────────────────

  describe("GET /", () => {
    it("returns list of conversations for the logged-in user", async () => {
      // Act
      const res = await request(app).get("/");

      // Assert
      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal(mockConvoList);
      expect(findStub.calledWith({ userId: "user-uuid-123" })).to.be.true;
    });

    it("returns empty array when user has no conversations", async () => {
      // Arrange
      const chainable = {
        select: sinon.stub().returnsThis(),
        sort: sinon.stub().resolves([]),
      };
      findStub.returns(chainable);

      // Act
      const res = await request(app).get("/");

      // Assert
      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal([]);
    });

    it("returns 500 when MongoDB find throws", async () => {
      // Arrange
      const chainable = {
        select: sinon.stub().returnsThis(),
        sort: sinon.stub().rejects(new Error("DB error")),
      };
      findStub.returns(chainable);

      // Act
      const res = await request(app).get("/");

      // Assert
      expect(res.status).to.equal(500);
      expect(res.body.error).to.equal("Internal Server Error");
    });
  });

  // ─── GET /:id ─────────────────────────────────────────────────────────────

  describe("GET /:id", () => {
    it("returns full conversation when id exists", async () => {
      // Arrange
      findByIdStub.resolves(mockFullConvo);

      // Act
      const res = await request(app).get("/id-1");

      // Assert
      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal(mockFullConvo);
    });

    it("returns 404 when conversation id does not exist", async () => {
      // Arrange
      findByIdStub.resolves(null);

      // Act
      const res = await request(app).get("/nonexistent-id");

      // Assert
      expect(res.status).to.equal(404);
      expect(res.body.error).to.equal("not found");
    });

    it("returns 500 when MongoDB findById throws", async () => {
      // Arrange
      findByIdStub.rejects(new Error("DB error"));

      // Act
      const res = await request(app).get("/id-1");

      // Assert
      expect(res.status).to.equal(500);
      expect(res.body.error).to.equal("Internal Server Error");
    });
  });

  // ─── POST / ───────────────────────────────────────────────────────────────

  describe("POST /", () => {
    it("creates and returns a new conversation with 201", async () => {
      // Arrange
      createStub.resolves(mockFullConvo);
      const body = { userId: "user-uuid-123", messages: [], roadmap: null };

      // Act
      const res = await request(app).post("/").send(body);

      // Assert
      expect(res.status).to.equal(201);
      expect(createStub.calledOnce).to.be.true;
    });

    it("returns 500 when MongoDB create throws", async () => {
      // Arrange
      createStub.rejects(new Error("DB error"));

      // Act
      const res = await request(app).post("/").send({ userId: "u", messages: [], roadmap: null });

      // Assert
      expect(res.status).to.equal(500);
      expect(res.body.error).to.equal("Internal Server Error");
    });
  });

  // ─── POST /:id/messages ───────────────────────────────────────────────────

  describe("POST /:id/messages", () => {
    it("appends message and returns updated conversation", async () => {
      // Arrange
      const updatedConvo = {
        ...mockFullConvo,
        messages: [...mockFullConvo.messages, { role: "user", content: "follow up" }],
      };
      findByIdAndUpdateStub.resolves(updatedConvo);

      // Act
      const res = await request(app)
        .post("/id-1/messages")
        .send({ role: "user", content: "follow up" });

      // Assert
      expect(res.status).to.equal(200);
      expect(findByIdAndUpdateStub.calledOnce).to.be.true;
      expect(findByIdAndUpdateStub.firstCall.args[1]).to.deep.equal({
        $push: { messages: { role: "user", content: "follow up" } },
      });
    });

    it("returns 404 when conversation id does not exist", async () => {
      // Arrange
      findByIdAndUpdateStub.resolves(null);

      // Act
      const res = await request(app)
        .post("/nonexistent-id/messages")
        .send({ role: "user", content: "hello" });

      // Assert
      expect(res.status).to.equal(404);
      expect(res.body.error).to.equal("not found");
    });

    it("returns 500 when MongoDB findByIdAndUpdate throws", async () => {
      // Arrange
      findByIdAndUpdateStub.rejects(new Error("DB error"));

      // Act
      const res = await request(app)
        .post("/id-1/messages")
        .send({ role: "user", content: "hello" });

      // Assert
      expect(res.status).to.equal(500);
      expect(res.body.error).to.equal("Internal Server Error");
    });
  });
});

// ─── UNTESTABLE ───────────────────────────────────────────────────────────────
// None.
