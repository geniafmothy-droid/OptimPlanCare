
import { Employee, ShiftCode, ServiceConfig, WorkPreference } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';
import { fetchWorkPreferences } from '../services/db';

// --- HELPER FUNCTIONS ---

const toLocalISOString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getDayOfWeek = (d: Date) => d.getDay(); // 0 Sun, 1 Mon...

/**
 * Get ISO Week Number
 */
const getWeekNumber = (d: Date): number => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

/**
 * Get Monthly Legal Hours for Maternity Mode based on FTE
 * Règle : 100%=161h, 80%=128.8h, 60%=96.6h, 50%=80.5h
 */
const getMaternityMonthlyCap = (fte: number): number => {
    if (fte >= 1.0) return 161;
    if (fte >= 0.8) return 128.8; // 128h48
    if (fte >= 0.6) return 96.6;  // 96h36
    if (fte >= 0.5) return 80.5;  // 80h30
    return fte * 161; // Fallback linéaire
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

// --- DIALYSIS SPECIFIC TARGETS ---
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
          
          // Calculer les heures déjà verrouillées (congés, etc)
          const currentCode = emp.shifts[dateStr];
          if (currentCode) equityStats[emp.id].TotalHours += (SHIFT_HOURS[currentCode] || 0);
      });
  }

  // --- PHASE 2: DAILY ASSIGNMENT ---
  for (let day = 1; day <= numDays; day++) {
      const currentDate = new Date(year, month, day);
      const dateStr = toLocalISOString(currentDate);
      const dayOfWeek = getDayOfWeek(currentDate);
      const prevDateStr = toLocalISOString(new Date(new Date(currentDate).setDate(currentDate.getDate() - 1)));
      const nextDateStr = toLocalISOString(new Date(new Date(currentDate).setDate(currentDate.getDate() + 1)));
      const weekNum = getWeekNumber(currentDate);
      const isEvenWeek = weekNum % 2 === 0;

      if (dayOfWeek === 0) continue; 

      // TARGET CALCULATION
      let targets: Record<string, number> = isMaternityMode ? { 'IT': 3, 'S': 1 } : { ...DIALYSIS_TARGETS[dayOfWeek] };
      if (serviceConfig?.shiftTargets?.[dayOfWeek]) {
          targets = { ...serviceConfig.shiftTargets[dayOfWeek] };
      }

      // Parité CPF
      if (isMaternityMode) {
          if (dayOfWeek === 3) { targets['CPF M'] = isEvenWeek ? 1 : 2; targets['CPF C'] = isEvenWeek ? 1 : 2; }
          else if (dayOfWeek === 5) { targets['CPF M'] = isEvenWeek ? 2 : 1; targets['CPF C'] = isEvenWeek ? 2 : 1; }
      }

      const priorityOrder: ShiftCode[] = ['S', 'CPF C', 'CPF M', 'T6', 'T5', 'IT']; 

      for (const shiftType of priorityOrder) {
          const needed = targets[shiftType] || 0;
          if (needed === 0) continue;

          let currentAssigned = employees.filter(e => e.shifts[dateStr] === shiftType && !NON_COUNTING_ROLES.includes(e.role)).length;
          if (currentAssigned >= needed) continue;

          const findCandidates = (strictnessLevel: number) => {
              return employees.filter(emp => {
                  if (emp.shifts[dateStr]) return false; 
                  
                  // RÈGLE POST-NUIT (Stricte)
                  if (emp.shifts[prevDateStr] === 'S') return false;
                  // Si on assigne S aujourd'hui, on ne peut pas avoir de poste déjà prévu demain
                  if (shiftType === 'S' && emp.shifts[nextDateStr] && SHIFT_TYPES[emp.shifts[nextDateStr]]?.isWork) return false;
                  
                  // Skill check
                  if (!emp.skills.includes(shiftType as string) && shiftType !== 'IT' && shiftType !== 'S') return false;

                  const hoursToAdd = SHIFT_HOURS[shiftType] || 0;

                  // QUOTAS MENSUELS (Maternité)
                  if (isMaternityMode) {
                      const monthlyCap = getMaternityMonthlyCap(emp.fte);
                      if (equityStats[emp.id].TotalHours + hoursToAdd > monthlyCap && strictnessLevel < 3) return false;

                      if (strictnessLevel < 3) {
                          const currentWeekIndex = Math.floor((day - 1) / 7);
                          if (emp.fte >= 1.0 && (dayOfWeek === 6 || dayOfWeek === 0)) {
                              if (equityStats[emp.id].LastWeekendWorked === currentWeekIndex - 1) return false;
                          }
                          if (emp.fte >= 0.75 && emp.fte < 0.9) {
                              if (dayOfWeek === 5 && shiftType === 'S' && equityStats[emp.id].LastWeekendWorked === currentWeekIndex) return false;
                              if (dayOfWeek === 6 && equityStats[emp.id].LastFridayNight === currentWeekIndex) return false;
                          }
                      }
                  }

                  if (strictnessLevel < 2 && (getHoursLast7Days(emp, currentDate, emp.shifts) + hoursToAdd) > 48) return false;

                  return true;
              });
          };

          const runPass = (level: number) => {
              let candidates = findCandidates(level).map(emp => {
                  let score = 1000;
                  const workedYesterday = emp.shifts[prevDateStr] && SHIFT_TYPES[emp.shifts[prevDateStr]]?.isWork;
                  if (workedYesterday) score += 2000; else score -= 500;
                  if (getConsecutiveDaysCount(emp, currentDate, emp.shifts) >= 2) score -= 5000;
                  
                  const monthlyCap = isMaternityMode ? getMaternityMonthlyCap(emp.fte) : (emp.fte * 160);
                  const remainingHours = monthlyCap - equityStats[emp.id].TotalHours;
                  score += (remainingHours * 10);
                  score += (emp.fte * 200);
                  score += Math.random() * 50; 
                  return { emp, score };
              }).sort((a, b) => b.score - a.score);

              let assignedCount = 0;
              for (let i = 0; i < (needed - currentAssigned); i++) {
                  if (candidates[i]) {
                      const winner = candidates[i].emp;
                      const hours = SHIFT_HOURS[shiftType] || 0;
                      winner.shifts[dateStr] = shiftType;
                      assignedCount++;
                      equityStats[winner.id].TotalHours += hours;
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
