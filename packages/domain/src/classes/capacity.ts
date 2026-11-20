/** Capacity is a hard limit. `seatsTaken` counts enrolled campers only; waitlisted and cancelled ones hold no seat. */
export type SeatDecision = { kind: 'seat' } | { kind: 'full'; capacity: number };

export function seatFor(capacity: number, seatsTaken: number): SeatDecision {
  return seatsTaken < capacity ? { kind: 'seat' } : { kind: 'full', capacity };
}

export function seatsLeft(capacity: number, seatsTaken: number): number {
  return Math.max(0, capacity - seatsTaken);
}

/** A camp size may be set only when it still holds every place already taken. Equal is allowed: the session is then exactly full. */
export function capacityCovers(capacity: number, seatsTaken: number): boolean {
  return seatsTaken <= capacity;
}
