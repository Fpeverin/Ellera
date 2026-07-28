// app/data/competitionRules.ts
//
// Regole di partecipazione (Under/Over) per una competizione. Le competizioni
// non sono un'entita' a parte nell'app (solo una stringa libera su
// events.competition), quindi le regole si agganciano per nome.
//
// Una soglia Under {year, minCount} richiede che almeno "minCount" giocatori
// in campo abbiano anno di nascita >= year. Una soglia Over {year, minCount}
// richiede almeno "minCount" giocatori con anno di nascita <= year. Le soglie
// sono indipendenti ma "cumulative per conteggio": un giocatore molto giovane
// puo' soddisfare piu' soglie Under contemporaneamente (es. un 2008 conta sia
// per la soglia 2006 sia per la 2007 sia per la 2008).
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';

export type RuleTier = { year: number; minCount: number };

export type CompetitionRules = {
  competition: string;
  underEnabled: boolean;
  underTiers: RuleTier[];
  overEnabled: boolean;
  overTiers: RuleTier[];
};

const EMPTY_RULES = (competition: string): CompetitionRules => ({
  competition,
  underEnabled: false,
  underTiers: [],
  overEnabled: false,
  overTiers: [],
});

function fromRow(row: any): CompetitionRules {
  return {
    competition: row.competition,
    underEnabled: row.under_enabled,
    underTiers: row.under_tiers ?? [],
    overEnabled: row.over_enabled,
    overTiers: row.over_tiers ?? [],
  };
}

export async function loadCompetitionRules(competition: string): Promise<CompetitionRules> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase
    .from('competition_rules')
    .select('*')
    .eq('org_id', orgId)
    .eq('competition', competition)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : EMPTY_RULES(competition);
}

export async function saveCompetitionRules(rules: CompetitionRules): Promise<void> {
  const orgId = getCurrentOrgId();
  const { error } = await supabase.from('competition_rules').upsert({
    org_id: orgId,
    competition: rules.competition,
    under_enabled: rules.underEnabled,
    under_tiers: rules.underTiers,
    over_enabled: rules.overEnabled,
    over_tiers: rules.overTiers,
  });
  if (error) throw error;
}

export type TierCheck = RuleTier & { actualCount: number; ok: boolean };
export type RulesCheckResult = {
  compliant: boolean;
  underChecks: TierCheck[];
  overChecks: TierCheck[];
};

/** playersOnField: chi conta ai fini della regola in questo momento (in campo, o espulso). */
export function checkLineupAgainstRules(
  playersOnField: { year: number }[],
  rules: CompetitionRules | null
): RulesCheckResult {
  const underChecks: TierCheck[] = rules?.underEnabled
    ? rules.underTiers.map((t) => {
        const actualCount = playersOnField.filter((p) => p.year >= t.year).length;
        return { ...t, actualCount, ok: actualCount >= t.minCount };
      })
    : [];
  const overChecks: TierCheck[] = rules?.overEnabled
    ? rules.overTiers.map((t) => {
        const actualCount = playersOnField.filter((p) => p.year <= t.year).length;
        return { ...t, actualCount, ok: actualCount >= t.minCount };
      })
    : [];
  return {
    compliant: [...underChecks, ...overChecks].every((c) => c.ok),
    underChecks,
    overChecks,
  };
}

export function describeViolations(result: RulesCheckResult): string {
  const lines: string[] = [];
  for (const c of result.underChecks) {
    if (!c.ok) lines.push(`Servono almeno ${c.minCount} nati nel ${c.year} o dopo (ce ne sono ${c.actualCount}).`);
  }
  for (const c of result.overChecks) {
    if (!c.ok) lines.push(`Servono almeno ${c.minCount} nati nel ${c.year} o prima (ce ne sono ${c.actualCount}).`);
  }
  return lines.join('\n');
}
