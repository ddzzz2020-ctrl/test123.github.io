import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { tagComment, TagResult } from "./tagger";
import { invokeLLM } from "./_core/llm";

const mockInvokeLLM = vi.mocked(invokeLLM);

function mockLLMResponse(jsonContent: string) {
  mockInvokeLLM.mockResolvedValue({
    choices: [{ message: { content: jsonContent, role: "assistant" }, finish_reason: "stop", index: 0 }],
  } as any);
}

describe("Tagger JSON Format - Skin Type & Scenario Extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("JSON 格式输出", () => {
    it("应该返回正确的 JSON 结构", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "卡粉, 脱妆",
        用户肤质: "混干皮",
        场景因子: "夏天, 戴口罩",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("我是混干皮，夏天戴口罩用这个粉底直接卡粉脱妆");
      
      expect(result).toEqual({
        差评标签: "卡粉, 脱妆",
        用户肤质: "混干皮",
        场景因子: "夏天, 戴口罩",
      });
    });

    it("应该处理空肤质和场景因子", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "卡粉, 干",
        用户肤质: "",
        场景因子: "",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("大油田实名避雷！刚上脸就卡粉，太干了！");
      
      expect(result.差评标签).toBe("卡粉, 干");
      expect(result.用户肤质).toBe("");
      expect(result.场景因子).toBe("");
    });
  });

  describe("用户肤质提取", () => {
    it("应该识别干皮", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "干",
        用户肤质: "干皮",
        场景因子: "",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("我是干皮，用了这个粉底太拔干了");
      expect(result.用户肤质).toBe("干皮");
    });

    it("应该识别大干皮", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "干",
        用户肤质: "大干皮",
        场景因子: "",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("大干皮用这个粉底简直是灾难");
      expect(result.用户肤质).toBe("大干皮");
    });

    it("应该识别混干皮", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "卡粉, 脱妆",
        用户肤质: "混干皮",
        场景因子: "",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("我是混干皮，这粉底卡粉脱妆");
      expect(result.用户肤质).toBe("混干皮");
    });

    it("应该识别油皮", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "控油差",
        用户肤质: "油皮",
        场景因子: "",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("我是油皮，这粉底一点都控不住油");
      expect(result.用户肤质).toBe("油皮");
    });

    it("应该识别大油皮", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "卡粉, 干",
        用户肤质: "大油皮",
        场景因子: "",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("大油皮实名避雷！刚上脸就卡粉，太干了！");
      expect(result.用户肤质).toBe("大油皮");
    });

    it("应该识别混油皮", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "脱妆",
        用户肤质: "混油皮",
        场景因子: "",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("我是混油皮，这粉底下午就脱妆了");
      expect(result.用户肤质).toBe("混油皮");
    });

    it("应该识别中性肤质", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "浮粉",
        用户肤质: "中性肤质",
        场景因子: "",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("我是中性皮肤，这粉底浮粉严重");
      expect(result.用户肤质).toBe("中性肤质");
    });
  });

  describe("场景因子提取", () => {
    it("应该识别夏天场景", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "脱妆",
        用户肤质: "",
        场景因子: "夏天",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("夏天用这个粉底直接脱妆");
      expect(result.场景因子).toBe("夏天");
    });

    it("应该识别戴口罩场景", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "脱妆",
        用户肤质: "",
        场景因子: "戴口罩",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("戴口罩就直接脱妆了");
      expect(result.场景因子).toBe("戴口罩");
    });

    it("应该识别多个场景因子", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "斑驳, 脱妆, 不防水不防汗, 假白",
        用户肤质: "混干皮",
        场景因子: "夏天, 出汗, 戴口罩",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment(
        "我是混干皮，这粉底夏天用绝了，一出门出汗戴口罩直接斑驳得没法看，而且死白死白的！"
      );
      expect(result.场景因子).toBe("夏天, 出汗, 戴口罩");
    });

    it("应该识别运动场景", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "脱妆",
        用户肤质: "",
        场景因子: "运动",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("运动的时候直接脱妆了");
      expect(result.场景因子).toBe("运动");
    });
  });

  describe("综合场景测试", () => {
    it("完整的 Few-Shot 示例 1", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "斑驳, 脱妆, 不防水不防汗, 假白",
        用户肤质: "混干皮",
        场景因子: "夏天, 出汗, 戴口罩",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment(
        "我是混干皮，这粉底夏天用绝了，一出门出汗戴口罩直接斑驳得没法看，而且死白死白的！"
      );
      
      expect(result.差评标签).toContain("斑驳");
      expect(result.差评标签).toContain("脱妆");
      expect(result.用户肤质).toBe("混干皮");
      expect(result.场景因子).toContain("夏天");
      expect(result.场景因子).toContain("戴口罩");
    });

    it("完整的 Few-Shot 示例 2", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "卡粉, 干",
        用户肤质: "大油皮",
        场景因子: "",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment("大油田实名避雷！刚上脸就卡粉，太干了！");
      
      expect(result.差评标签).toContain("卡粉");
      expect(result.差评标签).toContain("干");
      expect(result.用户肤质).toBe("大油皮");
      expect(result.场景因子).toBe("");
    });

    it("完整的 Few-Shot 示例 3", async () => {
      const jsonResponse = JSON.stringify({
        差评标签: "遮瑕差, 持妆差, 中样/小样性价比低",
        用户肤质: "",
        场景因子: "",
      });
      mockLLMResponse(jsonResponse);

      const result = await tagComment(
        "个人觉得既不遮瑕也不持妆，还有点小贵量少。一般般。"
      );
      
      expect(result.差评标签).toContain("遮瑕差");
      expect(result.差评标签).toContain("持妆差");
      expect(result.差评标签).toContain("中样/小样性价比低");
      expect(result.用户肤质).toBe("");
      expect(result.场景因子).toBe("");
    });
  });

  describe("错误处理", () => {
    it("应该在 JSON 解析失败时返回待确认", async () => {
      mockLLMResponse("这不是有效的 JSON");

      const result = await tagComment("某条评论");
      
      expect(result.差评标签).toBe("标签【待确认】");
      expect(result.用户肤质).toBe("");
      expect(result.场景因子).toBe("");
    });

    it("应该在 LLM 调用失败时返回待确认", async () => {
      mockInvokeLLM.mockRejectedValue(new Error("API error"));

      const result = await tagComment("某条评论");
      
      expect(result.差评标签).toBe("标签【待确认】");
      expect(result.用户肤质).toBe("");
      expect(result.场景因子).toBe("");
    });
  });
});
