import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getTasksByUserId, getTaskById, getTaskRowsByTaskId } from "./db";
import { BEAUTY_TAGS } from "../shared/tags";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  tags: router({
    /** 获取固定标签库列表 */
    list: publicProcedure.query(() => {
      return BEAUTY_TAGS;
    }),
  }),

  tasks: router({
    /** 获取当前用户的任务列表 */
    list: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return getTasksByUserId(ctx.user.id);
    }),

    /** 获取单个任务详情（含进度） */
    get: publicProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input, ctx }) => {
        const task = await getTaskById(input.taskId);
        if (!task) return null;
        // 允许未登录用户查询（前端通过 taskId 轮询）
        return task;
      }),

    /** 获取任务的前 N 条结果（预览） */
    preview: publicProcedure
      .input(z.object({ taskId: z.number(), limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return getTaskRowsByTaskId(input.taskId, input.limit, 0);
      }),

    /** 获取任务结果下载 URL */
    downloadUrl: publicProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        const task = await getTaskById(input.taskId);
        if (!task || !task.resultFileUrl) return null;
        return task.resultFileUrl;
      }),
  }),
});

export type AppRouter = typeof appRouter;
