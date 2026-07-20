import type { Capabilities } from './planCapabilities';

export interface EventLimitCheckParams {
  capabilities: Pick<Capabilities, 'events_limit'>;
  currentCount: number;
  selectedCount: number;
}

export interface EventLimitCheckResult {
  exceeds: boolean;
  maxEvents: number | null;
  remaining: number;
}

/**
 * Decide si añadir `selectedCount` eventos nuevos a los `currentCount` ya
 * existentes supera el límite de eventos del plan del bar.
 */
export function checkEventLimit({
  capabilities,
  currentCount,
  selectedCount,
}: EventLimitCheckParams): EventLimitCheckResult {
  if (capabilities.events_limit === 'unlimited') {
    return { exceeds: false, maxEvents: null, remaining: Infinity };
  }

  const maxEvents = capabilities.events_limit;
  const exceeds = currentCount + selectedCount > maxEvents;
  const remaining = Math.max(0, maxEvents - currentCount);

  return { exceeds, maxEvents, remaining };
}
