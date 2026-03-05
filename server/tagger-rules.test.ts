import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { tagComment } from "./tagger";
import { invokeLLM } from "./_core/llm";

const mockInvokeLLM = vi.mocked(invokeLLM);

function mockLLMResponse(tags: string, skinType = "", scenarioFactors = "") {
  const content = [tags, skinType, scenarioFactors].join("\n");
  mockInvokeLLM.mockResolvedValue({
    choices: [{ message: { content, role: "assistant" }, finish_reason: "stop", index: 0 }],
  } as any);
}

describe("Tagger Rules - Bug Fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("情绪宣泄互斥逻辑修复", () => {
    it("应该在有具体痛点时不输出情绪宣泄标签", async () => {
      // 用户反馈：这条评论有具体痛点（卡粉），不应该输出情绪宣泄
      mockLLMResponse("卡粉");
      const result = await tagComment("什么垃圾破粉底，气死我了，用了以后鼻翼两边直接卡出白线");
      expect(result.tags).toBe("卡粉");
      expect(result.tags).not.toContain("情绪宣泄");
    });

    it("应该在完全无具体痛点时输出情绪宣泄标签", async () => {
      // 用户反馈：纯情绪宣泄，无具体痛点
      mockLLMResponse("情绪宣泄/无具体原因");
      const result = await tagComment("非常难用啊");
      expect(result.tags).toBe("情绪宣泄/无具体原因");
    });

    it("应该在完全无具体痛点时输出情绪宣泄标签 - 案例2", async () => {
      // 用户反馈：纯情绪宣泄，无具体痛点
      mockLLMResponse("情绪宣泄/无具体原因");
      const result = await tagComment("很难用超级差");
      expect(result.tags).toBe("情绪宣泄/无具体原因");
    });

    it("情绪宣泄标签不应与其他标签共存", async () => {
      // 情绪宣泄与其他标签禁止共存
      mockLLMResponse("卡粉");
      const result = await tagComment("垃圾产品，卡粉严重");
      expect(result.tags).not.toContain("情绪宣泄");
    });
  });

  describe("中样/小样性价比低标签修复", () => {
    it("应该识别小样性价比低的标签", async () => {
      // 用户反馈：应该打【中样/小样性价比低】标签
      mockLLMResponse("中样/小样性价比低");
      const result = await tagComment("8g要七十块真的贵，买一次不会买了");
      expect(result.tags).toContain("中样/小样性价比低");
    });

    it("应该在多标签场景中包含性价比低标签", async () => {
      // 用户反馈：既不遮瑕也不持妆，还有点小贵量少
      mockLLMResponse("遮瑕差,持妆差,中样/小样性价比低");
      const result = await tagComment("个人觉得既不遮瑕也不持妆，还有点小贵量少。一般般。");
      expect(result.tags).toContain("遮瑕差");
      expect(result.tags).toContain("持妆差");
      expect(result.tags).toContain("中样/小样性价比低");
      // 即使有"一般般"这样的模糊词，也不应该输出无有效问题
      expect(result.tags).not.toBe("无有效问题");
    });
  });

  describe("多标签共存规则修复", () => {
    it("遮瑕差和持妆差应该能共存", async () => {
      // 用户反馈：既不遮瑕也不持妆，应该打两个标签
      mockLLMResponse("遮瑕差,持妆差");
      const result = await tagComment("既不遮瑕也不持妆");
      expect(result.tags).toContain("遮瑕差");
      expect(result.tags).toContain("持妆差");
    });

    it("卡粉和脱妆应该能共存", async () => {
      // 用户反馈：鼻翼卡粉，下午脱妆
      mockLLMResponse("卡粉,脱妆");
      const result = await tagComment("鼻翼卡出白线，下午就脱妆了");
      expect(result.tags).toContain("卡粉");
      expect(result.tags).toContain("脱妆");
    });

    it("应该支持三个或以上标签共存", async () => {
      // 多个不同维度的缺陷应该全部打标
      mockLLMResponse("卡粉,起皮,干");
      const result = await tagComment("太干了，不仅卡纹，额头和下巴还起了一层白色的干皮屑");
      expect(result.tags).toContain("卡粉");
      expect(result.tags).toContain("起皮");
      expect(result.tags).toContain("干");
    });
  });

  describe("综合场景测试", () => {
    it("复杂评论应该正确识别多个标签", async () => {
      // 综合场景：多个具体痛点
      mockLLMResponse("氧化暗沉,浮粉,遮瑕差,味道不喜欢", "混油皮");
      const result = await tagComment(
        "我是混合偏油性皮肤，没有像广告推广的那么好用，超过一小时暗沉和浮粉，而且遮瑕力度基本没有，味道还有点刺鼻。"
      );
      expect(result.tags).toContain("氧化暗沉");
      expect(result.tags).toContain("浮粉");
      expect(result.tags).toContain("遮瑕差");
      expect(result.tags).toContain("味道不喜欢");
      expect(result.skinType).toBe("混油皮");
    });

    it("应该区分脱妆和持妆差的互斥关系", async () => {
      // 脱妆优先级高于持妆差
      mockLLMResponse("脱妆");
      const result = await tagComment("说实话不咋样，持妆太差了，而且还不吃妆，没过几个小时就掉没了，变成大花猫。");
      expect(result.tags).toBe("脱妆");
      expect(result.tags).not.toContain("持妆差");
    });

    it("应该提取用户肤质和场景因子", async () => {
      // 测试肤质和场景因子提取
      mockLLMResponse("卡粉,脱妆", "大干皮", "夏天,戴口罩");
      const result = await tagComment("我是大干皮，夏天戴口罩卡粉严重，下午就脱妆了");
      expect(result.tags).toContain("卡粉");
      expect(result.tags).toContain("脱妆");
      expect(result.skinType).toBe("大干皮");
      expect(result.scenarioFactors).toContain("夏天");
      expect(result.scenarioFactors).toContain("戴口罩");
    });
  });
});
