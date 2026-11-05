// 帧率监测与自动降级：FPS 滑动平均连续 3 秒低于 40 时降一档（ART_GUIDE §6）
import { lowerTier } from '../art/tiers.js';

export function createQualityMonitor({ getQuality, setQuality, enabled = () => true, onDowngrade = () => {} }) {
  let avg = 60;
  let lowFor = 0;
  let grace = 2; // 启动/切换后的宽限秒数
  return {
    frame(dtSec) {
      if (!(dtSec > 0) || dtSec > 0.5) return; // 切后台、卡顿尖峰不计
      const fps = 1 / dtSec;
      avg += (fps - avg) * Math.min(1, dtSec * 2); // 约 0.5 秒时间常数的滑动平均
      if (grace > 0) { grace -= dtSec; return; }
      if (!enabled()) { lowFor = 0; return; }
      if (avg < 40) lowFor += dtSec; else lowFor = 0;
      if (lowFor >= 3) {
        const next = lowerTier(getQuality());
        lowFor = 0;
        grace = 3;
        avg = 60;
        if (next) { setQuality(next); onDowngrade(next); }
      }
    },
    reset() { lowFor = 0; grace = 2; avg = 60; },
    get fps() { return avg; },
  };
}
