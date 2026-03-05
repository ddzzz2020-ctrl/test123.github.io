import XLSX from "xlsx";
import Papa from "papaparse";
import type { TagResult } from "./tagger";

export interface ParsedFile {
  columns: string[];
  rows: Record<string, string>[];
  fileType: "xlsx" | "xls" | "csv";
}

/**
 * 从 Buffer 解析 Excel 或 CSV 文件
 */
export function parseFileBuffer(
  buffer: Buffer,
  filename: string
): ParsedFile {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "csv") {
    return parseCsv(buffer.toString("utf-8"));
  } else if (ext === "xlsx" || ext === "xls") {
    return parseExcel(buffer, ext as "xlsx" | "xls");
  } else {
    throw new Error(`不支持的文件格式：${ext}，请上传 xlsx、xls 或 csv 文件`);
  }
}

function parseCsv(content: string): ParsedFile {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    console.warn("[FileParser] CSV parse warnings:", result.errors.slice(0, 3));
  }

  const columns = result.meta.fields ?? [];
  return {
    columns,
    rows: result.data,
    fileType: "csv",
  };
}

function parseExcel(buffer: Buffer, ext: "xlsx" | "xls"): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel 文件中没有找到工作表");

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
  });

  const headerRow = XLSX.utils.sheet_to_json<unknown>(sheet, {
    header: 1,
  })[0] as unknown;
  const columns = (Array.isArray(headerRow) ? headerRow : []) as string[];

  return {
    columns: columns.length > 0 ? columns.map((c) => String(c).trim()) : Object.keys(rows[0] ?? {}),
    rows,
    fileType: ext,
  };
}

/**
 * 自动检测评论列（支持多个关键词）
 */
export function guessCommentColumn(columns: string[]): string | null {
  const keywords = ["评论", "评价", "内容", "comment", "text", "review"];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw))) {
      return col;
    }
  }
  return columns.length > 0 ? columns[0] : null;
}

/**
 * 将打标结果写回为 Excel Buffer（包含三列新数据）
 */
export function buildResultExcel(
  originalRows: Record<string, string>[],
  results: TagResult[],
  originalColumns: string[]
): Buffer {
  const resultRows = originalRows.map((row, i) => ({
    ...row,
    差评标签: results[i]?.tags ?? "",
    用户肤质: results[i]?.skinType ?? "",
    场景因子: results[i]?.scenarioFactors ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(resultRows, {
    header: [...originalColumns, "差评标签", "用户肤质", "场景因子"],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "打标结果");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

/**
 * 将打标结果写回为 CSV Buffer（包含三列新数据）
 */
export function buildResultCsv(
  originalRows: Record<string, string>[],
  results: TagResult[],
  originalColumns: string[]
): Buffer {
  const resultRows = originalRows.map((row, i) => ({
    ...row,
    差评标签: results[i]?.tags ?? "",
    用户肤质: results[i]?.skinType ?? "",
    场景因子: results[i]?.scenarioFactors ?? "",
  }));

  const csv = Papa.unparse(resultRows, {
    columns: [...originalColumns, "差评标签", "用户肤质", "场景因子"],
  });
  return Buffer.from("\uFEFF" + csv, "utf-8"); // BOM for Excel compatibility
}
