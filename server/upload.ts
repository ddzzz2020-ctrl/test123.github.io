import { Router } from "express";
import multer from "multer";
import { parseFileBuffer, guessCommentColumn } from "./fileParser";
import { createTask, updateTask } from "./db";
import { storagePut } from "./storage";
import { processTask } from "./taskProcessor";
import { nanoid } from "nanoid";
import { sdk } from "./_core/sdk";

const router = Router();

// 内存存储，最大 20MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
      "application/octet-stream",
    ];
    const ext = file.originalname.toLowerCase().split(".").pop() ?? "";
    if (allowed.includes(file.mimetype) || ["xlsx", "xls", "csv"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("仅支持 xlsx、xls、csv 格式的文件"));
    }
  },
});

/**
 * POST /api/upload
 * 上传文件，解析列头，创建任务，返回 taskId 和列信息
 */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // 验证登录（可选，未登录时 userId = 0）
    let userId = 0;
    try {
      const user = await sdk.authenticateRequest(req);
      userId = user.id;
    } catch {}

    if (!req.file) {
      return res.status(400).json({ error: "请上传文件" });
    }

    const { buffer, originalname } = req.file;
    const parsed = parseFileBuffer(buffer, originalname);
    const guessedColumn = guessCommentColumn(parsed.columns);

    // 上传原始文件到 S3
    const suffix = nanoid(8);
    const sourceKey = `uploads/${Date.now()}-${suffix}-${originalname}`;
    const { url: sourceFileUrl } = await storagePut(
      sourceKey,
      buffer,
      req.file.mimetype
    );

    // 创建任务记录
    const taskId = await createTask({
      userId,
      originalFilename: originalname,
      sourceFileKey: sourceKey,
      sourceFileUrl,
      commentColumn: guessedColumn ?? parsed.columns[0],
      status: "pending",
      totalRows: parsed.rows.length,
      processedRows: 0,
      fileType: parsed.fileType,
      columns: parsed.columns,
    });

    res.json({
      taskId,
      columns: parsed.columns,
      guessedColumn,
      totalRows: parsed.rows.length,
      fileType: parsed.fileType,
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "上传失败" });
  }
});

/**
 * POST /api/start-task
 * 确认评论列后，开始异步处理任务
 */
router.post("/start-task", async (req, res) => {
  try {
    const { taskId, commentColumn } = req.body as { taskId: number; commentColumn: string };
    if (!taskId || !commentColumn) {
      return res.status(400).json({ error: "缺少必要参数" });
    }

    // 重新获取任务信息（含原始文件 URL）
    const { getTaskById } = await import("./db");
    const task = await getTaskById(taskId);
    if (!task) return res.status(404).json({ error: "任务不存在" });
    if (task.status !== "pending") {
      return res.status(400).json({ error: "任务已在处理中或已完成" });
    }

    // 更新评论列
    await updateTask(taskId, { commentColumn, status: "pending" });

    // 从 S3 重新下载原始文件内容（或直接从内存缓存，这里用 S3 URL）
    const axios = (await import("axios")).default;
    const fileResp = await axios.get<ArrayBuffer>(task.sourceFileUrl!, {
      responseType: "arraybuffer",
    });
    const buffer = Buffer.from(fileResp.data);
    const { parseFileBuffer } = await import("./fileParser");
    const parsed = parseFileBuffer(buffer, task.originalFilename);

    // 异步启动处理（不等待完成）
    processTask({
      taskId,
      rows: parsed.rows,
      commentColumn,
      originalColumns: parsed.columns,
      fileType: parsed.fileType,
      originalFilename: task.originalFilename,
    }).catch((e) => console.error("[StartTask] processTask error:", e));

    res.json({ success: true, taskId });
  } catch (error) {
    console.error("[StartTask] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "启动失败" });
  }
});

export default router;
