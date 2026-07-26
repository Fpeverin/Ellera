// app/data/tactics.ts
export type Tactic = {
  id: string;
  name: string;
  description?: string;
};

export const tactics: Tactic[] = [
  { id: '1', name: 'Pressing alto', description: 'Recupero palla in zona offensiva' },
  { id: '2', name: 'Difesa bassa', description: 'Linea difensiva molto arretrata' },
  { id: '3', name: 'Ripartenze veloci', description: 'Verticalizzazioni rapide dopo il recupero palla' },
];
