// app/lib/currentOrg.ts
//
// Tiene traccia dell'org_id della squadra corrente in una variabile di modulo,
// aggiornata da AuthContext quando cambia la membership. Evita di dover far
// passare orgId come parametro in ogni funzione di data-access (loadEvents,
// saveEvents, ecc.) e in ogni schermata che le chiama.

let currentOrgId: string | null = null;

export function setCurrentOrgId(id: string | null) {
  currentOrgId = id;
}

export function getCurrentOrgId(): string {
  if (!currentOrgId) {
    throw new Error('Nessuna squadra selezionata (utente non autenticato o senza membership).');
  }
  return currentOrgId;
}
