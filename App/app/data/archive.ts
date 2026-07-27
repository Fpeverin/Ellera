import { Role } from './players';

export interface ArchivedPlayerStats {
  matchesPlayed: number;
  minutesPlayed: number;
  goals: number;
  goalsConceded: number;
  starts: number;
  bench: number;
  notCalled: number;
  subbedOn: number;
  subbedOff: number;
  yellowCards: number;
  redCards: number;
  trainingsTotal: number;
  trainingsPresent: number;
  trainingsAbsent: number;
  trainingsInjured: number;
  trainingsDiff: number;
}

export interface ArchivedPlayer {
  id: string;
  name: string;
  role: Role;
  year: number;
  height: string;
  weight: string;
  photo?: string | null;
  stats: ArchivedPlayerStats;
}

export interface ArchivedGoal {
  id: string;
  team: 'HOME' | 'AWAY';
  minute: number;
  scorerName: string;
  scorerId?: string;
}

export interface ArchivedSub {
  id: string;
  minute: number;
  outId: string;
  outName: string;
  inId: string;
  inName: string;
}

export interface ArchivedCard {
  id: string;
  minute: number;
  team: 'HOME' | 'AWAY';
  color: 'YELLOW' | 'RED';
  playerId?: string;
  playerName: string;
}

export interface ArchivedLineup {
  moduleName: string | null;
  convocatiIds: string[];
  fieldPlayerIds: (string | null)[];
  benchPlayerIds: string[];
}

export interface ArchivedMatch {
  id: string;
  date: string;
  time: string;
  location: string;
  opponent: string;
  competition: string;
  isHome: boolean;
  scoreHome?: number;
  scoreAway?: number;
  lineup: ArchivedLineup | null;
  goals: ArchivedGoal[];
  subs: ArchivedSub[];
  cards: ArchivedCard[];
  tacticsIds: string[];
}

export interface ArchivedTraining {
  id: string;
  date: string;
  time: string;
  location: string;
  tema?: string;
  presenze: Record<string, 'presente' | 'assente' | 'infortunato' | 'differenziato'>;
}

export interface SeasonSummary {
  totalMatches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  totalTrainings: number;
}

export interface SeasonArchive {
  id: string;
  label: string;
  archivedAt: string;
  summary: SeasonSummary;
  squad: ArchivedPlayer[];
  matches: ArchivedMatch[];
  trainings: ArchivedTraining[];
}

