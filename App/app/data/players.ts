// app/data/players.ts
export type Role = 'PORTIERE' | 'DIFENSORE' | 'CENTROCAMPISTA' | 'ATTACCANTE';

export type Player = {
  id: string;
  name: string;
  height: string;
  weight: string;        // Nome e cognome
  year: number;
  role: Role;
  photo?: string | null;      // uri locale o http
  attachments?: { name: string; uri: string }[];
};
