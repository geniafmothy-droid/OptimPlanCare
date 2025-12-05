
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
    // Check previous 6 days + current planned shift (if any, though usually we call this before assignment)
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
    1: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 2 }, // Lundi (2 soirs)
    2: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 1 }, // Mardi (1 soir)
    3: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 2 }, // Mercredi (2 soirs)
    4: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 1 }, // Jeudi (1 soir)
    5: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 2 }, // Vendredi (2 soirs)
    6: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 1 }, // Samedi (1 soir)
    0: {}                                     // Dimanche (Fermé par défaut)
};

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

  // 2. Prepare Working Copy
  // We use a separate 'plannedShifts' map to track decisions made during this generation run
  // while keeping 'emp.shifts' for history reference.
  const employees = currentEmployees.map(emp => {
      // Create a clean slate for the month, but KEEP existing locks
      const newShifts = { ...emp.shifts };
      return { ...emp, shifts: newShifts };
  });

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); 
  const numDays = endDate.getDate();

  // Codes that are considered "immutable" (Manual locks or Leaves)
  const LOCKED_CODES = ['CA', 'NT', 'FO', 'RC', 'HS', 'F', 'RTT', 'CSS', 'PATER', 'MALADIE'];

  // Track equity counters for the month
  const equityStats: Record<string, { Mondays: number, Wednesdays: number, Fridays: number, Saturdays: number, TotalHours: number }> = {};
  employees.forEach(e => {
      equityStats[e.id] = { Mondays: 0, Wednesdays: 0, Fridays: 0, Saturdays: 0, TotalHours: 0 };
  });

  // --- PHASE 1: PRE-CLEANING & HARD CONSTRAINTS ---
  for (let day = 1; day <= numDays; day++) {
      const currentDate = new Date(year, month, day);
      const dateStr = toLocalISOString(currentDate);
      const dayOfWeek = getDayOfWeek(currentDate);

      employees.forEach(emp => {
          const existing = emp.shifts[dateStr];

          // A. Clean up regeneratable shifts (RH, NT, OFF or Auto-generated work if re-running)
          // Note: added 'RH' and 'NT' to be cleanable unless they are specific leave requests (which are usually CA/NT/RC handled by LOCKED_CODES)
          // If 'NT' was manually set as "Maladie", it should be in LOCKED_CODES. 
          // If 'NT' was generated previously, we clear it to regenerate.
          if (!LOCKED_CODES.includes(existing)) {
              delete emp.shifts[dateStr]; 
          }

          // B. Apply Desiderata (NO_WORK -> RH or NT depending on day)
          // Only if slot is empty (don't overwrite CA)
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

          // C. Sunday Rule (Dialysis Closed)
          // If Sunday and not manually set to something else (e.g. On-call), set RH
          if (dayOfWeek === 0 && !emp.shifts[dateStr] && emp.role !== 'Cadre') {
              emp.shifts[dateStr] = 'RH';
          }
          
          // D. Cadre Default Schedule (IT Mon-Fri)
          if (emp.role === 'Cadre' && !emp.shifts[dateStr] && dayOfWeek >= 1 && dayOfWeek <= 5) {
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

      // Skip closed days (Sundays) for assignment
      if (dayOfWeek === 0) continue;

      // 1. Determine Needs
      // FALLBACK LOGIC: If serviceConfig exists but is empty for this day, default to DIALYSIS_TARGETS
      let targets = { ...DIALYSIS_TARGETS[dayOfWeek] };
      
      if (serviceConfig?.shiftTargets && serviceConfig.shiftTargets[dayOfWeek] && Object.keys(serviceConfig.shiftTargets[dayOfWeek]).length > 0) {
          targets = { ...serviceConfig.shiftTargets[dayOfWeek] };
      }

      // Priority Order: Fill 'S' (Soir) first because it has the strict "Next Day Off" constraint.
      // Then fill long shifts (IT), then shorter ones.
      const priorityOrder: ShiftCode[] = ['S', 'IT', 'T6', 'T5']; 

      // 2. Assign Each Shift Type
      for (const shiftType of priorityOrder) {
          const needed = targets[shiftType] || 0;
          if (needed === 0) continue;

          // Check how many already assigned (e.g. manually locked)
          let currentAssigned = employees.filter(e => e.shifts[dateStr] === shiftType).length;
          
          if (currentAssigned >= needed) continue;

          // 3. Filter Candidates (Hard Constraints)
          const candidates = employees.filter(emp => {
              // Role check
              if (emp.role !== 'Infirmier' && emp.role !== 'Aide-Soignant') return false; // Focus on care staff
              // Already assigned?
              if (emp.shifts[dateStr]) return false;

              // HARD 1: S -> RH/NT (If yesterday was S, today MUST be rest, so cannot work)
              if (emp.shifts[prevDateStr] === 'S') return false;

              // HARD 2: Max 48h / 7 sliding days
              // We simulate adding this shift
              const hoursThisShift = SHIFT_HOURS[shiftType] || 7.5;
              const hoursPast = getHoursLast7Days(emp, currentDate, emp.shifts);
              if ((hoursPast + hoursThisShift) > 48) return false;

              // HARD 3: 1 Saturday out of 2
              if (dayOfWeek === 6) {
                  const prevSat = new Date(currentDate);
                  prevSat.setDate(prevSat.getDate() - 7);
                  const prevSatStr = toLocalISOString(prevSat);
                  const prevShift = emp.shifts[prevSatStr];
                  // If worked last Sat (and shift was a working shift)
                  if (prevShift && SHIFT_TYPES[prevShift]?.isWork) return false;
              }

              // HARD 4: Check if strict "NO_NIGHT" constraint exists and trying to assign S
              if (shiftType === 'S') {
                  const empPrefs = preferences.filter(p => p.employeeId === emp.id);
                  const hasNoNight = empPrefs.some(p => 
                      p.type === 'NO_NIGHT' && 
                      dateStr >= p.startDate && 
                      dateStr <= p.endDate &&
                      (!p.recurringDays || p.recurringDays.includes(dayOfWeek))
                  );
                  if (hasNoNight) return false;
              }

              return true;
          });

          // 4. Score Candidates (Soft Constraints & Equity)
          const scoredCandidates = candidates.map(emp => {
              let score = 1000;

              // FACTOR A: Equity Counters (Balance M/W/F/Sat)
              if (dayOfWeek === 1) score -= (equityStats[emp.id].Mondays * 50);
              if (dayOfWeek === 3) score -= (equityStats[emp.id].Wednesdays * 50);
              if (dayOfWeek === 5) score -= (equityStats[emp.id].Fridays * 50);
              if (dayOfWeek === 6) score -= (equityStats[emp.id].Saturdays * 100); // Heavy penalty for sat imbalance

              // FACTOR B: FTE Balancing
              // Lower score if they already have tons of hours
              score -= equityStats[emp.id].TotalHours;

              // FACTOR C: "Saturday -> Avoid Monday"
              // If today is Monday, and employee worked last Saturday, huge penalty
              if (dayOfWeek === 1) {
                  const lastSat = new Date(currentDate);
                  lastSat.setDate(lastSat.getDate() - 2); // Sat is 2 days ago
                  const lastSatStr = toLocalISOString(lastSat);
                  const s = emp.shifts[lastSatStr];
                  if (s && SHIFT_TYPES[s]?.isWork) {
                      score -= 5000; // Try very hard to avoid
                  }
              }

              // FACTOR D: Golden Weekend Protection (3 days off)
              if (dayOfWeek === 1) { // Monday
                  const sun = new Date(currentDate); sun.setDate(sun.getDate() - 1);
                  const sat = new Date(currentDate); sat.setDate(sat.getDate() - 2);
                  const sSun = emp.shifts[toLocalISOString(sun)];
                  const sSat = emp.shifts[toLocalISOString(sat)];
                  // If Sat and Sun were NOT work (OFF, RH, CA, etc), effectively rest
                  const satRest = !sSat || !SHIFT_TYPES[sSat]?.isWork;
                  const sunRest = !sSun || !SHIFT_TYPES[sSun]?.isWork;
                  
                  if (satRest && sunRest) {
                      // Working today breaks a 3-day weekend opportunity
                      score -= 2000; 
                  }
              }

              // FACTOR E: Randomness (to allow shuffling between equal candidates)
              score += Math.random() * 20;

              return { emp, score };
          });

          // Sort descending (Higher score = Better candidate)
          scoredCandidates.sort((a, b) => b.score - a.score);

          // Assign needed slots
          for (let i = 0; i < (needed - currentAssigned); i++) {
              if (scoredCandidates[i]) {
                  const winner = scoredCandidates[i].emp;
                  winner.shifts[dateStr] = shiftType;
                  
                  // Update stats
                  equityStats[winner.id].TotalHours += (SHIFT_HOURS[shiftType] || 0);
                  if (dayOfWeek === 1) equityStats[winner.id].Mondays++;
                  if (dayOfWeek === 3) equityStats[winner.id].Wednesdays++;
                  if (dayOfWeek === 5) equityStats[winner.id].Fridays++;
                  if (dayOfWeek === 6) equityStats[winner.id].Saturdays++;
              }
          }
      }
  }

  // --- PHASE 3: FILL HOLES & COMPENSATORY REST ---
  // Fill remaining empty slots with NT (Weekdays) or RH (Weekends)
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
