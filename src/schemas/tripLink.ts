// A measurement's or refuel's trip (backend specs/0042 RF-1): optional,
// with its route copied, as an expense's (0026)

export interface TripLink {
  tripId: string | null
  /** "Managua → León", as when it was chosen. */
  tripRoute: string | null
}

export const NO_TRIP: TripLink = { tripId: null, tripRoute: null }
