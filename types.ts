
export type ShiftCode = 
  | 'M' | 'T5' | 'T6' | 'S' | 'IT' | 'NT' | 'CA' | 'RH' | 'FO' | 'ETP' | 'DP' | 'OFF' | 'RC' | 'HS' | 'F' | 'RTT' | 'INT'; // Added INT for Interim

export type UserRole = 'ADMIN' | 'DIRECTOR' | 'CADRE' | 'INFIRMIER' | 'AIDE_SOIGNANT' | 'MANAGER' | 'CADRE_SUP';

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

export interface Skill {
  id: string;
  code: string;
  label: string;
}

export interface LeaveCounterComplex {
    taken: number;
    allowed: number;
    reliquat: number;
}

export interface LeaveCounters {
    CA: number | LeaveCounterComplex;
    RTT: number | LeaveCounterComplex;
    HS: number | LeaveCounterComplex; // Heures Sup
    RC: number | LeaveCounterComplex; // Repos Compensateur
    [key: string]: number | LeaveCounterComplex | any;
}

export interface LeaveHistory {
    date: string;
    action: string;
    type?: string; // Code du congé (CA, RTT...) ou 'RESET'
    details: string;
}

export interface LeaveData {
    year: number;
    counters: LeaveCounters; 
    history: LeaveHistory[];
}

export type LeaveRequestStatus = 'PENDING_CADRE' | 'PENDING_DIRECTOR' | 'PENDING_DG' | 'VALIDATED' | 'REFUSED';

export interface LeaveRequestWorkflow {
    id: string;
    employeeId: string;
    employeeName: string;
    type: ShiftCode;
    startDate: string;
    endDate: string;
    status: LeaveRequestStatus;
    createdAt: string;
    comments?: string; // Motif refus ou info
}

export interface WorkPreference {
    id: string;
    employeeId: string;
    date: string; // YYYY-MM-DD
    type: 'NO_WORK' | 'NO_NIGHT' | 'MORNING_ONLY';
    reason?: string;
    status: 'PENDING' | 'VALIDATED' | 'REFUSED';
    rejectionReason?: string;
}

export interface AppNotification {
    id: string;
    date: string;
    recipientRole: UserRole | 'ALL' | 'DG'; 
    recipientId?: string; // If specific user
    title: string;
    message: string;
    isRead: boolean;
    type: 'info' | 'warning' | 'success' | 'error';
    actionType?: string;
    entityId?: string;
}

export interface Employee {
  id: string;
  matricule: string;
  name: string;
  role: 'Infirmier' | 'Aide-Soignant' | 'Cadre' | 'Manager' | 'Directeur' | 'Intérimaire'; // Job Title
  systemRole?: UserRole; // App Permission Role
  fte: number; // Quotité : 1.0 = 100%, 0.8 = 80%, etc.
  leaveBalance: number; // Legacy simple
  leaveCounters: LeaveCounters; // Detailed counters
  leaveData?: LeaveData; // Full leave history
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

export interface ServiceConfig {
    openDays: number[]; // 0=Sun, 1=Mon...
    requiredSkills: string[]; // List of skill codes (e.g., ['IT', 'Dialyse'])
    shiftTargets?: Record<number, Record<string, number>>; // Day (0-6) -> { 'IT': 4, 'S': 2 }
}

export interface Service {
    id: string;
    name: string;
    config: ServiceConfig;
}

export interface ServiceAssignment {
    id: string;
    employeeId: string;
    serviceId: string;
    startDate: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD or null/undefined
}

export interface PlanningScenario {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    employeesSnapshot: Employee[]; // Copie complète des employés et de leurs shifts dans ce scénario
    score?: number; // Score d'optimisation (optionnel)
}

export interface CounterRule {
    id: string;
    label: string; // Ex: Indemnité de nuit
    code: string; // Ex: IND_NUIT
    type: 'PREMIUM' | 'OVERTIME' | 'DEDUCTION' | 'INFO';
    value: number; // Ex: 5 (pour 5 euros ou 5 heures)
    unit: 'EUROS' | 'HOURS' | 'PERCENT';
    condition: string; // Description textuelle de la règle (ex: "Si travail entre 21h et 6h")
}
