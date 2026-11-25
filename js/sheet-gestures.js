/**
 * v0.55.0 JS 批 B2 / B4：窄屏触摸手势 —— 下滑关闭抽屉、顶部下拉刷新。
 *
 * 只在窄屏（≤680px）+ 触摸设备上启用，桌面端不绑定、不改行为。
 * 关闭一律走各抽屉现有的 close 函数（这里只调 onClose，不自己改 class）；
 * 下拉刷新走 app.js 的 refreshNow（数据重拉 + 倒计时/英雄区/通知刷新）。
 *
 * 本文件顶层不碰 DOM（Node 下 import 做纯函数单测不会炸）；判定逻辑抽成
 * 纯函数 shouldCloseSheetOnSwipe / shouldTriggerPullRefresh。
 */
import { vibrate } from "./utils.js";

/** 下滑关闭：手指下滑超过该距离即关。 */
export const SHEET_SWIPE_CLOSE_THRESHOLD_PX = 80;
/** 下滑关闭：快速甩动的判定 —— 位移 >= 40px 且速度 >= 0.6px/ms 也算关。 */
export const SHEET_SWIPE_FLICK_MIN_PX = 40;
export const SHEET_SWIPE_FLICK_MIN_VELOCITY = 0.6;
/** 下拉刷新：顶部下拉超过该距离、松手即刷新。 */
export const PULL_REFRESH_THRESHOLD_PX = 70;

/**
 * 下滑关闭判定（纯函数）。dy 为向下位移（px），durationMs 为本次滑动耗时。
 * 关：dy >= 80；或 dy >= 40 且速度够快（快速甩动）；其余回弹（不关）。
 */
export function shouldCloseSheetOnSwipe(
  { dy, durationMs, thresholdPx = SHEET_SWIPE_CLOSE_THRESHOLD_PX } = {}
) {
  if (!Number.isFinite(dy) || dy <= 0) return false;
  if (dy >= thresholdPx) return true;
  if (
    dy >= SHEET_SWIPE_FLICK_MIN_PX &&
    Number.isFinite(durationMs) &&
    durationMs > 0 &&
    dy / durationMs >= SHEET_SWIPE_FLICK_MIN_VELOCITY
  )
    return true;
  return false;
}

/**
 * 下拉刷新触发条件（纯函数）。只在页面已到顶（scrollTop 为 0）且
 * 下拉距离达到阈值时触发；已滚下去时下拉只是普通滚动，不刷新。
 */
export function shouldTriggerPullRefresh(
  { scrollTop, pullDistance, thresholdPx = PULL_REFRESH_THRESHOLD_PX } = {}
) {
  if (!Number.isFinite(scrollTop) || !Number.isFinite(pullDistance))
    return false;
  return scrollTop <= 0 && pullDistance >= thresholdPx;
}

/** 窄屏 + 触摸设备（两项都满足才启用手势；桌面端 / 非触摸本返回 false）。 */
export function isNarrowTouchScreen() {
  if (typeof window === "undefined") return false;
  const narrow =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 680px)").matches;
  const touch =
    "ontouchstart" in window ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
  return Boolean(narrow && touch);
}

const getTouchY = (event) => {
  const t = event.touches?.[0] || event.changedTouches?.[0];
  return t ? t.clientY : null;
};

/**
 * 给一个抽屉/面板绑下滑关闭。
 * 只认从手柄（.sheet-handle）或面板顶部 56px 区域起手的手指 —— 面板中部
 * 起手的是列表滚动，不能抢。拖动时面板跟手下移；松手按 shouldCloseSheetOnSwipe
 * 决定关（走 onClose）还是回弹（transform 清掉）。
 * @param {Element} panelEl 面板（.drawer-panel / .sheet-panel）
 * @param {{ onClose: () => void }} options
 */
export function bindSheetSwipeGesture(panelEl, { onClose } = {}) {
  if (!panelEl || typeof onClose !== "function") return () => {};
  let startY = null;
  let startTime = 0;
  let dragging = false;

  const resetTransform = (animate) => {
    if (animate) {
      panelEl.style.transition = "transform 0.2s ease-out";
      panelEl.style.transform = "";
      window.setTimeout(() => {
        panelEl.style.transition = "";
      }, 220);
    } else {
      panelEl.style.transition = "";
      panelEl.style.transform = "";
    }
  };

  const onTouchStart = (event) => {
    if (!isNarrowTouchScreen()) return;
    if (event.touches && event.touches.length > 1) return;
    const y = getTouchY(event);
    if (y === null) return;
    // 只认手柄 / 面板顶部区域起手；中部是滚动区，不抢。
    const rect = panelEl.getBoundingClientRect();
    const fromHandle = Boolean(event.target.closest?.(".sheet-handle"));
    const fromTop = y - rect.top <= 56;
    if (!fromHandle && !fromTop) return;
    startY = y;
    startTime = Date.now();
    dragging = false;
  };

  const onTouchMove = (event) => {
    if (startY === null) return;
    if (event.touches && event.touches.length > 1) {
      startY = null;
      return;
    }
    const y = getTouchY(event);
    if (y === null) return;
    const dy = y - startY;
    if (dy <= 0) {
      // 往上滑不是关闭手势：不跟手、不拦截，让面板自己滚动。
      if (dragging) resetTransform(true);
      dragging = false;
      startY = null;
      return;
    }
    if (dy > 10 && !dragging) dragging = true;
    if (!dragging) return;
    // 跟手下移；这一步才 preventDefault（起手 10px 内不拦截，误触不吞滚动）。
    event.preventDefault();
    panelEl.style.transition = "none";
    panelEl.style.transform = `translateY(${dy}px)`;
  };

  const onTouchEnd = (event) => {
    if (startY === null) return;
    const y = getTouchY(event);
    const dy = y === null ? 0 : y - startY;
    const durationMs = Date.now() - startTime;
    startY = null;
    if (!dragging) return;
    dragging = false;
    if (shouldCloseSheetOnSwipe({ dy, durationMs })) {
      resetTransform(false);
      onClose();
    } else {
      resetTransform(true);
    }
  };

  const onTouchCancel = () => {
    if (startY === null) return;
    startY = null;
    if (dragging) {
      dragging = false;
      resetTransform(true);
    }
  };

  panelEl.addEventListener("touchstart", onTouchStart, { passive: true });
  panelEl.addEventListener("touchmove", onTouchMove, { passive: false });
  panelEl.addEventListener("touchend", onTouchEnd, { passive: true });
  panelEl.addEventListener("touchcancel", onTouchCancel, { passive: true });
  return () => {
    panelEl.removeEventListener("touchstart", onTouchStart);
    panelEl.removeEventListener("touchmove", onTouchMove);
    panelEl.removeEventListener("touchend", onTouchEnd);
    panelEl.removeEventListener("touchcancel", onTouchCancel);
  };
}

/**
 * 顶部下拉刷新（绑在 window 的 touch 事件上，页面滚动容器就是 window）。
 * 只有 scrollTop 为 0 时起手才跟踪；下拉超过阈值时指示器（.toast 复用样式）
 * 显示“松开刷新”，松手触发一次 onRefresh；不够阈值只收起指示器，不刷新。
 * @param {{ onRefresh: () => void | Promise<void>, indicatorEl?: Element }} options
 */
export function bindPullToRefresh({ onRefresh, indicatorEl } = {}) {
  if (typeof onRefresh !== "function" || typeof window === "undefined")
    return () => {};
  let startY = null;
  let pulling = false;
  let refreshing = false;

  const showIndicator = (show) => {
    indicatorEl?.classList.toggle("hidden", !show);
  };

  const onTouchStart = (event) => {
    if (!isNarrowTouchScreen() || refreshing) return;
    if (event.touches && event.touches.length > 1) return;
    if (window.scrollY > 0 && document.documentElement.scrollTop > 0) return;
    const y = getTouchY(event);
    if (y === null) return;
    startY = y;
    pulling = false;
  };

  const onTouchMove = (event) => {
    if (startY === null || refreshing) return;
    if (window.scrollY > 0 || document.documentElement.scrollTop > 0) {
      startY = null;
      showIndicator(false);
      return;
    }
    const y = getTouchY(event);
    if (y === null) return;
    const dy = y - startY;
    if (dy <= 0) {
      pulling = false;
      showIndicator(false);
      return;
    }
    pulling = true;
    // 超过阈值才亮指示器（复用 .toast 视觉，不新造一套）；不够只跟踪不显示。
    showIndicator(dy >= PULL_REFRESH_THRESHOLD_PX);
  };

  const onTouchEnd = (event) => {
    if (startY === null) return;
    const y = getTouchY(event);
    const dy = y === null ? 0 : y - startY;
    startY = null;
    const wasPulling = pulling;
    pulling = false;
    showIndicator(false);
    if (!wasPulling || refreshing) return;
    if (
      shouldTriggerPullRefresh({
        scrollTop: window.scrollY || document.documentElement.scrollTop,
        pullDistance: dy,
      })
    ) {
      refreshing = true;
      vibrate(10);
      Promise.resolve()
        .then(onRefresh)
        .catch(() => {})
        .finally(() => {
          refreshing = false;
        });
    }
  };

  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  return () => {
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
  };
}
