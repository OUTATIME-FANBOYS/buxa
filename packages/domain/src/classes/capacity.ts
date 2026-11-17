/** Capacity is a hard limit. `seatsTaken` counts enrolled campers only; waitlisted and cancelled ones hold no seat. */
export type SeatDecision = { kind: 'seat' } | { kind: 'full'; capacity: number };

export function seatFor(capacity: number, seatsTaken: number): SeatDecision {
  return seatsTaken < capacity ? { kind: 'seat' } : { kind: 'full', capacity };
}

export function seatsLeft(capacity: number, seatsTaken: number): number {
  return Math.max(0, capacity - seatsTaken);
}
