export function normaliseMemoryEntity(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/^the /, "")
    .replace(/^a /, "")
    .replace(/^an /, "")
    .replace(/^go to /, "")
    .replace(/^going to /, "")
    .replace(/^visit /, "")
    .replace(/^visiting /, "")
    .replace(/^at /, "")
    .replace(/^in /, "")
    .replace(/^on /, "")
    .replace(/^to /, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function displayMemoryEntity(value: string) {
  return normaliseMemoryEntity(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function uniqueNormalised(values: string[]) {
  const map = new Map<string, string>();

  for (const value of values) {
    const key = normaliseMemoryEntity(value);

    if (!key) continue;

    map.set(key, displayMemoryEntity(key));
  }

  return Array.from(map.values());}