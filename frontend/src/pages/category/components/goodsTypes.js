// Planned navigation types are independent of the current DB seed.
export const GOODS_TYPES = [
  '포토카드',
  '키링',
  '피규어',
  '아크릴 스탠드',
  '인형',
  '캔뱃지',
  '문구',
  '의류',
  '기타 굿즈',
];

export function buildGoodsTypes(categories) {
  return GOODS_TYPES.map((name) => {
    const aliases = name === '아크릴 스탠드' ? [name, '아크릴'] : [name];
    const match = categories.find((category) => aliases.includes(category.name));
    return { ...match, id: match?.id ?? null, name, type: 'GOODS' };
  });
}
