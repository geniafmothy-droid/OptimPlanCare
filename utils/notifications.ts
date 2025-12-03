

import { Employee, Service } from '../types';
import { SHIFT_TYPES } from '../constants';

/**
 * Simulates sending the schedule via email.
 * In a real app, this would call a backend API.
 */
export const sendScheduleEmail = async (
  email: string, 
  serviceName: string, 
  periodLabel: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    console.log(`[EMAIL] Sending schedule to ${email} for service ${serviceName} (${periodLabel})`);
    // Simulate network delay
    setTimeout(() => {
      resolve(true);
    }, 1000);
  });
};

/**
 * Simulates broadcasting the schedule notification to the entire team of a service.
 */
export const notifyTeam = async (
  serviceName: string,
  employeesCount: number
): Promise<boolean> => {
    return new Promise((resolve) => {
        console.log(`[NOTIFICATION] Broadcasting schedule update to ${employeesCount} employees in ${serviceName}`);
        setTimeout(() => {
            resolve(true);
        }, 800);
    });
};

/**
 * Generates and sends a weekly skills summary to the Manager (Cadre).
 */
export const sendManagerWeeklyRecap = async (
    employees: Employee[],
    service: Service,
    startDate: Date
): Promise<{ success: boolean; message: string }> => {
    
    // 1. Find Manager(s)
    const managers = employees.filter(e => e.role === 'Cadre' || e.role === 'Manager');
    if (managers.length === 0) {
        return { success: false, message: "Aucun cadre/manager trouvé pour recevoir le récapitulatif." };
    }

    // 2. Generate Summary Data (Simulation of PDF/Excel generation)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    let summary = `RÉCAPITULATIF HEBDOMADAIRE - Service: ${service.name}\n`;
    summary += `Période: ${startDate.toLocaleDateString()} au ${endDate.toLocaleDateString()}\n`;
    summary += `--------------------------------------------------\n`;

    // Simple aggregation example
    const skillsCount: Record<string, number> = {};
    
    employees.forEach(emp => {
        // Check if emp works at least once this week
        let works = false;
        for(let i=0; i<7; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0]; // Simplified ISO for key
            if (emp.shifts[dateStr] && SHIFT_TYPES[emp.shifts[dateStr]]?.isWork) {
                works = true;
                break;
            }
        }

        if (works) {
            emp.skills.forEach(skill => {
                skillsCount[skill] = (skillsCount[skill] || 0) + 1;
            });
        }
    });

    summary += "Compétences actives cette semaine :\n";
    Object.entries(skillsCount).forEach(([skill, count]) => {
        summary += `- ${skill}: ${count} agents\n`;
    });

    console.log(`[EMAIL] Sending Weekly Recap to ${managers.map(m => m.name).join(', ')}`);
    console.log(summary);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return { success: true, message: `Récapitulatif envoyé à ${managers.length} cadre(s).` };
};

/**
 * Simulates sending an email notification for a new leave request.
 */
export const sendLeaveRequestEmail = async (
    recipientRole: string,
    employeeName: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    isSickLeave: boolean
): Promise<boolean> => {
    console.log(`[EMAIL] To ${recipientRole}: ${employeeName} - ${leaveType} (${startDate} to ${endDate})`);
    // In a real app, this would make an API call to an email service.
    return new Promise(resolve => setTimeout(() => resolve(true), 500));
};