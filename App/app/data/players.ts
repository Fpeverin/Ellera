// app/data/players.ts
export type Role = 'PORTIERE' | 'DIFENSORE' | 'CENTROCAMPISTA' | 'ATTACCANTE';

export type Player = {
  id: string;
  name: string;
  height: string;
  weight: string;        // Nome e cognome
  year: number;
  dob?: string | null;    // data di nascita completa 'YYYY-MM-DD', se impostata
  role: Role;
  photo?: string | null;      // uri locale o http
  attachments?: { name: string; uri: string }[];
};
