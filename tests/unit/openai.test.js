const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

describe("services/openai — generateRoadmap", () => {
  let generateRoadmap;
  let createStub;

  const validMessages = [
    { role: "system", content: "You are a coach." },
    { role: "user", content: "Topic: React." },
  ];

  const validRoadmapString = JSON.stringify({
    phases: [{ title: "Foundations", duration: "2 weeks", milestones: [] }],
  });

  beforeEach(() => {
    createStub = sinon.stub();

    // proxyquire replaces the openai SDK at require time so the module-level
    // `new OpenAI()` client uses our stub instead of the real SDK
    const openaiModule = proxyquire("../../services/openai", {
      openai: class OpenAI {
        constructor() {
          this.chat = {
            completions: { create: createStub },
          };
        }
      },
    });

    generateRoadmap = openaiModule.generateRoadmap;
  });

  afterEach(() => {
    sinon.restore();
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  describe("happy path", () => {
    it("returns the raw JSON string from OpenAI on success", async () => {
      // Arrange
      createStub.resolves({
        choices: [{ message: { content: validRoadmapString } }],
      });

      // Act
      const result = await generateRoadmap(validMessages);

      // Assert
      expect(result).to.equal(validRoadmapString);
      expect(createStub.calledOnce).to.be.true;
      expect(createStub.firstCall.args[0]).to.deep.include({
        model: "gpt-4o",
        messages: validMessages,
      });
    });
  });

  // ─── Error cases ──────────────────────────────────────────────────────────

  describe("error cases", () => {
    it("throws rate limit message when OpenAI returns 429", async () => {
      // Arrange
      const err = new Error("rate limited");
      err.status = 429;
      createStub.rejects(err);

      // Act + Assert
      try {
        await generateRoadmap(validMessages);
        expect.fail("should have thrown");
      } catch (e) {
        expect(e.message).to.equal("OpenAI rate limit hit — try again in a moment");
      }
    });

    it("throws timeout message when OpenAI connection times out", async () => {
      // Arrange
      const err = new Error("timeout");
      err.name = "APIConnectionTimeoutError";
      createStub.rejects(err);

      // Act + Assert
      try {
        await generateRoadmap(validMessages);
        expect.fail("should have thrown");
      } catch (e) {
        expect(e.message).to.equal("OpenAI timed out — please try again");
      }
    });

    it("throws generic unavailable message for all other OpenAI errors", async () => {
      // Arrange
      createStub.rejects(new Error("unexpected internal error"));

      // Act + Assert
      try {
        await generateRoadmap(validMessages);
        expect.fail("should have thrown");
      } catch (e) {
        expect(e.message).to.equal("OpenAI unavailable — please try again");
      }
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("passes an empty messages array to OpenAI without throwing", async () => {
      // Arrange
      createStub.resolves({
        choices: [{ message: { content: validRoadmapString } }],
      });

      // Act
      const result = await generateRoadmap([]);

      // Assert
      expect(result).to.equal(validRoadmapString);
      expect(createStub.firstCall.args[0].messages).to.deep.equal([]);
    });
  });
});

// ─── UNTESTABLE ───────────────────────────────────────────────────────────────
//
// TIMEOUT_MS config branch (line 6):
//   `parseInt(process.env.OPENAI_TIMEOUT_MS, 10) || 30000`
//   The client is created once at module load. The env var is read at that moment.
//   proxyquire re-requires the module each beforeEach, so setting process.env
//   before require would work — but the OpenAI constructor timeout param is
//   not observable from outside the module. Low risk: config-only, no logic branch.
