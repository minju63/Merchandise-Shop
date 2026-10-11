export function parseRegionalQuery(query, data) {
  const normalized = query.trim();
  const lowerQuery = normalized.toLocaleLowerCase('ko-KR');
  const exactEntity = data.autocompleteItems.some((item) => (
    ['작품', '굿즈샵'].includes(item.type)
    && item.label.toLocaleLowerCase('ko-KR') === lowerQuery
  ));

  if (exactEntity) return { region: null, keyword: normalized };

  const regionNames = data.regions.flatMap((region) => (
    [region.label, region.displayName, ...region.aliases].map((name) => ({
      name: name.toLocaleLowerCase('ko-KR'),
      region,
    }))
  ));
  const exactRegion = regionNames.find(({ name }) => name === lowerQuery);
  if (exactRegion) return { region: exactRegion.region, keyword: '' };

  const words = normalized.split(/\s+/).filter(Boolean);
  const regionalWordIndex = words.findIndex((word) => (
    regionNames.some(({ name }) => name === word.toLocaleLowerCase('ko-KR'))
  ));

  if (regionalWordIndex >= 0) {
    const matched = regionNames.find(({ name }) => (
      name === words[regionalWordIndex].toLocaleLowerCase('ko-KR')
    ));
    return {
      region: matched.region,
      keyword: words.filter((_, index) => index !== regionalWordIndex).join(' '),
    };
  }

  if (words.length === 1) {
    const prefix = regionNames
      .filter(({ name }) => lowerQuery.startsWith(name) && lowerQuery.length > name.length)
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (prefix) {
      return { region: prefix.region, keyword: normalized.slice(prefix.name.length).trim() };
    }
  }

  return { region: null, keyword: normalized };
}
