// 渡劫 / 炼丹接入点
import { tribulationInfo, runTribulation } from './tribulation.js';
import * as alc from './alchemy.js';
export const tribulationInfoSafe = tribulationInfo;
export const tribulation = (s, c, opts) => runTribulation(s, c, opts);
export const craft = alc.craft;
export const craftInfo = alc.craftInfo;
export const usePill = alc.usePill;
