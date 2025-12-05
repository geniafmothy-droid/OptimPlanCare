
import { Employee, ShiftCode, ServiceConfig, WorkPreference } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';
import { fetchWorkPreferences } from '../services/db';

// Helper: Force local date string YYYY-MM-DD
const toLocalISOString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getDayOfWeek = (d: Date) => d.getDay(); // 0 Sun, 6 Sat

// --- DEFAULT TARGETS (Fallback if no config) ---
const DEFAULT_TARGETS: Record<number, Record<string, number>> = {
    1: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 2 }, // Lundi
    2: { 'IT': 4, 'T5': 1, 'T6': 1 },         // Mardi
    3: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 2 }, // Mercredi
    4: { 'IT': 4, 'T5': 1, 'T6': 1 },         // Jeudi
    5: { 'IT': 4, 'T5': 1, 'T6': 1, 'S': 2 }, // Vendredi
    6: { 'IT': 4, 'T5': 1, 'T6': 1 },         // Samedi
    0: {}                                     // Dimanche (Fermé par défaut)
};

export const generateMonthlySchedule = async (
  currentEmployees: Employee[],
  year: number,
  month: number,
  serviceConfig?: ServiceConfig
): Promise<Employee[]> => {
  
  // 1. Fetch Preferences
  let preferences: WorkPreference[] = [];
  try {
      preferences = await fetchWorkPreferences();
      // Filter for VALIDATED preferences only for the generator
      preferences = preferences.filter(p => p.status === 'VALIDATED');
  } catch (e) {
      console.warn("Could not fetch preferences.", e);
  }

  // Clone employees to ensure we don't mutate state directly before saving
  const employees = currentEmployees.map(emp => ({
      ...emp,
      shifts: { ...emp.shifts }
  }));
  
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); 
  const numDays = endDate.getDate();

  // Codes that should NEVER be overwritten during generation
  // Removed 'RH' to allow regeneration of weekly rest
  const LOCKED_ABSENCE_CODES = ['CA', 'NT', 'FO', 'RC', 'HS', 'F', 'RTT', 'CSS', 'PATER', 'MALADIE'];

  // Configuration Fallbacks
  const openDays = (serviceConfig?.openDays && Array.isArray(serviceConfig.openDays) && serviceConfig.openDays.length > 0)
      ? serviceConfig.openDays
      : [1, 2, 3, 4, 5, 6]; // Default: Mon-Sat Open

  const maxConsecutive = serviceConfig?.maxConsecutiveDays || 6; // Default to 6 days to allow full weeks

  // --- MAIN LOOP ---
  for (let day = 1; day <= numDays; day++) {
      const currentDate = new Date(year, month, day);
      const dateStr = toLocalISOString(currentDate);
      const dayOfWeek = getDayOfWeek(currentDate);
      
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = toLocalISOString(prevDate);

      // Rule 1: Check Open Days
      const isOpen = openDays.includes(dayOfWeek);

      // --- PHASE 1 : VERROUILLAGE ABSENCES & CONTRAINTES DURES ---
      employees.forEach(emp => {
          const existing = emp.shifts[dateStr];

          // 1. Preserve existing absences (EXCEPT RH which we regenerate)
          if (existing && LOCKED_ABSENCE_CODES.includes(existing)) return;
          
          // Clear RH/OFF if they exist to allow regeneration
          if (existing === 'RH' || existing === 'OFF') {
              delete emp.shifts[dateStr];
          }

          // 2. Rule 6: S -> NT/Repos enforced
          const prevShift = emp.shifts[prevDateStr];
          if (prevShift === 'S') {
              // Forced Rest after Evening Shift
              // Check if we already have a valid absence lock
              if (!emp.shifts[dateStr]) {
                  emp.shifts[dateStr] = 'RC'; // Prefer RC or RH
              }
              return; 
          }

          // 3. Desiderata (NO_WORK)
          const empPrefs = preferences.filter(p => p.employeeId === emp.id);
          for (const pref of empPrefs) {
              if (dateStr >= pref.startDate && dateStr <= pref.endDate) {
                  if (pref.recurringDays && pref.recurringDays.length > 0 && !pref.recurringDays.includes(dayOfWeek)) continue;
                  
                  if (pref.type === 'NO_WORK' && !emp.shifts[dateStr]) {
                      emp.shifts[dateStr] = 'RH';
                  }
              }
          }
          
          // 4. Closed Service Force RH (Except Cadre)
          if (!isOpen && !emp.shifts[dateStr] && emp.role !== 'Cadre') {
              emp.shifts[dateStr] = 'RH';
          }
      });

      
      // --- PHASE 2 : ASSIGNMENT (Only if Open) ---
      if (isOpen) {
          // Determine Targets
          let dailyTargets: Record<string, number> = {};
          
          if (serviceConfig?.shiftTargets && serviceConfig.shiftTargets[dayOfWeek]) {
              dailyTargets = serviceConfig.shiftTargets[dayOfWeek];
          } 
          
          // Fallback if config exists but has empty targets for this day, or if no config
          // Also check if values are all 0, which might indicate a bad config save
          const totalTarget = Object.values(dailyTargets).reduce((a,b) => a+b, 0);
          
          if (Object.keys(dailyTargets).length === 0 || totalTarget === 0) {
              dailyTargets = DEFAULT_TARGETS[dayOfWeek] || {};
          }

          // Priority Order: Combine standard shifts with any custom ones in targets
          const standardPriority: ShiftCode[] = ['S', 'T6', 'T5', 'IT', 'M'];
          const targetKeys = Object.keys(dailyTargets) as ShiftCode[];
          // Create unique list, respecting standard priority first
          const priorityOrder = Array.from(new Set([...standardPriority, ...targetKeys]));

          for (const shiftType of priorityOrder) {
              const needed = dailyTargets[shiftType] || 0;
              if (needed === 0) continue;

              let assignedCount = 0;

              // Count locked/manual assignments
              const alreadyAssigned = employees.filter(e => e.shifts[dateStr] === shiftType).length;
              if (alreadyAssigned >= needed) continue;

              // Filter Candidates
              const candidates = employees.filter(emp => {
                  if (emp.role === 'Cadre') return false; // Cadres managed separately
                  if (emp.shifts[dateStr]) return false;  // Already busy

                  // Skill Check (Robust)
                  if (serviceConfig?.requiredSkills?.length) {
                      const hasRequired = emp.skills.some(s => serviceConfig.requiredSkills!.includes(s));
                      if (!hasRequired) return false;
                  }

                  // Desiderata (Constraints)
                  const empPrefs = preferences.filter(p => p.employeeId === emp.id);
                  for (const pref of empPrefs) {
                      if (dateStr >= pref.startDate && dateStr <= pref.endDate) {
                           if (pref.recurringDays && !pref.recurringDays.includes(dayOfWeek)) continue;
                           if (pref.type === 'NO_NIGHT' && shiftType === 'S') return false;
                           if (pref.type === 'MORNING_ONLY' && shiftType === 'S') return false;
                           if (pref.type === 'AFTERNOON_ONLY' && shiftType !== 'S') return false;
                      }
                  }

                  // Rule 4: Max 48h / 7 sliding days
                  let hoursLast6 = 0;
                  for(let k=1; k<=6; k++) {
                      const dP = new Date(currentDate); dP.setDate(dP.getDate() - k);
                      const sP = emp.shifts[toLocalISOString(dP)];
                      if (sP) hoursLast6 += (SHIFT_HOURS[sP] || 0);
                  }
                  // Estimate: if shiftType doesn't have hours, assume 7.5
                  const shiftDuration = SHIFT_HOURS[shiftType] || 7.5;
                  if (hoursLast6 + shiftDuration > 48) return false;

                  // Rule 5: Max 1 Saturday out of 2
                  if (dayOfWeek === 6) {
                      const prevSat = new Date(currentDate); prevSat.setDate(prevSat.getDate() - 7);
                      const sSat = emp.shifts[toLocalISOString(prevSat)];
                      if (sSat && SHIFT_TYPES[sSat]?.isWork) return false;
                  }

                  // Rule 6: Max Consecutive Days
                  let consecutive = 0;
                  for(let k=1; k<=maxConsecutive; k++) {
                      const dP = new Date(currentDate); dP.setDate(dP.getDate() - k);
                      const sP = emp.shifts[toLocalISOString(dP)];
                      if (sP && SHIFT_TYPES[sP]?.isWork) consecutive++;
                      else break;
                  }
                  if (consecutive >= maxConsecutive) return false;

                  return true;
              });

              // Scoring for fair distribution
              const scoredCandidates = candidates.map(emp => {
                  let score = 0;
                  
                  // Prefer those with fewer hours this month
                  let hoursMonth = 0;
                  for(let d=1; d<day; d++) {
                      const s = emp.shifts[toLocalISOString(new Date(year, month, d))];
                      if(s) hoursMonth += (SHIFT_HOURS[s] || 0);
                  }
                  score += hoursMonth; 

                  // Rotation penalty for S
                  if (shiftType === 'S') {
                       const sCount = Object.values(emp.shifts).filter(s => s === 'S').length;
                       score += sCount * 50; 
                  }

                  score += Math.random() * 20; // Noise
                  return { emp, score };
              });

              scoredCandidates.sort((a, b) => a.score - b.score);

              // Assign
              for (const item of scoredCandidates) {
                  if (assignedCount + alreadyAssigned >= needed) break;
                  item.emp.shifts[dateStr] = shiftType;
                  assignedCount++;
              }
          }
      }
      
      // --- PHASE 3 : FILL HOLES (RH) ---
      employees.forEach(emp => {
          if (!emp.shifts[dateStr]) {
              if (emp.role === 'Cadre') {
                  // Cadre works weekdays unless holiday
                  // Simple logic: IT on Mon-Fri
                  const isHoliday = false; // TODO: integrate holiday check
                  if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday) emp.shifts[dateStr] = 'IT';
                  else emp.shifts[dateStr] = 'RH';
              } else {
                  emp.shifts[dateStr] = 'RH';
              }
          }
      });
  }

  return employees;
};
