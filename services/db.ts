
import { supabase } from '../lib/supabase';
import { Employee, ShiftCode, Skill, Service, ServiceAssignment, LeaveRequestWorkflow, AppNotification, LeaveRequestStatus } from '../types';
import { MOCK_EMPLOYEES } from '../constants';

// --- System Diagnostics ---
export const checkConnection = async (): Promise<{ success: boolean; latency: number; message?: string }> => {
    const start = performance.now();
    try {
        // Simple lightweight query to check connection
        const { error } = await supabase.from('services').select('count', { count: 'exact', head: true });
        const end = performance.now();
        
        if (error) throw new Error(error.message);
        
        return { 
            success: true, 
            latency: Math.round(end - start) 
        };
    } catch (err: any) {
        return { 
            success: false, 
            latency: 0, 
            message: err.message || "Erreur inconnue" 
        };
    }
};

// --- Services Management ---
export const fetchServices = async (): Promise<Service[]> => {
    const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');
    
    if (error) {
        if (error.code === '42P01') return []; 
        return [];
    }
    return data || [];
};

export const updateServiceConfig = async (id: string, config: any) => {
    const { error } = await supabase
        .from('services')
        .update({ config })
        .eq('id', id);
    if (error) throw new Error(error.message);
};

export const createService = async (name: string, config: any = { openDays: [1,2,3,4,5,6] }) => {
    const { error } = await supabase
        .from('services')
        .insert([{ name, config }]);
    if (error) throw new Error(error.message);
};

export const deleteService = async (id: string) => {
    const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);
    if (error) throw new Error(error.message);
};

export const updateService = async (id: string, name: string) => {
    const { error } = await supabase
        .from('services')
        .update({ name })
        .eq('id', id);
    if (error) throw new Error(error.message);
};

// --- Service Assignments Management ---

export const fetchServiceAssignments = async (): Promise<ServiceAssignment[]> => {
    const { data, error } = await supabase
        .from('service_assignments')
        .select('*');
    if (error) return [];
    
    return data?.map((d: any) => ({
        id: d.id,
        employeeId: d.employee_id,
        serviceId: d.service_id,
        startDate: d.start_date,
        endDate: d.end_date
    })) || [];
};

export const createServiceAssignment = async (employeeId: string, serviceId: string, startDate: string, endDate?: string) => {
    const { error } = await supabase
        .from('service_assignments')
        .insert([{ 
            employee_id: employeeId, 
            service_id: serviceId, 
            start_date: startDate, 
            end_date: endDate || null 
        }]);
    if (error) throw new Error(error.message);
};

export const deleteServiceAssignment = async (id: string) => {
    const { error } = await supabase
        .from('service_assignments')
        .delete()
        .eq('id', id);
    if (error) throw new Error(error.message);
};


// --- Skills Management ---

export const fetchSkills = async (): Promise<Skill[]> => {
    const { data, error } = await supabase
        .from('skills')
        .select('*')
        .order('code');
    if (error) return []; 
    return data || [];
};

export const createSkill = async (code: string, label: string) => {
    const { error } = await supabase
        .from('skills')
        .insert([{ code, label }]);
    if (error) throw new Error(error.message);
};

export const deleteSkill = async (id: string) => {
    const { error } = await supabase
        .from('skills')
        .delete()
        .eq('id', id);
    if (error) throw new Error(error.message);
};

// --- Employees Management ---

export const fetchEmployeesWithShifts = async (): Promise<Employee[]> => {
  const { data: employeesData, error: empError } = await supabase
    .from('employees')
    .select(`
      id,
      matricule,
      name,
      role,
      fte,
      leave_balance,
      leave_data,
      skills,
      shifts (
        date,
        shift_code
      )
    `)
    .order('name');

  if (empError) {
    console.warn("Using mock data due to DB error or empty DB");
    return MOCK_EMPLOYEES;
  }

  if (!employeesData || employeesData.length === 0) return MOCK_EMPLOYEES;

  return employeesData.map((emp: any) => {
    const shiftsRecord: Record<string, ShiftCode> = {};
    if (emp.shifts && Array.isArray(emp.shifts)) {
      emp.shifts.forEach((s: any) => {
        shiftsRecord[s.date] = s.shift_code as ShiftCode;
      });
    }

    let safeCounters = { CA: 0, RTT: 0, HS: 0, RC: 0 };
    if (emp.leave_data && emp.leave_data.counters) {
        safeCounters = emp.leave_data.counters;
    }

    return {
      id: emp.id,
      matricule: emp.matricule,
      name: emp.name,
      role: emp.role,
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
    const { error } = await supabase
      .from('shifts')
      .delete()
      .match({ employee_id: employeeId, date: date });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('shifts')
      .upsert(
        { employee_id: employeeId, date: date, shift_code: shiftCode },
        { onConflict: 'employee_id,date' }
      );
    if (error) throw new Error(error.message);
  }
};

export const saveLeaveRange = async (employeeId: string, startDate: string, endDate: string, type: ShiftCode) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const shiftsToInsert = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const isSunday = d.getDay() === 0;
        const codeToApply = isSunday ? 'RH' : type;

        shiftsToInsert.push({
            employee_id: employeeId,
            date: dateStr,
            shift_code: codeToApply
        });
    }

    if (shiftsToInsert.length > 0) {
        const { error } = await supabase
            .from('shifts')
            .upsert(shiftsToInsert, { onConflict: 'employee_id,date' });
        if (error) throw new Error(error.message);
    }
};

export const deleteLeaveRange = async (employeeId: string, startDate: string, endDate: string) => {
    const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('employee_id', employeeId)
        .gte('date', startDate)
        .lte('date', endDate);
    if (error) throw new Error(error.message);
};

export const updateEmployeeBalance = async (employeeId: string, newBalance: number) => {
    const { error } = await supabase
        .from('employees')
        .update({ leave_balance: newBalance })
        .eq('id', employeeId);
    if (error) throw new Error(error.message);
};

export const updateEmployeeLeaveData = async (employeeId: string, leaveData: any) => {
    const { error } = await supabase
        .from('employees')
        .update({ leave_data: leaveData })
        .eq('id', employeeId);
    if (error) throw new Error(error.message);
};

export const upsertEmployee = async (employee: Employee) => {
  const currentLeaveData = employee.leaveData || { counters: {}, history: [] };
  currentLeaveData.counters = employee.leaveCounters;

  const payload: any = {
      matricule: employee.matricule,
      name: employee.name,
      role: employee.role,
      fte: employee.fte,
      leave_balance: employee.leaveBalance,
      leave_data: currentLeaveData,
      skills: employee.skills
  };

  let conflictTarget = 'matricule';
  if (employee.id && employee.id.length > 10) {
      payload.id = employee.id;
      conflictTarget = 'id';
  }

  const { error } = await supabase
    .from('employees')
    .upsert(payload, { onConflict: conflictTarget })
    .select();
  if (error) throw new Error(error.message);
};

export const deleteEmployee = async (employeeId: string) => {
    const { error } = await supabase
        .from('employees')
        .delete()
        .match({ id: employeeId });
    if (error) throw new Error(error.message);
}

export const seedDatabase = async () => {
  for (const emp of MOCK_EMPLOYEES) {
    const { data, error } = await supabase
      .from('employees')
      .upsert({
        matricule: emp.matricule,
        name: emp.name,
        role: emp.role,
        fte: emp.fte,
        leave_balance: emp.leaveBalance,
        leave_data: { counters: emp.leaveCounters, history: [] },
        skills: emp.skills
      }, { onConflict: 'matricule' })
      .select()
      .single();

    if (error || !data) continue;
    const newId = data.id;
    const shiftsToInsert = Object.entries(emp.shifts).map(([date, code]) => ({
      employee_id: newId,
      date: date,
      shift_code: code
    }));
    if (shiftsToInsert.length > 0) {
      await supabase.from('shifts').upsert(shiftsToInsert, { onConflict: 'employee_id,date' });
    }
  }
};

export const bulkSaveSchedule = async (employees: Employee[]) => {
  const allShifts: any[] = [];
  for (const emp of employees) {
    if (emp.id.length < 10) continue; 
    Object.entries(emp.shifts).forEach(([date, code]) => {
      if (code !== 'OFF') {
        allShifts.push({ employee_id: emp.id, date: date, shift_code: code });
      }
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

export const clearShiftsInRange = async (year: number, month: number, serviceId?: string) => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    // Use local string construction to ensure we get the full range YYYY-MM-01 to YYYY-MM-LastDay
    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    
    let query = supabase.from('shifts').delete().gte('date', startStr).lte('date', endStr);

    if (serviceId) {
        // Filter by employees in this service during the period
        const { data: assignments } = await supabase
            .from('service_assignments')
            .select('employee_id, start_date, end_date')
            .eq('service_id', serviceId);

        // Filter assignments in JS to correctly handle overlapping date ranges
        // An assignment is relevant if it overlaps with [startStr, endStr]
        const relevantEmpIds = (assignments || [])
            .filter((a: any) => {
                const aStart = a.start_date;
                const aEnd = a.end_date || '9999-12-31';
                // Overlap check
                return (aStart <= endStr) && (aEnd >= startStr);
            })
            .map((a: any) => a.employee_id);
        
        if (relevantEmpIds.length > 0) {
            query = query.in('employee_id', relevantEmpIds);
        } else {
             // If no employees in service for this range, delete nothing (using empty array)
             query = query.in('employee_id', []);
        }
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
};

export const bulkImportEmployees = async (employees: Employee[]) => {
    for (const emp of employees) {
        const { data: dbEmp, error } = await supabase
             .from('employees')
             .upsert({
                 matricule: emp.matricule,
                 name: emp.name,
                 role: emp.role,
                 fte: emp.fte,
                 leave_balance: emp.leaveBalance,
                 leave_data: { counters: emp.leaveCounters, history: emp.leaveData?.history || [] },
                 skills: emp.skills
             }, { onConflict: 'matricule' })
             .select()
             .single();
        if (error || !dbEmp) continue;

        const empId = dbEmp.id;
        const shifts = Object.entries(emp.shifts).map(([date, code]) => ({
             employee_id: empId,
             date,
             shift_code: code
        }));
        if (shifts.length > 0) {
            await supabase.from('shifts').upsert(shifts, { onConflict: 'employee_id,date' });
        }
    }
}

// --- DB-BACKED WORKFLOW MANAGEMENT ---

export const fetchLeaveRequests = async (): Promise<LeaveRequestWorkflow[]> => {
    // JOIN to get employee name
    const { data, error } = await supabase
        .from('leave_requests')
        .select(`
            *,
            employee:employees(name)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        // Fallback or empty if table doesn't exist yet
        return [];
    }

    return data.map((r: any) => ({
        id: r.id,
        employeeId: r.employee_id,
        employeeName: r.employee?.name || 'Inconnu',
        type: r.type,
        startDate: r.start_date,
        endDate: r.end_date,
        status: r.status as LeaveRequestStatus,
        createdAt: r.created_at,
        comments: r.comments
    }));
};

export const createLeaveRequest = async (req: Omit<LeaveRequestWorkflow, 'id' | 'createdAt' | 'status'>, initialStatus: LeaveRequestStatus = 'PENDING_CADRE') => {
    const { data, error } = await supabase
        .from('leave_requests')
        .insert([{
            employee_id: req.employeeId,
            type: req.type,
            start_date: req.startDate,
            end_date: req.endDate,
            status: initialStatus
        }])
        .select()
        .single();
    
    if (error) throw new Error(error.message);
    
    return {
        ...req,
        id: data.id,
        status: initialStatus,
        createdAt: data.created_at
    };
};

export const updateLeaveRequest = async (id: string, req: Partial<LeaveRequestWorkflow>) => {
    const payload: any = {};
    if (req.type) payload.type = req.type;
    if (req.startDate) payload.start_date = req.startDate;
    if (req.endDate) payload.end_date = req.endDate;
    
    // Reset status to pending if modified? Usually yes.
    // We'll let the frontend decide if status should change.

    const { error } = await supabase
        .from('leave_requests')
        .update(payload)
        .eq('id', id);

    if (error) throw new Error(error.message);
};

export const deleteLeaveRequest = async (id: string) => {
    const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', id);
    if (error) throw new Error(error.message);
}

export const updateLeaveRequestStatus = async (id: string, status: LeaveRequestWorkflow['status'], comments?: string) => {
    const updateData: any = { 
        status, 
        validation_date: new Date().toISOString()
        // validator_id could be passed here if we had current user ID context in this function
    };
    if (comments) updateData.comments = comments;

    const { error } = await supabase
        .from('leave_requests')
        .update(updateData)
        .eq('id', id);

    if (error) throw new Error(error.message);
};

// --- DB NOTIFICATIONS ---

export const fetchNotifications = async (): Promise<AppNotification[]> => {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('date', { ascending: false })
        .limit(50);
    
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
    const { error } = await supabase
        .from('notifications')
        .insert([{
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
    await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
};
