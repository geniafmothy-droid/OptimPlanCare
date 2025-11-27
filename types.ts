
export type ShiftCode = 
  | 'M' | 'T5' | 'T6' | 'S' | 'IT' | 'NT' | 'CA' | 'RH' | 'FO' | 'ETP' | 'DP' | 'OFF' | 'RC';

export interface ShiftDefinition {
  code: ShiftCode;
  label: string;
  color: string; // Tailwind class for background
  textColor: string;
  description: string;
  isWork: boolean;
  startHour?: number; // Heure de début (ex: 6.5 pour 06h30)
  endHour?: number;   // Heure de fin (ex: 18.5 pour 18h30)
}

export interface Employee {
  id: string;
  matricule: string;
  name: string;
  role: 'Infirmier' | 'Aide-Soignant' | 'Cadre' | 'Manager';
  fte: number; // Quotité : 1.0 = 100%, 0.8 = 80%, etc.
  leaveBalance: number; // Solde de congés
  skills: string[]; // Compétences de l'équipier (ex: 'Senior', 'Dialyse')
  shifts: Record<string, ShiftCode>; // Date string (YYYY-MM-DD) -> ShiftCode
}

export interface DailyStats {
  date: string;
  totalStaff: number;
  seniorCount: number;
  missingSkills: string[];
  counts: Record<ShiftCode, number>;
}

export interface ConstraintViolation {
  employeeId: string;
  date: string;
  type: 'CONSECUTIVE_DAYS' | 'MISSING_SKILL' | 'INVALID_ROTATION';
  message: string;
  severity: 'warning' | 'error';
}

export type ViewMode = 'month' | 'week' | 'workweek' | 'day' | 'hourly';
