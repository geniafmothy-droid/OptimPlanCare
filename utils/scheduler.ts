
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
const getHoursLast7Days = (emp: Employee, currentDate: Date, tempShifts: Record<string, ShiftCode>): number => {
    let total = 0;
    // Check previous 6 days + current planned shift
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

  // Codes that cannot be moved/deleted
  const LOCKED_CODES = ['CA', 'FO', 'RC', 'HS', 'F', 'RTT', 'CSS', 'PATER', 'MALADIE'];

  // Stats for equity balancing
  const equityStats: Record<string, { Mondays: number, Saturdays: number, TotalHours: number }> = {};
  employees.forEach(e => {
      equityStats[e.id] = { Mondays: 0, Saturdays: 0, TotalHours: 0 };
  });

  // --- PHASE 1: PRE-CLEANING & DESIDERATA APPLICATION ---
  for (let day = 1; day <= numDays; day++) {
      const currentDate = new Date(year, month, day);
      const dateStr = toLocalISOString(currentDate);
      const dayOfWeek = getDayOfWeek(currentDate);

      employees.forEach(emp => {
          const existing = emp.shifts[dateStr];

          // 1. Clean up regeneratable shifts (NT, RH, Work codes not locked)
          if (existing && !LOCKED_CODES.includes(existing)) {
              delete emp.shifts[dateStr]; 
          }

          // 2. Apply "NO_WORK" Desiderata as Hard Constraints immediately
          if (!emp.shifts[dateStr]) {
              const empPrefs = preferences.filter(p => p.employeeId === emp.id);
              for (const pref of empPrefs) {
                  if (dateStr >= pref.startDate && dateStr <= pref.endDate) {
                      if (pref.recurringDays && pref.recurringDays.length > 0 && !pref.recurringDays.includes(dayOfWeek)) continue;
                      
                      if (pref.type === 'NO_WORK') {
                          // Rule: RH only for Sat(6)/Sun(0), NT for Weekdays
                          emp.shifts[dateStr] = (dayOfWeek === 0 || dayOfWeek === 6) ? 'RH' : 'NT';
                      }
                  }
              }
          }

          // 3. Apply Sunday Rule (Closed)
          // Exception: Cadres usually don't work Sunday but might have on-call. 
          // Here we set RH for standard staff if empty.
          if (dayOfWeek === 0 && !emp.shifts[dateStr] && !NON_COUNTING_ROLES.includes(emp.role)) {
              emp.shifts[dateStr] = 'RH';
          }
          
          // 4. Cadre Default Schedule (IT Mon-Fri)
          // We assign them IT, but remember: this IT will NOT count towards the nurse target due to NON_COUNTING_ROLES check later.
          if (NON_COUNTING_ROLES.includes(emp.role) && !emp.shifts[dateStr] && dayOfWeek >= 1 && dayOfWeek <= 5) {
              emp.shifts[dateStr] = 'IT';
          }
      });
  }

  // --- PHASE 2: DAILY ASSIGNMENT LOOP (THE CORE) ---
  for (let day = 1; day <= numDays; day++) {
      const currentDate = new Date(year, month, day);
      const dateStr = toLocalISOString(currentDate);
      const dayOfWeek = getDayOfWeek(currentDate);
      
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = toLocalISOString(prevDate);

      if (dayOfWeek === 0) continue; // Skip Sundays

      // 1. Determine Targets
      let targets = { ...DIALYSIS_TARGETS[dayOfWeek] };
      if (serviceConfig?.shiftTargets && serviceConfig.shiftTargets[dayOfWeek]) {
          const configTargets = serviceConfig.shiftTargets[dayOfWeek];
          if (Object.keys(configTargets).length > 0) {
              targets = { ...configTargets };
          }
      }

      // Priority: Fill 'S' first (Hardest to fill due to "Next Day Off" rule)
      const priorityOrder: ShiftCode[] = ['S', 'T6', 'T5', 'IT']; 

      for (const shiftType of priorityOrder) {
          const needed = targets[shiftType] || 0;
          if (needed === 0) continue;

          // Count currently assigned STRICTLY filtering out management/admin roles
          // This ensures that even if a Cadre is in 'IT', we still need 4 Nurses in 'IT'.
          let currentAssigned = employees.filter(e => 
              e.shifts[dateStr] === shiftType && 
              !NON_COUNTING_ROLES.includes(e.role)
          ).length;
          
          if (currentAssigned >= needed) continue;

          // --- CANDIDATE FINDING STRATEGY ---
          
          const findCandidates = (ignoreEquity: boolean) => {
              return employees.filter(emp => {
                  // A. Role Check (Strictly Care Staff)
                  if (NON_COUNTING_ROLES.includes(emp.role)) return false; 
                  // Double check to be sure we only take Nurses/AS/Interim
                  if (emp.role !== 'Infirmier' && emp.role !== 'Aide-Soignant' && emp.role !== 'Intérimaire') return false;
                  
                  // B. Availability Check
                  if (emp.shifts[dateStr]) return false; // Already working or absent

                  // C. Legal Hard Constraints
                  // 1. Post-Night Rest: If S yesterday, cannot work today.
                  if (emp.shifts[prevDateStr] === 'S') return false;

                  // 2. Max 48h / 7 days
                  const hoursThisShift = SHIFT_HOURS[shiftType] || 7.5;
                  const hoursPast = getHoursLast7Days(emp, currentDate, emp.shifts);
                  if ((hoursPast + hoursThisShift) > 48) return false;

                  // 3. Samedi rule (1 sur 2) - Only applies if today is Saturday
                  if (dayOfWeek === 6 && !ignoreEquity) {
                      const prevSat = new Date(currentDate); prevSat.setDate(prevSat.getDate() - 7);
                      const prevSatStr = toLocalISOString(prevSat);
                      const prevShift = emp.shifts[prevSatStr];
                      if (prevShift && SHIFT_TYPES[prevShift]?.isWork) return false;
                  }

                  // 4. "NO_NIGHT" Desiderata Check
                  if (shiftType === 'S') {
                      const hasNoNight = preferences.some(p => 
                          p.employeeId === emp.id && 
                          p.type === 'NO_NIGHT' &&
                          dateStr >= p.startDate && dateStr <= p.endDate
                      );
                      if (hasNoNight) return false;
                  }

                  return true;
              });
          };

          // --- PASS 1: EQUITY & FTE PRIORITY ---
          let candidates = findCandidates(false);
          
          let scoredCandidates = candidates.map(emp => {
              let score = 1000;
              
              // CRITICAL: FTE WEIGHTING
              // A 100% FTE (1.0) gets +5000 points. A 80% (0.8) gets +4000.
              // This ensures full-time staff are filled FIRST before part-time, preventing 100% staff from ending up with NT.
              score += (emp.fte * 5000);

              // Penalty for too many hours already worked relative to others
              score -= equityStats[emp.id].TotalHours;
              
              // Penalty for specific days to rotate
              if (dayOfWeek === 1) score -= (equityStats[emp.id].Mondays * 50);
              if (dayOfWeek === 6) score -= (equityStats[emp.id].Saturdays * 200);

              // Randomness to break ties among same FTE
              score += Math.random() * 50; 
              return { emp, score };
          });

          scoredCandidates.sort((a, b) => b.score - a.score);

          // Assign
          let assignedInPass1 = 0;
          for (let i = 0; i < (needed - currentAssigned); i++) {
              if (scoredCandidates[i]) {
                  const winner = scoredCandidates[i].emp;
                  winner.shifts[dateStr] = shiftType;
                  assignedInPass1++;
                  
                  // Update Stats
                  equityStats[winner.id].TotalHours += (SHIFT_HOURS[shiftType] || 0);
                  if (dayOfWeek === 1) equityStats[winner.id].Mondays++;
                  if (dayOfWeek === 6) equityStats[winner.id].Saturdays++;
              }
          }

          currentAssigned += assignedInPass1;

          // --- PASS 2: RESCUE MODE (Force Assignment) ---
          // Ignore soft rules (like Saturday 1/2) if we are still missing staff.
          if (currentAssigned < needed) {
              const rescueCandidates = findCandidates(true); // ignoreEquity = true
              
              let scoredRescue = rescueCandidates.map(emp => ({
                  emp,
                  // Still prioritize FTE in rescue mode
                  score: (emp.fte * 5000) - equityStats[emp.id].TotalHours + Math.random() * 50
              })).sort((a, b) => b.score - a.score);

              for (let i = 0; i < (needed - currentAssigned); i++) {
                  if (scoredRescue[i]) {
                      const winner = scoredRescue[i].emp;
                      winner.shifts[dateStr] = shiftType;
                      
                      equityStats[winner.id].TotalHours += (SHIFT_HOURS[shiftType] || 0);
                      if (dayOfWeek === 1) equityStats[winner.id].Mondays++;
                      if (dayOfWeek === 6) equityStats[winner.id].Saturdays++;
                  }
              }
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
              // Rule: RH only for Sat(6)/Sun(0), NT for Weekdays
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
