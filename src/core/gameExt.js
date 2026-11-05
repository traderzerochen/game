// 阶段 2 模块接入点
import { tribulationInfo, runTribulation } from './tribulation.js';
export const tribulationInfoSafe = tribulationInfo;
export const tribulation = (s, c, opts) => runTribulation(s, c, opts);
export const craft = () => ({ ok: false, reason: 'invalid' });
export const craftInfo = () => ({ can: false, rate: 0, missing: [] });
export const usePill = () => ({ ok: false, reason: 'invalid' });
