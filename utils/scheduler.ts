
import { Employee, ShiftCode, ServiceConfig, WorkPreference } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';
import { fetchWorkPreferences } from '../services/db';

// Helper to shuffle array for random distribution when scores are equal
const shuffle = <T>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export const generateMonthlySchedule = async (
  currentEmployees: Employee[],
  year: number,
  month: number,
  serviceConfig?: ServiceConfig
): Promise<Employee[]> => {
  
  // 1. Fetch Preferences (Desiderata) from DB
  let preferences: WorkPreference[] = [];
  try {
      preferences = await fetchWorkPreferences();
  } catch (e) {
      console.warn("Could not fetch preferences, proceeding without.");
  }

  // Clone employees to avoid direct mutation (Crucial for Scenario Planning)
  // Deep clone needed for shifts object
  const employees = currentEmployees.map(emp => ({
      ...emp,
      shifts: { ...emp.shifts }
  }));
  
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // Last day of month
  const numDays = endDate.getDate();

  // Helper: Force local date string YYYY-MM-DD
  const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Helper: Get Shift Hours
  const getShiftHours = (code: ShiftCode) => SHIFT_HOURS[code] || 0;

  // Helper: Calculate worked hours in sliding 7 days window ending at `date`
  const getHoursLast7Days = (emp: Employee, currentDate: Date): number => {
      let total = 0;
      for (let i = 0; i < 7; i++) {
          const d = new Date(currentDate);
          d.setDate(d.getDate() - i);
          const s = emp.shifts[toDateStr(d)];
          if (s) total += getShiftHours(s);
      }
      return total;
  };

  // Helper: Check if worked previous Saturday
  const workedPreviousSaturday = (emp: Employee, currentDate: Date): boolean => {
      const d = new Date(currentDate);
      const day = d.getDay(); // 6 = Saturday
      if (day !== 6) return false;
      
      const prevSat = new Date(d);
      prevSat.setDate(d.getDate() - 7);
      const s = emp.shifts[toDateStr(prevSat)];
      return !!(s && SHIFT_TYPES[s]?.isWork);
  };

  // Iterate day by day
  for (let day = 1; day <= numDays; day++) {
      const currentDate = new Date(year, month, day);
      const dateStr = toDateStr(currentDate);
      const dayOfWeek = currentDate.getDay(); // 0=Sun, 1=Mon...

      // --- PHASE 0: PRE-CHECK HARD CONSTRAINTS (Absences & Desiderata) ---
      for (const emp of employees) {
          // 1. Preserve Manual Absences (Locked)
          const existing = emp.shifts[dateStr];
          if (['CA', 'NT', 'FO', 'RC', 'HS', 'F', 'RTT', 'RH'].includes(existing)) {
              continue; // Skip logic, keep existing
          }

          // 2. Apply Validated Desiderata
          const pref = preferences.find(p => p.employeeId === emp.id && p.date === dateStr && p.status === 'VALIDATED');
          if (pref) {
              if (pref.type === 'NO_WORK') {
                  emp.shifts[dateStr] = 'RH'; // Force Rest
              }
              // Other pref types (NO_NIGHT) handled during assignment
          }

          // 3. Service Closed Rule (Sunday) - Unless config says open
          const isOpen = serviceConfig ? serviceConfig.openDays.includes(dayOfWeek) : dayOfWeek !== 0;
          if (!isOpen && !['CA', 'NT'].includes(emp.shifts[dateStr])) {
              emp.shifts[dateStr] = 'RH';
          }
      }

      // If Service Closed, skip assignment logic for this day
      const isOpen = serviceConfig ? serviceConfig.openDays.includes(dayOfWeek) : dayOfWeek !== 0;
      if (!isOpen) continue;

      // --- PHASE 1: IDENTIFY TARGETS ---
      // Defaults (Dialysis example) if no config
      let targets: Record<string, number> = { 'IT': 4, 'T5': 1, 'T6': 1, 'M': 2 }; // Generic default
      
      // Override with Specific Day Targets from Config
      if (serviceConfig?.shiftTargets && serviceConfig.shiftTargets[dayOfWeek]) {
          targets = serviceConfig.shiftTargets[dayOfWeek];
      } else if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
          // Default Dialysis Rule: 2 S on Mon/Wed/Fri
          targets['S'] = 2;
      }

      // --- PHASE 2: ASSIGN CRITICAL SHIFTS (Greedy with Scoring) ---
      // We iterate through required shifts (e.g., first fill S, then IT...)
      // Order matters: Fill hardest shifts first (Night/Soir)
      const shiftPriority: ShiftCode[] = ['S', 'T6', 'T5', 'IT', 'M', 'DP']; 
      
      for (const shiftType of shiftPriority) {
          const needed = targets[shiftType] || 0;
          if (needed === 0) continue;

          let assignedCount = 0;
          
          // Filter eligible candidates
          // Candidates are employees who:
          // 1. Don't have a shift yet today
          // 2. Have the required Skill
          // 3. Not blocked by Desiderata (NO_NIGHT)
          // 4. Respect 48h rule
          // 5. Respect Sat rotation
          // 6. Respect Post-Night rule
          
          const candidates = employees.filter(emp => {
              if (emp.shifts[dateStr]) return false; // Already assigned (Absence or other shift)
              
              // Skill Check
              if (serviceConfig?.requiredSkills?.includes(shiftType)) {
                  // If shift is a skill code, emp must have it
                  if (!emp.skills.includes(shiftType)) return false;
              }

              // Desiderata Check
              const pref = preferences.find(p => p.employeeId === emp.id && p.date === dateStr && p.status === 'VALIDATED');
              if (pref && pref.type === 'NO_NIGHT' && shiftType === 'S') return false;
              if (pref && pref.type === 'MORNING_ONLY' && (shiftType === 'S' || shiftType === 'IT')) return false;

              // Post-Night Rule (Look at yesterday)
              const prevDate = new Date(currentDate);
              prevDate.setDate(currentDate.getDate() - 1);
              const prevShift = emp.shifts[toDateStr(prevDate)];
              if (prevShift === 'S') return false; // Must rest after Night

              // Saturday Rule
              if (dayOfWeek === 6 && workedPreviousSaturday(emp, currentDate)) return false;

              // 48h Rule
              const hoursThisWeek = getHoursLast7Days(emp, currentDate);
              if (hoursThisWeek + getShiftHours(shiftType) > 48) return false;

              return true;
          });

          // --- SCORING FOR EQUITY ---
          // Score = (FTE - CurrentMonthHours/TargetHours) + RandomFactor
          // Prioritize those who worked less relative to their FTE
          const scoredCandidates = candidates.map(emp => {
              // Calculate hours worked so far this month
              let hoursMonth = 0;
              for(let d=1; d<day; d++) {
                  const s = emp.shifts[toDateStr(new Date(year, month, d))];
                  if(s) hoursMonth += getShiftHours(s);
              }
              
              // Lower score is better (we sort ascending) -> Sort by hours ascending
              // Weight by FTE (Someone with 50% should have fewer hours)
              const weightedHours = hoursMonth / (emp.fte || 1);
              
              return { emp, score: weightedHours + Math.random() * 5 }; // Random factor to break ties
          }).sort((a, b) => a.score - b.score);

          // Assign
          for (const cand of scoredCandidates) {
              if (assignedCount >= needed) break;
              cand.emp.shifts[dateStr] = shiftType;
              assignedCount++;
          }
      }

      // --- PHASE 3: FILL REMAINING / OFF ---
      employees.forEach(emp => {
          if (!emp.shifts[dateStr]) {
              // Decide between Repos (RH) or Default Work (M) based on FTE needs?
              // For simplicity in this version, unassigned becomes RH/OFF
              // In a real roster, we might assign generic 'M' if under-hours.
              emp.shifts[dateStr] = 'RH'; 
          }
      });
  }

  return employees;
};
