import { Employee, ShiftCode } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS, NURSE_CYCLE_MATRIX } from '../constants';

// Helper to shuffle array for random distribution of shifts
const shuffle = <T>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// Helper to get ISO week number to determine cycle rotation
const getWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

export const generateMonthlySchedule = (
  currentEmployees: Employee[],
  year: number,
  month: number
): Employee[] => {
  // Clone employees to avoid direct mutation issues during calculation
  const employees = JSON.parse(JSON.stringify(currentEmployees)) as Employee[];
  
  // Clear shifts for the target month
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // Last day of month
  
  // Separate by roles
  const infirmiers = employees.filter(e => e.role === 'Infirmier');
  const aidesSoignants = employees.filter(e => e.role === 'Aide-Soignant');
  const cadres = employees.filter(e => e.role === 'Cadre');

  // --- INFIRMIERS LOGIC (MATRIX CYCLE) ---
  // Apply the 7-week cycle based on the matrix
  infirmiers.forEach((emp, index) => {
    // Determine offset for this employee so they fall on different lines
    // We simply use their index. Emp 0 starts on Line 0, Emp 1 on Line 1, etc.
    const cycleOffset = index % 7;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        // 0 (Sun) to 6 (Sat) in JS
        // We need 0 (Mon) to 6 (Sun) for our matrix array access
        // Matrix is: [Lun, Mar, Mer, Jeu, Ven, Sam, Dim]
        const jsDay = d.getDay(); 
        const matrixDayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convert Sun(0)->6, Mon(1)->0

        // Determine Week Number to rotate lines
        const weekNum = getWeekNumber(d);
        
        // Calculate which row of the matrix to use
        // Row = (WeekNum + Offset) % 7
        const matrixRowIndex = (weekNum + cycleOffset) % 7;

        // Assign Code
        emp.shifts[dateStr] = NURSE_CYCLE_MATRIX[matrixRowIndex][matrixDayIndex];
    }
  });


  // --- AIDE-SOIGNANTS & CADRES (SIMPLE LOGIC) ---
  // We process these day by day as they don't have the strict matrix constraint yet
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon...
    
    // SUNDAY RULE for Non-Infirmiers: Service Fermé -> RH
    // Note: The Matrix for Infirmiers already handles Sunday as RH/RC, so we don't need to force it there.
    if (dayOfWeek === 0) {
      [...aidesSoignants, ...cadres].forEach(emp => {
        emp.shifts[dateStr] = 'RH';
      });
      continue;
    }

    // --- AIDE-SOIGNANTS ---
    // Simple random assignment respecting 50/50 distribution if possible
    let availableAS = shuffle(aidesSoignants);
    const asWorkCount = Math.min(2, availableAS.length); // Assuming need ~2 AS per day
    for(let i=0; i<availableAS.length; i++) {
        if (i < asWorkCount) {
             availableAS[i].shifts[dateStr] = Math.random() > 0.5 ? 'IT' : 'M';
        } else {
             availableAS[i].shifts[dateStr] = 'NT';
        }
    }

    // --- CADRES ---
    cadres.forEach(c => {
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            c.shifts[dateStr] = 'IT';
        } else {
            c.shifts[dateStr] = 'RH'; // Weekend off for Cadres usually
        }
    });
  }
  
  return employees;
};