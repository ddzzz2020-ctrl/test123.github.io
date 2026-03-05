import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TagsSidebar() {
  const { data: tags = [] } = trpc.tags.list.useQuery();
  const [showModal, setShowModal] = useState(false);

  const tagDescriptions: Record<string, string> = {
    "卡粉": "粉底在面部纹理处堆积，呈现明显的粉末感",
    "起皮": "粉底与脱皮或干燥皮肤不贴合，呈现片状",
    "不服帖": "粉底与肌肤贴合度差，容易浮粉",
    "毛孔": "无法遮盖毛孔，反而突显毛孔",
    "拔干": "粉底吸收肌肤水分，导致干燥感",
    "德泽涂": "粉底涂抹不均匀，色差明显",
    "精成重/厚重/质地粗": "粉底质地厚重，上脸显得厚重感强",
    "浮粉": "粉底浮在肌肤表面，不贴合",
    "假白": "粉底色号不适合，显得肤色不自然",
    "泛红": "粉底泛红，显得肤色不均",
    "不防水不防汗": "粉底防水防汗效果差，容易脱妆",
    "不防晒": "粉底无防晒效果",
    "氧化暗沉": "粉底容易氧化，导致肤色暗沉",
    "持妆差": "粉底持妆时间短，容易脱妆",
    "脱妆": "粉底在使用过程中脱落或褪色",
    "遮瑕差": "粉底遮瑕力度不足，无法遮盖瑕疵",
    "控油差": "粉底控油效果差，容易出油",
    "显气色差": "粉底上脸不显气色，显得气色差",
    "显肤色暗": "粉底显肤色暗沉",
    "显肤色黄": "粉底显肤色偏黄",
    "显肤色红": "粉底显肤色偏红",
    "显脸暗": "粉底显脸暗沉",
    "显脸黄": "粉底显脸偏黄",
    "显脸红": "粉底显脸偏红",
    "显脸黑": "粉底显脸偏黑",
    "显脸白": "粉底显脸过白，显得不自然",
    "显脸脏": "粉底上脸显脸脏",
    "显脸老": "粉底显脸显得老气",
    "显脸肿": "粉底显脸显得浮肿",
    "中样/小样性价比低": "中样或小样容量少但价格高，性价比低",
    "正装性价比低": "正装价格高，性价比低",
    "味道不喜欢": "粉底味道刺鼻或不喜欢",
    "容易过敏": "粉底容易引起皮肤过敏",
    "刺激肌肤": "粉底刺激肌肤，引起不适",
    "情绪宣泄/无具体原因": "评论仅表达情绪，无具体问题描述",
    "无有效问题": "评论无有效问题，或为正面评价",
  };

  return (
    <>
      <div className="bg-card rounded-2xl border border-border p-4 sticky top-6">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground tracking-wide uppercase">
            标签库
          </h3>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {tags.length}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          系统内置固定标签，不支持增删改
        </p>
        <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 mb-3">
          {tags.map((tag, i) => (
            <div
              key={tag}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors group"
            >
              <span className="text-xs text-muted-foreground/50 font-mono w-5 shrink-0 text-right">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-xs text-foreground font-medium truncate">{tag}</span>
            </div>
          ))}
        </div>
        <Button
          onClick={() => setShowModal(true)}
          variant="outline"
          size="sm"
          className="w-full text-xs"
        >
          查看全部 {tags.length} 个标签
        </Button>
      </div>

      {/* 标签详情模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">38 个差评标签详情</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 内容 */}
            <div className="overflow-y-auto flex-1 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tags.map((tag) => (
                  <div
                    key={tag}
                    className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:border-border transition-colors"
                  >
                    <h4 className="font-semibold text-sm text-foreground mb-1">{tag}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {tagDescriptions[tag] || "标签描述"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部 */}
            <div className="flex justify-end gap-2 p-6 border-t border-border">
              <Button
                onClick={() => setShowModal(false)}
                variant="default"
                size="sm"
              >
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
