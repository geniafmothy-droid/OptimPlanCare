
import { Employee, ShiftCode, ServiceConfig, WorkPreference } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';
import { fetchWorkPreferences } from '../services/db';

// --- HELPER FUNCTIONS ---

const toLocalISOString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getDayOfWeek = (d: Date) => d.getDay(); // 0 Sun, 1 Mon...

/**
 * Calculates total hours worked in the sliding window ending at 'dateStr'.
 * Window is 7 days including current date (Current + 6 previous days).
 */
export const getHoursLast7Days = (emp: Employee, currentDate: Date, tempShifts: Record<string, ShiftCode>): number => {
    let total = 0;
    // Check previous 6 days + current planned shift (if any)
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

// --- DIALYSIS SPECIFIC RULES ---
const DIALYSIS_TARGETS: Record<number, Record<string, number>> = {
    1: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 2 }, // Lundi
    2: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 1 }, // Mardi
    3: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 2 }, // Mercredi
    4: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 1 }, // Jeudi
    5: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 2 }, // Vendredi
    6: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 1 }, // Samedi
    0: {}                                     // Dimanche (Fermé par défaut)
};

// ROLES THAT DO NOT COUNT TOWARDS STAFFING TARGETS
const NON_COUNTING_ROLES = [
    'Cadre', 
    'Cadre Supérieur', 
    'Directeur', 
    'Manager', 
    'Administrateur', 
    'Agent Administratif'
];

export const generateMonthlySchedule = async (
  currentEmployees: Employee[],
  year: number,
  month: number,
  serviceConfig?: ServiceConfig
): Promise<Employee[]> => {
  
  // 1. Fetch Validated Preferences
  let preferences: WorkPreference[] = [];
  try {
      const allPrefs = await fetchWorkPreferences();
      preferences = allPrefs.filter(p => p.status === 'VALIDATED');
  } catch (e) {
      console.warn("Could not fetch preferences.", e);
  }

  // 2. Prepare Working Copy & Clean Slate
  const employees = currentEmployees.map(emp => {
      const newShifts = { ...emp.shifts };
      return { ...emp, shifts: newShifts };
  });

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); 
  const numDays = endDate.getDate();

  const LOCKED_CODES = ['CA', 'FO', 'RC', 'HS', 'F', 'RTT', 'CSS', 'PATER', 'MALADIE'];

  // Stats for equity balancing
  const equityStats: Record<string, { Mondays: number, Saturdays: number, Nights: number, TotalHours: number }> = {};
  employees.forEach(e => {
      equityStats[e.id] = { Mondays: 0, Saturdays: 0, Nights: 0, TotalHours: 0 };
  });

  // --- PHASE 1: PRE-CLEANING & DESIDERATA APPLICATION ---
  for (let day = 1; day <= numDays; day++) {
      const currentDate = new Date(year, month, day);
      const dateStr = toLocalISOString(currentDate);
      const dayOfWeek = getDayOfWeek(currentDate);

      employees.forEach(emp => {
          const existing = emp.shifts[dateStr];

          if (existing && !LOCKED_CODES.includes(existing)) {
              delete emp.shifts[dateStr]; 
          }

          if (!emp.shifts[dateStr]) {
              const empPrefs = preferences.filter(p => p.employeeId === emp.id);
              for (const pref of empPrefs) {
                  if (dateStr >= pref.startDate && dateStr <= pref.endDate) {
                      if (pref.recurringDays && pref.recurringDays.length > 0 && !pref.recurringDays.includes(dayOfWeek)) continue;
                      
                      if (pref.type === 'NO_WORK') {
                          emp.shifts[dateStr] = (dayOfWeek === 0 || dayOfWeek === 6) ? 'RH' : 'NT';
                      }
                  }
              }
          }

          if (dayOfWeek === 0 && !emp.shifts[dateStr] && !NON_COUNTING_ROLES.includes(emp.role)) {
              emp.shifts[dateStr] = 'RH';
          }
          
          if (NON_COUNTING_ROLES.includes(emp.role) && !emp.shifts[dateStr] && dayOfWeek >= 1 && dayOfWeek <= 5) {
              emp.shifts[dateStr] = 'IT';
          }
      });
  }

  // --- PHASE 2: DAILY ASSIGNMENT LOOP ---
  for (let day = 1; day <= numDays; day++) {
      const currentDate = new Date(year, month, day);
      const dateStr = toLocalISOString(currentDate);
      const dayOfWeek = getDayOfWeek(currentDate);
      
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = toLocalISOString(prevDate);

      const prevPrevDate = new Date(prevDate);
      prevPrevDate.setDate(prevPrevDate.getDate() - 1);
      const prevPrevDateStr = toLocalISOString(prevPrevDate);

      if (dayOfWeek === 0) continue; // Skip Sundays

      // 1. Determine Targets
      let targets = { ...DIALYSIS_TARGETS[dayOfWeek] };
      if (serviceConfig?.shiftTargets && serviceConfig.shiftTargets[dayOfWeek]) {
          const configTargets = serviceConfig.shiftTargets[dayOfWeek];
          if (Object.keys(configTargets).length > 0) {
              targets = { ...configTargets };
          }
      }

      // Priority Order: 'S' first (constraint heavy), then specific shifts, then generic IT
      const priorityOrder: ShiftCode[] = ['S', 'T6', 'T5', 'IT']; 

      for (const shiftType of priorityOrder) {
          const needed = targets[shiftType] || 0;
          if (needed === 0) continue;

          let currentAssigned = employees.filter(e => 
              e.shifts[dateStr] === shiftType && 
              !NON_COUNTING_ROLES.includes(e.role)
          ).length;
          
          if (currentAssigned >= needed) continue;

          // --- CANDIDATE FINDING STRATEGY ---
          const findCandidates = (strictnessLevel: number) => {
              return employees.filter(emp => {
                  // A. Role Check
                  const r = emp.role.toLowerCase();
                  const isNursing = r.includes('infirmier') || r.includes('ide') || r.includes('soignant') || r.includes('as') || r.includes('intérim');
                  
                  if (!isNursing) return false;
                  if (NON_COUNTING_ROLES.map(x => x.toLowerCase()).includes(r)) return false; 
                  
                  // B. Availability Check
                  if (emp.shifts[dateStr]) return false; 

                  // C. Safety Hard Constraints (Post-Night) - ABSOLUTE
                  if (emp.shifts[prevDateStr] === 'S') return false;

                  // D. Max 48h / 7 days
                  // Strictness 0 & 1: Respect 48h
                  // Strictness 2+: Ignore 48h (Emergency fill)
                  if (strictnessLevel < 2) {
                      const hoursThisShift = SHIFT_HOURS[shiftType] || 7.5;
                      const hoursPast = getHoursLast7Days(emp, currentDate, emp.shifts);
                      if ((hoursPast + hoursThisShift) > 48) return false;
                  }

                  // E. Samedi rule (1 sur 2)
                  // Strictness 0: Strict 1/2
                  // Strictness 1+: Ignore
                  if (dayOfWeek === 6 && strictnessLevel === 0) {
                      const prevSat = new Date(currentDate); prevSat.setDate(prevSat.getDate() - 7);
                      const prevSatStr = toLocalISOString(prevSat);
                      const prevShift = emp.shifts[prevSatStr];
                      if (prevShift && SHIFT_TYPES[prevShift]?.isWork) return false;
                  }

                  // F. "NO_NIGHT" / Preferences
                  if (shiftType === 'S') {
                      const hasNoNight = preferences.some(p => 
                          p.employeeId === emp.id && 
                          p.type === 'NO_NIGHT' &&
                          dateStr >= p.startDate && dateStr <= p.endDate
                      );
                      if (hasNoNight && strictnessLevel < 3) return false;
                  }

                  return true;
              });
          };

          const runPass = (level: number) => {
              let candidates = findCandidates(level);
              
              let scoredCandidates = candidates.map(emp => {
                  let score = 1000;
                  
                  const workedYesterday = emp.shifts[prevDateStr] && SHIFT_TYPES[emp.shifts[prevDateStr]]?.isWork;
                  const workedBeforeYesterday = emp.shifts[prevPrevDateStr] && SHIFT_TYPES[emp.shifts[prevPrevDateStr]]?.isWork;

                  // --- STRATEGY: BLOCK SCHEDULING ---
                  // Massive bonus if worked yesterday. We want to chain days (Mon-Tue-Wed).
                  // This prevents the "oscillation" where everyone rests on the same day.
                  if (workedYesterday) {
                      score += 5000; 
                      if (workedBeforeYesterday) score += 1000; // Prefer chains of 3 over chains of 2
                  } 
                  else {
                      // If didn't work yesterday, we are pulling from the "Fresh" pool.
                      // Only do this if necessary.
                      // Penalize slightly to prefer those currently in a work block.
                      score -= 500;
                  }

                  // Equity penalty (secondary to block scheduling)
                  // Prevents one person from doing ALL the work, but only kicks in if blocks are equal
                  score -= (equityStats[emp.id].TotalHours * 5);

                  // FTE Bonus: Higher FTEs should be picked first for new blocks
                  score += (emp.fte * 200);
                  
                  if (level === 0) {
                      if (dayOfWeek === 6) score -= (equityStats[emp.id].Saturdays * 2000); // Heavy penalty for sat rotation
                      if (shiftType === 'S') score -= (equityStats[emp.id].Nights * 500);
                  }

                  // Randomness to break ties
                  score += Math.random() * 50; 
                  return { emp, score };
              });

              scoredCandidates.sort((a, b) => b.score - a.score);

              let assignedCount = 0;
              const slotsToFill = needed - currentAssigned;
              
              for (let i = 0; i < slotsToFill; i++) {
                  if (scoredCandidates[i]) {
                      const winner = scoredCandidates[i].emp;
                      winner.shifts[dateStr] = shiftType;
                      assignedCount++;
                      
                      equityStats[winner.id].TotalHours += (SHIFT_HOURS[shiftType] || 0);
                      if (dayOfWeek === 1) equityStats[winner.id].Mondays++;
                      if (dayOfWeek === 6) equityStats[winner.id].Saturdays++;
                      if (shiftType === 'S') equityStats[winner.id].Nights++;
                  }
              }
              currentAssigned += assignedCount;
          };

          // --- PASS 1: STANDARD (Block Rules & Constraints) ---
          runPass(0);

          // --- PASS 2: RELAXED (Ignore Preference & Saturday Rotation) ---
          if (currentAssigned < needed) {
              runPass(1);
          }

          // --- PASS 3: FORCE (Ignore 48h limit) ---
          if (currentAssigned < needed) {
              runPass(2);
          }

          // --- PASS 4: NUCLEAR (Fill holes at all cost, only Safety Rule remains) ---
          if (currentAssigned < needed) {
              runPass(3);
          }
      }
  }

  // --- PHASE 3: FILL HOLES (NT/RH) ---
  employees.forEach(emp => {
      for (let day = 1; day <= numDays; day++) {
          const d = new Date(year, month, day);
          const dateStr = toLocalISOString(d);
          const dayOfWeek = getDayOfWeek(d);
          
          if (!emp.shifts[dateStr]) {
              if (dayOfWeek === 0 || dayOfWeek === 6) {
                  emp.shifts[dateStr] = 'RH';
              } else {
                  emp.shifts[dateStr] = 'NT';
              }
          }
      }
  });

  return employees;
};
