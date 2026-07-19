# 修 Bug 4：新建工作台直接打开浮窗 · 施工指令

## 目标

点 "新会话" → 直接在画布上打开一个工作台浮窗。**不创建工作台卡片。** 画布上只有用户的文件卡——没有那 380×532 的工作台大卡占空间。

工作台浮窗独立存在。右键浮窗标题栏 → "删除工作台" → 二次确认 → 浮窗关闭。

---

## 零、卡片缩小到五分之三，字不变

`foundation/types.ts`：

```typescript
export const CARD_W = 228;   // 380 × 0.6
export const CARD_H = 319;   // 532 × 0.6，保持 5:7
export const DOCK_W = 276;   // 460 × 0.6
export const DOCK_H = 384;   // 640 × 0.6
```

CardView 中 `cardRem` 的计算**保持基于旧基准 380**——字不随卡缩小：

```typescript
const cardRem = (380 * interaction.global.cardScale) / 150;  // 依然 380
```

卡片视觉尺寸缩小到 60%，但字、色块、状态线保持当前大小不变。

---

## 一、工作台尺寸：460 → 2000（比例 4.35×）

`foundation/types.ts`：

```typescript
export const CARD_W = 228;   // 380 × 0.6
export const CARD_H = 319;   // 532 × 0.6，保持 5:7
export const DOCK_W = 276;   // 460 × 0.6
export const DOCK_H = 384;   // 640 × 0.6
```

CardView 中 `cardRem` 的计算**保持基于旧基准 380**——字不随卡缩小：

```typescript
const cardRem = (380 * interaction.global.cardScale) / 150;  // 依然 380，不随 CARD_W 变
```

这样卡片视觉尺寸缩小到 60%，但字、色块、状态线保持当前大小。

`Workbench.tsx` 和 `foundation/types.ts` 中以下值全面同步放大（乘 4.35）：

| 参数 | 旧值 | 新值 |
|------|------|------|
| `workbench.panelWidth` | 460 | **2000** |
| 图标列宽度 | 50 | **220** |
| 图标字号 | 14px(≈0.875rem) | **3.8rem** |
| 角标字号 | 8px(≈0.5rem) | **2.2rem** |
| 图标 padding | 6×2 | **26×9** |
| 图标间距 | 2 | **9** |
| 抽屉宽度 | 250 | **1000** |
| 抽屉最大高度 | 320 | **1400** |
| 对话区 maxHeight | 340 | **1500** |
| 对话区 minHeight | 100 | **440** |
| 输入区行数 | 2 | **6** |
| 输入区高度 | 44 | **200** |
| Header 字号基准 | 0.5625rem | **2.5rem** |
| Header padding | 4×8 | **18×35** |
| 按钮 padding | 3×8 | **13×35** |
| 确认条 padding | 8×10 | **35×44** |
| 消息内边距 | 6 | **26** |
| 消息字号 | 11px(≈0.6875rem) | **3rem** |
| 勾选框大小 | 12×12 | **52×52** |
| 区折叠标题 padding | 6×10 | **26×44** |
| 区折叠标题字号 | 0.625rem | **2.7rem** |
| 总高上限 | 70vh | **85vh** |
| 新建卡片弹窗宽度 | 260 | **1100** |
| 模式按钮字体 | 0.5625rem | **2.5rem** |
| 思考链下拉字体 | 0.5625rem | **2.5rem** |
| 模型下拉字体 | 0.5625rem | **2.5rem** |
| textarea 字体 | 0.6875rem | **3rem** |

## 三、工作台不再依赖卡片

### 改 `App.tsx`

`createWorkbench` 不再 `createCard`。改成直接生成一个 `workbenchId`，不建卡、不用球：

```typescript
const createWorkbench = useCallback(() => {
  const wbId = `wb-${Date.now()}`;  // 纯内存 ID，不存 OPFS
  setOpenWorkbenchId(wbId);
}, []);
```

`openWorkbenchId` 传给 Canvas → Canvas 直接渲染一个 Workbench 浮窗，不需要 `index.cards[id]`。

### 改 `Canvas.tsx`

原来：

```typescript
{openWorkbench && (
  <Workbench card={index.cards[openWorkbench]} ... />
)}
```

改为接受独立的工作台 ID：

```typescript
{activeWorkbenches.map((wb) => (
  <Workbench
    key={wb.id}
    workbenchId={wb.id}
    position={wb.position}
    allCards={Object.values(index.cards)}
    registerZone={registerZone}
    unregisterZone={unregisterZone}
    onClose={(id) => { /* 关闭浮窗 */ }}
    onDelete={(id) => { /* 二次确认后删除 */ }}
  />
))}
```

### 工作台位置

新工作台出现在画布视口中央：

```typescript
const v = view.current;
const x = (-v.x + window.innerWidth / 2) / v.zoom - CARD_W;
const y = (-v.y + window.innerHeight / 2) / v.zoom;
```

---

## 二、改 Workbench.tsx

### 去掉对 `card` 的依赖

当前 `WorkbenchProps` 需要 `card: CardEntry`。改为：

```typescript
interface WorkbenchProps {
  workbenchId: string;
  position: { x: number; y: number };
  interaction: InteractionConfig;
  allCards: CardEntry[];
  registerZone: ...;
  unregisterZone: ...;
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
}
```

所有原来读 `card.xxx` 的地方改为用 `workbenchId` 或 props：
- `card.id` → `workbenchId`
- `card.position` → `position`
- `card.label` → 默认"新会话"（可重命名，存在组件 state）
- `card.isWorkbench` → 不需要了

### 浮窗标题栏加关闭/删除按钮

在浮窗顶部加一条标题栏：

```
┌─────────────────────────────────┐
│ 新会话          [重命名] [×]    │
├─────────────────────────────────┤
│ ...                             │
```

- `[×]` → 关闭浮窗（保留会话，下次打开还在——如果做了持久化）
- 右键标题栏 → "删除工作台" → 弹出确认 → 删会话 + 关浮窗

二次确认：

```typescript
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
```

### 持久化不变

会话仍然以 `workbenchId` 为 key 存 OPFS（`sessions/{id}.json`）。关闭浮窗再打开——如果 Canvas 里存了这个 workbenchId → 恢复会话。

---

## 四、工作台浮窗管理

Canvas 维护一个 `activeWorkbenches` 数组：

```typescript
interface ActiveWorkbench {
  id: string;
  position: { x: number; y: number };
}

const [activeWorkbenches, setActiveWorkbenches] = useState<ActiveWorkbench[]>([]);
```

- 创建：`addWorkbench(wbId, {x, y})`
- 关闭：`removeWorkbench(wbId)` — 保留在后台列表中（可重新打开）
- 删除：从列表中彻底移除 + 删会话文件

---

## 五、文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `App.tsx` | createWorkbench 不建卡，直接生成 workbenchId |
| 修改 | `ui/canvas/Canvas.tsx` | 管理 activeWorkbenches 数组，渲染独立浮窗 |
| 修改 | `ui/workbench/Workbench.tsx` | 去掉 card 依赖，加标题栏 + 删除确认 |

## 六、验收

1. 点 "新会话" → 画布中央出现工作台浮窗，画布上没有新卡片
2. 浮窗有标题栏（"新会话" + 关闭 ×）
3. 右键标题栏 → "删除工作台" → 弹确认 → 确认后浮窗消失
4. 关闭浮窗 → 再次点新会话 → 新浮窗出现（上次会话恢复或不恢复，取决于持久化设置）
5. 不影响已有文件卡片的功能
6. `npx tsc --noEmit` 零错误
