# 修 Bug 2：拖拽误触 · 施工指令

## 问题

每次点卡片（单击、双击）都触发了拖拽的拾起动画（scale 1.05 + 阴影）。原因是 `onPointerDown` 直接启动了 `dragLoop`，没有区分"想点"和"想拖"。

## 修一个文件：`ui/card/CardView.tsx`

### 1. 在 `ds` ref 里加一个字段

```typescript
// 旧：
const ds = useRef({
  active: false, frame: 0,
  px: 0, py: 0, ...
});

// 新：
const ds = useRef({
  active: false, frame: 0,
  startX: 0, startY: 0,   // 按下的位置（用于判断是否移动）
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
  
  // 只记录位置 + 捕获指针——不启动 dragLoop
  d.active = true;
  d.frame = 0;
  d.startX = e.clientX;
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
  // 不调 dragLoop——等 onPointerMove 判断
}, [editing, deleting, card, onClick]);
```

### 3. `onPointerMove` 检测实际移动距离——超过 3px 才启动拖拽

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
    
    // 这时才启动拖拽动画
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
  
  // 正常的拖拽跟随逻辑
  d.prevPrevPx = d.prevPx;
  d.prevPrevPy = d.prevPy;
  d.prevPx = d.px;
  d.prevPy = d.py;
  d.px = e.clientX;
  d.py = e.clientY;
}, [interaction, card, onDragStart, dragLoop]);
```

### 4. `onPointerUp` 判断：没拖过 → 不触发拖拽结束

```typescript
const onPointerUp = useCallback(() => {
  if (!ds.current.active) return;
  
  if (!isDragging.current) {
    // 没有移动——这是个纯点击。清理状态但不触发拖拽逻辑
    ds.current.active = false;
    return;
  }
  
  // 正常拖拽结束
  finishDrag();
}, [finishDrag]);
```

### 5. `dragLoop` 保持不变

不需要改。`dragLoop` 只在 `onPointerMove` 检测到真实移动后才启动。

## 验收

1. 单击卡片 → 选中（边框 2px + 发光环），卡片不缩放、不移动
2. 双击卡片 → 进入编辑模式或打开工作台，卡片不缩放
3. 按住卡片拖动超过 3px → 拾起动画出现 → 跟随鼠标
4. 按住卡片轻微抖动（< 3px）→ 不触发拖拽
5. `npx tsc --noEmit` 零错误
