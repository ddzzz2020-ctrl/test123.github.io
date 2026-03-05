import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 打标任务表
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** 原始文件名 */
  originalFilename: varchar("originalFilename", { length: 512 }).notNull(),
  /** 原始文件 S3 key */
  sourceFileKey: varchar("sourceFileKey", { length: 1024 }),
  /** 原始文件 S3 URL */
  sourceFileUrl: text("sourceFileUrl"),
  /** 结果文件 S3 key */
  resultFileKey: varchar("resultFileKey", { length: 1024 }),
  /** 结果文件 S3 URL */
  resultFileUrl: text("resultFileUrl"),
  /** 评论所在列名 */
  commentColumn: varchar("commentColumn", { length: 256 }),
  /** 任务状态 */
  status: mysqlEnum("status", ["pending", "processing", "done", "failed"])
    .default("pending")
    .notNull(),
  /** 总评论数 */
  totalRows: int("totalRows").default(0).notNull(),
  /** 已处理数 */
  processedRows: int("processedRows").default(0).notNull(),
  /** 错误信息 */
  errorMessage: text("errorMessage"),
  /** 文件类型 */
  fileType: varchar("fileType", { length: 16 }),
  /** 列头列表（JSON 数组） */
  columns: json("columns").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * 打标结果行表
 */
export const taskRows = mysqlTable("task_rows", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  /** 行号（从 1 开始） */
  rowIndex: int("rowIndex").notNull(),
  /** 原始评论文本 */
  commentText: text("commentText"),
  /** 打标结果（逻辑分隔） */
  tags: text("tags"),
  /** 用户肤质 */
  skinType: varchar("skinType", { length: 64 }),
  /** 场景因子（逻辑分隔） */
  scenarioFactors: text("scenarioFactors"),
  /** 原始行数据（JSON） */
  rowData: json("rowData").$type<Record<string, string>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskRow = typeof taskRows.$inferSelect;
export type InsertTaskRow = typeof taskRows.$inferInsert;
