// UI 入口（ui-art 负责）。骨架阶段仅显示标题。
import DATA from '../data/index.js';
document.getElementById('app').textContent = `${DATA.texts.title} —— 骨架已就绪`;
