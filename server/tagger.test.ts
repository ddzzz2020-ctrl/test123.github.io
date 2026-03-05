import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { tagComment, type TagResult } from "./tagger";
import { invokeLLM } from "./_core/llm";

const mockInvokeLLM = vi.mocked(invokeLLM);

function mockLLMResponse(tags: string, skinType = "", scenarioFactors = "") {
  const content = [tags, skinType, scenarioFactors].join("\n");
  mockInvokeLLM.mockResolvedValue({
    choices: [{ message: { content, role: "assistant" }, finish_reason: "stop", index: 0 }],
  } as any);
}

describe("tagComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns TagResult with 无有效问题 for empty comment", async () => {
    const result = await tagComment("");
    expect(result.tags).toBe("无有效问题");
    expect(result.skinType).toBe("");
    expect(result.scenarioFactors).toBe("");
    expect(mockInvokeLLM).not.toHaveBeenCalled();
  });

  it("returns TagResult with 无有效问题 for whitespace-only comment", async () => {
    const result = await tagComment("   ");
    expect(result.tags).toBe("无有效问题");
  });

  it("returns TagResult with LLM response for valid comment", async () => {
    mockLLMResponse("卡粉,脱妆", "", "");
    const result = await tagComment("鼻翼卡出白线，下午就掉妆了");
    expect(result.tags).toBe("卡粉,脱妆");
    expect(result.skinType).toBe("");
    expect(result.scenarioFactors).toBe("");
    expect(mockInvokeLLM).toHaveBeenCalledOnce();
  });

  it("returns TagResult with skinType and scenarioFactors", async () => {
    mockLLMResponse("卡粉", "混干皮", "夏天,戴口罩");
    const result = await tagComment("我是混干皮，夏天戴口罩卡粉严重");
    expect(result.tags).toBe("卡粉");
    expect(result.skinType).toBe("混干皮");
    expect(result.scenarioFactors).toBe("夏天,戴口罩");
  });

  it("returns TagResult with 标签【待确认】 when LLM throws", async () => {
    mockInvokeLLM.mockRejectedValue(new Error("API error"));
    const result = await tagComment("这个粉底很差");
    expect(result.tags).toBe("标签【待确认】");
    expect(result.skinType).toBe("");
    expect(result.scenarioFactors).toBe("");
  });

  it("returns TagResult with 无有效问题 when LLM returns empty string", async () => {
    mockLLMResponse("", "", "");
    const result = await tagComment("还行");
    expect(result.tags).toBe("无有效问题");
  });

  it("trims whitespace from LLM response", async () => {
    mockLLMResponse("  浮粉  ", "  油皮  ", "  夏天  ");
    const result = await tagComment("粉浮在汗毛上");
    expect(result.tags).toBe("浮粉");
    expect(result.skinType).toBe("油皮");
    expect(result.scenarioFactors).toBe("夏天");
  });

  it("handles multiple tags with correct format", async () => {
    mockLLMResponse("遮瑕差,持妆差,中样/小样性价比低", "", "");
    const result = await tagComment("个人觉得既不遮瑕也不持妆，还有点小贵量少。一般般。");
    expect(result.tags).toBe("遮瑕差,持妆差,中样/小样性价比低");
  });

  it("correctly identifies emotion-only comments", async () => {
    mockLLMResponse("情绪宣泄/无具体原因", "", "");
    const result = await tagComment("非常难用啊");
    expect(result.tags).toBe("情绪宣泄/无具体原因");
  });

  it("correctly identifies emotion-only comments with strong words", async () => {
    mockLLMResponse("情绪宣泄/无具体原因", "", "");
    const result = await tagComment("很难用超级差，看来是好评都有是刷出来");
    expect(result.tags).toBe("情绪宣泄/无具体原因");
  });

  it("correctly prioritizes specific tags over emotion", async () => {
    mockLLMResponse("卡粉,脱妆", "", "");
    const result = await tagComment("什么垃圾破粉底，气死我了，用了以后鼻翼两边直接卡出白线，下午就脱妆了，纯纯骗钱的玩意！");
    expect(result.tags).toBe("卡粉,脱妆");
    expect(result.tags).not.toContain("情绪宣泄");
  });
});
