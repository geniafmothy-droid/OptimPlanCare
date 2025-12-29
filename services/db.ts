
import { supabase } from '../lib/supabase';
import { Employee, ShiftCode, Skill, Service, ServiceAssignment, LeaveRequestWorkflow, AppNotification, LeaveRequestStatus, WorkPreference, SurveyResponse, RoleDefinition, GuardArchive } from '../types';
import { MOCK_EMPLOYEES } from '../constants';

// --- Guards Archiving ---
export const fetchGuardArchives = async (year: number): Promise<GuardArchive[]> => {
    const { data, error } = await supabase.from('guard_archives').select('*').eq('year', year);
    if (error) return [];
    return data.map((d:any) => ({
        id: d.id, year: d.year, month: d.month, data: d.data, archivedAt: d.archived_at, archivedBy: d.archived_by
    }));
};

export const archiveMonthGuards = async (archive: Omit<GuardArchive, 'id' | 'archivedAt'>) => {
    const { error } = await supabase.from('guard_archives').upsert({
        year: archive.year,
        month: archive.month,
        data: archive.data,
        archived_by: archive.archivedBy
    }, { onConflict: 'year,month' });
    if (error) throw new Error(error.message);
};

// --- System Diagnostics ---
export const checkConnection = async (): Promise<{ success: boolean; latency: number; message?: string }> => {
    const start = performance.now();
    try {
        const { error } = await supabase.from('services').select('count', { count: 'exact', head: true });
        const end = performance.now();
        if (error) throw new Error(error.message);
        return { success: true, latency: Math.round(end - start) };
    } catch (err: any) {
        return { success: false, latency: 0, message: err.message || "Erreur inconnue" };
    }
};

// --- Services Management ---
export const fetchServices = async (): Promise<Service[]> => {
    const { data, error } = await supabase.from('services').select('*').order('name');
    if (error) return [];
    return data || [];
};

export const updateServiceConfig = async (id: string, config: any) => {
    const { error } = await supabase.from('services').update({ config }).eq('id', id);
    if (error) throw new Error(error.message);
};

export const createService = async (name: string, config: any = { openDays: [1,2,3,4,5,6] }) => {
    const { error } = await supabase.from('services').insert([{ name, config }]);
    if (error) throw new Error(error.message);
};

export const deleteService = async (id: string) => {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) throw new Error(error.message);
};

export const updateService = async (id: string, name: string) => {
    const { error } = await supabase.from('services').update({ name }).eq('id', id);
    if (error) throw new Error(error.message);
};

export const fetchServiceAssignments = async (): Promise<ServiceAssignment[]> => {
    const { data, error } = await supabase.from('service_assignments').select('*');
    if (error) return [];
    return data?.map((d: any) => ({
        id: d.id, employeeId: d.employee_id, serviceId: d.service_id, startDate: d.start_date, endDate: d.end_date
    })) || [];
};

export const createServiceAssignment = async (employeeId: string, serviceId: string, startDate: string, endDate?: string) => {
    const { error } = await supabase.from('service_assignments').insert([{ 
        employee_id: employeeId, service_id: serviceId, start_date: startDate, end_date: endDate || null 
    }]);
    if (error) throw new Error(error.message);
};

export const updateServiceAssignment = async (id: string, employeeId: string, serviceId: string, startDate: string, endDate?: string) => {
    const { error } = await supabase.from('service_assignments').update({ 
        employee_id: employeeId, service_id: serviceId, start_date: startDate, end_date: endDate || null 
    }).eq('id', id);
    if (error) throw new Error(error.message);
};

export const deleteServiceAssignment = async (id: string) => {
    const { error } = await supabase.from('service_assignments').delete().eq('id', id);
    if (error) throw new Error(error.message);
};

// --- Skills Management ---
export const fetchSkills = async (): Promise<Skill[]> => {
    const { data, error } = await supabase.from('skills').select('*').order('code');
    if (error) return []; 
    return data?.map((s: any) => ({
        id: s.id, 
        code: s.code, 
        label: s.label, 
        defaultDuration: s.default_duration, 
        defaultBreak: s.default_break,
        color: s.color,
        textColor: s.text_color
    })) || [];
};

export const createSkill = async (code: string, label: string, defaultDuration?: number, defaultBreak?: number, color?: string, textColor?: string) => {
    const { error } = await supabase.from('skills').insert([{ 
        code, 
        label, 
        default_duration: defaultDuration, 
        default_break: defaultBreak,
        color,
        text_color: textColor
    }]);
    if (error) throw new Error(error.message);
};

export const updateSkill = async (id: string, code: string, label: string, defaultDuration?: number, defaultBreak?: number, color?: string, textColor?: string) => {
    const { error } = await supabase.from('skills').update({ 
        code, 
        label, 
        default_duration: defaultDuration, 
        default_break: defaultBreak,
        color,
        text_color: textColor
    }).eq('id', id);
    if (error) throw new Error(error.message);
};

export const deleteSkill = async (id: string) => {
    const { error } = await supabase.from('skills').delete().eq('id', id);
    if (error) throw new Error(error.message);
};

// --- Roles Management ---
export const fetchRoles = async (): Promise<RoleDefinition[]> => {
    const { data, error } = await supabase.from('roles').select('*').order('label');
    if (error) {
        return [
            { id: '1', code: 'ADMIN', label: 'Administrateur', description: 'Accès total', isSystem: true },
            { id: '2', code: 'DIRECTOR', label: 'Directeur', description: 'Validation finale', isSystem: true },
            { id: '3', code: 'CADRE', label: 'Cadre', description: 'Gestion équipe', isSystem: true },
            { id: '4', code: 'INFIRMIER', label: 'Infirmier', description: 'Personnel soignant', isSystem: true },
            { id: '5', code: 'AIDE_SOIGNANT', label: 'Aide-Soignant', description: 'Assistant soignant', isSystem: true }
        ];
    }
    return data || [];
};

export const upsertRole = async (role: RoleDefinition) => {
    const payload = {
        code: role.code,
        label: role.label,
        description: role.description,
        is_system: role.isSystem
    };
    const { error } = await supabase.from('roles').upsert(payload, { onConflict: 'code' });
    if (error) throw new Error(error.message);
};

// --- Employee & Shift Management ---

export const fetchEmployeesWithShifts = async (): Promise<Employee[]> => {
  const { data: employeesData, error: empError } = await supabase.from('employees')
    .select(`id, matricule, name, role, fte, leave_balance, leave_data, skills, shifts (date, shift_code)`)
    .order('name');

  if (empError) throw new Error("Impossible de charger les employés : " + empError.message);
  if (!employeesData) return [];

  return employeesData.map((emp: any) => {
    const shiftsRecord: Record<string, ShiftCode> = {};
    if (emp.shifts && Array.isArray(emp.shifts)) {
      emp.shifts.forEach((s: any) => { shiftsRecord[s.date] = s.shift_code as ShiftCode; });
    }
    let safeCounters = { CA: 0, RTT: 0, HS: 0, RC: 0 };
    if (emp.leave_data && emp.leave_data.counters) { safeCounters = emp.leave_data.counters; }

    return {
      id: emp.id, matricule: emp.matricule, name: emp.name, role: emp.role as any,
      fte: emp.fte, leaveBalance: emp.leave_balance || 0, leaveCounters: safeCounters,
      leaveData: emp.leave_data, skills: emp.skills || [], shifts: shiftsRecord
    };
  });
};

export const upsertShift = async (employeeId: string, date: string, shiftCode: ShiftCode) => {
  if (shiftCode === 'OFF') {
    const { error } = await supabase.from('shifts').delete().match({ employee_id: employeeId, date: date });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('shifts').upsert({ employee_id: employeeId, date: date, shift_code: shiftCode }, { onConflict: 'employee_id,date' });
    if (error) throw new Error(error.message);
  }
};

export const upsertEmployee = async (employee: Employee) => {
  let currentLeaveData = employee.leaveData || { counters: {}, history: [] };
  
  if (employee.leaveCounters) {
      const cleanCounter = (val: any) => { 
          const num = typeof val === 'number' ? val : parseFloat(val); 
          return isNaN(num) ? 0 : num; 
      };
      const safeCounters = { 
          CA: cleanCounter(employee.leaveCounters.CA), 
          RTT: cleanCounter(employee.leaveCounters.RTT), 
          HS: cleanCounter(employee.leaveCounters.HS), 
          RC: cleanCounter(employee.leaveCounters.RC) 
      };
      currentLeaveData = { ...currentLeaveData, counters: safeCounters };
  }

  const payload: any = {
      matricule: employee.matricule,
      name: employee.name,
      role: employee.role, // Le libellé sélectionné (ex: 'Infirmier')
      fte: typeof employee.fte === 'number' ? employee.fte : 1.0,
      leave_balance: typeof employee.leaveBalance === 'number' ? employee.leaveBalance : 0,
      leave_data: currentLeaveData,
      skills: employee.skills || []
  };

  // Si l'ID est un vrai UUID Supabase, on le passe pour l'update
  if (employee.id && employee.id.length > 20) {
      payload.id = employee.id;
  }

  const { error } = await supabase
    .from('employees')
    .upsert(payload, { onConflict: 'matricule' })
    .select();

  if (error) throw new Error(error.message);
};

export const deleteEmployee = async (employeeId: string) => {
    const { error } = await supabase.from('employees').delete().match({ id: employeeId });
    if (error) throw new Error(error.message);
}

export const bulkUpsertShifts = async (shifts: {employee_id: string, date: string, shift_code: string}[]) => {
    const BATCH_SIZE = 1000;
    for (let i = 0; i < shifts.length; i += BATCH_SIZE) {
        const batch = shifts.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('shifts').upsert(batch, { onConflict: 'employee_id,date' });
        if (error) throw new Error(error.message);
    }
};

export const bulkImportEmployees = async (employees: Employee[]) => {
    for (const emp of employees) {
        await upsertEmployee(emp);
    }
};

export const bulkSaveSchedule = async (employees: Employee[]) => {
    const allShifts: {employee_id: string, date: string, shift_code: string}[] = [];
    employees.forEach(emp => {
        Object.entries(emp.shifts).forEach(([date, code]) => {
            allShifts.push({ employee_id: emp.id, date, shift_code: code });
        });
    });
    if (allShifts.length > 0) {
        await bulkUpsertShifts(allShifts);
    }
};

export const clearShiftsInRange = async (year: number, month: number, serviceId?: string) => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    let query = supabase.from('shifts').delete().gte('date', startStr).lte('date', endStr);
    
    if (serviceId) {
        const { data: assignments } = await supabase.from('service_assignments').select('employee_id').eq('service_id', serviceId);
        const empIds = (assignments || []).map((a:any) => a.employee_id);
        if (empIds.length > 0) query = query.in('employee_id', empIds);
        else return; // Rien à supprimer
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
};

export const clearLeavesAndNotificationsInRange = async (year: number, month: number) => {
    const startStr = new Date(year, month, 1).toISOString().split('T')[0];
    const endStr = new Date(year, month + 1, 0).toISOString().split('T')[0];
    await supabase.from('leave_requests').delete().gte('start_date', startStr).lte('start_date', endStr);
    await supabase.from('notifications').delete().gte('date', startStr).lte('date', endStr);
};

export const fetchLeaveRequests = async (): Promise<LeaveRequestWorkflow[]> => {
    const { data, error } = await supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
    if (error) return [];
    const { data: allEmps } = await supabase.from('employees').select('id, name');
    const empMap = new Map(allEmps?.map((e:any) => [e.id, e.name]) || []);
    return data.map((r: any) => ({
        id: r.id, employeeId: r.employee_id, employeeName: empMap.get(r.employee_id) || 'Inconnu', type: r.type,
        startDate: r.start_date, endDate: r.end_date, status: r.status as LeaveRequestStatus, createdAt: r.created_at, comments: r.comments
    }));
};

export const createLeaveRequest = async (req: Omit<LeaveRequestWorkflow, 'id' | 'createdAt' | 'status'>, initialStatus: LeaveRequestStatus = 'PENDING_CADRE', employeeToAutoCreate?: Employee) => {
    if (employeeToAutoCreate) { try { await upsertEmployee(employeeToAutoCreate); } catch (e: any) { } }
    const { data, error } = await supabase.from('leave_requests').insert([{ 
        employee_id: req.employeeId, type: req.type, start_date: req.startDate, end_date: req.endDate, status: initialStatus 
    }]).select().single();
    if (error) throw new Error(error.message);
    return { ...req, id: data.id, status: initialStatus, createdAt: data.created_at };
};

export const updateLeaveRequest = async (id: string, updates: Partial<LeaveRequestWorkflow>) => {
    const payload: any = {};
    if (updates.type) payload.type = updates.type;
    if (updates.startDate) payload.start_date = updates.startDate;
    if (updates.endDate) payload.end_date = updates.endDate;
    if (updates.status) payload.status = updates.status;
    const { error } = await supabase.from('leave_requests').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
};

export const deleteLeaveRequest = async (id: string) => {
    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
    if (error) throw new Error(error.message);
};

export const updateLeaveRequestStatus = async (id: string, status: LeaveRequestWorkflow['status'], comments?: string) => {
    const { error } = await supabase.from('leave_requests').update({ status, comments }).eq('id', id);
    if (error) throw new Error(error.message);
};

export const saveLeaveRange = async (employeeId: string, startDate: string, endDate: string, type: ShiftCode) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const shifts = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        shifts.push({ employee_id: employeeId, date: d.toISOString().split('T')[0], shift_code: type });
    }
    if (shifts.length > 0) await bulkUpsertShifts(shifts);
};

// --- Work Preferences ---
export const fetchWorkPreferences = async (): Promise<WorkPreference[]> => {
    const { data, error } = await supabase.from('work_preferences').select('*');
    if (error) return [];
    return data.map((p: any) => ({
        id: p.id, employeeId: p.employee_id, startDate: p.start_date, endDate: p.end_date,
        recurringDays: p.recurring_days, type: p.type, reason: p.reason, status: p.status, rejectionReason: p.rejection_reason
    }));
};

export const createWorkPreference = async (pref: Omit<WorkPreference, 'id' | 'status'>) => {
    const { error } = await supabase.from('work_preferences').insert([{
            employee_id: pref.employeeId, start_date: pref.startDate, end_date: pref.endDate,
            recurring_days: pref.recurringDays, type: pref.type, reason: pref.reason, status: 'PENDING'
        }]);
    if (error) throw new Error(error.message);
};

export const updateWorkPreferenceStatus = async (id: string, status: 'VALIDATED' | 'REFUSED', rejectionReason?: string) => {
    const { error } = await supabase.from('work_preferences').update({ status, rejection_reason: rejectionReason }).eq('id', id);
    if (error) throw new Error(error.message);
};

// --- Notifications ---
export const fetchNotifications = async (): Promise<AppNotification[]> => {
    const { data, error } = await supabase.from('notifications').select('*').order('date', { ascending: false }).limit(50);
    if (error) return [];
    return data.map((n: any) => ({
        id: n.id, date: n.date, recipientRole: n.recipient_role, recipientId: n.recipient_id, title: n.title,
        message: n.message, isRead: n.is_read, type: n.type || 'info', actionType: n.action_type, entityId: n.entity_id
    }));
};

export const createNotification = async (notif: Omit<AppNotification, 'id' | 'date' | 'isRead'>) => {
    const { error } = await supabase.from('notifications').insert([{
            recipient_role: notif.recipientRole, recipient_id: notif.recipientId, title: notif.title,
            // Fixed: use notif.entityId instead of notif.entity_id to match AppNotification interface
            message: notif.message, type: notif.type, action_type: notif.actionType || null, entity_id: notif.entityId || null
        }]);
    if (error) console.error("Error sending notification:", error);
};

export const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
};

// --- Surveys ---
export const saveSurveyResponse = async (response: Omit<SurveyResponse, 'id'>) => {
    const { error } = await supabase.from('survey_responses').insert([{
            employee_id: response.employeeId, date: response.date, satisfaction: response.satisfaction,
            workload: response.workload, balance: response.balance, comment: response.comment
        }]);
    if (error) throw new Error("Erreur sauvegarde enquête"); 
};

export const fetchSurveyStats = async (): Promise<{satisfaction: number, workload: number, balance: number, count: number}> => {
    const { data, error } = await supabase.from('survey_responses').select('satisfaction, workload, balance');
    if (error || !data || data.length === 0) return { satisfaction: 0, workload: 0, balance: 0, count: 0 };
    const total = data.length;
    const sumSat = data.reduce((acc, curr) => acc + curr.satisfaction, 0);
    const sumWork = data.reduce((acc, curr) => acc + curr.workload, 0);
    const sumBal = data.reduce((acc, curr) => acc + curr.balance, 0);
    return { satisfaction: Math.round(sumSat / total), workload: Math.round(sumWork / total), balance: Math.round(sumBal / total), count: total };
};

export const fetchSurveyResponses = async () => {
    const { data, error } = await supabase.from('survey_responses').select('*, employees (name, role)').order('date', { ascending: false });
    if (error) return [];
    return data;
};
