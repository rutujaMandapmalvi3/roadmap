const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();
const express = require("express");
const request = require("supertest");

describe("routes/chat — POST /", () => {
  let app;
  let generateRoadmapStub;
  let findByIdStub;
  let createStub;
  let saveStub;

  const validRoadmap = {
    phases: [
      {
        title: "Foundations",
        duration: "2 weeks",
        milestones: [{ title: "JSX basics", resources: ["reactjs.org"] }],
      },
    ],
  };
  const validRoadmapString = JSON.stringify(validRoadmap);

  const mockConvo = {
    _id: "convo-id-123",
    userId: "user-uuid-123",
    topic: "React",
    messages: [
      { role: "system", content: "You are a coach." },
      { role: "user", content: "Topic: React." },
      { role: "assistant", content: validRoadmapString },
    ],
    roadmap: validRoadmap,
    save: null, // assigned in beforeEach
  };

  beforeEach(() => {
    generateRoadmapStub = sinon.stub();
    findByIdStub = sinon.stub();
    createStub = sinon.stub();
    saveStub = sinon.stub().resolves();

    const chatRouter = proxyquire("../../routes/chat", {
      "../services/openai": { generateRoadmap: generateRoadmapStub },
      "../models/Conversation": {
        findById: findByIdStub,
        create: createStub,
      },
    });

    app = express();
    app.use(express.json());
    // inject auth — middleware already tested separately
    app.use((req, res, next) => {
      req.user = { userId: "user-uuid-123" };
      next();
    });
    app.use("/", chatRouter);
  });

  afterEach(() => {
    sinon.restore();
  });

  // ─── Happy path: fresh conversation ──────────────────────────────────────

  describe("fresh conversation", () => {
    const freshBody = {
      topic: "React",
      currentLevel: "beginner",
      timeframe: "3 months",
      goal: "get a job",
    };

    it("creates a new conversation and returns 201 with the saved document", async () => {
      // Arrange
      generateRoadmapStub.resolves(validRoadmapString);
      const savedConvo = { ...mockConvo, _id: "new-id" };
      createStub.resolves(savedConvo);

      // Act
      const res = await request(app).post("/").send(freshBody);

      // Assert
      expect(res.status).to.equal(201);
      expect(res.body._id).to.equal("new-id");
      expect(createStub.calledOnce).to.be.true;
      expect(createStub.firstCall.args[0]).to.deep.include({
        userId: "user-uuid-123",
        topic: "React",
      });
    });

    it("sends system prompt and user message to OpenAI on fresh start", async () => {
      // Arrange
      generateRoadmapStub.resolves(validRoadmapString);
      createStub.resolves(mockConvo);

      // Act
      await request(app).post("/").send(freshBody);

      // Assert
      const messages = generateRoadmapStub.firstCall.args[0];
      expect(messages[0].role).to.equal("system");
      expect(messages[1].role).to.equal("user");
      expect(messages[1].content).to.include("React");
      expect(messages[1].content).to.include("beginner");
    });
  });

  // ─── Happy path: follow-up ────────────────────────────────────────────────

  describe("follow-up conversation", () => {
    const followUpBody = {
      conversationId: "convo-id-123",
      followUpMessage: "Make phase 1 shorter",
    };

    it("appends messages and overwrites roadmap on follow-up", async () => {
      // Arrange
      const convoDoc = {
        ...mockConvo,
        messages: [...mockConvo.messages],
        save: saveStub,
      };
      findByIdStub.resolves(convoDoc);
      generateRoadmapStub.resolves(validRoadmapString);

      // Act
      const res = await request(app).post("/").send(followUpBody);

      // Assert
      expect(res.status).to.equal(200);
      expect(saveStub.calledOnce).to.be.true;
      // two messages appended: user + assistant
      const lastTwo = convoDoc.messages.slice(-2);
      expect(lastTwo[0]).to.deep.equal({ role: "user", content: "Make phase 1 shorter" });
      expect(lastTwo[1].role).to.equal("assistant");
    });

    it("uses sliding window of last 10 messages when building OpenAI context", async () => {
      // Arrange — convo with 15 messages
      const manyMessages = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `message ${i}`,
      }));
      const convoDoc = { ...mockConvo, messages: manyMessages, save: saveStub };
      findByIdStub.resolves(convoDoc);
      generateRoadmapStub.resolves(validRoadmapString);

      // Act
      await request(app).post("/").send(followUpBody);

      // Assert — OpenAI receives last 10 + new user message = 11 total
      const sentMessages = generateRoadmapStub.firstCall.args[0];
      expect(sentMessages.length).to.equal(11);
      expect(sentMessages[sentMessages.length - 1]).to.deep.equal({
        role: "user",
        content: "Make phase 1 shorter",
      });
    });
  });

  // ─── Validation failures ──────────────────────────────────────────────────

  describe("input validation", () => {
    it("returns 400 when fresh body is missing required fields", async () => {
      // Arrange — missing currentLevel, timeframe, goal
      const res = await request(app).post("/").send({ topic: "React" });

      // Assert
      expect(res.status).to.equal(400);
      expect(generateRoadmapStub.called).to.be.false;
    });

    it("returns 400 when topic is shorter than 2 characters", async () => {
      const res = await request(app).post("/").send({
        topic: "R",
        currentLevel: "beginner",
        timeframe: "3 months",
        goal: "get a job",
      });
      expect(res.status).to.equal(400);
    });

    it("returns 400 when currentLevel is not a valid enum value", async () => {
      const res = await request(app).post("/").send({
        topic: "React",
        currentLevel: "expert",
        timeframe: "3 months",
        goal: "get a job",
      });
      expect(res.status).to.equal(400);
    });

    it("returns 400 when follow-up body is missing followUpMessage", async () => {
      const res = await request(app)
        .post("/")
        .send({ conversationId: "convo-id-123" });
      expect(res.status).to.equal(400);
    });
  });

  // ─── Error cases ──────────────────────────────────────────────────────────

  describe("error cases", () => {
    it("returns 404 when conversationId does not exist in MongoDB", async () => {
      // Arrange
      findByIdStub.resolves(null);

      // Act
      const res = await request(app).post("/").send({
        conversationId: "nonexistent-id",
        followUpMessage: "update it",
      });

      // Assert
      expect(res.status).to.equal(404);
      expect(res.body.error).to.equal("Conversation not found");
    });

    it("returns 500 when OpenAI returns malformed JSON", async () => {
      // Arrange
      generateRoadmapStub.resolves("not valid json {{{");
      createStub.resolves(mockConvo);

      // Act
      const res = await request(app).post("/").send({
        topic: "React",
        currentLevel: "beginner",
        timeframe: "3 months",
        goal: "get a job",
      });

      // Assert
      expect(res.status).to.equal(500);
    });

    it("returns 500 when OpenAI returns JSON with wrong shape", async () => {
      // Arrange — valid JSON but missing required `phases` key
      generateRoadmapStub.resolves(JSON.stringify({ wrong: "shape" }));

      // Act
      const res = await request(app).post("/").send({
        topic: "React",
        currentLevel: "beginner",
        timeframe: "3 months",
        goal: "get a job",
      });

      // Assert
      expect(res.status).to.equal(500);
      expect(res.body.error).to.equal(
        "OpenAI returned an unexpected structure. Please try again."
      );
    });

    it("returns 500 with OpenAI error message when generateRoadmap throws", async () => {
      // Arrange
      generateRoadmapStub.rejects(new Error("OpenAI unavailable — please try again"));
      createStub.resolves(mockConvo);

      // Act
      const res = await request(app).post("/").send({
        topic: "React",
        currentLevel: "beginner",
        timeframe: "3 months",
        goal: "get a job",
      });

      // Assert
      expect(res.status).to.equal(500);
      expect(res.body.error).to.equal("OpenAI unavailable — please try again");
    });
  });
});

// ─── UNTESTABLE ───────────────────────────────────────────────────────────────
// None.
