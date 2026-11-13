/** Movement-only opportunity frontier; target activity time is excluded by design. */
export function frontierMembership(outbound: Float64Array, returns: Float64Array, mask: Uint8Array,
  elapsed: number, budget: number, reserve: number): Uint8Array {
  if (outbound.length !== returns.length || mask.length !== outbound.length ||
      ![elapsed, budget, reserve].every(x => Number.isFinite(x) && x >= 0) || budget <= 0)
    throw new Error('Invalid frontier input');
  const threshold = Math.max(0, budget - elapsed) - reserve;
  const membership = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    const cost = outbound[i] + returns[i];
    membership[i] = mask[i] === 1 && Number.isFinite(cost) && cost <= threshold ? 1 : 0;
  }
  return membership;
}

export function countFrontier(membership: Uint8Array): number {
  return membership.reduce((sum, value) => sum + (value === 1 ? 1 : 0), 0);
}
