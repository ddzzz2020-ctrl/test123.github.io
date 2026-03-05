import { trpc } from "@/lib/trpc";
import { Loader2, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Clock, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onSelectTask: (taskId: number) => void;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "done") return <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.5 0.12 150)" }} />;
  if (status === "failed") return <AlertCircle className="w-4 h-4 text-destructive" />;
  if (status === "processing") return <Loader className="w-4 h-4 text-muted-foreground animate-spin" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

function StatusLabel({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    done: { label: "完成", color: "oklch(0.5 0.12 150)" },
    failed: { label: "失败", color: "oklch(0.58 0.2 25)" },
    processing: { label: "处理中", color: "oklch(0.52 0.015 240)" },
    pending: { label: "等待中", color: "oklch(0.52 0.015 240)" },
  };
  const s = map[status] ?? { label: status, color: "oklch(0.52 0.015 240)" };
  return <span className="text-xs font-medium" style={{ color: s.color }}>{s.label}</span>;
}

export default function HistoryPanel({ onSelectTask }: Props) {
  const { data: tasks = [], isLoading } = trpc.tasks.list.useQuery();

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm text-foreground">历史记录</h3>
        <p className="text-xs text-muted-foreground mt-0.5">点击任务可查看结果</p>
      </div>

      {isLoading && (
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && tasks.length === 0 && (
        <div className="p-6 text-center">
          <FileSpreadsheet className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">暂无历史记录</p>
        </div>
      )}

      <div className="divide-y divide-border/50 max-h-[calc(100vh-200px)] overflow-y-auto">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => task.status === "done" && onSelectTask(task.id)}
          >
            <div className="flex items-start gap-2">
              <StatusIcon status={task.status} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate" title={task.originalFilename}>
                  {task.originalFilename}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusLabel status={task.status} />
                  <span className="text-xs text-muted-foreground">
                    {task.totalRows} 条
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {new Date(task.createdAt).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {task.status === "done" && task.resultFileUrl && (
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTask(task.id);
                  }}
                >
                  查看结果
                </Button>
                <a
                  href={task.resultFileUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2">
                    <Download className="w-3 h-3" />
                  </Button>
                </a>
              </div>
            )}

            {task.status === "processing" && (
              <div className="mt-2">
                <div className="w-full bg-muted rounded-full h-1">
                  <div
                    className="h-1 rounded-full transition-all"
                    style={{
                      width: `${task.totalRows > 0 ? Math.round((task.processedRows / task.totalRows) * 100) : 0}%`,
                      background: "oklch(0.65 0.12 230)",
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {task.processedRows} / {task.totalRows}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
