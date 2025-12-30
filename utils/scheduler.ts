import { Employee, ShiftCode, ServiceConfig, WorkPreference } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';
import { fetchWorkPreferences } from '../services/db';

// --- HELPER FUNCTIONS ---

const toLocalISOString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getDayOfWeek = (d: Date) => d.getDay(); // 0 Sun, 1 Mon...

/**
 * Get ISO Week Number
 */
export const getWeekNumber = (d: Date): number => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

export const getHoursLast7Days = (emp: Employee, currentDate: Date, tempShifts: Record<string, ShiftCode>): number => {
    let total = 0;
    for (let k = 0; k < 7; k++) {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - k);
        const dStr = toLocalISOString(d);
        const code = tempShifts[dStr] || emp.shifts[dStr];
        if (code && SHIFT_HOURS[code]) {
            total += SHIFT_HOURS[code];
        }
    }
    return total;
};

const getConsecutiveDaysCount = (emp: Employee, currentDate: Date, tempShifts: Record<string, ShiftCode>): number => {
    let count = 0;
    let d = new Date(currentDate);
    d.setDate(d.getDate() - 1); 
    while (true) {
        const dStr = toLocalISOString(d);
        const code = tempShifts[dStr] || emp.shifts[dStr];
        if (code && SHIFT_TYPES[code]?.isWork) {
            count++;
            d.setDate(d.getDate() - 1);
        } else break;
    }
    return count;
};

/**
 * Calcule les effectifs cibles réels en fusionnant les paramètres par défaut,
 * les objectifs journaliers spécifiques et les règles métier (ex: Parité Maternité).
 */
export const getEffectiveTargets = (date: Date, config?: ServiceConfig): Record<string, number> => {
    const targets: Record<string, number> = {};
    if (!config) return targets;

    const dayOfWeek = date.getDay();
    const weekNum = getWeekNumber(date);
    const isOddWeek = weekNum % 2 !== 0;

    // 1. Initialisation avec les effectifs minimums par défaut des compétences actives
    if (config.skillRequirements) {
        config.skillRequirements.forEach(req => {
            if (req.minStaff > 0) targets[req.skillCode] = req.minStaff;
        });
    }

    // 2. Logique spécifique Maternité (Parité CPF)
    // S'applique si on est en mode Maternité et qu'aucune surcharge manuelle n'existe pour ces postes
    if (config.fteConstraintMode === 'MATERNITY_STANDARD') {
        // Mercredi (3) et Vendredi (5)
        if (dayOfWeek === 3 || dayOfWeek === 5) {
            const parityTarget = isOddWeek ? 2 : 1;
            // On ne surcharge que si l'utilisateur n'a pas mis d'objectif spécifique dans le tableau
            if (!config.shiftTargets?.[dayOfWeek]?.['CPF M']) targets['CPF M'] = parityTarget;
            if (!config.shiftTargets?.[dayOfWeek]?.['CPF C']) targets['CPF C'] = parityTarget;
        }
    }

    // 3. Surcharge finale avec les "Objectifs Journaliers Spécifiques" (Tableau de saisie manuelle)
    if (config.shiftTargets?.[dayOfWeek]) {
        const daily = config.shiftTargets[dayOfWeek];
        Object.entries(daily).forEach(([code, val]) => {
            if (val !== undefined && val !== null) targets[code] = val as number;
        });
    }

    return targets;
};

// --- DIALYSIS SPECIFIC FALLBACK TARGETS ---
const DIALYSIS_TARGETS: Record<number, Record<string, number>> = {
    1: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 2 }, 
    2: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 1 }, 
    3: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 2 }, 
    4: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 1 }, 
    5: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 2 }, 
    6: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 1 }, 
    0: {}                                     
};

const NON_COUNTING_ROLES = ['Cadre', 'Cadre Supérieur', 'Directeur', 'Manager', 'Administrateur', 'Agent Administratif'];

export const generateMonthlySchedule = async (
  currentEmployees: Employee[],
  year: number,
  month: number,
  serviceConfig?: ServiceConfig
): Promise<Employee[]> => {
  
  let preferences: WorkPreference[] = [];
  try {
      const allPrefs = await fetchWorkPreferences();
      preferences = allPrefs.filter(p => p.status === 'VALIDATED');
  } catch (e) { console.warn("Could not fetch preferences.", e); }

  const employees = currentEmployees.map(emp => ({ ...emp, shifts: { ...emp.shifts } }));
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); 
  const numDays = endDate.getDate();

  const LOCKED_CODES = ['CA', 'FO', 'RC', 'HS', 'F', 'RTT', 'CSS', 'PATER', 'MALADIE', 'MAL', 'AT', 'ABS'];
  const equityStats: Record<string, { Mondays: number, Saturdays: number, Nights: number, TotalHours: number, LastWeekendWorked: number, LastFridayNight: number }> = {};
  employees.forEach(e => { equityStats[e.id] = { Mondays: 0, Saturdays: 0, Nights: 0, TotalHours: 0, LastWeekendWorked: -1, LastFridayNight: -1 }; });

  const isMaternityMode = serviceConfig?.fteConstraintMode === 'MATERNITY_STANDARD';

  // --- PHASE 1: PRE-CLEANING & DESIDERATA ---
  for (let day = 1; day <= numDays; day++) {
      const currentDate = new Date(year, month, day);
      const dateStr = toLocalISOString(currentDate);
      const dayOfWeek = getDayOfWeek(currentDate);
      employees.forEach(emp => {
          const existing = emp.shifts[dateStr];
          if (existing && !LOCKED_CODES.includes(existing)) delete emp.shifts[dateStr];
          if (!emp.shifts[dateStr]) {
              const empPrefs = preferences.filter(p => p.employeeId === emp.id && dateStr >= p.startDate && dateStr <= p.endDate);
              for (const pref of empPrefs) {
                  if (pref.recurringDays && pref.recurringDays.length > 0 && !pref.recurringDays.includes(dayOfWeek)) continue;
                  if (pref.type === 'NO_WORK') emp.shifts[dateStr] = (dayOfWeek === 0 || dayOfWeek === 6) ? 'RH' : 'NT';
              }
          }
          if (dayOfWeek === 0 && !emp.shifts[dateStr] && !NON_COUNTING_ROLES.includes(emp.role)) emp.shifts[dateStr] = 'RH';
          if (NON_COUNTING_ROLES.includes(emp.role) && !emp.shifts[dateStr] && dayOfWeek >= 1 && dayOfWeek <= 5) emp.shifts[dateStr] = 'IT';
      });
  }

  // --- PHASE 2: DAILY ASSIGNMENT ---
  for (let day = 1; day <= numDays; day++) {
      const currentDate = new Date(year, month, day);
      const dateStr = toLocalISOString(currentDate);
      const dayOfWeek = getDayOfWeek(currentDate);
      const prevDateStr = toLocalISOString(new Date(new Date(currentDate).setDate(currentDate.getDate() - 1)));

      if (dayOfWeek === 0 && (!serviceConfig?.openDays || !serviceConfig.openDays.includes(0))) continue; 

      // IA LOGIC: Determine effective targets using the centralized helper
      let targets = getEffectiveTargets(currentDate, serviceConfig);
      
      // Fallback logic if no config exists or targets are empty (Legacy support)
      if (Object.keys(targets).length === 0) {
          targets = isMaternityMode ? { 'IT': 3, 'S': 1 } : { ...DIALYSIS_TARGETS[dayOfWeek] };
      }

      // Sort priority: Critical shifts first (Night S, then specific codes, then generic IT)
      const priorityOrder: ShiftCode[] = (Object.keys(targets) as ShiftCode[]).sort((a, b) => {
          if (a === 'S') return -1;
          if (b === 'S') return 1;
          return a.localeCompare(b);
      });

      for (const shiftType of priorityOrder) {
          const needed = targets[shiftType] || 0;
          if (needed === 0) continue;

          let currentAssigned = employees.filter(e => e.shifts[dateStr] === shiftType && !NON_COUNTING_ROLES.includes(e.role)).length;
          if (currentAssigned >= needed) continue;

          const findCandidates = (strictnessLevel: number) => {
              return employees.filter(emp => {
                  if (emp.shifts[dateStr]) return false; 
                  if (emp.shifts[prevDateStr] === 'S') return false;
                  
                  // Skill check
                  if (!emp.skills.includes(shiftType as string) && shiftType !== 'IT' && shiftType !== 'S') return false;

                  if (isMaternityMode && strictnessLevel < 3) {
                      const currentWeekIndex = Math.floor((day - 1) / 7);
                      
                      // R4: 100% - 1 Weekend every 2
                      if (emp.fte >= 1.0 && (dayOfWeek === 6 || dayOfWeek === 0)) {
                          if (equityStats[emp.id].LastWeekendWorked === currentWeekIndex - 1) return false;
                      }

                      // R4: 80% - Cycle (WE, RH, Friday Night, RH)
                      if (emp.fte >= 0.75 && emp.fte < 0.9) {
                          if (dayOfWeek === 5 && shiftType === 'S') {
                              if (equityStats[emp.id].LastWeekendWorked === currentWeekIndex) return false;
                          }
                          if (dayOfWeek === 6) {
                              if (equityStats[emp.id].LastFridayNight === currentWeekIndex) return false;
                          }
                      }
                  }

                  if (strictnessLevel < 2 && (getHoursLast7Days(emp, currentDate, emp.shifts) + (SHIFT_HOURS[shiftType] || 7.5)) > 48) return false;

                  return true;
              });
          };

          const runPass = (level: number) => {
              let candidates = findCandidates(level).map(emp => {
                  let score = 1000;
                  const workedYesterday = emp.shifts[prevDateStr] && SHIFT_TYPES[emp.shifts[prevDateStr]]?.isWork;
                  if (workedYesterday) score += 2000; else score -= 500;
                  if (getConsecutiveDaysCount(emp, currentDate, emp.shifts) >= 2) score -= 5000;
                  score -= (equityStats[emp.id].TotalHours * 5);
                  score += (emp.fte * 200);
                  score += Math.random() * 50; 
                  return { emp, score };
              }).sort((a, b) => b.score - a.score);

              let assignedCount = 0;
              for (let i = 0; i < (needed - currentAssigned); i++) {
                  if (candidates[i]) {
                      const winner = candidates[i].emp;
                      winner.shifts[dateStr] = shiftType;
                      assignedCount++;
                      equityStats[winner.id].TotalHours += (SHIFT_HOURS[shiftType] || 0);
                      if (dayOfWeek === 6 || dayOfWeek === 0) equityStats[winner.id].LastWeekendWorked = Math.floor((day - 1) / 7);
                      if (dayOfWeek === 5 && shiftType === 'S') equityStats[winner.id].LastFridayNight = Math.floor((day - 1) / 7);
                  }
              }
              currentAssigned += assignedCount;
          };

          runPass(0);
          if (currentAssigned < needed) runPass(1);
          if (currentAssigned < needed) runPass(2);
      }
  }

  employees.forEach(emp => {
      for (let day = 1; day <= numDays; day++) {
          const d = new Date(year, month, day);
          const dateStr = toLocalISOString(d);
          if (!emp.shifts[dateStr]) emp.shifts[dateStr] = (d.getDay() === 0 || d.getDay() === 6) ? 'RH' : 'NT';
      }
  });

  return employees;
};
