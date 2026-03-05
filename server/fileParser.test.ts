import { describe, it, expect } from "vitest";
import { guessCommentColumn, buildResultCsv, buildResultExcel } from "./fileParser";
import type { TagResult } from "./tagger";

describe("guessCommentColumn", () => {
  it("identifies '评论' column", () => {
    expect(guessCommentColumn(["商品名称", "用户评论", "评分"])).toBe("用户评论");
  });

  it("identifies 'comment' column (case-insensitive)", () => {
    expect(guessCommentColumn(["id", "Comment", "rating"])).toBe("Comment");
  });

  it("identifies '评价' column", () => {
    expect(guessCommentColumn(["订单号", "买家评价", "时间"])).toBe("买家评价");
  });

  it("falls back to first column when no match", () => {
    expect(guessCommentColumn(["产品名", "价格", "库存"])).toBe("产品名");
  });

  it("returns null for empty columns", () => {
    expect(guessCommentColumn([])).toBeNull();
  });

  it("identifies '内容' column", () => {
    expect(guessCommentColumn(["标题", "内容", "作者"])).toBe("内容");
  });
});

describe("buildResultCsv", () => {
  it("adds 差评标签、用户肤质、场景因子 columns to output", () => {
    const rows = [
      { 商品: "粉底液A", 评论: "卡粉严重" },
      { 商品: "粉底液B", 评论: "很好用" },
    ];
    const results: TagResult[] = [
      { tags: "卡粉", skinType: "混干皮", scenarioFactors: "夏天" },
      { tags: "无有效问题", skinType: "", scenarioFactors: "" },
    ];
    const buffer = buildResultCsv(rows, results, ["商品", "评论"]);
    const csv = buffer.toString("utf-8").replace(/^\uFEFF/, ""); // strip BOM
    expect(csv).toContain("差评标签");
    expect(csv).toContain("用户肤质");
    expect(csv).toContain("场景因子");
    expect(csv).toContain("卡粉");
    expect(csv).toContain("混干皮");
    expect(csv).toContain("夏天");
  });

  it("handles empty rows", () => {
    const buffer = buildResultCsv([], [], []);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it("handles empty skinType and scenarioFactors", () => {
    const rows = [{ 评论: "测试" }];
    const results: TagResult[] = [
      { tags: "卡粉", skinType: "", scenarioFactors: "" },
    ];
    const buffer = buildResultCsv(rows, results, ["评论"]);
    const csv = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    expect(csv).toContain("卡粉");
    // 空值应该在 CSV 中显示为空
    expect(csv).toContain(",,");
  });
});

describe("buildResultExcel", () => {
  it("returns a Buffer with all three columns", () => {
    const rows = [{ 评论: "测试评论" }];
    const results: TagResult[] = [
      { tags: "卡粉", skinType: "油皮", scenarioFactors: "运动" },
    ];
    const buffer = buildResultExcel(rows, results, ["评论"]);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles multiple rows with mixed data", () => {
    const rows = [
      { 评论: "评论1" },
      { 评论: "评论2" },
      { 评论: "评论3" },
    ];
    const results: TagResult[] = [
      { tags: "卡粉", skinType: "混干皮", scenarioFactors: "夏天" },
      { tags: "无有效问题", skinType: "", scenarioFactors: "" },
      { tags: "脱妆,干", skinType: "大干皮", scenarioFactors: "空调房" },
    ];
    const buffer = buildResultExcel(rows, results, ["评论"]);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles empty skinType and scenarioFactors", () => {
    const rows = [{ 评论: "测试" }];
    const results: TagResult[] = [
      { tags: "卡粉", skinType: "", scenarioFactors: "" },
    ];
    const buffer = buildResultExcel(rows, results, ["评论"]);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});
