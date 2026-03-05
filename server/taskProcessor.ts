import { updateTask, insertTaskRows, getTaskById } from "./db";
import type { TagResult } from "./tagger";
import { buildResultExcel, buildResultCsv } from "./fileParser";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";
import { nanoid } from "nanoid";

export interface ProcessTaskOptions {
  taskId: number;
  rows: Record<string, string>[];
  commentColumn: string;
  originalColumns: string[];
  fileType: "xlsx" | "xls" | "csv";
  originalFilename: string;
}

/**
 * 异步处理打标任务（在后台运行，不阻塞 HTTP 响应）
 */
export async function processTask(opts: ProcessTaskOptions): Promise<void> {
  const { taskId, rows, commentColumn, originalColumns, fileType, originalFilename } = opts;

  try {
    // 更新状态为处理中
    await updateTask(taskId, { status: "processing", totalRows: rows.length });

    const comments = rows.map((r) => r[commentColumn] ?? "");
    const allResults: TagResult[] = [];

    // 分批处理，每批 5 条，处理后立即更新进度
    const BATCH_SIZE = 5;
    for (let i = 0; i < comments.length; i += BATCH_SIZE) {
      const batchComments = comments.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batchComments.map(async (c) => {
          const { tagComment } = await import("./tagger");
          return tagComment(c);
        })
      );
      allResults.push(...batchResults);

      // 更新进度
      const processed = Math.min(i + BATCH_SIZE, comments.length);
      await updateTask(taskId, { processedRows: processed });
    }

    // 将结果存入数据库
    const taskRowsData = rows.map((row, idx) => ({
      taskId,
      rowIndex: idx + 1,
      commentText: row[commentColumn] ?? "",
      tags: allResults[idx]?.tags ?? "",
      skinType: allResults[idx]?.skinType ?? "",
      scenarioFactors: allResults[idx]?.scenarioFactors ?? "",
      rowData: row,
    }));
    await insertTaskRows(taskRowsData);

    // 生成结果文件并上传 S3
    const suffix = nanoid(8);
    const baseName = originalFilename.replace(/\.[^.]+$/, "");
    let resultBuffer: Buffer;
    let resultKey: string;
    let contentType: string;

    if (fileType === "csv") {
      resultBuffer = buildResultCsv(rows, allResults, originalColumns);
      resultKey = `results/${taskId}-${suffix}-${baseName}_tagged.csv`;
      contentType = "text/csv";
    } else {
      resultBuffer = buildResultExcel(rows, allResults, originalColumns);
      resultKey = `results/${taskId}-${suffix}-${baseName}_tagged.xlsx`;
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    const { url: resultFileUrl } = await storagePut(resultKey, resultBuffer, contentType);

    // 更新任务为完成
    await updateTask(taskId, {
      status: "done",
      processedRows: rows.length,
      resultFileKey: resultKey,
      resultFileUrl,
    });

    // 发送完成通知
    const task = await getTaskById(taskId);
    await notifyOwner({
      title: "✅ 打标任务完成",
      content: `文件「${originalFilename}」已完成打标处理，共处理 ${rows.length} 条评论。点击进入系统查看结果并下载。`,
    });
  } catch (error) {
    console.error(`[TaskProcessor] Task ${taskId} failed:`, error);
    await updateTask(taskId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
