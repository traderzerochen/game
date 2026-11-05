// 五行生克
export const RELATIONS = {
  overcomes: { metal: 'wood', wood: 'earth', earth: 'water', water: 'fire', fire: 'metal' },
  generates: { metal: 'water', water: 'wood', wood: 'fire', fire: 'earth', earth: 'metal' },
};

/** 攻方元素对守方元素的倍率：克 1.3，被克 0.75，其余 1.0 */
export function elemMult(atk, def) {
  if (!atk || !def || atk === 'none' || def === 'none') return 1;
  if (RELATIONS.overcomes[atk] === def) return 1.3;
  if (RELATIONS.overcomes[def] === atk) return 0.75;
  return 1;
}
