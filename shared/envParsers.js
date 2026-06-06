function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value).toLowerCase() === 'true';
}

function parseInteger(value, fallback, min = 1) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    return fallback;
  }

  return parsed;
}

function parseFloatInRange(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

export { parseBoolean, parseFloatInRange, parseInteger };
