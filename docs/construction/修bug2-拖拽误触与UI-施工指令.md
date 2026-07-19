# 修 Bug 2：拖拽误触 + UI 尺寸全面放大 · 施工指令

## 问题

A. 每次点卡片（单击、双击）都触发了拖拽拾起动画。`onPointerDown` 直接启动 `dragLoop`，没有区分"想点"和"想拖"。

B. 所有 UI 极小。卡片 150×210 在 1920 屏上不可见。工作台 UI 字号 9-11px 完全看不清。设置面板滑动条找不到。画布太白。欢迎文字太小。

---

## 一、拖拽误触修复

改 `ui/card/CardView.tsx`。

### 1. 在 `ds` ref 里加字段

```typescript
const ds = useRef({
  active: false, frame: 0,
  startX: 0, startY: 0,   // 新增：按下的位置
  px: 0, py: 0, ...
});
```

### 2. `onPointerDown` 不启动拖拽——只记录位置

```typescript
const onPointerDown = useCallback((e: React.PointerEvent) => {
  if (editing || deleting) return;
  onClick?.(card.id, e as unknown as React.MouseEvent);
  
  cancelAnimationFrame(raf.current);
  const d = ds.current;
  
  d.active = true;
  d.frame = 0;
  d.startX = e.clientX;  // 记录起始位置
  d.startY = e.clientY;
  d.px = e.clientX;
  d.py = e.clientY;
  d.prevPx = e.clientX;
  d.prevPy = e.clientY;
  d.prevPrevPx = e.clientX;
  d.prevPrevPy = e.clientY;
  d.cx = card.position.x;
  d.cy = card.position.y;
  
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  // 不调 dragLoop——等 onPointerMove 判断是否真拖拽
}, [editing, deleting, card, onClick]);
```

### 3. `onPointerMove` 检测移动距离——超过 3px 才启动拖拽

```typescript
const onPointerMove = useCallback((e: React.PointerEvent) => {
  if (!ds.current.active) return;
  
  const d = ds.current;
  const dx = e.clientX - d.startX;
  const dy = e.clientY - d.startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // 移动超过 3px 才算拖拽
  if (!isDragging.current && dist > 3) {
    isDragging.current = true;
    
    const el = elRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = `translate(${d.cx}px, ${d.cy}px) scale(1.05)`;
      el.style.boxShadow = interaction.card.dragShadow;
    }
    document.body.style.cursor = "grabbing";
    
    raf.current = requestAnimationFrame(dragLoop);
    onDragStart?.(card.id);
  }
  
  if (!isDragging.current) return;  // 没到 3px，不处理
  
  // 正常拖拽跟随
  d.prevPrevPx = d.prevPx;
  d.prevPrevPy = d.prevPy;
  d.prevPx = d.px;
  d.prevPy = d.py;
  d.px = e.clientX;
  d.py = e.clientY;
}, [interaction, card, onDragStart, dragLoop]);
```

### 4. `onPointerUp` 判断：没拖过 → 不触发 drag end

```typescript
const onPointerUp = useCallback(() => {
  if (!ds.current.active) return;
  
  if (!isDragging.current) {
    ds.current.active = false;
    return;  // 没有移动——纯点击，清理状态
  }
  
  finishDrag();
}, [finishDrag]);
```

### 5. `dragLoop` 保持不变

只在 `onPointerMove` 检测到真实移动后才启动。

---

## 二、UI 尺寸全面放大

### 改 `foundation/types.ts` → `defaultInteraction()`

**默认值改为：**

```typescript
// 旧
uiScale: 1.0,
cardScale: 1.0,
backgroundColor: "#f5f5f5",

// 新
uiScale: 3.0,           // 3x 全局 UI
cardScale: 5.0,          // 5x 卡片（150→750 基准，太大，见下方单独处理）
backgroundColor: "#c0c0c0",  // 比 #f5f5f5 暗约 30%
```

**注意**：`cardScale: 5.0` 会让卡片变成 750×1050 基准尺寸——太大了。改为"默认值 5.0 但是卡片本身也按比例合理缩放"。

实际更合理的做法：把 `CARD_W` / `CARD_H` 放大，`cardScale` 保持 1.0：

```typescript
// foundation/types.ts
export const CARD_W = 750;   // 原 150 → 5x
export const CARD_H = 1050;  // 原 210 → 5x

export const DOCK_W = 900;   // 原 180 → 5x
export const DOCK_H = 1250;  // 原 250 → 5x
```

连同 Dock 尺寸一起放大 5 倍。

### 画布背景 + 网格

```typescript
// defaultInteraction() 中
global: {
  backgroundColor: "#c0c0c0",  // 暗 30%
  gridColor: "#a0a0a0",        // 网格也加深
  gridSpacing: 40,
  fontFamily: "system-ui, sans-serif",
  animationEnabled: true,
  uiScale: 3.0,
  cardScale: 1.0,    // 卡片已直接放大，scale 不再需要
}
```

### 欢迎文字

改 `Canvas.tsx` 欢迎状态：

```typescript
<div style={{ fontSize: "9rem", fontWeight: 700, letterSpacing: 8, marginBottom: 24 }}>
  Smelt
</div>
<div style={{ fontSize: "2.5rem", fontWeight: 600, lineHeight: 2, textAlign: "center", color: "#808080" }}>
  {t("canvas.welcomeHint1")}<br />
  {t("canvas.welcomeHint2")}<br />
  {t("canvas.welcomeHint3")}
</div>
```

### 设置面板中的 UI Scale 滑动条

确认 `SettingsPanel.tsx` 中两处滑动条和标签的 `fontSize` 使用 `rem` 单位（已有 uiScale 作为根字号基数，rem 会自动放大）。如果文字仍然太小，标签用的 `fontSize` 改成 `"1rem"` 以上。

关键检查点：
- SettingsPanel 里两个 `<input type="range">` 应该可见
- 滑动条标签文字不小于 `0.875rem`（14px 等效）

### 工作台

Workbench 总宽 460px 在原来的全局 uiScale 下没问题——但卡片已经 5x 放大，工作台浮窗需要跟着放大。由于 `panelStyle` 用了 `interaction.workbench.panelWidth`（默认 460），应在 `defaultInteraction()` 中：

```typescript
workbench: {
  openSpringStiffness: 200,
  openSpringDamping: 24,
  panelWidth: 1380,   // 原 460 → 3x（不是 5x，因为工作台 UI 需要 3x 就够）
  showThinkingTrace: true,
},
```

**总结默认值变化表**：

| 参数 | 旧 | 新 | 说明 |
|------|----|----|------|
| `CARD_W` | 150 | 750 | 5x |
| `CARD_H` | 210 | 1050 | 5x |
| `DOCK_W` | 180 | 900 | 5x |
| `DOCK_H` | 250 | 1250 | 5x |
| `uiScale` | 1.0 | 3.0 | 全局 UI 3x |
| `cardScale` | 1.0 | 1.0 | 卡片已直接放大 |
| `backgroundColor` | #f5f5f5 | #c0c0c0 | 暗 30% |
| `gridColor` | #d1d5db | #a0a0a0 | 同步暗 |
| `workbench.panelWidth` | 460 | 1380 | 3x |

---

## 三、文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `ui/card/CardView.tsx` | 拖拽误触：pointerDown 不启动 drag，pointerMove 检测 3px 阈 值 |
| 修改 | `foundation/types.ts` | 全部尺寸默认值：卡片 5x、UI 3x、画布暗 30%、Dock 5x |
| 修改 | `ui/canvas/Canvas.tsx` | 欢迎文字放大：Smelt 9rem bold、提示 2.5rem bold |

## 四、验收

1. 单击卡片 → 选中（边框高亮），卡片不缩放不飘
2. 双击卡片 → 改名模式或打开工作台
3. 按住拖超过 3px → 拾起动画 → 跟随鼠标
4. 卡片在画布上很大、一眼可见
5. 工作台打开 → 全部字号清晰可读
6. 画布底色明显偏灰、不刺眼
7. 空画布中央 "Smelt" 大字醒目、三段提示可读
8. `npx tsc --noEmit` 零错误
