import type { PosActorDto, PosTicketSummaryDto, TableFloorStatus } from "../api/posServiceApi";

export const TABLE_STATUS_TEXT: Record<TableFloorStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  held: "Held order",
  reserved: "Reserved",
  needsCleaning: "Needs cleaning",
  unavailable: "Unavailable",
};

/** The ticket is served by the signed-in user. */
export function isMine(ticket: Pick<PosTicketSummaryDto, "waiterUserId" | "waiterEmployeeId">, actor: PosActorDto | null) {
  if (!actor) return false;
  return ticket.waiterUserId === actor.userId || (!!actor.employeeId && ticket.waiterEmployeeId === actor.employeeId);
}
