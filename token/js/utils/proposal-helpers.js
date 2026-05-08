export function formatRequiredSignatures(requiredSignatures) {
  if (requiredSignatures === null || requiredSignatures === undefined) return '?';

  const value = Number(requiredSignatures?.toString?.() ?? requiredSignatures);
  return Number.isFinite(value) ? String(value) : '?';
}

export function formatSignatureProgress(numSignatures, requiredSignatures) {
  if (numSignatures === null || numSignatures === undefined) return '—';

  const value = Number(numSignatures?.toString?.() ?? numSignatures);
  if (!Number.isFinite(value)) return '—';

  return `${value}/${formatRequiredSignatures(requiredSignatures)}`;
}
