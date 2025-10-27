// Subscriptions removed; always return PRO capabilities
import { CAP_BY_TIER, type Tier } from './planCapabilities';

/** Devuelve tier + capacidades (free/pro/elite) */
export async function getEffectiveCapabilities(userId: string): Promise<{ tier: Tier; capabilities: any }> {
  return { tier: 'pro', capabilities: CAP_BY_TIER.pro } as any;
}