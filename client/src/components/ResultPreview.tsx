import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

interface Props {
  taskId: number;
}

function TagBadge({ tag }: { tag: string }) {
  const isInvalid = tag === "无有效问题";
  const isPending = tag.includes("待确认");
  const isEmotion = tag === "情绪宣泄/无具体原因";

  let bg = "oklch(0.92 0.025 230)";
  let color = "oklch(0.25 0.03 240)";

  if (isInvalid) { bg = "oklch(0.94 0.006 240)"; color = "oklch(0.52 0.015 240)"; }
  else if (isPending) { bg = "oklch(0.93 0.05 55)"; color = "oklch(0.4 0.1 55)"; }
  else if (isEmotion) { bg = "oklch(0.91 0.03 10)"; color = "oklch(0.35 0.06 10)"; }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-1 mb-1"
      style={{ background: bg, color }}
    >
      {tag}
    </span>
  );
}

export default function ResultPreview({ taskId }: Props) {
  const { data: rows = [], isLoading } = trpc.tasks.preview.useQuery(
    { taskId, limit: 10 },
    { enabled: !!taskId }
  );

  const { data: task } = trpc.tasks.get.useQuery({ taskId }, { enabled: !!taskId });

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rows.length) return null;

  const commentCol = task?.commentColumn ?? "";

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">结果预览</h3>
        <span className="text-xs text-muted-foreground">前 10 条</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-3 text-left font-semibold text-muted-foreground w-8">#</th>
              <th className="px-3 py-3 text-left font-semibold text-muted-foreground min-w-[200px]">评论内容</th>
              <th className="px-3 py-3 text-left font-semibold text-muted-foreground min-w-[180px]">差评标签</th>
              <th className="px-3 py-3 text-left font-semibold text-muted-foreground min-w-[100px]">用户肤质</th>
              <th className="px-3 py-3 text-left font-semibold text-muted-foreground min-w-[120px]">场景因子</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const comment = row.commentText ?? "";
              const tagStr = row.tags ?? "";
              const skinType = row.skinType ?? "";
              const scenarioFactors = row.scenarioFactors ?? "";
              const tagList = tagStr ? tagStr.split(",").map((t) => t.trim()).filter(Boolean) : [];

              return (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground font-mono">{i + 1}</td>
                  <td className="px-3 py-3 text-foreground">
                    <p className="line-clamp-2 leading-relaxed">{comment || "—"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {tagList.length > 0
                        ? tagList.map((t, ti) => <TagBadge key={ti} tag={t} />)
                        : <span className="text-muted-foreground">—</span>
                      }
                    </div>
                  </td>
                  <td className="px-3 py-3 text-foreground">
                    {skinType ? (
                      <span className="inline-block px-2 py-1 rounded bg-muted/50 text-xs">
                        {skinType}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-foreground text-xs">
                    {scenarioFactors ? (
                      <div className="space-y-0.5">
                        {scenarioFactors.split(",").map((factor, fi) => (
                          <div key={fi} className="inline-block px-2 py-0.5 rounded bg-muted/40 mr-1 mb-0.5">
                            {factor.trim()}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
