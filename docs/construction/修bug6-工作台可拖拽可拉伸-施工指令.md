# 修 Bug 6：工作台可拖拽移动 + 自由拉伸边框 · 施工指令

## 目标

工作台浮窗像桌面窗口一样：拖标题栏移动、拖右下角拉伸。不再绑定卡片位置。

---

## 一、改 Workbench.tsx

### 1. 加状态

```typescript
const [size, setSize] = useState({ w: 2000, h: 800 });  // 初始尺寸
const [pos, setPos] = useState({ x: 200, y: 150 });     // 画布坐标
```

### 2. 标题栏——可拖拽移动

在最顶部加一个 40px 高的标题栏：

```typescript
const titleDrag = useRef({ active: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

<div
  onPointerDown={(e) => {
    titleDrag.current = { active: true, startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }}
  onPointerMove={(e) => {
    if (!titleDrag.current.active) return;
    setPos({
      x: titleDrag.current.startPosX + (e.clientX - titleDrag.current.startX),
      y: titleDrag.current.startPosY + (e.clientY - titleDrag.current.startY),
    });
  }}
  onPointerUp={() => { titleDrag.current.active = false; }}
  style={{ height: 40, cursor: "grab", display: "flex", alignItems: "center", padding: "0 12px", borderBottom: "1px solid #e5e7eb", userSelect: "none" }}
>
  <span style={{ fontSize: "2rem", fontWeight: 600 }}>工作台</span>
  <span style={{ marginLeft: "auto", fontSize: "1.5rem", color: "#6b7280", cursor: "pointer" }} onClick={onClose}>×</span>
</div>
```

### 3. 右下角——可拉伸

```typescript
const resize = useRef({ active: false, startX: 0, startY: 0, startW: 0, startH: 0 });

<div
  onPointerDown={(e) => {
    e.stopPropagation();
    resize.current = { active: true, startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }}
  onPointerMove={(e) => {
    if (!resize.current.active) return;
    setSize({
      w: Math.max(600, resize.current.startW + (e.clientX - resize.current.startX)),
      h: Math.max(400, resize.current.startH + (e.clientY - resize.current.startY)),
    });
  }}
  onPointerUp={() => { resize.current.active = false; }}
  style={{
    position: "absolute", right: 0, bottom: 0,
    width: 24, height: 24, cursor: "nwse-resize",
  }}
>
  <div style={{
    width: 0, height: 0,
    borderLeft: "12px solid transparent",
    borderRight: "12px solid #d1d5db",
    borderTop: "12px solid #d1d5db",
    borderBottom: "12px solid transparent",
    position: "absolute", right: 2, bottom: 2,
  }} />
</div>
```

### 4. 去掉对卡片 position 的依赖

所有原来读 `card.position.x / card.position.y` 的地方改为 `pos.x / pos.y`。面板宽度从 `interaction.workbench.panelWidth` 改为 `size.w`。

---

## 二、改 Canvas.tsx

Workbench 不再从 `openWorkbenches` Set 中读取卡片。改为单独的 `activeWorkbenches` 数组：

```typescript
interface WbWindow {
  id: string;
}

const [activeWorkbenches, setActiveWorkbenches] = useState<WbWindow[]>([]);

// 渲染：
{activeWorkbenches.map((wb) => (
  <Workbench
    key={wb.id}
    workbenchId={wb.id}
    allCards={Object.values(index.cards)}
    interaction={effectiveInteraction}
    registerZone={registerZone}
    unregisterZone={unregisterZone}
    onClose={(id) => setActiveWorkbenches((prev) => prev.filter((w) => w.id !== id))}
  />
))}
```

---

## 三、改 App.tsx

`createWorkbench` 不再创建卡片：

```typescript
const createWorkbench = useCallback(() => {
  setNewWorkbench(true);
}, []);
```

Canvas 收到 `newWorkbench` 标志 → 添加一个工作台窗口：

```typescript
if (newWorkbench) {
  setActiveWorkbenches((prev) => [...prev, { id: `wb-${Date.now()}` }]);
  setNewWorkbench(false);
}
```

---

## 四、文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `ui/workbench/Workbench.tsx` | 加标题栏拖拽 + 右下角拉伸 + size/pos state |
| 修改 | `ui/canvas/Canvas.tsx` | activeWorkbenches 数组替代卡片绑定 |
| 修改 | `App.tsx` | createWorkbench 不建卡 |

---

## 五、边界保护

### 位置不丢失

```typescript
// 拖拽结束时钳制——至少标题栏可见
const onTitleUp = () => {
  titleDrag.current.active = false;
  setPos((prev) => ({
    x: Math.max(-prev.size.w + 200, prev.x),   // 右边至少 200px 可见
    y: Math.max(-40, prev.y),                    // 标题栏 40px 最少可见
  }));
};
```

### 最小/最大尺寸

```typescript
// 拉伸时钳制
const onResizeMove = (e) => {
  setSize({
    w: Math.min(3000, Math.max(600, startW + (e.clientX - startX))),  // 600~3000
    h: Math.min(2000, Math.max(400, startH + (e.clientY - startY))),  // 400~2000
  });
};
```

### 像素对齐

拖拽/拉伸时用 `Math.round` 避免亚像素模糊：

```typescript
x: Math.round(titleDrag.current.startPosX + (e.clientX - titleDrag.current.startX))
```

---

## 六、验收

1. 点"新会话"→ 画布上出现工作台浮窗（不建卡片）
2. 拖标题栏 → 浮窗移动
3. 拖右下角 → 浮窗拉伸（最小 600×400）
4. 点标题栏 × → 浮窗关闭
5. `npx tsc --noEmit` 零错误
