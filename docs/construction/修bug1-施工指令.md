# 修 Bug 1：UX 紧急修复 · 施工指令

## 目标

修 8 个用户上手时立刻遇到的 UX 问题。

---

## 一、拖拽跟随比例：0.4 → 0.65

**文件：`foundation/types.ts`**

`defaultInteraction()` 中 `dragFollowRatio: 0.4` → `dragFollowRatio: 0.65`。

为什么：0.4 太慢，鼠标跑了半屏幕卡片还在后头。0.65 保留了物理感（不是 1:1 贴手），但不再拖沓。

**不需要改 CardView 逻辑——CardView 已经读 `interaction.card.dragFollowRatio` 变量。只改数字。**

---

## 二、卡片尺寸：可调滑动条，默认 220×308

**文件：`foundation/types.ts`**

在 `InteractionConfig.global` 加字段：

```typescript
cardScale: number;  // 0.6～1.4, 默认 1.0。150×210 的倍率
```

`defaultInteraction()` 中 `cardScale: 1.0`。

CardView 渲染时动态计算：

```typescript
const w = CARD_W * interaction.global.cardScale;
const h = CARD_H * interaction.global.cardScale;
```

默认 150×210 × 1.0 = 150×210（保持不变）。用户调到 1.47 = 220×308。调到 2.0 = 300×420。

**不需要改 CARD_W/CARD_H 常量**——它们是基准值。渲染尺寸由 cardScale 倍率决定。

**连带影响：**
- 快照生成尺寸保持 300×400（够用，cardScale 拉到最大也够）
- `DOCK_W` / `DOCK_H` 随 cardScale 同步缩放
- 包内缩略图和 Tray 区缩略图保持固定 80×112（不随卡片缩放）

**文件：`ui/panels/SettingsPanel.tsx`**

加卡片大小滑动条。和 UI Scale 放在一起。

---

## 二点五、快照质量提升

**文件：`features/snapshot.ts`**

快照模糊的两个原因同时修：

a) 文本快照的字号太小——Canvas 上 `fillText` 用 10px font，生成的 PNG 是 300×400，再缩小到预览区后就糊了。

```typescript
// snapshotText 中（第 65 行）：
// 旧：ctx.font = "10px monospace";
// 新：ctx.font = "14px monospace";

// snapshotCSV 中（第 120 行）：
// 旧：ctx.font = ri === 0 ? "bold 8px monospace" : "8px monospace";
// 新：ctx.font = ri === 0 ? "bold 11px monospace" : "11px monospace";
```

b) PNG 压缩率太低——0.6 的 quality 参数牺牲了锐利度。

```typescript
// snapshotImage（第 43 行）："image/png", 0.7 → 0.85
// snapshotText（第 73 行）："image/png", 0.6 → 0.85
// snapshotCSV（第 126 行）："image/png", 0.6 → 0.85
```

三处 `canvas.toBlob` 的 quality 参数全部从 0.6/0.7 调到 0.85。

---

## 三、欢迎状态

**文件：`ui/canvas/Canvas.tsx`**

当 `cards.length === 0` 时，在画布中央渲染引导层：

```typescript
{cards.length === 0 && (
  <div style={{
    position: "absolute", inset: 0,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    pointerEvents: "none",
    color: "#d1d5db", fontFamily: "system-ui, sans-serif",
  }}>
    <div style={{ fontSize: 48, fontWeight: 300, letterSpacing: 8, marginBottom: 24 }}>
      Smelt
    </div>
    <div style={{ fontSize: 13, lineHeight: 2, textAlign: "center" }}>
      {t("canvas.welcomeHint1")}<br/>
      {t("canvas.welcomeHint2")}<br/>
      {t("canvas.welcomeHint3")}
    </div>
  </div>
)}
```

i18n key（zh/en）：
- `canvas.welcomeHint1`: "拖文件到此处，或 Ctrl+N 新建工作台" / "Drag files here, or Ctrl+N for a new workbench"
- `canvas.welcomeHint2`: "双击卡片打开工作台，右键卡片导出为 .card" / "Double-click a card to open workbench, right-click to export as .card"
- `canvas.welcomeHint3`: "这是一张无限画布——拖拽平移，滚轮缩放" / "Infinite canvas — drag to pan, scroll to zoom"

当画布上出现第一张卡片时，引导层自然消失（被卡片遮挡）。不需要额外判断。

---

## 四、新建工作台自动打开浮窗

**文件：`App.tsx` → `createWorkbench`**

```typescript
const createWorkbench = useCallback(() => {
  if (!index) return;
  const card = createCard(t("wb.newSession"), {
    x: 300,  // 画布中央附近，不是随机
    y: 200,
  });
  card.isWorkbench = true;
  refresh();
  // 新：自动打开浮窗
  setTimeout(() => setOpenWorkbenchId(card.id), 300);
}, [index, refresh]);
```

Canvas 需要接受一个新的 prop `autoOpenWorkbenchId`：

```typescript
// Canvas 中：
const [autoOpenId, setAutoOpenId] = useState<string | null>(null);

// 当 prop 传入时，自动加入 openWorkbenches
useEffect(() => {
  if (autoOpenWorkbenchId) {
    setOpenWorkbenches((prev) => new Set([...prev, autoOpenWorkbenchId]));
    setAutoOpenWorkbenchId(null);  // 执行一次就清
  }
}, [autoOpenWorkbenchId]);
```

---

## 五、画布底色 + 网格点加深

**文件：`foundation/types.ts` → `defaultInteraction()`**

```typescript
// 旧
global: {
  backgroundColor: "#fafbfc",  // 太白
  gridColor: "#e5e7eb",         // 太淡
  ...
}
// 新
global: {
  backgroundColor: "#f5f5f5",   // 微灰，鼠标白色三角可见
  gridColor: "#d1d5db",         // 加深，网格可见
  ...
}
```

---

## 六、拖拽时强制鼠标态

**文件：`ui/card/CardView.tsx` → `dragLoop`**

在 `isDragging.current = true` 之后（约第 108 行），加一行：

```typescript
document.body.style.cursor = "grabbing";
```

在 `finishDrag` 中复位（约第 170 行之后）：

```typescript
document.body.style.cursor = "";
```

---

## 七、+号按钮行为修正

**文件：`App.tsx` / `Canvas.tsx`**

当前 + 号 `handleAddCard`（Canvas 第 198 行附近）创建空卡片。改为**直接新建工作台**（和 Ctrl+N 一样）。

```typescript
// 旧：createCard(t("card.defaultLabel"), ...)
// 新：onCreateWorkbench()
```

+ 号变成"新建工作台"按钮。用户不需要单独"创建空卡片"——空卡无意义。

如果想创建独立卡片（非工作台）：只能通过"文件拖入"或"工作台内新建卡片"或"导入 .card"。+号不承担这个职责。

---

## 八、UI Scale 系统

**文件：`foundation/types.ts` → `InteractionConfig.global`**

加字段：

```typescript
uiScale: number;  // 0.8～2.0, 默认 1.0
```

`defaultInteraction()` 中 `uiScale: 1.0`。

**文件：`ui/canvas/Canvas.tsx`**

最外层 div 加：

```typescript
style={{ fontSize: `${16 * effectiveInteraction.global.uiScale}px` }}
```

**全项目改动：** 所有 `fontSize` 数字从 `px` 改 `rem`。换算规则：

```
fontSize: 10  → fontSize: "0.625rem"
fontSize: 11  → fontSize: "0.6875rem"
fontSize: 12  → fontSize: "0.75rem"
fontSize: 13  → fontSize: "0.8125rem"
fontSize: 14  → fontSize: "0.875rem"
fontSize: 16  → fontSize: "1rem"
fontSize: 18  → fontSize: "1.125rem"
fontSize: 20  → fontSize: "1.25rem"
fontSize: 24  → fontSize: "1.5rem"
fontSize: 28  → fontSize: "1.75rem"
fontSize: 48  → fontSize: "3rem"
```

**文件：`ui/panels/SettingsPanel.tsx`**

加 UI Scale 滑动条：

```
UI 大小：[小] ───●─── [大]
           0.8     1.0     2.0
```

拖滑动条 → 更新 `interaction.global.uiScale` → 存 localStorage → Canvas reren渲染。

---

## 九、文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `foundation/types.ts` | dragFollowRatio、CARD_W/H、底色、网格色、uiScale 字段 |
| 修改 | `ui/canvas/Canvas.tsx` | 欢迎状态、autoOpen 逻辑、uiScale 根字号、+号改新建工作台 |
| 修改 | `ui/card/CardView.tsx` | 拖拽时 body cursor grabbing / 松开复位 |
| 修改 | `App.tsx` | 新建工作台自动打开 + 传 autoOpenId |
| 全项目 | 所有 .tsx 文件 | px → rem 换算 |

**全项目 rem 替换用 sed 批量处理：**

```
s/fontSize: 10/fontSize: "0.625rem"/g（仅在 style 对象内）
s/fontSize: 11/fontSize: "0.6875rem"/g
s/fontSize: 12/fontSize: "0.75rem"/g
...以此类推
```

建议手动检查——有些 `fontSize` 是数字变量（如 `{14}`），那些保持不碰。

---

## 十、验收

1. 刷新空间 → 画布中央显示"Smelt"大 logo + 三条提示文字
2. 拖一个文件进来 → logo 和提示消失 → 卡片出现在画布上（200×280，比之前大）
3. 拖拽卡片 → 跟随灵敏不拖沓 → 松开后弹簧回落
4. 拖拽时鼠标态始终为 `grabbing`，松手恢复
5. 点 + 号 → 工作台卡片出现在画布中央 → 浮窗自动打开
6. 右键工作台卡片 → 菜单正常弹出
7. 画布底色微灰，鼠标可见
8. 设置面板拉 UI Scale → 全局字号同步缩放
10. 卡片快照清晰——文字不糊、颜色不晕、边缘锐利
11. 设置面板拉卡片大小滑条 → 画布上所有卡片同步缩放
12. `npx tsc --noEmit` 零错误
