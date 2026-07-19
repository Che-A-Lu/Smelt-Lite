# 修 Bug 5：拖拽第一秒卡片偏移 · 施工指令

## 问题

`dragLoop` 中 `d.cx = d.px`——`d.px` 是 `e.clientX`（屏幕坐标），但卡片定位是画布坐标。画布有平移/缩放时，两个坐标系完全不一致。卡片第一帧直接跳到错误位置。

## 修复

用**相对偏移**而非绝对坐标。记录按下时的指针位置和卡片位置，拖拽过程中计算偏移量叠加。

### 改 `ui/card/CardView.tsx`

**1. `ds` ref 加两个字段：**

```typescript
const ds = useRef({
  active: false, frame: 0,
  startX: 0, startY: 0,
  startCardX: 0, startCardY: 0,  // 新增：按下时卡片位置
  px: 0, py: 0, ...
});
```

**2. `onPointerDown` 记录卡片起始位置：**

```typescript
d.cx = card.position.x;
d.cy = card.position.y;
d.startCardX = card.position.x;  // 新增
d.startCardY = card.position.y;  // 新增
```

**3. `dragLoop` 用相对偏移：**

```typescript
const dragLoop = useCallback(() => {
  const d = ds.current;
  if (!d.active || !isDragging.current) return;
  
  // 相对偏移 = 当前指针位置 - 按下时指针位置
  const dx = d.px - d.startX;
  const dy = d.py - d.startY;
  
  // 卡片位置 = 按下时卡片位置 + 偏移
  d.cx = d.startCardX + dx;
  d.cy = d.startCardY + dy - 6;  // -6 上浮
  
  if (elRef.current) {
    elRef.current.style.transform = `translate(${d.cx}px, ${d.cy}px)`;
  }
  
  onDragMove?.(card.id, d.cx, d.cy, d.px, d.py);
  raf.current = requestAnimationFrame(dragLoop);
}, [card.id, onDragMove]);
```

**4. `throwLoop` 同样修复——惯性投掷后落位使用偏移：**

保持不变——throwLoop 已经在操作 `d.cx/d.cy`（画布坐标），只需要确认 `onDragEnd` 传的值正确。

## 验收

1. 画布平移后（view.x/view.y 不为 0）→ 拖拽卡片 → 卡片不跳
2. 画布缩放后（view.zoom ≠ 1）→ 拖拽卡片 → 卡片不跳
3. 画布既平移又缩放 → 拖拽卡片 → 卡片跟随指针，无位移
4. `npx tsc --noEmit` 零错误
