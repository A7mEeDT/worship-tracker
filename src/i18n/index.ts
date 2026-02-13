import { ar } from "./ar";

type Dict = typeof ar;
type Key = keyof Dict;

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) {
    return template;
  }
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key]);
    }
    return match;
  });
}

export function t(key: Key, vars?: Record<string, string | number>) {
  return interpolate(ar[key], vars);
}

