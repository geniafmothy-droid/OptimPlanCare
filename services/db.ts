
import { supabase } from '../lib/supabase';
import { Employee, ShiftCode, Skill, Service, ServiceAssignment, LeaveRequestWorkflow, AppNotification, LeaveRequestStatus, WorkPreference, SurveyResponse, RoleDefinition } from '../types';
import { MOCK_EMPLOYEES } from '../constants';

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
    if (error) { 
        if (error.code === '42P01') return []; 
        console.error("Fetch Services Error:", error.message);
        return []; 
    }
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
    if (error) {
        if (error.code !== '42P01') console.error("Fetch Assignments Error:", error.message);
        return [];
    }
    return data?.map((d: any) => ({
        id: d.id, 
        employeeId: d.employee_id, 
        serviceId: d.service_id, 
        startDate: d.start_date, 
        endDate: d.end_date
    })) || [];
};

export const createServiceAssignment = async (employeeId: string, serviceId: string, startDate: string, endDate?: string) => {
    const { error } = await supabase.from('service_assignments').insert([{ 
        employee_id: employeeId, 
        service_id: serviceId, 
        start_date: startDate, 
        end_date: endDate || null 
    }]);
    if (error) throw new Error(error.message);
};

export const updateServiceAssignment = async (id: string, employeeId: string, serviceId: string, startDate: string, endDate?: string) => {
    const { error } = await supabase.from('service_assignments').update({ 
        employee_id: employeeId, 
        service_id: serviceId, 
        start_date: startDate, 
        end_date: endDate || null 
    }).eq('id', id);
    if (error) throw new Error(error.message);
};

export const deleteServiceAssignment = async (id: string) => {
    const { error } = await supabase.from('service_assignments').delete().eq('id', id);
    if (error) throw new Error(error.message);
};

export const deleteServiceAssignmentByComposite = async (employeeId: string, serviceId: string) => {
    const { error } = await supabase.from('service_assignments').delete().eq('employee_id', employeeId).eq('service_id', serviceId);
    if (error) throw new Error(error.message);
};

// --- Skills Management ---
export const fetchSkills = async (): Promise<Skill[]> => {
    const { data, error } = await supabase.from('skills').select('*').order('code');
    if (error) {
        if (error.code !== '42P01') console.error("Fetch Skills Error:", error.message);
        return []; 
    }
    return data?.map((s: any) => ({
        id: s.id, 
        code: s.code, 
        label: s.label, 
        defaultDuration: s.default_duration, 
        defaultBreak: s.default_break
    })) || [];
};

export const createSkill = async (code: string, label: string, defaultDuration?: number, defaultBreak?: number) => {
    const { error } = await supabase.from('skills').insert([{ 
        code, 
        label, 
        default_duration: defaultDuration, 
        default_break: defaultBreak 
    }]);
    if (error) throw new Error(error.message);
};

export const updateSkill = async (id: string, code: string, label: string, defaultDuration?: number, defaultBreak?: number) => {
    const { error } = await supabase.from('skills').update({ 
        code, 
        label, 
        default_duration: defaultDuration, 
        default_break: defaultBreak 
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
        if (error.code === '42P01') return [
            { id: '1', code: 'ADMIN', label: 'Administrateur', description: 'Accès total', isSystem: true },
            { id: '2', code: 'DIRECTOR', label: 'Directeur / Directrice', description: 'Validation finale', isSystem: true },
            { id: '3', code: 'CADRE', label: 'Cadre de Santé', description: 'Gestion équipe', isSystem: true },
            { id: '4', code: 'INFIRMIER', label: 'Infirmier', description: 'Personnel soignant', isSystem: true },
            { id: '5', code: 'AIDE_SOIGNANT', label: 'Aide-Soignant', description: 'Assistant soignant', isSystem: true },
            { id: '9', code: 'SAGE_FEMME', label: 'Sage-Femme', description: 'Maïeutique', isSystem: true }
        ];
        return [];
    }
    return data || [];
};

export const upsertRole = async (role: RoleDefinition) => {
    const { error } = await supabase.from('roles').upsert({
        id: role.id.startsWith('custom') ? undefined : role.id,
        code: role.code,
        label: role.label,
        description: role.description,
        is_system: role.isSystem
    });
    if (error) throw new Error(error.message);
};

// --- Employee & Shift Management ---

const normalizeRole = (rawRole: string): Employee['role'] => {
    if (!rawRole) return 'Infirmier';
    const r = rawRole.trim();
    if (/^infirmier/i.test(r) || /^ide/i.test(r)) return 'Infirmier';
    if (/^aide[- ]soignant/i.test(r) || /^as/i.test(r) || /^asd/i.test(r)) return 'Aide-Soignant';
    if (/^cadre/i.test(r)) return 'Cadre';
    if (/^direct/i.test(r)) return 'Directeur';
    if (/^manager/i.test(r)) return 'Manager';
    if (/^int[eé]rim/i.test(r)) return 'Intérimaire';
    if (/^m[eé]decin/i.test(r) || /^dr/i.test(r) || /^docteur/i.test(r)) return 'Médecin';
    if (/^secr[eé]taire/i.test(r)) return 'Secrétaire';
    if (/^sage[- ]femme/i.test(r) || /^sf/i.test(r)) return 'Sage-Femme';
    if (/^agent/i.test(r) || /^admin/i.test(r)) return 'Agent Administratif';
    return (r.charAt(0).toUpperCase() + r.slice(1)) as any;
};

export const fetchEmployeesWithShifts = async (): Promise<Employee[]> => {
  const { data: employeesData, error: empError } = await supabase.from('employees')
    .select(`id, matricule, name, role, fte, leave_balance, leave_data, skills, shifts (date, shift_code)`)
    .order('name');

  if (empError) {
      if(empError.code === '42P01') return [];
      throw new Error("Impossible de charger les employés : " + empError.message);
  }
  if (!employeesData) return [];

  return employeesData.map((emp: any) => {
    const shiftsRecord: Record<string, ShiftCode> = {};
    if (emp.shifts && Array.isArray(emp.shifts)) {
      emp.shifts.forEach((s: any) => { shiftsRecord[s.date] = s.shift_code as ShiftCode; });
    }
    let safeCounters = { CA: 0, RTT: 0, HS: 0, RC: 0 };
    if (emp.leave_data && emp.leave_data.counters) { safeCounters = emp.leave_data.counters; }

    return {
      id: emp.id, 
      matricule: emp.matricule, 
      name: emp.name, 
      role: normalizeRole(emp.role),
      fte: emp.fte, 
      leaveBalance: emp.leave_balance || 0, 
      leaveCounters: safeCounters,
      leaveData: emp.leave_data, 
      skills: emp.skills || [], 
      shifts: shiftsRecord
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

export const toLocalISOString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const clearShiftsInRange = async (year: number, month: number, serviceId?: string) => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const startStr = toLocalISOString(startDate);
    const endStr = toLocalISOString(endDate);
    
    const PRESERVED_CODES = ['CA', 'RC', 'HS', 'F', 'RTT', 'FO', 'CSS', 'PATER', 'MALADIE', 'MAL', 'AT', 'ABS'];

    let query = supabase.from('shifts')
        .delete()
        .gte('date', startStr)
        .lte('date', endStr)
        .not('shift_code', 'in', `(${PRESERVED_CODES.join(',')})`);

    if (serviceId) {
        const { data: assignments } = await supabase
            .from('service_assignments')
            .select('employee_id, start_date, end_date')
            .eq('service_id', serviceId);

        const relevantEmpIds = (assignments || [])
            .filter((a: any) => {
                const aStart = a.start_date;
                const aEnd = a.end_date || '9999-12-31';
                return (aStart <= endStr) && (aEnd >= startStr);
            })
            .map((a: any) => a.employee_id);
        
        if (relevantEmpIds.length > 0) {
            query = query.in('employee_id', relevantEmpIds);
        } else {
             query = query.in('employee_id', []);
        }
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
};

export const clearLeavesAndNotificationsInRange = async (year: number, month: number) => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const startStr = toLocalISOString(startDate);
    const endStr = toLocalISOString(endDate);

    const { data: requests, error: reqError } = await supabase
        .from('leave_requests')
        .select('id')
        .or(`start_date.gte.${startStr},end_date.lte.${endStr}`);
    
    if (reqError) throw new Error(reqError.message);

    const requestIds = requests?.map(r => r.id) || [];

    if (requestIds.length > 0) {
        const { error: notifError } = await supabase
            .from('notifications')
            .delete()
            .in('entity_id', requestIds);
        
        if (notifError) console.warn("Erreur suppression notifications", notifError);

        const { error: delReqError } = await supabase
            .from('leave_requests')
            .delete()
            .in('id', requestIds);
        
        if (delReqError) throw new Error(delReqError.message);
    }

    const ABSENCE_CODES = ['CA', 'RTT', 'MAL', 'RC', 'HS', 'FO', 'F', 'AT', 'ABS', 'CSS', 'PATER', 'MALADIE'];
    const { error: shiftError } = await supabase
        .from('shifts')
        .delete()
        .gte('date', startStr)
        .lte('date', endStr)
        .in('shift_code', ABSENCE_CODES);

    if (shiftError) throw new Error(shiftError.message);
};

export const saveLeaveRange = async (employeeId: string, startDate: string, endDate: string, type: ShiftCode) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const shiftsToInsert = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const isSunday = d.getDay() === 0;
        const codeToApply = isSunday ? 'RH' : type;
        shiftsToInsert.push({ employee_id: employeeId, date: dateStr, shift_code: codeToApply });
    }
    if (shiftsToInsert.length > 0) {
        const { error } = await supabase.from('shifts').upsert(shiftsToInsert, { onConflict: 'employee_id,date' });
        if (error) throw new Error(error.message);
    }
};

export const deleteLeaveRange = async (employeeId: string, startDate: string, endDate: string) => {
    const { error } = await supabase.from('shifts').delete().eq('employee_id', employeeId).gte('date', startDate).lte('date', endDate);
    if (error) throw new Error(error.message);
};

export const updateEmployeeBalance = async (employeeId: string, newBalance: number) => {
    const { error } = await supabase.from('employees').update({ leave_balance: newBalance }).eq('id', employeeId);
    if (error) throw new Error(error.message);
};

export const updateEmployeeLeaveData = async (employeeId: string, leaveData: any) => {
    const { error } = await supabase.from('employees').update({ leave_data: leaveData }).eq('id', employeeId);
    if (error) throw new Error(error.message);
};

export const upsertEmployee = async (employee: Employee) => {
  let currentLeaveData = employee.leaveData || { counters: {}, history: [] };
  if (employee.leaveCounters) {
      const cleanCounter = (val: any) => { const num = typeof val === 'number' ? val : parseFloat(val); return isNaN(num) ? 0 : num; };
      const safeCounters = { CA: cleanCounter(employee.leaveCounters.CA), RTT: cleanCounter(employee.leaveCounters.RTT), HS: cleanCounter(employee.leaveCounters.HS), RC: cleanCounter(employee.leaveCounters.RC) };
      currentLeaveData = { ...currentLeaveData, counters: safeCounters };
  }
  const payload: any = {
      id: employee.id, 
      matricule: employee.matricule, 
      name: employee.name, 
      role: employee.role, 
      fte: employee.fte,
      leave_balance: employee.leaveBalance, 
      leave_data: currentLeaveData, 
      skills: employee.skills
  };
  const { error } = await supabase.from('employees').upsert(payload, { onConflict: 'id' }).select();
  if (error) throw new Error(error.message);
};

export const deleteEmployee = async (employeeId: string) => {
    const { error } = await supabase.from('employees').delete().match({ id: employeeId });
    if (error) throw new Error(error.message);
}

export const seedDatabase = async () => {
  for (const emp of MOCK_EMPLOYEES) {
    const { data, error } = await supabase.from('employees').upsert({
        matricule: emp.matricule, 
        name: emp.name, 
        role: emp.role, 
        fte: emp.fte, 
        leave_balance: emp.leaveBalance,
        leave_data: { counters: emp.leaveCounters, history: [] }, 
        skills: emp.skills
      }, { onConflict: 'matricule' }).select().single();
    if (error || !data) continue;
    
    const newId = data.id;
    const shiftsToInsert = Object.entries(emp.shifts).map(([date, code]) => ({ employee_id: newId, date: date, shift_code: code }));
    if (shiftsToInsert.length > 0) { await supabase.from('shifts').upsert(shiftsToInsert, { onConflict: 'employee_id,date' }); }
  }
};

export const bulkSaveSchedule = async (employees: Employee[]) => {
  const allShifts: any[] = [];
  for (const emp of employees) {
    if (emp.id.length < 10) continue; 
    Object.entries(emp.shifts).forEach(([date, code]) => {
      if (code !== 'OFF') { allShifts.push({ employee_id: emp.id, date: date, shift_code: code }); }
    });
  }
  const BATCH_SIZE = 1000;
  for (let i = 0; i < allShifts.length; i += BATCH_SIZE) {
    const batch = allShifts.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('shifts').upsert(batch, { onConflict: 'employee_id,date' });
    if (error) throw new Error(error.message);
  }
};

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
        const { data: dbEmp, error } = await supabase.from('employees').upsert({
                 matricule: emp.matricule, 
                 name: emp.name, 
                 role: emp.role, 
                 fte: emp.fte, 
                 // Fix: Access leaveBalance instead of leave_balance on Employee object
                 leave_balance: emp.leaveBalance, 
                 leave_data: { counters: emp.leaveCounters, history: emp.leaveData?.history || [] }, 
                 skills: emp.skills
             }, { onConflict: 'matricule' }).select().single();
        if (error || !dbEmp) continue;
        const empId = dbEmp.id;
        const shifts = Object.entries(emp.shifts).map(([date, code]) => ({ employee_id: empId, date, shift_code: code }));
        if (shifts.length > 0) { await supabase.from('shifts').upsert(shifts, { onConflict: 'employee_id,date' }); }
    }
}

// --- Leave Management ---
export const fetchLeaveRequests = async (): Promise<LeaveRequestWorkflow[]> => {
    const { data, error } = await supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
    if (error) {
        if(error.code !== '42P01') console.error("Fetch Leave Requests Error:", error.message);
        return [];
    }
    const { data: allEmps } = await supabase.from('employees').select('id, name');
    const empMap = new Map(allEmps?.map((e:any) => [e.id, e.name]) || []);
    return data.map((r: any) => ({
        id: r.id, 
        employeeId: r.employee_id, 
        employeeName: empMap.get(r.employee_id) || 'Inconnu', 
        type: r.type,
        startDate: r.start_date, 
        endDate: r.end_date, 
        status: r.status as LeaveRequestStatus, 
        createdAt: r.created_at, 
        comments: r.comments
    }));
};

export const createLeaveRequest = async (req: Omit<LeaveRequestWorkflow, 'id' | 'createdAt' | 'status'>, initialStatus: LeaveRequestStatus = 'PENDING_CADRE', employeeToAutoCreate?: Employee) => {
    if (employeeToAutoCreate) { try { await upsertEmployee(employeeToAutoCreate); } catch (e: any) { console.error("Auto-creation failed:", e); } }
    const { data, error } = await supabase.from('leave_requests').insert([{ 
        employee_id: req.employeeId, 
        type: req.type, 
        start_date: req.startDate, 
        end_date: req.endDate, 
        status: initialStatus 
    }]).select().single();
    if (error) throw new Error(error.message);
    return { ...req, id: data.id, status: initialStatus, createdAt: data.created_at };
};

export const updateLeaveRequest = async (id: string, req: Partial<LeaveRequestWorkflow>) => {
    const payload: any = {};
    if (req.type) payload.type = req.type;
    if (req.startDate) payload.start_date = req.startDate;
    if (req.endDate) payload.end_date = req.endDate;
    const { error } = await supabase.from('leave_requests').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
};

export const deleteLeaveRequest = async (id: string) => {
    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

export const updateLeaveRequestStatus = async (id: string, status: LeaveRequestWorkflow['status'], comments?: string) => {
    const updateData: any = { status, validation_date: new Date().toISOString() };
    if (comments) updateData.comments = comments;
    const { error } = await supabase.from('leave_requests').update(updateData).eq('id', id);
    if (error) throw new Error(error.message);
};

// --- Work Preferences ---
export const fetchWorkPreferences = async (): Promise<WorkPreference[]> => {
    const { data, error } = await supabase.from('work_preferences').select('*');
    if (error) {
        if(error.code !== '42P01') console.error("Fetch Preferences Error:", error.message);
        return [];
    }
    return data.map((p: any) => ({
        id: p.id, 
        employeeId: p.employee_id, 
        startDate: p.start_date || p.date, 
        endDate: p.end_date || p.date,
        recurringDays: p.recurring_days, 
        type: p.type, 
        reason: p.reason, 
        status: p.status, 
        rejectionReason: p.rejection_reason
    }));
};

/**
 * Creates a new work preference record in the database.
 * @param pref The preference data without ID and status.
 */
export const createWorkPreference = async (pref: Omit<WorkPreference, 'id' | 'status'>) => {
    const { error } = await supabase.from('work_preferences').insert([{
            employee_id: pref.employeeId, 
            start_date: pref.startDate, 
            end_date: pref.endDate,
            // Fixed property name error: changed pref.recurring_days to pref.recurringDays
            recurring_days: pref.recurringDays, 
            type: pref.type, 
            reason: pref.reason, 
            status: 'PENDING'
        }]);
    if (error) throw new Error(error.message);
};

export const updateWorkPreferenceStatus = async (id: string, status: 'VALIDATED' | 'REFUSED', rejectionReason?: string) => {
    const updateData: any = { status };
    if (rejectionReason) updateData.rejection_reason = rejectionReason;
    const { error } = await supabase.from('work_preferences').update(updateData).eq('id', id);
    if (error) throw new Error(error.message);
};

// --- Notifications ---
export const fetchNotifications = async (): Promise<AppNotification[]> => {
    const { data, error } = await supabase.from('notifications').select('*').order('date', { ascending: false }).limit(50);
    if (error) return [];
    return data.map((n: any) => ({
        id: n.id, 
        date: n.date, 
        recipientRole: n.recipient_role, 
        recipientId: n.recipient_id, 
        title: n.title,
        message: n.message, 
        isRead: n.is_read, 
        type: n.type || 'info', 
        actionType: n.action_type, 
        entityId: n.entity_id
    }));
};

export const createNotification = async (notif: Omit<AppNotification, 'id' | 'date' | 'isRead'>) => {
    const { error } = await supabase.from('notifications').insert([{
            recipient_role: notif.recipientRole, 
            recipient_id: notif.recipientId, 
            title: notif.title,
            message: notif.message, 
            type: notif.type, 
            action_type: notif.actionType || null, 
            entity_id: notif.entityId || null
        }]);
    if (error) console.error("Error sending notification:", error);
};

export const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
};

// --- Surveys ---
export const saveSurveyResponse = async (response: Omit<SurveyResponse, 'id'>) => {
    const { error } = await supabase.from('survey_responses').insert([{
            employee_id: response.employeeId, 
            date: response.date, 
            satisfaction: response.satisfaction,
            workload: response.workload, 
            balance: response.balance, 
            comment: response.comment
        }]);
    if (error) { 
        console.error("Survey Save Error:", error.message || error); 
        throw new Error("Erreur sauvegarde enquête"); 
    }
};

export const fetchSurveyStats = async (): Promise<{satisfaction: number, workload: number, balance: number, count: number}> => {
    const { data, error } = await supabase.from('survey_responses').select('satisfaction, workload, balance');
    if (error) {
        if(error.code === '42P01') return { satisfaction: 0, workload: 0, balance: 0, count: 0 };
        console.warn("Survey Stats Fetch Error:", error.message);
        return { satisfaction: 0, workload: 0, balance: 0, count: 0 };
    }
    if (!data || data.length === 0) return { satisfaction: 0, workload: 0, balance: 0, count: 0 };
    const total = data.length;
    const sumSat = data.reduce((acc, curr) => acc + curr.satisfaction, 0);
    const sumWork = data.reduce((acc, curr) => acc + curr.workload, 0);
    const sumBal = data.reduce((acc, curr) => acc + curr.balance, 0);
    return { satisfaction: Math.round(sumSat / total), workload: Math.round(sumWork / total), balance: Math.round(sumBal / total), count: total };
};

export const fetchSurveyResponses = async () => {
    const { data, error } = await supabase
        .from('survey_responses')
        .select('*, employees (name, role)')
        .order('date', { ascending: false });
    
    if (error) {
        if (error.code === '42P01' || error.code === 'PGRST200') {
            console.warn(`Fetch Survey: Table or relation issue (${error.code}). Returning empty list.`);
            return [];
        }
        console.error("Fetch Survey Error:", error.message || error);
        return [];
    }
    return data;
};
