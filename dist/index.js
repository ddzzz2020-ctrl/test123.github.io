var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json
} from "drizzle-orm/mysql-core";
var users, tasks, taskRows;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    tasks = mysqlTable("tasks", {
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
      status: mysqlEnum("status", ["pending", "processing", "done", "failed"]).default("pending").notNull(),
      /** 总评论数 */
      totalRows: int("totalRows").default(0).notNull(),
      /** 已处理数 */
      processedRows: int("processedRows").default(0).notNull(),
      /** 错误信息 */
      errorMessage: text("errorMessage"),
      /** 文件类型 */
      fileType: varchar("fileType", { length: 16 }),
      /** 列头列表（JSON 数组） */
      columns: json("columns").$type(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    taskRows = mysqlTable("task_rows", {
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
      rowData: json("rowData").$type(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
    };
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  createTask: () => createTask,
  getDb: () => getDb,
  getTaskById: () => getTaskById,
  getTaskRowsByTaskId: () => getTaskRowsByTaskId,
  getTasksByUserId: () => getTasksByUserId,
  getUserByOpenId: () => getUserByOpenId,
  insertTaskRows: () => insertTaskRows,
  updateTask: () => updateTask,
  upsertUser: () => upsertUser
});
import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = { openId: user.openId };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createTask(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tasks).values(data);
  return result[0].insertId;
}
async function updateTask(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tasks).set(data).where(eq(tasks.id, id));
}
async function getTaskById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0];
}
async function getTasksByUserId(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt));
}
async function insertTaskRows(rows) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(taskRows).values(rows.slice(i, i + 100));
  }
}
async function getTaskRowsByTaskId(taskId, limit = 10, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taskRows).where(eq(taskRows.taskId, taskId)).orderBy(taskRows.rowIndex).limit(limit).offset(offset);
}
var _db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    _db = null;
  }
});

// shared/tags.ts
var BEAUTY_TAGS, TAG_COUNT;
var init_tags = __esm({
  "shared/tags.ts"() {
    "use strict";
    BEAUTY_TAGS = [
      "\u5361\u7C89",
      "\u8D77\u76AE",
      "\u4E0D\u670D\u5E16",
      "\u663E\u6BDB\u5B54",
      "\u6413\u6CE5",
      "\u50CF\u6CA1\u6D82",
      "\u7C89\u611F\u91CD/\u539A\u91CD/\u7C89\u8D28\u7C97",
      "\u6D6E\u7C89",
      "\u6591\u9A73",
      "\u6301\u5986\u5DEE",
      "\u8131\u5986",
      "\u6C27\u5316\u6697\u6C89",
      "\u4E0D\u9632\u6C34\u4E0D\u9632\u6C57",
      "\u4E0D\u9632\u8E6D",
      "\u5F88\u7D27\u7EF7",
      "\u4E0D\u597D\u62CD/\u63A8\u5F00",
      "\u9ECF/\u7C98",
      "\u5E72",
      "\u901F\u5E72\u592A\u5FEB",
      "\u8272\u53F7\u4E0D\u5408\u9002/\u4E0D\u597D",
      "\u5047\u767D",
      "\u53D1\u9ED1",
      "\u53D1\u7070",
      "\u53D1\u9EC4",
      "\u592A\u767D",
      "\u95F7\u75D8/\u95ED\u53E3",
      "\u8FC7\u654F",
      "\u5378\u4E0D\u5E72\u51C0/\u4E0D\u597D\u5378",
      "\u63A7\u6CB9\u5DEE",
      "\u906E\u7455\u5DEE",
      "\u5C0F\u6837\u3001\u6B63\u88C5\u4E0D\u4E00\u81F4",
      "\u8D60\u9001\u7684\u7C89\u6251\u4E0D\u597D\u7528",
      "\u5305\u88C5\u95EE\u9898",
      "\u5BA2\u670D\u95EE\u9898",
      "\u5473\u9053\u4E0D\u559C\u6B22",
      "\u60C5\u7EEA\u5BA3\u6CC4/\u65E0\u5177\u4F53\u539F\u56E0",
      "\u548C\u76F4\u64AD\u95F4/\u89C6\u9891\u4E0D\u4E00\u6837",
      "\u4E2D\u6837/\u5C0F\u6837\u6027\u4EF7\u6BD4\u4F4E"
    ];
    TAG_COUNT = BEAUTY_TAGS.length;
  }
});

// server/fileParser.ts
var fileParser_exports = {};
__export(fileParser_exports, {
  buildResultCsv: () => buildResultCsv,
  buildResultExcel: () => buildResultExcel,
  guessCommentColumn: () => guessCommentColumn,
  parseFileBuffer: () => parseFileBuffer
});
import XLSX from "xlsx";
import Papa from "papaparse";
function parseFileBuffer(buffer, filename) {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "csv") {
    return parseCsv(buffer.toString("utf-8"));
  } else if (ext === "xlsx" || ext === "xls") {
    return parseExcel(buffer, ext);
  } else {
    throw new Error(`\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u683C\u5F0F\uFF1A${ext}\uFF0C\u8BF7\u4E0A\u4F20 xlsx\u3001xls \u6216 csv \u6587\u4EF6`);
  }
}
function parseCsv(content) {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim()
  });
  if (result.errors.length > 0) {
    console.warn("[FileParser] CSV parse warnings:", result.errors.slice(0, 3));
  }
  const columns = result.meta.fields ?? [];
  return {
    columns,
    rows: result.data,
    fileType: "csv"
  };
}
function parseExcel(buffer, ext) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel \u6587\u4EF6\u4E2D\u6CA1\u6709\u627E\u5230\u5DE5\u4F5C\u8868");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: ""
  });
  const headerRow = XLSX.utils.sheet_to_json(sheet, {
    header: 1
  })[0];
  const columns = Array.isArray(headerRow) ? headerRow : [];
  return {
    columns: columns.length > 0 ? columns.map((c) => String(c).trim()) : Object.keys(rows[0] ?? {}),
    rows,
    fileType: ext
  };
}
function guessCommentColumn(columns) {
  const keywords = ["\u8BC4\u8BBA", "\u8BC4\u4EF7", "\u5185\u5BB9", "comment", "text", "review"];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw))) {
      return col;
    }
  }
  return columns.length > 0 ? columns[0] : null;
}
function buildResultExcel(originalRows, results, originalColumns) {
  const resultRows = originalRows.map((row, i) => ({
    ...row,
    \u5DEE\u8BC4\u6807\u7B7E: results[i]?.tags ?? "",
    \u7528\u6237\u80A4\u8D28: results[i]?.skinType ?? "",
    \u573A\u666F\u56E0\u5B50: results[i]?.scenarioFactors ?? ""
  }));
  const ws = XLSX.utils.json_to_sheet(resultRows, {
    header: [...originalColumns, "\u5DEE\u8BC4\u6807\u7B7E", "\u7528\u6237\u80A4\u8D28", "\u573A\u666F\u56E0\u5B50"]
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "\u6253\u6807\u7ED3\u679C");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
function buildResultCsv(originalRows, results, originalColumns) {
  const resultRows = originalRows.map((row, i) => ({
    ...row,
    \u5DEE\u8BC4\u6807\u7B7E: results[i]?.tags ?? "",
    \u7528\u6237\u80A4\u8D28: results[i]?.skinType ?? "",
    \u573A\u666F\u56E0\u5B50: results[i]?.scenarioFactors ?? ""
  }));
  const csv = Papa.unparse(resultRows, {
    columns: [...originalColumns, "\u5DEE\u8BC4\u6807\u7B7E", "\u7528\u6237\u80A4\u8D28", "\u573A\u666F\u56E0\u5B50"]
  });
  return Buffer.from("\uFEFF" + csv, "utf-8");
}
var init_fileParser = __esm({
  "server/fileParser.ts"() {
    "use strict";
  }
});

// server/_core/llm.ts
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}
var ensureArray, normalizeContentPart, normalizeMessage, normalizeToolChoice, resolveApiUrl, assertApiKey, normalizeResponseFormat;
var init_llm = __esm({
  "server/_core/llm.ts"() {
    "use strict";
    init_env();
    ensureArray = (value) => Array.isArray(value) ? value : [value];
    normalizeContentPart = (part) => {
      if (typeof part === "string") {
        return { type: "text", text: part };
      }
      if (part.type === "text") {
        return part;
      }
      if (part.type === "image_url") {
        return part;
      }
      if (part.type === "file_url") {
        return part;
      }
      throw new Error("Unsupported message content part");
    };
    normalizeMessage = (message) => {
      const { role, name, tool_call_id } = message;
      if (role === "tool" || role === "function") {
        const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
        return {
          role,
          name,
          tool_call_id,
          content
        };
      }
      const contentParts = ensureArray(message.content).map(normalizeContentPart);
      if (contentParts.length === 1 && contentParts[0].type === "text") {
        return {
          role,
          name,
          content: contentParts[0].text
        };
      }
      return {
        role,
        name,
        content: contentParts
      };
    };
    normalizeToolChoice = (toolChoice, tools) => {
      if (!toolChoice) return void 0;
      if (toolChoice === "none" || toolChoice === "auto") {
        return toolChoice;
      }
      if (toolChoice === "required") {
        if (!tools || tools.length === 0) {
          throw new Error(
            "tool_choice 'required' was provided but no tools were configured"
          );
        }
        if (tools.length > 1) {
          throw new Error(
            "tool_choice 'required' needs a single tool or specify the tool name explicitly"
          );
        }
        return {
          type: "function",
          function: { name: tools[0].function.name }
        };
      }
      if ("name" in toolChoice) {
        return {
          type: "function",
          function: { name: toolChoice.name }
        };
      }
      return toolChoice;
    };
    resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
    assertApiKey = () => {
      if (!ENV.forgeApiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }
    };
    normalizeResponseFormat = ({
      responseFormat,
      response_format,
      outputSchema,
      output_schema
    }) => {
      const explicitFormat = responseFormat || response_format;
      if (explicitFormat) {
        if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
          throw new Error(
            "responseFormat json_schema requires a defined schema object"
          );
        }
        return explicitFormat;
      }
      const schema = outputSchema || output_schema;
      if (!schema) return void 0;
      if (!schema.name || !schema.schema) {
        throw new Error("outputSchema requires both name and schema");
      }
      return {
        type: "json_schema",
        json_schema: {
          name: schema.name,
          schema: schema.schema,
          ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
        }
      };
    };
  }
});

// server/tagger.ts
var tagger_exports = {};
__export(tagger_exports, {
  tagComment: () => tagComment
});
async function tagComment(comment) {
  if (!comment || comment.trim().length === 0) {
    return { tags: "\u65E0\u6709\u6548\u95EE\u9898", skinType: "", scenarioFactors: "" };
  }
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `\u8BF7\u5BF9\u4EE5\u4E0B\u8BC4\u8BBA\u8FDB\u884C\u6253\u6807\uFF0C\u5E76\u63D0\u53D6\u7528\u6237\u80A4\u8D28\u548C\u573A\u666F\u56E0\u5B50\u3002
\u8BC4\u8BBA\uFF1A${comment.trim()}

\u8BF7\u6309\u4EE5\u4E0B\u683C\u5F0F\u8F93\u51FA\u4E09\u884C\uFF1A
\u7B2C\u4E00\u884C\uFF1A\u5DEE\u8BC4\u6807\u7B7E\uFF08\u7528\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF0C\u65E0\u5219\u8F93\u51FA"\u65E0\u6709\u6548\u95EE\u9898"\uFF09
\u7B2C\u4E8C\u884C\uFF1A\u7528\u6237\u80A4\u8D28\uFF087\u4E2A\u6807\u51C6\u8BCD\u4E4B\u4E00\uFF0C\u65E0\u5219\u7559\u7A7A\uFF09
\u7B2C\u4E09\u884C\uFF1A\u573A\u666F\u56E0\u5B50\uFF08\u9017\u53F7\u5206\u9694\uFF0C\u65E0\u5219\u7559\u7A7A\uFF09`
        }
      ]
    });
    const rawContent = response.choices?.[0]?.message?.content ?? "";
    const content = typeof rawContent === "string" ? rawContent : "";
    const lines = content.trim().split("\n").map((line) => line.trim());
    return {
      tags: lines[0] || "\u65E0\u6709\u6548\u95EE\u9898",
      skinType: lines[1] || "",
      scenarioFactors: lines[2] || ""
    };
  } catch (error) {
    console.error("[Tagger] LLM call failed:", error);
    return { tags: "\u6807\u7B7E\u3010\u5F85\u786E\u8BA4\u3011", skinType: "", scenarioFactors: "" };
  }
}
var TAGS_LIST, SYSTEM_PROMPT;
var init_tagger = __esm({
  "server/tagger.ts"() {
    "use strict";
    init_llm();
    init_tags();
    TAGS_LIST = BEAUTY_TAGS.join("\u3001");
    SYSTEM_PROMPT = `\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u7F8E\u5986\u4EA7\u54C1\u5DEE\u8BC4\u8BED\u4E49\u5206\u6790\u5F15\u64CE\uFF0C\u4E13\u95E8\u5904\u7406\u7C89\u5E95\u6DB2/\u5E95\u5986\u7C7B\u4EA7\u54C1\u7684\u7528\u6237\u8BC4\u8BBA\u3002

## \u4F60\u7684\u4EFB\u52A1
\u5BF9\u6BCF\u6761\u8BC4\u8BBA\u8FDB\u884C\u8BED\u4E49\u5206\u6790\uFF0C\u4ECE\u4EE5\u4E0B\u56FA\u5B9A\u6807\u7B7E\u5E93\u4E2D\u5339\u914D\u6700\u5408\u9002\u7684\u6807\u7B7E\uFF1A
${TAGS_LIST}

## \u6838\u5FC3\u6253\u6807\u89C4\u5219

### 1. \u591A\u6807\u7B7E\u652F\u6301
- \u4E00\u6761\u8BC4\u8BBA\u53EF\u5339\u914D\u591A\u4E2A\u6807\u7B7E\uFF0C\u7528\u82F1\u6587\u9017\u53F7\u5206\u9694
- \u989C\u8272\u53D8\u5316\u9700\u533A\u5206\u6210\u56E0\uFF1A\u65F6\u95F4\u63A8\u79FB\u53D8\u8272\u2192"\u6C27\u5316\u6697\u6C89"\uFF1B\u4E0A\u8138\u5373\u8272\u5DEE\u2192"\u53D1\u9ED1/\u53D1\u7070/\u53D1\u9EC4/\u5047\u767D/\u592A\u767D"

### 2. \u6DF1\u5EA6\u8BED\u4E49\u5339\u914D
\u65E0\u9700\u539F\u8BCD\u51FA\u73B0\uFF0C\u6839\u636E\u542B\u4E49\u3001\u573A\u666F\u9ED1\u8BDD\u81EA\u52A8\u5F52\u7C7B\u3002

### 3. \u597D\u8BC4\u4E0E\u65E0\u6548\u566A\u97F3\u8FC7\u6EE4
- \u7EAF\u597D\u8BC4/\u672A\u5B9E\u9645\u4F7F\u7528\uFF08\u7269\u6D41\u5FEB\u3001\u6CA1\u7528\uFF09\u2192 \u8F93\u51FA"\u65E0\u6709\u6548\u95EE\u9898"
- \u6B32\u626C\u5148\u6291\u4F46\u8BED\u6C14\u79EF\u6781\uFF08\u867D\u7136\u6709\u5C0F\u7F3A\u70B9\u4F46\u6574\u4F53\u597D\uFF09\u2192 \u4E0D\u6253\u6807\uFF0C\u8F93\u51FA"\u65E0\u6709\u6548\u95EE\u9898"
- \u660E\u786E\u6307\u51FA\u5177\u4F53\u7F3A\u9677\u4F46\u52C9\u5F3A\u63A5\u53D7 \u2192 \u4FDD\u7559\u5177\u4F53\u7F3A\u9677\u6807\u7B7E

### 4. \u5F3A\u5236\u5C4F\u853D\u89C4\u5219\uFF08\u8F93\u51FA"\u65E0\u6709\u6548\u95EE\u9898"\uFF09
\u4EE5\u4E0B\u7C7B\u578B\u5F3A\u5236\u5C4F\u853D\uFF0C\u7981\u6B62\u6620\u5C04\u4EFB\u4F55\u6807\u7B7E\uFF1A
- \u4EF7\u683C\u4E0E\u8425\u9500\u673A\u5236\u7C7B\uFF1A\u964D\u4EF7\u3001\u673A\u5236\u53D8\u4E86\u3001\u798F\u888B\u3001\u4E0A\u5F53
- \u552E\u540E\u4E0E\u9000\u6362\u8D27\u6D41\u7A0B\u7C7B\uFF1A\u9000\u8D27\u3001\u9001\u7684\u4E1C\u897F\u9000\u56DE\u53BB
- \u7269\u6D41\u5916\u5305\u88C5\u635F\u6BC1\uFF1A\u5FEB\u9012\u7EB8\u7BB1\u538B\u6241\u3001\u5305\u88F9\u88AB\u6C34\u6CE1
- \u65E0\u6307\u5411\u6027\u6A21\u7CCA/\u7EAF\u60C5\u7EEA\uFF1A\u4E00\u822C\u822C\u3001\u5509\u3001\u8D28\u91CF\u6709\u95EE\u9898\uFF08\u65E0\u5177\u4F53\u63CF\u8FF0\uFF09

### 5. \u5173\u952E\u4E92\u65A5\u89C4\u5219
- \u3010\u8131\u5986\u3011vs\u3010\u6301\u5986\u5DEE\u3011\u7EDD\u5BF9\u4E92\u65A5\uFF1A\u540C\u65F6\u89E6\u53D1\u65F6\uFF0C\u53EA\u4FDD\u7559\u3010\u8131\u5986\u3011\uFF0C\u5F3A\u5236\u5220\u9664\u3010\u6301\u5986\u5DEE\u3011
- \u3010\u60C5\u7EEA\u5BA3\u6CC4/\u65E0\u5177\u4F53\u539F\u56E0\u3011\u662F\u6700\u4F4E\u4F18\u5148\u7EA7\u515C\u5E95\u6807\u7B7E\uFF1A\u53EA\u8981\u6709\u4EFB\u4F55\u5177\u4F53\u529F\u80FD\u75DB\u70B9\uFF08\u5361\u7C89\u3001\u8131\u5986\u3001\u906E\u7455\u5DEE\u7B49\uFF09\uFF0C\u7981\u6B62\u8F93\u51FA\u6B64\u6807\u7B7E\u3002\u5373\u4F7F\u6587\u672C\u5305\u542B\u5783\u573E\u3001\u907F\u96F7\u7B49\u5F3A\u70C8\u60C5\u7EEA\u8BCD\uFF0C\u82E5\u5B58\u5728\u5177\u4F53\u75DB\u70B9\u4E5F\u8981\u4F18\u5148\u6253\u6807\u5177\u4F53\u6807\u7B7E
- \u3010\u60C5\u7EEA\u5BA3\u6CC4/\u65E0\u5177\u4F53\u539F\u56E0\u3011\u4E0E\u5176\u4ED6\u4EFB\u4F55\u6807\u7B7E\u7EDD\u5BF9\u7981\u6B62\u5171\u5B58\uFF08\u4E92\u65A5\u89C4\u5219\uFF09
- \u3010\u4E0D\u670D\u5E16\u3011\u4EC5\u5F53\u660E\u786E\u63D0\u5230"\u4E0D\u670D\u5E16/\u4E0D\u8D34\u80A4/\u6CA1\u6709\u8D34\u80A4\u611F"\u65F6\u624D\u89E6\u53D1\uFF0C\u7981\u6B62\u4ECE\u6D6E\u7C89/\u8D77\u76AE\u63A8\u65AD

### 6. \u8272\u5F69\u65F6\u95F4\u8F74\u8BC6\u522B
- \u521A\u4E0A\u8138\u5373\u8272\u5DEE\uFF08\u65E0\u65F6\u95F4\u63A8\u79FB\uFF09\u2192 \u53D1\u7070/\u53D1\u9EC4/\u53D1\u9ED1/\u5047\u767D/\u592A\u767D
- \u968F\u65F6\u95F4\u63A8\u79FB\u53D8\u8272\uFF08\u4E0B\u5348/\u51E0\u5C0F\u65F6\u540E\uFF09\u2192 \u6C27\u5316\u6697\u6C89
- \u4E24\u8005\u5171\u5B58 \u2192 \u53CC\u5411\u6253\u6807

### 7. \u5305\u88C5/\u5BA2\u670D\u8FB9\u754C
- \u3010\u5305\u88C5\u95EE\u9898\u3011\uFF1A\u4EC5\u9650\u4EA7\u54C1\u521D\u7EA7\u5305\u88C5\uFF08\u6CF5\u5934\u3001\u74F6\u8EAB\u3001\u76D6\u5B50\uFF09\u7684\u8BBE\u8BA1/\u8D28\u91CF\u7F3A\u9677
- \u3010\u5BA2\u670D\u95EE\u9898\u3011\uFF1A\u4EC5\u9650\u5BA2\u670D\u5728\u4EA7\u54C1\u4E13\u4E1A\u77E5\u8BC6\u4E0A\u7684\u8BEF\u5BFC\uFF0C\u6216\u5BF9\u4EA7\u54C1\u8D28\u91CF\u7F3A\u9677\u7684\u552E\u540E\u62D2\u7EDD
- \u7269\u6D41\u5916\u5305\u88C5\u635F\u6BC1\u3001\u5E38\u89C4\u7535\u5546\u8FD0\u8425\u6469\u64E6 \u2192 \u5F3A\u5236\u5C4F\u853D

### 8. \u6027\u4EF7\u6BD4\u4E0E\u591A\u6807\u7B7E\u5171\u5B58\u89C4\u5219
- \u3010\u4E2D\u6837/\u5C0F\u6837\u6027\u4EF7\u6BD4\u4F4E\u3011\uFF1A\u9488\u5BF9\u8BD5\u7528\u88C5\u3001\u5C0F\u6837\u3001\u4E2D\u6837\u7684\u5BB9\u91CF\u592A\u5C11\u3001\u4EF7\u683C\u592A\u8D35\u7684\u62B1\u6028\u3002\u5173\u952E\u8BCD\uFF1A\u592A\u5C0F\u4E86\u3001\u5C0F\u7684\u53EF\u601C\u3001\u5C31\u8FD9\u4E48\u4E00\u5C0F\u5305\u3001\u7528\u4E24\u6B21\u5C31\u6CA1\u4E86\u3001\u8BD5\u7528\u888B\u8FD8\u8981\u5341\u51E0\u5757\u3001\u51E0\u5341\u5757\u94B1\u5C31\u51E0\u514B\u3001\u4E0D\u591F\u585E\u7259\u7F1D
- \u3010\u6301\u5986\u5DEE\u3011vs\u3010\u906E\u7455\u5DEE\u3011\u53EF\u5171\u5B58\uFF1A"\u65E2\u4E0D\u906E\u7455\u4E5F\u4E0D\u6301\u5986"\u5E94\u540C\u65F6\u6253\u3010\u906E\u7455\u5DEE\u3011\u548C\u3010\u6301\u5986\u5DEE\u3011\u4E24\u4E2A\u6807\u7B7E
- \u591A\u6807\u7B7E\u5171\u5B58\u539F\u5219\uFF1A\u53EA\u8981\u8BC4\u8BBA\u4E2D\u63D0\u53CA\u591A\u4E2A\u4E0D\u540C\u7EF4\u5EA6\u7684\u7F3A\u9677\uFF0C\u5C31\u5E94\u8BE5\u5168\u90E8\u6253\u6807\uFF0C\u7528\u82F1\u6587\u9017\u53F7\u5206\u9694

### 9. \u7F6E\u4FE1\u5EA6\u6807\u8BB0
\u6A21\u578B\u4E0D\u786E\u5B9A\u65F6\uFF1A\u7ED9\u51FA\u6700\u53EF\u80FD\u7684\u6807\u7B7E\uFF0C\u540C\u65F6\u52A0\u4E0A\u3010\u5F85\u786E\u8BA4\u3011\u540E\u7F00\uFF0C\u5982"\u5361\u7C89\u3010\u5F85\u786E\u8BA4\u3011"

## \u9ED1\u8BDD\u8BCD\u5178\uFF08\u90E8\u5206\uFF09
- \u5361\u7C89\uFF1A\u5361\u7EB9\u3001\u5361\u51FA\u6C9F\u58D1\u3001\u6CD5\u4EE4\u7EB9\u79EF\u7EBF\u3001\u5361\u6210\u7F51\u72B6\u3001\u663E\u5E72\u7EB9
- \u8131\u5986\uFF1A\u6389\u5986\u3001\u82B1\u5986\u3001\u6655\u5986\u3001\u6389\u6CA1\u4E86\u3001\u6EB6\u5986\u3001\u53D8\u6210\u5927\u82B1\u732B\u3001\u7CCA\u6210\u4E00\u56E2
- \u6301\u5986\u5DEE\uFF1A\u4E0D\u6301\u4E45\u3001\u5F85\u673A\u77ED\u3001\u6491\u4E0D\u5230\u4E0B\u5348\u3001\u4E0D\u5403\u5986\uFF08\u9519\u522B\u5B57\uFF09\u3001\u6301\u88C5\uFF08\u9519\u522B\u5B57\uFF09
- \u4E0D\u9632\u8E6D\uFF1A\u4E00\u78B0\u5C31\u6389\u3001\u6CBE\u53E3\u7F69\u3001\u624B\u673A\u5C4F\u5E55\u4E0A\u90FD\u662F\u7C89\u3001\u4E00\u6478\u4E00\u4E2A\u624B\u6307\u5370
- \u63A7\u6CB9\u5DEE\uFF1A\u51FA\u6CB9\u5FEB\u3001\u6CB9\u5149\u6EE1\u9762\u3001\u732A\u6CB9\u8499\u5FC3\u3001\u5927\u6CB9\u7530\u3001\u538B\u4E0D\u4F4F\u6CB9
- \u6D6E\u7C89\uFF1A\u767D\u829D\u9EBB\u3001\u7C89\u6D6E\u5728\u6C57\u6BDB\u4E0A\u3001\u4E0D\u878D\u5408\u3001\u50CF\u9762\u5177\u6D6E\u5728\u8868\u9762
- \u5047\u767D\uFF1A\u6B7B\u767D\u3001\u60E8\u767D\u3001\u715E\u767D\u3001\u50CF\u9B3C\u4E00\u6837\u3001\u827A\u4F0E\u8138\u3001\u50CF\u5237\u5899
- \u6C27\u5316\u6697\u6C89\uFF1A\u6C27\u5316\u5FEB\u3001\u5230\u4E86\u4E0B\u5348/\u4E2D\u5348\u9EC4\u4E86\u3001\u53D8\u9EC4\u8138\u5A46\u3001\u5173\u516C\u8138
- \u6413\u6CE5\uFF1A\u6413\u51FA\u6761\u3001\u6CE5\u4E38\u5B50\u3001\u50CF\u6A61\u76AE\u64E6\u5C51\u3001\u548C\u9632\u6652\u6253\u67B6
- \u5E72\uFF1A\u62D4\u5E72\u3001\u5012\u62D4\u5E72\u3001\u5E72\u5DF4\u3001\u76B1\u7EB9\u90FD\u5E72\u51FA\u6765\u4E86
- \u4E0D\u597D\u62CD/\u63A8\u5F00\uFF1A\u63A8\u4E0D\u5F00\u3001\u62CD\u4E0D\u5300\u3001\u5EF6\u5C55\u6027\u5DEE\u3001\u963B\u529B\u5927
- \u906E\u7455\u5DEE\uFF1A\u76D6\u4E0D\u4F4F\u75D8\u5370/\u6591\u70B9\u3001\u906E\u76D6\u529B\u4E3A\u96F6\u3001\u6D82\u4E86\u4E2A\u5BC2\u5BDE
- \u7C89\u611F\u91CD/\u539A\u91CD/\u7C89\u8D28\u7C97\uFF1A\u5986\u611F\u91CD\u3001\u7C89\u7C92\u5927\u3001\u7CCA\u5728\u8138\u4E0A\u3001\u9762\u5177\u8138
- \u663E\u6BDB\u5B54\uFF1A\u6BDB\u5B54\u63D2\u79E7\u3001\u767D\u829D\u9EBB\u5D4C\u5728\u6BDB\u5B54\u91CC\u3001\u6BDB\u5B54\u66F4\u5927\u4E86
- \u5F88\u7D27\u7EF7\uFF1A\u52D2\u5F97\u614C\u3001\u8138\u90E8\u808C\u8089\u53D1\u7D27\u3001\u50CF\u7CCA\u4E86\u6C34\u6CE5
- \u548C\u76F4\u64AD\u95F4/\u89C6\u9891\u4E0D\u4E00\u6837\uFF1A\u548C\u4E66\uFF08\u5C0F\u7EA2\u4E66\uFF09\u7684\u6548\u679C\u4E0D\u4E00\u6837\u3001\u865A\u5047\u5BA3\u4F20\u3001\u5E26\u8D27\u9A97\u4EBA
- \u4E2D\u6837/\u5C0F\u6837\u6027\u4EF7\u6BD4\u4F4E\uFF1A\u592A\u5C0F\u4E86\u3001\u5C0F\u7684\u53EF\u601C\u3001\u5C31\u8FD9\u4E48\u4E00\u5C0F\u5305\u3001\u7528\u4E24\u6B21\u5C31\u6CA1\u4E86\u3001\u8BD5\u7528\u888B\u8FD8\u8981\u5341\u51E0\u5757\u3001\u51E0\u5341\u5757\u94B1\u5C31\u51E0\u514B\u3001\u4E0D\u591F\u585E\u7259\u7F1D
- \u95F7\u75D8/\u95ED\u53E3\uFF1A\u7206\u75D8\u3001\u957F\u95ED\u53E3\u3001\u95F7\u51FA\u75D8\u75D8
- \u8FC7\u654F\uFF1A\u6CDB\u7EA2\u3001\u53D1\u75D2\u3001\u523A\u75DB\u3001\u7EA2\u80BF\u3001\u70C2\u8138

## \u91CD\u70B9\u4FEE\u6B63\u6848\u4F8B\uFF08\u5FC5\u987B\u4E25\u683C\u9075\u5FAA\uFF09
1. "\u4E2A\u4EBA\u89C9\u5F97\u65E2\u4E0D\u906E\u7455\u4E5F\u4E0D\u6301\u5986\uFF0C\u8FD8\u6709\u70B9\u5C0F\u8D35\u91CF\u5C11\u3002\u4E00\u822C\u822C\u3002" \u2192 \u906E\u7455\u5DEE,\u6301\u5986\u5DEE,\u4E2D\u6837/\u5C0F\u6837\u6027\u4EF7\u6BD4\u4F4E
   - \u7406\u7531\uFF1A\u660E\u786E\u63D0\u5230"\u65E2\u4E0D\u906E\u7455\u4E5F\u4E0D\u6301\u5986"\u2192 \u3010\u906E\u7455\u5DEE\u3011+\u3010\u6301\u5986\u5DEE\u3011\uFF1B"\u5C0F\u8D35\u91CF\u5C11"\u2192 \u3010\u4E2D\u6837/\u5C0F\u6837\u6027\u4EF7\u6BD4\u4F4E\u3011\uFF1B\u591A\u6807\u7B7E\u5171\u5B58
2. "\u975E\u5E38\u96BE\u7528\u554A" \u2192 \u60C5\u7EEA\u5BA3\u6CC4/\u65E0\u5177\u4F53\u539F\u56E0
   - \u7406\u7531\uFF1A\u5B8C\u5168\u65E0\u5177\u4F53\u75DB\u70B9\uFF0C\u7EAF\u60C5\u7EEA\u5BA3\u6CC4
3. "\u5F88\u96BE\u7528\u8D85\u7EA7\u5DEE\uFF0C\u770B\u6765\u662F\u597D\u8BC4\u90FD\u6709\u662F\u5237\u51FA\u6765" \u2192 \u60C5\u7EEA\u5BA3\u6CC4/\u65E0\u5177\u4F53\u539F\u56E0
   - \u7406\u7531\uFF1A\u65E0\u5177\u4F53\u4EA7\u54C1\u75DB\u70B9\uFF0C\u7EAF\u60C5\u7EEA\u5BA3\u6CC4\u548C\u8D28\u7591\uFF0C\u65E0\u7814\u53D1\u6307\u5BFC\u4EF7\u503C
4. "\u9F3B\u7FFC\u5361\u51FA\u767D\u7EBF\uFF0C\u4E0B\u5348\u5C31\u8131\u5986\u4E86" \u2192 \u5361\u7C89,\u8131\u5986
   - \u7406\u7531\uFF1A\u4E24\u4E2A\u4E0D\u540C\u7EF4\u5EA6\u7684\u5177\u4F53\u75DB\u70B9\uFF0C\u591A\u6807\u7B7E\u5171\u5B58

## \u9644\u52A0\u4EFB\u52A1\uFF1A\u7528\u6237\u80A4\u8D28\u4E0E\u573A\u666F\u56E0\u5B50\u63D0\u53D6
\u9664\u4E86\u6838\u5FC3\u7684\u5DEE\u8BC4\u6807\u7B7E\uFF0C\u4F60\u8FD8\u9700\u8981\u4ECE\u8BC4\u8BBA\u6587\u672C\u4E2D\u63D0\u53D6"\u7528\u6237\u80A4\u8D28"\u4E0E"\u573A\u666F\u56E0\u5B50"\u3002

### \u7528\u6237\u80A4\u8D28\u63D0\u53D6\u89C4\u5219
\u4EC5\u63D0\u53D6\u7528\u6237\u660E\u786E\u8868\u8FF0\u7684\u81EA\u8EAB\u80A4\u8D28\uFF0C\u5F52\u4E00\u5316\u4E3A\u4EE5\u4E0B\u6807\u51C6\u8BCD\u6C47\u4E4B\u4E00\u8F93\u51FA\u3002\u4E25\u7981\u63D0\u53D6\u4EA7\u54C1\u9002\u7528\u7684\u80A4\u8D28\u3002\u65E0\u5219\u7559\u7A7A\u3002
- \u5E72\u76AE
- \u6DF7\u5E72\u76AE
- \u5927\u5E72\u76AE
- \u6CB9\u76AE
- \u6DF7\u6CB9\u76AE
- \u5927\u6CB9\u76AE
- \u4E2D\u6027\u80A4\u8D28

### \u573A\u666F\u56E0\u5B50\u63D0\u53D6\u89C4\u5219
\u63D0\u53D6\u6587\u672C\u4E2D\u5B9E\u9645\u51FA\u73B0\u7684\u573A\u666F\u8BCD\uFF0C\u53EF\u8F93\u51FA\u591A\u4E2A\uFF08\u9017\u53F7\u5206\u9694\uFF09\u3002\u65E0\u5219\u7559\u7A7A\u3002
- \u5B63\u8282/\u5929\u6C14\uFF1A\u590F\u5929\u3001\u51AC\u5B63\u3001\u9AD8\u6E29\u3001\u66B4\u6C57
- \u7269\u7406\u573A\u666F\uFF1A\u6234\u53E3\u7F69\u3001\u53E3\u7F69\u6469\u64E6
- \u7279\u6B8A\u6D3B\u52A8\uFF1A\u8FD0\u52A8\u3001\u6E38\u6CF3\u3001\u519B\u8BAD
- \u5BA4\u5185\u73AF\u5883\uFF1A\u7A7A\u8C03\u623F\u3001\u6696\u6C14\u623F

## \u6700\u7EC8\u8F93\u51FA\u683C\u5F0F
\u4EC5\u8F93\u51FA\u5DEE\u8BC4\u6807\u7B7E\u5217\u8868\uFF0C\u7528\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF0C\u4E0D\u8981\u89E3\u91CA\u3002
- \u65E0\u6709\u6548\u95EE\u9898\u65F6\u8F93\u51FA\uFF1A\u65E0\u6709\u6548\u95EE\u9898
- \u793A\u4F8B\uFF1A\u5361\u7C89,\u8131\u5986,\u906E\u7455\u5DEE`;
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
init_db();

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
init_env();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/routers.ts
import { z as z2 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_db();
init_tags();
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  tags: router({
    /** 获取固定标签库列表 */
    list: publicProcedure.query(() => {
      return BEAUTY_TAGS;
    })
  }),
  tasks: router({
    /** 获取当前用户的任务列表 */
    list: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return getTasksByUserId(ctx.user.id);
    }),
    /** 获取单个任务详情（含进度） */
    get: publicProcedure.input(z2.object({ taskId: z2.number() })).query(async ({ input, ctx }) => {
      const task = await getTaskById(input.taskId);
      if (!task) return null;
      return task;
    }),
    /** 获取任务的前 N 条结果（预览） */
    preview: publicProcedure.input(z2.object({ taskId: z2.number(), limit: z2.number().default(10) })).query(async ({ input }) => {
      return getTaskRowsByTaskId(input.taskId, input.limit, 0);
    }),
    /** 获取任务结果下载 URL */
    downloadUrl: publicProcedure.input(z2.object({ taskId: z2.number() })).query(async ({ input }) => {
      const task = await getTaskById(input.taskId);
      if (!task || !task.resultFileUrl) return null;
      return task.resultFileUrl;
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  base: "/test123.github.io/",
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/upload.ts
init_fileParser();
init_db();
import { Router } from "express";
import multer from "multer";

// server/storage.ts
init_env();
function getStorageConfig() {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
function buildUploadUrl(baseUrl, relKey) {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function toFormData(data, contentType, fileName) {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
function buildAuthHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

// server/taskProcessor.ts
init_db();
init_fileParser();
import { nanoid as nanoid2 } from "nanoid";
async function processTask(opts) {
  const { taskId, rows, commentColumn, originalColumns, fileType, originalFilename } = opts;
  try {
    await updateTask(taskId, { status: "processing", totalRows: rows.length });
    const comments = rows.map((r) => r[commentColumn] ?? "");
    const allResults = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < comments.length; i += BATCH_SIZE) {
      const batchComments = comments.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batchComments.map(async (c) => {
          const { tagComment: tagComment2 } = await Promise.resolve().then(() => (init_tagger(), tagger_exports));
          return tagComment2(c);
        })
      );
      allResults.push(...batchResults);
      const processed = Math.min(i + BATCH_SIZE, comments.length);
      await updateTask(taskId, { processedRows: processed });
    }
    const taskRowsData = rows.map((row, idx) => ({
      taskId,
      rowIndex: idx + 1,
      commentText: row[commentColumn] ?? "",
      tags: allResults[idx]?.tags ?? "",
      skinType: allResults[idx]?.skinType ?? "",
      scenarioFactors: allResults[idx]?.scenarioFactors ?? "",
      rowData: row
    }));
    await insertTaskRows(taskRowsData);
    const suffix = nanoid2(8);
    const baseName = originalFilename.replace(/\.[^.]+$/, "");
    let resultBuffer;
    let resultKey;
    let contentType;
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
    await updateTask(taskId, {
      status: "done",
      processedRows: rows.length,
      resultFileKey: resultKey,
      resultFileUrl
    });
    const task = await getTaskById(taskId);
    await notifyOwner({
      title: "\u2705 \u6253\u6807\u4EFB\u52A1\u5B8C\u6210",
      content: `\u6587\u4EF6\u300C${originalFilename}\u300D\u5DF2\u5B8C\u6210\u6253\u6807\u5904\u7406\uFF0C\u5171\u5904\u7406 ${rows.length} \u6761\u8BC4\u8BBA\u3002\u70B9\u51FB\u8FDB\u5165\u7CFB\u7EDF\u67E5\u770B\u7ED3\u679C\u5E76\u4E0B\u8F7D\u3002`
    });
  } catch (error) {
    console.error(`[TaskProcessor] Task ${taskId} failed:`, error);
    await updateTask(taskId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  }
}

// server/upload.ts
import { nanoid as nanoid3 } from "nanoid";
var router2 = Router();
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
      "application/octet-stream"
    ];
    const ext = file.originalname.toLowerCase().split(".").pop() ?? "";
    if (allowed.includes(file.mimetype) || ["xlsx", "xls", "csv"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("\u4EC5\u652F\u6301 xlsx\u3001xls\u3001csv \u683C\u5F0F\u7684\u6587\u4EF6"));
    }
  }
});
router2.post("/upload", upload.single("file"), async (req, res) => {
  try {
    let userId = 0;
    try {
      const user = await sdk.authenticateRequest(req);
      userId = user.id;
    } catch {
    }
    if (!req.file) {
      return res.status(400).json({ error: "\u8BF7\u4E0A\u4F20\u6587\u4EF6" });
    }
    const { buffer, originalname } = req.file;
    const parsed = parseFileBuffer(buffer, originalname);
    const guessedColumn = guessCommentColumn(parsed.columns);
    const suffix = nanoid3(8);
    const sourceKey = `uploads/${Date.now()}-${suffix}-${originalname}`;
    const { url: sourceFileUrl } = await storagePut(
      sourceKey,
      buffer,
      req.file.mimetype
    );
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
      columns: parsed.columns
    });
    res.json({
      taskId,
      columns: parsed.columns,
      guessedColumn,
      totalRows: parsed.rows.length,
      fileType: parsed.fileType
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "\u4E0A\u4F20\u5931\u8D25" });
  }
});
router2.post("/start-task", async (req, res) => {
  try {
    const { taskId, commentColumn } = req.body;
    if (!taskId || !commentColumn) {
      return res.status(400).json({ error: "\u7F3A\u5C11\u5FC5\u8981\u53C2\u6570" });
    }
    const { getTaskById: getTaskById2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const task = await getTaskById2(taskId);
    if (!task) return res.status(404).json({ error: "\u4EFB\u52A1\u4E0D\u5B58\u5728" });
    if (task.status !== "pending") {
      return res.status(400).json({ error: "\u4EFB\u52A1\u5DF2\u5728\u5904\u7406\u4E2D\u6216\u5DF2\u5B8C\u6210" });
    }
    await updateTask(taskId, { commentColumn, status: "pending" });
    const axios2 = (await import("axios")).default;
    const fileResp = await axios2.get(task.sourceFileUrl, {
      responseType: "arraybuffer"
    });
    const buffer = Buffer.from(fileResp.data);
    const { parseFileBuffer: parseFileBuffer2 } = await Promise.resolve().then(() => (init_fileParser(), fileParser_exports));
    const parsed = parseFileBuffer2(buffer, task.originalFilename);
    processTask({
      taskId,
      rows: parsed.rows,
      commentColumn,
      originalColumns: parsed.columns,
      fileType: parsed.fileType,
      originalFilename: task.originalFilename
    }).catch((e) => console.error("[StartTask] processTask error:", e));
    res.json({ success: true, taskId });
  } catch (error) {
    console.error("[StartTask] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "\u542F\u52A8\u5931\u8D25" });
  }
});
var upload_default = router2;

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use("/api", upload_default);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
