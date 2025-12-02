


import { supabase } from '../lib/supabase';
import { Employee, ShiftCode, Skill, Service, ServiceAssignment, LeaveRequestWorkflow, AppNotification, LeaveRequestStatus } from '../types';
import { MOCK_EMPLOYEES } from '../constants';

// --- Services Management ---
export const fetchServices = async (): Promise<Service[]> => {
    const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');
    
    if (error) {
        // console.error('Error fetching services:', JSON.stringify(error, null, 2)); // Suppressed for mock flow
        if (error.code === '42P01') return []; 
        // throw new Error(error.message);
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
    // Return mock data if DB fails or is empty for demo purposes
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

    return {
      id: emp.id,
      matricule: emp.matricule,
      name: emp.name,
      role: emp.role,
      fte: emp.fte,
      leaveBalance: emp.leave_balance || 0,
      leaveCounters: emp.leave_data?.counters || { CA: 0, RTT: 0, HS: 0, RC: 0 },
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
  const payload: any = {
      matricule: employee.matricule,
      name: employee.name,
      role: employee.role,
      fte: employee.fte,
      leave_balance: employee.leaveBalance,
      leave_data: employee.leaveData,
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
  // Same logic as before
  for (const emp of MOCK_EMPLOYEES) {
    const { data, error } = await supabase
      .from('employees')
      .upsert({
        matricule: emp.matricule,
        name: emp.name,
        role: emp.role,
        fte: emp.fte,
        leave_balance: emp.leaveBalance,
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

export const clearShiftsInRange = async (year: number, month: number) => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const { error } = await supabase.from('shifts').delete().gte('date', startStr).lte('date', endStr);
    if (error) throw new Error(error.message);
};

export const bulkImportEmployees = async (employees: Employee[]) => {
    // Same import logic
    for (const emp of employees) {
        const { data: dbEmp, error } = await supabase
             .from('employees')
             .upsert({
                 matricule: emp.matricule,
                 name: emp.name,
                 role: emp.role,
                 fte: emp.fte,
                 leave_balance: emp.leaveBalance,
                 leave_data: emp.leaveData,
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

// --- MOCK STORAGE FOR WORKFLOW (Pending real DB tables) ---
// In a real app, these would be 'leave_requests' and 'notifications' tables in Supabase.
// We use localStorage simulation here to make it persistent across reloads for the demo.

const getStored = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
const setStored = (key: string, val: any) => localStorage.setItem(key, JSON.stringify(val));

export const fetchLeaveRequests = async (): Promise<LeaveRequestWorkflow[]> => {
    return getStored('optiplan_leave_requests');
};

export const createLeaveRequest = async (req: Omit<LeaveRequestWorkflow, 'id' | 'createdAt' | 'status'>, initialStatus: LeaveRequestStatus = 'PENDING_CADRE') => {
    const current = getStored('optiplan_leave_requests');
    const newReq: LeaveRequestWorkflow = {
        ...req,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: initialStatus
    };
    current.push(newReq);
    setStored('optiplan_leave_requests', current);
    return newReq;
};

export const updateLeaveRequestStatus = async (id: string, status: LeaveRequestWorkflow['status'], comments?: string) => {
    const current = getStored('optiplan_leave_requests') as LeaveRequestWorkflow[];
    const idx = current.findIndex(r => r.id === id);
    if (idx !== -1) {
        current[idx].status = status;
        if (comments) current[idx].comments = comments;
        setStored('optiplan_leave_requests', current);
    }
};

export const fetchNotifications = async (): Promise<AppNotification[]> => {
    return getStored('optiplan_notifications');
};

export const createNotification = async (notif: Omit<AppNotification, 'id' | 'date' | 'isRead'>) => {
    const current = getStored('optiplan_notifications');
    const newNotif: AppNotification = {
        ...notif,
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        isRead: false
    };
    current.unshift(newNotif); // Add to top
    setStored('optiplan_notifications', current);
};

export const markNotificationRead = async (id: string) => {
    const current = getStored('optiplan_notifications') as AppNotification[];
    const idx = current.findIndex(n => n.id === id);
    if (idx !== -1) {
        current[idx].isRead = true;
        setStored('optiplan_notifications', current);
    }
};