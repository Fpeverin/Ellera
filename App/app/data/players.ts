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

export const players: Player[] = [
  // PORTIERI
  { id: 'beccari-gabriele', name: 'BECCARI GABRIELE', year: 2008, role: 'PORTIERE', height: '170', weight: '60' },
  { id: 'segoloni-riccardo', name: 'SEGOLONI RICCARDO', year: 1988, role: 'PORTIERE', height: '170', weight: '60' },
  { id: 'liuzza-alessandro', name: 'LIUZZA ALESSANDRO', year: 2007, role: 'PORTIERE', height: '170', weight: '60' },

  // DIFENSORI
  { id: 'polidori-mattia', name: 'POLIDORI MATTIA', year: 1998, role: 'DIFENSORE', height: '170', weight: '60' },
  { id: 'morlunghi-alessandro', name: 'MORLUNGHI ALESSANDRO', year: 2005, role: 'DIFENSORE', height: '170', weight: '60' },
  { id: 'mottola-francesco', name: 'MOTTOLA FRANCESCO', year: 2005, role: 'DIFENSORE', height: '170', weight: '60' },
  { id: 'vescovi-filippo', name: 'VESCOVI FILIPPO', year: 2005, role: 'DIFENSORE', height: '170', weight: '60' },
  { id: 'sorbelli-daniele', name: 'SORBELLI DANIELE', year: 2002, role: 'DIFENSORE', height: '170', weight: '60' },
  { id: 'tarpani-matteo', name: 'TARPANI MATTEO', year: 2006, role: 'DIFENSORE', height: '170', weight: '60' },
  { id: 'giombetti-daniele', name: 'SEBBEN VALENTINO', year: 2006, role: 'DIFENSORE', height: '170', weight: '60' },
  { id: 'silvestri-giacomo', name: 'SILVESTRI GIACOMO', year: 2008, role: 'DIFENSORE', height: '170', weight: '60' },
  { id: 'spippoli-lorenzo', name: 'SPIPPOLI LORENZO', year: 2007, role: 'DIFENSORE', height: '170', weight: '60' },
  { id: 'borgnini-edoardo', name: 'BORGNINI EDOARDO', year: 2009, role: 'DIFENSORE', height: '170', weight: '60' },

  // CENTROCAMPISTI
 { id: 'capaccio-nicola', name: 'CAPACCIO NICOLA', year: 2009, role: 'CENTROCAMPISTA', height: '170', weight: '60' },
 { id: 'vitale-lucio', name: 'VITALE LUCIO', year: 2009, role: 'CENTROCAMPISTA', height: '170', weight: '60' },
  { id: 'convito-michele', name: 'CONVITO MICHELE', year: 2002, role: 'CENTROCAMPISTA', height: '170', weight: '60' },
  { id: 'gejci-leonardo', name: 'GEJCI LEONARDO', year: 2008, role: 'CENTROCAMPISTA', height: '170', weight: '60' },
  { id: 'heid-fabian', name: 'EID FABIAN', year: 2007, role: 'CENTROCAMPISTA', height: '170', weight: '60' },
  { id: 'mennini-lorenzo', name: 'MENNINI LORENZO', year: 2000, role: 'CENTROCAMPISTA', height: '170', weight: '60' },
  { id: 'paccaduscio-andrea', name: 'PACCADUSCIO ANDREA', year: 2006, role: 'CENTROCAMPISTA', height: '170', weight: '60' },
  { id: 'paradisi-filippo', name: 'PARADISI FILIPPO', year: 1998, role: 'CENTROCAMPISTA', height: '170', weight: '60' },
  { id: 'polidoro-federico', name: 'POLIDORO FEDERICO', year: 2002, role: 'CENTROCAMPISTA', height: '170', weight: '60' },
  { id: 'roticiani-tommaso', name: 'ROTICIANI TOMMASO', year: 2008, role: 'CENTROCAMPISTA', height: '170', weight: '60' },
   { id: 'salvucci-thomas', name: 'SALVUCCI THOMAS', year: 1998, role: 'CENTROCAMPISTA', height: '170', weight: '60' },
  { id: 'sisani-alessio', name: 'SISANI ALESSIO', year: 2007, role: 'CENTROCAMPISTA', height: '170', weight: '60' },
  

  // ATTACCANTI
  { id: 'antognoni-nicola', name: 'ANTOGNONI NICOLA', year: 2004, role: 'ATTACCANTE', height: '170', weight: '60' },
  { id: 'vinciarelli-daniele', name: 'VINCIARELLI DANIELE', year: 2002, role: 'ATTACCANTE', height: '170', weight: '60' },
  { id: 'nuti-francesco', name: 'NUTI FRANCESCO', year: 2006, role: 'ATTACCANTE', height: '170', weight: '60' },
  { id: 'mariotti-francesco', name: 'MARIOTTI FRANCESCO', year: 2006, role: 'ATTACCANTE', height: '170', weight: '60' },
  { id: 'massetti-giovanni', name: 'MASSETTI GIOVANNI', year: 2007, role: 'ATTACCANTE', height: '170', weight: '60' },
  { id: 'mantovani-filippo', name: 'MANTOVANI FILIPPO', year: 2008, role: 'ATTACCANTE', height: '170', weight: '60' },
];

export const exPlayers: Player[] = [
  { id: 'bolletta-marco', name: 'BOLLETTA MARCO', year: 1993, role: 'DIFENSORE',   height: '170', weight: '60' },
  { id: 'ravanelli-carlo', name: 'RAVANELLI CARLO', year: 2005, role: 'ATTACCANTE', height: '170', weight: '60' },
  { id: 'gazzani-michele', name: 'GAZZANI MICHELE', year: 2005, role: 'ATTACCANTE', height: '170', weight: '60' },
   { id: 'bertini-lorenzo', name: 'BERTINI LORENZO', year: 2006, role: 'CENTROCAMPISTA', height: '170', weight: '60' }
];