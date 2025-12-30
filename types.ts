
export type ShiftCode = 
  | 'M' | 'T5' | 'T6' | 'S' | 'IT' | 'NT' | 'CA' | 'RH' | 'FO' | 'ETP' | 'DP' | 'OFF' | 'RC' | 'HS' | 'F' | 'RTT' | 'INT'
  | 'MAL' | 'AT' | 'ABS'; // Added specific absenteeism codes

export type UserRole = 'ADMIN' | 'DIRECTOR' | 'CADRE' | 'INFIRMIER' | 'AIDE_SOIGNANT' | 'MANAGER' | 'CADRE_SUP' | 'AGENT_ADMIN' | 'MEDECIN' | 'SECRETAIRE' | 'SAGE_FEMME';

export interface ShiftDefinition {
  code: ShiftCode;
  label: string;
  color: string; 
  textColor: string;
  description: string;
  isWork: boolean;
  startHour?: number; 
  endHour?: number;
  duration?: number; // Total presence hours
  breakDuration?: number; // Break in hours (e.g. 0.5)
  serviceId?: string; // Lié à un service spécifique
}

export interface Skill {
  id: string;
  code: string; // Linked to ShiftCode often
  label: string;
  defaultDuration?: number;
  defaultBreak?: number;
  color?: string; // New: Background color class
  textColor?: string; // New: Text color class
  serviceId?: string; // Ajouté: Lien vers un service
}

export interface SkillRequirement {
    skillCode: string;
    minStaff: number; // Effectif cible minimum
    startTime?: string; // "06:30"
    endTime?: string; // "18:30"
}

export interface ValidationRule {
    id: string;
    code: string;
    label: string;
    description: string;
    isActive: boolean;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    category: 'LEGAL' | 'EQUITY' | 'SERVICE';
}

export interface LeaveCounterComplex {
    taken: number;
    allowed: number;
    reliquat: number;
}

export interface LeaveCounters {
    CA: number | LeaveCounterComplex;
    RTT: number | LeaveCounterComplex;
    HS: number | LeaveCounterComplex; 
    RC: number | LeaveCounterComplex; 
    [key: string]: number | LeaveCounterComplex | any;
}

export interface LeaveHistory {
    date: string;
    action: string;
    type?: string; 
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
    comments?: string;
}

// Updated WorkPreference for Advanced Desiderata
export interface WorkPreference {
    id: string;
    employeeId: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    recurringDays?: number[]; // [1, 3] for Mon, Wed
    type: 'NO_WORK' | 'NO_NIGHT' | 'MORNING_ONLY' | 'AFTERNOON_ONLY';
    reason?: string;
    status: 'PENDING' | 'VALIDATED' | 'REFUSED';
    rejectionReason?: string;
}

export interface SurveyResponse {
    id: string;
    employeeId: string;
    date: string;
    satisfaction: number; // 0-100 (converted from 1-10)
    workload: number; // 0-100
    balance: number; // 0-100
    comment?: string;
}

export interface AppNotification {
    id: string;
    date: string;
    recipientRole: UserRole | 'ALL' | 'DG'; 
    recipientId?: string; 
    title: string;
    message: string;
    isRead: boolean;
    isProcessed?: boolean; // New: Workflow complete
    type: 'info' | 'warning' | 'success' | 'error';
    actionType?: string;
    entityId?: string;
}

export interface Employee {
  id: string;
  matricule: string;
  name: string;
  role: 'Infirmier' | 'Aide-Soignant' | 'Cadre' | 'Cadre Supérieur' | 'Manager' | 'Directeur' | 'Intérimaire' | 'Agent Administratif' | 'Médecin' | 'Secrétaire' | 'Sage-Femme'; 
  systemRole?: UserRole; 
  fte: number; 
  leaveBalance: number; 
  leaveCounters: LeaveCounters; 
  leaveData?: LeaveData; 
  skills: string[]; 
  shifts: Record<string, ShiftCode>; 
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
  type: 'CONSECUTIVE_DAYS' | 'MISSING_SKILL' | 'INVALID_ROTATION' | 'FTE_MISMATCH';
  message: string;
  severity: 'warning' | 'error';
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export type ViewMode = 'month' | 'week' | 'workweek' | 'workweek6' | 'day' | 'hourly';

export interface EquityConfig {
    targetSaturdayPercentage: number; // e.g., 50%
    targetHolidayPercentage: number;
    targetNightPercentage: number; // e.g. 33%
}

export interface ServiceConfig {
    openDays: number[]; 
    requiredSkills: string[]; // Kept for backward compatibility or simple lists
    skillRequirements?: SkillRequirement[]; // Detailed requirements
    shiftTargets?: Record<number, Record<string, number>>; 
    equityRules?: EquityConfig;
    maxConsecutiveDays?: number; // New rule
    minWeekendGap?: number; // Days between weekends worked
    activeRules?: ValidationRule[]; // List of active rules with priorities
    fteConstraintMode?: 'NONE' | 'DIALYSIS_STANDARD' | 'MATERNITY_STANDARD'; // Mode Maternité ajouté
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
    startDate: string; 
    endDate?: string; 
}

export interface PlanningScenario {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    employeesSnapshot: Employee[]; 
    score?: number; 
}

export interface CounterRule {
    id: string;
    label: string; 
    code: string; 
    type: 'PREMIUM' | 'OVERTIME' | 'DEDUCTION' | 'INFO';
    value: number; 
    unit: 'EUROS' | 'HOURS' | 'PERCENT';
    condition: string; 
}

export interface RoleDefinition {
    id: string;
    code: string;
    label: string;
    description: string;
    isSystem: boolean;
}

export interface SurveyResult {
    period: '1_MONTH' | '3_MONTHS' | '6_MONTHS' | '1_YEAR';
    score: number; // 0-100
    respondents: number;
    comments: string[];
}

export interface HazardEvent {
    id: string;
    date: string;
    type: 'ABSENCE_IMPREVUE' | 'SURCROIT_ACTIVITE';
    description: string;
    status: 'OPEN' | 'RESOLVED';
    impactedEmployeeId?: string; // If absence
    resolution?: string;
}

// Added GuardArchive interface used in services/db.ts
export interface GuardArchive {
    id: string;
    year: number;
    month: number;
    data: any;
    archivedAt: string;
    archivedBy: string;
}
