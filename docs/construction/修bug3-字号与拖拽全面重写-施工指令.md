# 修 Bug 3：字号系统 + 拖拽全面重写 · 施工指令

## 一、字号系统：硬编码 px → 动态 rem

### 问题

所有组件的 `fontSize` 是硬编码 px。卡片从 150 变成 750，字仍是 10px——肉眼看不见。

### 方案

卡片本身已经是 `CARD_W * cardScale` 渲染。所有卡片内文字应该基于**当前卡片实际宽度**计算字号。不用全局 rem——而是每个 CardView 自己算 `cardRem` 基准：

```typescript
// CardView 渲染前
const displayW = CARD_W * interaction.global.cardScale;
const displayH = CARD_H * interaction.global.cardScale;
const cardRem = displayW / 150;  // 以 150px 宽的卡片为基准 1rem
```

CardView 内所有 `fontSize` 从 `10` 改为 `10 * cardRem`：

```typescript
// 卡片名：10px → 10 * cardRem
fontSize: 10 * cardRem,
// 预览区：9px → 9 * cardRem  
fontSize: 9 * cardRem,
// 标签：8px → 8 * cardRem
fontSize: 8 * cardRem,
// 状态线宽度：3px → 3 * cardRem
width: 3 * cardRem,
// 类型色块：6×12 → 6*cardRem × 12*cardRem
width: 6 * cardRem, height: 12 * cardRem,
```

**工作台同理。** 工作台根节点已经有 `fontSize: ${16 * uiScale}px`，但内部组件都是硬编码 px 没走 rem。改成：Workbench 根设 `font-size: ${10 * uiScale}px`（约 30px），内部所有 px 字号换成 em/rem。

具体换算——Workbench 内部字号原来是 9-11px。将根字号从 `16 * uiScale` 改为 `12 * uiScale`，内部所有 `fontSize` 用 `em` 单位，`fontSize: "1em"` 就是 12×3=36px（uiScale=3时）。

不逐字改——在 Workbench.tsx 的根 div 加 `fontSize: "${12 * uiScale}px"`，把所有内联 `fontSize: 数值` 换成 `fontSize: em值`：

```
fontSize: 10 → fontSize: "0.8em"
fontSize: 11 → fontSize: "0.9em"
fontSize: 12 → fontSize: "1em"
fontSize: 13 → fontSize: "1.1em"
fontSize: 14 → fontSize: "1.2em"
```

### 设置面板滑动条

确认 SettingsPanel 中两个 `<input type="range">` —— `uiScale`（0.8-2.0）和 `cardScale`（0.6-1.4）——的值写入 localStorage 后，Canvas 能读到并应用于 `effectiveInteraction`。

检查链：
1. 滑动条 `onChange` → `localStorage.setItem`
2. Canvas → `useEffect` → 读 localStorage → 更新 `effectiveInteraction`
3. CardView 读 `interaction.global.cardScale` 计算 `displayW/displayH`
4. 工作台根 div 读 `interaction.global.uiScale` 设置根字号

---

## 二、拖拽手感全面重写

### 目标：卡牌游戏手感

```
hover → 卡片上浮 4px + 阴影
按下 → 卡片继续悬浮
拖拽 → 卡片完全跟手（1:1，零延迟），比指针高 4px
松手 → 卡片落下（回到原位 Y，弹簧，200ms）
      如果鼠标在动（扔出）→ 惯性滑行，逐渐减速
```

### 改 `foundation/types.ts` → `defaultInteraction()`

```typescript
card: {
  dragDelayFrames: 0,        // 零延迟——按下立刻跟手
  dragFollowRatio: 1.0,      // 完全跟手，不留追赶距离
  dragScaleOnPickup: 1.0,    // 不缩放——抬起的视觉效果靠上浮+阴影
  dragShadow: "0 8px 24px rgba(0,0,0,0.2)",  // 更重的阴影
  throwDecay: 0.92,          // 保持不变：扔出时每帧衰减
  minThrowVelocity: 3,        // 稍高一点的投掷触发阈值
},
```

### 改 `ui/card/CardView.tsx`

**静态时（hover 态）：**

```typescript
// CardView 根 div 加 CSS hover
onMouseEnter → el.style.transform = `translate(${card.position.x}px, ${card.position.y - 4}px)` 
               + el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"
onMouseLeave → el.style.transform = `translate(${card.position.x}px, ${card.position.y}px)`
               + el.style.boxShadow = "none"
```

**按下（pointerDown）——不启动拖拽，只做上浮：**

```typescript
const onPointerDown = useCallback((e: React.PointerEvent) => {
  // ... 现有逻辑 + ：
  const el = elRef.current;
  if (el) {
    el.style.transition = "none";
    el.style.transform = `translate(${d.cx}px, ${d.cy - 6}px)`;
    el.style.boxShadow = interaction.card.dragShadow;
    el.style.zIndex = "1000";
  }
  // 不调 dragLoop——等 onPointerMove 判断
}, []);
```

**移动（pointerMove）——首次移动超过 5px 才启动 dragLoop（需更大的阈值因为 hover 上浮会微移鼠标）：**

```typescript
const onPointerMove = useCallback((e: React.PointerEvent) => {
  if (!ds.current.active) return;
  
  const d = ds.current;
  const dx = e.clientX - d.startX;
  const dy = e.clientY - d.startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // 阈值提高到 5px——避免 hover 上浮时轻微移动触发拖拽
  if (!isDragging.current && dist > 5) {
    isDragging.current = true;
    document.body.style.cursor = "grabbing";
    raf.current = requestAnimationFrame(dragLoop);
    onDragStart?.(card.id);
  }
  
  if (!isDragging.current) return;
  
  // 拖拽中：卡片位置 = 指针位置，Y 轴偏移 -6px（悬浮在上方）
  d.px = e.clientX;
  d.py = e.clientY;
  // dragLoop 里会用 1.0 的 followRatio——即刻跟随
}, []);
```

**dragLoop——简化版，1:1 跟随：**

```typescript
const dragLoop = useCallback(() => {
  const d = ds.current;
  if (!d.active || !isDragging.current) return;
  
  // 完全跟手——卡片中心和指针重合
  d.cx = d.px;
  d.cy = d.py - 6;  // 轻微上浮
  
  if (elRef.current) {
    elRef.current.style.transform = `translate(${d.cx}px, ${d.cy}px)`;
  }
  
  onDragMove?.(card.id, d.cx, d.cy, d.px, d.py);
  raf.current = requestAnimationFrame(dragLoop);
}, [card.id, onDragMove]);
```

**松手（pointerUp）——卡片落下：**

```typescript
const finishDrag = useCallback(() => {
  const d = ds.current;
  d.active = false;
  cancelAnimationFrame(raf.current);
  isDragging.current = false;
  document.body.style.cursor = "";
  
  const el = elRef.current;
  if (!el) return;
  
  // 卡片落下动画：弹簧回到原位
  el.style.transition = "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)";
  el.style.transform = `translate(${d.cx}px, ${d.cy})`;  // 去掉 -6，回到正常 Y
  el.style.zIndex = "";
  
  // 阴影在 150ms 后消失
  setTimeout(() => {
    if (el) { el.style.boxShadow = "none"; el.style.transition = ""; }
  }, 150);
  
  // 投掷：检查最近 3 帧指针速度
  const avgVx = (d.px - d.prevPrevPx) / 3;
  const avgVy = (d.py - d.prevPrevPy) / 3;
  const speed = Math.sqrt(avgVx * avgVx + avgVy * avgVy);
  
  if (speed > interaction.card.minThrowVelocity) {
    // 惯性投掷
    throwLoop(avgVx, avgVy);
  } else {
    onDragEnd?.(card.id, d.cx, d.cy + 6);  // +6 恢复真实 Y
  }
}, [interaction, card.id, onDragEnd, throwLoop]);
```

**throwLoop——保持不变。**

---

## 三、右键菜单位置修复

问题：ContextMenu 组件用 `position: fixed` 定位在 `{x: e.clientX, y: e.clientY}`。但 Canvas 有 `transform: scale(view.zoom)`。当 zoom ≠ 1 时，卡片视觉位置和实际 clientX/clientY 有偏差。

简单修复：ContextMenu 在 Canvas 的 `contentRef` 内部渲染（用 `position: absolute` 而非 `position: fixed`），坐标用 CardView 的实际画布坐标 `{card.position.x + CARD_W / 2, card.position.y}`。这需要 CardView 的 `onContextMenu` 回调传画布坐标而不是屏幕坐标。

或者更简单的修复：ContextMenu 仍在 body 下用 fixed 定位，但在 Canvas 上监听到 zoom 变化时关闭菜单（或不做——首次点击后菜单打开，zoom 不变就行）。

对于当前问题——**菜单固定在画布一个位置**：检查 ContextMenu 是否在 Canvas 的 `contentRef` 内部（受 transform 影响）。如果是，改成 render 到 `document.body`（Portal）。

改 CardView 中 `onContextMenu` 的回调，从传 `{x: e.clientX, y: e.clientY}` 改为直接打开 ContextMenu 到 body：

```typescript
// CardView 的 onContextMenu 中：
const onContextMenu = useCallback((e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  // 直接打开 ContextMenu 到 body（避开 Canvas transform）
  setCtxMenu({ x: e.clientX, y: e.clientY });
}, []);
```

同时在 CardView 渲染中，ContextMenu 用 `createPortal` 渲染到 `document.body`：

```typescript
{ctxMenu && createPortal(
  <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={...} onClose={() => setCtxMenu(null)} />,
  document.body
)}
```

---

## 四、卡片尺寸调整

`CARD_W` 从 750 降到约一半——380。

```typescript
export const CARD_W = 380;
export const CARD_H = 532;   // 5:7 比例
export const DOCK_W = 460;   // 跟随缩小
export const DOCK_H = 640;
```

这样子 `cardScale` 默认 1.0 时，卡片约 380×532——在 1920 屏上是肉眼可见且有存在感的尺寸。想更大/更小用设置面板的滑动条调。

---

## 五、文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `foundation/types.ts` | dragFollowRatio→1.0, dragDelayFrames→0, dragScaleOnPickup→1.0, dragShadow 加重, CARD_W→380, DOCK_W→460, uiScale→3.0 |
| 修改 | `ui/card/CardView.tsx` | 字号 cardRem 体系 + hover 上浮 + 拖拽 1:1 + 松手落下 + 右键 portal 到 body |
| 修改 | `ui/workbench/Workbench.tsx` | 所有 fontSize 硬编码 px → em 动态 |

## 六、验收

1. 卡片约 380×532，画布上清晰可见
2. 卡片上字号、色块、状态线随卡片大小同步缩放
3. 鼠标悬停卡片 → 卡片上浮 4px + 淡阴影
4. 按下拖拽 → 卡片上浮 6px + 重阴影 → 跟着指针 1:1 移动
5. 松手 → 卡片落下回弹 → 阴影淡出
6. 右键卡片 → 菜单出现在指针位置，不是固定画布位置
7. 右键删除功能正常
8. 工作台内字号清晰可读
9. 设置面板 uiScale/cardScale 滑动条拉动 → 实时生效
10. `npx tsc --noEmit` 零错误
