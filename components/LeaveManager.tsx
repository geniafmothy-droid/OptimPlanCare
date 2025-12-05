
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Employee, ShiftCode, LeaveRequestWorkflow, UserRole, ServiceAssignment, WorkPreference, LeaveRequestStatus, ServiceConfig } from '../types';
import { Calendar, Upload, CheckCircle2, AlertTriangle, History, Settings, LayoutGrid, Filter, ChevronLeft, ChevronRight, Trash2, Save, Send, XCircle, Check, AlertOctagon, Edit2, X, Heart, FolderClock, ChevronDown, Clock, Database, Lock, Moon, Sun, Coffee, List, Eye, CalendarDays, Download } from 'lucide-react';
import * as db from '../services/db';
import { SHIFT_TYPES } from '../constants';
import { LeaveCalendar } from './LeaveCalendar';
import { exportLeavesToCSV } from '../utils/csvExport';

interface LeaveManagerProps {
    employees: Employee[];
    filteredEmployees?: Employee[];
    onReload: () => void;
    currentUser: { role: UserRole, employeeId?: string, name?: string };
    activeServiceId?: string;
    assignmentsList?: ServiceAssignment[];
    serviceConfig?: ServiceConfig;
}

export const LeaveManager: React.FC<LeaveManagerProps> = ({ employees, filteredEmployees, onReload, currentUser, activeServiceId, assignmentsList, serviceConfig }) => {
    // Determine default mode based on role
    const defaultMode = (currentUser.role === 'INFIRMIER' || currentUser.role === 'AIDE_SOIGNANT') ? 'my_requests' : 'validation';

    const [mode, setMode] = useState<'my_requests' | 'desiderata' | 'desiderata_summary' | 'validation' | 'calendar' | 'forecast'>(defaultMode);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
    const [schemaError, setSchemaError] = useState<{ msg: string, type: 'COLUMN' | 'RLS' } | null>(null);

    // Workflow Data
    const [requests, setRequests] = useState<LeaveRequestWorkflow[]>([]);
    const [preferences, setPreferences] = useState<WorkPreference[]>([]);

    // Form State (New Request)
    const [leaveType, setLeaveType] = useState<string>('CA'); 
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    // Conflict & Force State
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);
    const [forceSubmit, setForceSubmit] = useState(false);
    
    // Desiderata State (Advanced)
    const [prefStartDate, setPrefStartDate] = useState('');
    const [prefEndDate, setPrefEndDate] = useState('');
    const [prefType, setPrefType] = useState<'NO_WORK' | 'NO_NIGHT' | 'MORNING_ONLY' | 'AFTERNOON_ONLY'>('NO_WORK');
    const [prefReason, setPrefReason] = useState('');
    const [prefDays, setPrefDays] = useState<number[]>([]); // 0=Sun...
    
    // Editing state
    const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

    // Validation State (Leaves)
    const [validationModal, setValidationModal] = useState<{ isOpen: boolean, req: LeaveRequestWorkflow | null, isApprove: boolean } | null>(null);
    // Validation State (Desiderata)
    const [desiderataValidationModal, setDesiderataValidationModal] = useState<{ isOpen: boolean, pref: WorkPreference | null, isApprove: boolean } | null>(null);
    
    const [selectedRequest, setSelectedRequest] = useState<LeaveRequestWorkflow | null>(null); // For Comparison View
    const [refusalReason, setRefusalReason] = useState('');
    
    // Validation Filters
    const [valFilterStart, setValFilterStart] = useState('');
    const [valFilterEnd, setValFilterEnd] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calendar view state
    const [calendarDate, setCalendarDate] = useState(new Date());

    useEffect(() => {
        loadData();
    }, []);

    // Helper to scroll to top when a message appears
    useEffect(() => {
        if (message && containerRef.current) {
            containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [message]);

    const checkForDbErrors = (e: any) => {
        const errMsg = e.message || JSON.stringify(e);
        console.error("DB Error detected:", errMsg);
        
        if (errMsg.includes('recurring_days') || (errMsg.includes('column') && errMsg.includes('work_preferences'))) {
            setSchemaError({ msg: errMsg, type: 'COLUMN' });
            return true;
        }
        if (errMsg.includes('row-level security') || errMsg.includes('policy')) {
            setSchemaError({ msg: errMsg, type: 'RLS' });
            return true;
        }
        return false;
    };

    const loadData = async () => {
        try {
            const [reqs, prefs] = await Promise.all([
                db.fetchLeaveRequests(),
                db.fetchWorkPreferences()
            ]);
            setRequests(reqs);
            setPreferences(prefs);
            setSchemaError(null);
        } catch (e: any) {
            if (!checkForDbErrors(e)) {
                console.warn("Could not load leave requests:", e);
            }
        }
    };

    // Use filtered employees for the global calendar view
    const viewableEmployees = useMemo(() => {
        if (filteredEmployees && filteredEmployees.length > 0) return filteredEmployees;
        // Fallback: If no external filter, filter by service manually
        if (!activeServiceId || !assignmentsList) return employees;
        const assignedIds = assignmentsList
            .filter(a => a.serviceId === activeServiceId)
            .map(a => a.employeeId);
        return employees.filter(e => assignedIds.includes(e.id));
    }, [employees, filteredEmployees, activeServiceId, assignmentsList]);

    // --- FORECAST DATA PREP ---
    // Filter requests that are strictly PENDING (for Forecast view)
    const pendingRequests = useMemo(() => {
        return requests.filter(r => r.status.startsWith('PENDING'));
    }, [requests]);

    // --- CONTEXT PENDING REQUESTS (For Validation View) ---
    // Includes all pending requests EXCEPT the currently selected one (which is simulated as full shift)
    const contextPendingRequests = useMemo(() => {
        return requests.filter(r => r.status.startsWith('PENDING') && r.id !== selectedRequest?.id);
    }, [requests, selectedRequest]);

    // --- SIMULATION LOGIC (For Single Request Validation) ---
    const employeesWithSimulation = useMemo(() => {
        if (!selectedRequest) return viewableEmployees;

        return viewableEmployees.map(emp => {
            if (emp.id === selectedRequest.employeeId) {
                // Clone shifts to avoid mutating state
                const newShifts = { ...emp.shifts };
                
                const start = new Date(selectedRequest.startDate);
                const end = new Date(selectedRequest.endDate);
                
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const dStr = d.toISOString().split('T')[0];
                    // Overwrite with the requested type for visualization
                    newShifts[dStr] = selectedRequest.type;
                }
                return { ...emp, shifts: newShifts };
            }
            return emp;
        });
    }, [viewableEmployees, selectedRequest]);


    // --- CONFLICT CHECK LOGIC ---
    const checkConflicts = (start: string, end: string, type: string) => {
        if (!start || !end || !currentUser.employeeId) return null;
        if (type === 'NT') return null; 

        const me = employees.find(e => e.id === currentUser.employeeId);
        if (!me) return null;

        try {
            const sDate = new Date(start);
            const eDate = new Date(end);
            
            let conflictCount = 0;
            // Find colleagues with overlapping skills (simplified)
            const sameSkillEmps = employees.filter(e => e.id !== me.id && e.skills.some(skill => me.skills.includes(skill)));

            for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
                const dStr = d.toISOString().split('T')[0];
                sameSkillEmps.forEach(colleague => {
                    const shift = colleague.shifts[dStr];
                    if (['CA', 'RH', 'RC', 'NT', 'FO', 'HS', 'F', 'RTT'].includes(shift)) {
                        conflictCount++;
                    }
                });
            }

            if (conflictCount > 0) {
                 return "Attention : D'autres collègues sont absents sur cette période.";
            }
        } catch (e) {
            console.warn("Error checking conflicts", e);
        }
        return null;
    };

    // --- CHECK N-1 OVERLAP (HISTORY) ---
    const checkN1Overlap = (req: LeaveRequestWorkflow) => {
        // Only makes sense if we have history. Using 'requests' as source of truth.
        if (requests.length === 0) return false;

        const currentStart = new Date(req.startDate);
        const targetStart = new Date(currentStart);
        targetStart.setFullYear(currentStart.getFullYear() - 1);
        targetStart.setDate(targetStart.getDate() - 5); // Window -5 days (fuzzy match)

        const currentEnd = new Date(req.endDate);
        const targetEnd = new Date(currentEnd);
        targetEnd.setFullYear(currentEnd.getFullYear() - 1);
        targetEnd.setDate(targetEnd.getDate() + 5); // Window +5 days

        // Look for validated requests from the same employee in the calculated range N-1
        return requests.some(r =>
            r.employeeId === req.employeeId &&
            r.status === 'VALIDATED' &&
            r.id !== req.id && 
            new Date(r.startDate) <= targetEnd &&
            new Date(r.endDate) >= targetStart
        );
    };

    // --- HELPER: CALCULATE EFFECTIVE DAYS ---
    const getEffectiveDays = (startStr: string, endStr: string) => {
        const start = new Date(startStr);
        const end = new Date(endStr);
        let count = 0;
        // Iterate from start to end inclusive
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            // Count if NOT Sunday (generic assumption for RH/Non-working)
            if (d.getDay() !== 0) {
                count++;
            }
        }
        return count;
    };

    useEffect(() => {
        if (startDate && endDate) {
            const warn = checkConflicts(startDate, endDate, leaveType);
            setConflictWarning(warn);
            // Reset force submit when dates change
            setForceSubmit(false);
        } else {
            setConflictWarning(null);
        }
    }, [startDate, endDate, leaveType]);

    // Calculate approximate staffing presence
    const calculateStaffingInfo = (startStr: string, endStr: string) => {
        const sDate = new Date(startStr);
        const eDate = new Date(endStr);
        let totalDays = 0;
        let totalPresent = 0;

        for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
            const dStr = d.toISOString().split('T')[0];
            const presentToday = viewableEmployees.reduce((acc, emp) => {
                const code = emp.shifts[dStr];
                return (code && SHIFT_TYPES[code]?.isWork) ? acc + 1 : acc;
            }, 0);
            
            totalPresent += presentToday;
            totalDays++;
        }
        
        const avg = totalDays > 0 ? Math.round(totalPresent / totalDays) : 0;
        return `Effectif moyen présent sur la période : ${avg} agents.`;
    };

    // --- ACTIONS ---

    const handleCreateOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        
        try {
            if (!startDate || !endDate) {
                 setMessage({ text: "Veuillez sélectionner les dates.", type: "error" });
                 return;
            }

            if (!currentUser.employeeId) {
                 setMessage({ text: "Erreur: Session utilisateur invalide.", type: "error" });
                 return;
            }

            // Find current employee data
            let me = employees.find(e => e.id === currentUser.employeeId);
            if (!me) {
                 // Fallback for mock data stability
                 if (currentUser.name) {
                     me = {
                         id: currentUser.employeeId,
                         name: currentUser.name,
                         role: currentUser.role as any, 
                         matricule: 'UNKNOWN',
                         fte: 1,
                         leaveBalance: 0,
                         leaveCounters: { CA:0, RTT:0, HS:0, RC:0},
                         skills: [],
                         shifts: {}
                     };
                 } else {
                     setMessage({ text: "Erreur critique : Fiche employé introuvable.", type: "error" });
                     return;
                 }
            }

            const isSickLeave = leaveType === 'NT';
            
            // Conflict Check Barrier
            if (!isSickLeave && conflictWarning && !forceSubmit) {
                setMessage({ text: "Veuillez cocher la case pour forcer la demande malgré le conflit.", type: "warning" });
                return;
            }

            setIsLoading(true);
            
            let initialStatus: LeaveRequestStatus = 'PENDING_CADRE';
            let recipientRole: UserRole | 'DG' = 'CADRE';
            
            if (isSickLeave) {
                initialStatus = 'VALIDATED'; 
                recipientRole = 'CADRE'; 
            } else {
                if (me.role === 'Infirmier' || me.role === 'Aide-Soignant') {
                    initialStatus = 'PENDING_CADRE';
                    recipientRole = 'CADRE';
                } else if (me.role === 'Cadre' || me.role === 'Manager') {
                    initialStatus = 'PENDING_DIRECTOR';
                    recipientRole = 'DIRECTOR';
                } else if (me.role === 'Directeur') {
                    initialStatus = 'PENDING_DG';
                    recipientRole = 'DG';
                }
            }

            if (editingRequestId) {
                await db.updateLeaveRequest(editingRequestId, {
                    type: leaveType as ShiftCode,
                    startDate,
                    endDate,
                    status: initialStatus
                });
                setMessage({ text: "Demande mise à jour avec succès.", type: 'success' });
            } else {
                // Pass 'me' to ensure employee exists in DB (mock data scenario)
                const req = await db.createLeaveRequest({
                    employeeId: me.id,
                    employeeName: me.name,
                    type: leaveType as ShiftCode,
                    startDate,
                    endDate,
                }, initialStatus, me);
                
                // Notification (Non-blocking)
                db.createNotification({
                    recipientRole: recipientRole === 'DG' ? 'ADMIN' : recipientRole,
                    title: isSickLeave ? 'Arrêt Maladie' : 'Demande de Congés',
                    message: `${me.name} : ${leaveType} du ${startDate} au ${endDate}`,
                    type: isSickLeave ? 'warning' : 'info',
                    actionType: isSickLeave ? undefined : 'LEAVE_VALIDATION', 
                    entityId: req.id
                }).catch(console.warn);

                if (isSickLeave) {
                    await db.saveLeaveRange(me.id, startDate, endDate, 'NT');
                    setMessage({ text: "Arrêt maladie enregistré.", type: 'success' });
                } else {
                    setMessage({ text: "Demande envoyée pour validation.", type: 'success' });
                }
            }
            
            // Reset Form
            setStartDate('');
            setEndDate('');
            setEditingRequestId(null);
            setLeaveType('CA');
            setForceSubmit(false);
            setConflictWarning(null);
            
            await loadData();
            onReload(); 
        } catch (err: any) {
            console.error("Submission Error:", err);
            setMessage({ text: `Erreur: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const togglePrefDay = (day: number) => {
        setPrefDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    const handleSubmitDesiderata = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser.employeeId || !prefStartDate || !prefEndDate) return;
        setIsLoading(true);
        try {
            await db.createWorkPreference({
                employeeId: currentUser.employeeId,
                startDate: prefStartDate,
                endDate: prefEndDate,
                type: prefType,
                recurringDays: prefDays,
                reason: prefReason
            });
            setMessage({ text: "Souhait enregistré.", type: 'success' });
            setPrefStartDate('');
            setPrefEndDate('');
            setPrefReason('');
            setPrefDays([]);
            loadData();
        } catch (e: any) {
            if (!checkForDbErrors(e)) {
                setMessage({ text: e.message, type: 'error' });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const openDesiderataValidationModal = (pref: WorkPreference, isApprove: boolean) => {
        setRefusalReason('');
        setDesiderataValidationModal({ isOpen: true, pref, isApprove });
    };

    const confirmDesiderataValidation = async () => {
        if (!desiderataValidationModal || !desiderataValidationModal.pref) return;
        const { pref, isApprove } = desiderataValidationModal;

        if (!isApprove && !refusalReason.trim()) {
            setMessage({ text: "Motif de refus obligatoire pour les desiderata.", type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            const status = isApprove ? 'VALIDATED' : 'REFUSED';
            if (!isApprove) {
                await db.updateWorkPreferenceStatus(pref.id, status, refusalReason);
            } else {
                await db.updateWorkPreferenceStatus(pref.id, status);
            }
            
            setMessage({ text: isApprove ? "Souhait accepté." : "Souhait refusé.", type: isApprove ? 'success' : 'warning' });
            setDesiderataValidationModal(null);
            loadData();
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditRequest = (req: LeaveRequestWorkflow) => {
        setLeaveType(req.type);
        setStartDate(req.startDate);
        setEndDate(req.endDate);
        setEditingRequestId(req.id);
        setMessage({ text: "Mode modification activé.", type: 'info' });
    };

    const handleDeleteRequest = async (id: string) => {
        if(!confirm("Supprimer cette demande ?")) return;
        try {
            await db.deleteLeaveRequest(id);
            loadData();
            setMessage({ text: "Demande supprimée.", type: 'success' });
        } catch(e: any) {
            setMessage({ text: e.message, type: 'error' });
        }
    };

    const cancelEdit = () => {
        setEditingRequestId(null);
        setStartDate('');
        setEndDate('');
        setLeaveType('CA');
        setMessage(null);
    };

    const openValidationModal = (req: LeaveRequestWorkflow, isApprove: boolean) => {
        setRefusalReason('');
        setValidationModal({ isOpen: true, req, isApprove });
    };

    const handleSelectRequestForComparison = (req: LeaveRequestWorkflow) => {
        setSelectedRequest(req);
        // Auto-navigate calendar to the request start date
        setCalendarDate(new Date(req.startDate));
    };

    const confirmValidation = async () => {
        if (!validationModal || !validationModal.req) return;
        const { req, isApprove } = validationModal;

        if (!isApprove && !refusalReason.trim()) {
            setMessage({ text: "Motif de refus obligatoire.", type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            let newStatus: LeaveRequestWorkflow['status'] = isApprove ? 'VALIDATED' : 'REFUSED';
            let commentToSave = isApprove ? `Validé par ${currentUser.role}` : `Refusé par ${currentUser.role}: ${refusalReason}`;
            let notifMsg = isApprove ? `Votre demande a été validée.` : `Refusé: ${refusalReason}`;

            if (isApprove) {
                if (req.status === 'PENDING_CADRE') {
                     newStatus = 'PENDING_DIRECTOR';
                     const staffingInfo = calculateStaffingInfo(req.startDate, req.endDate);
                     notifMsg = `Pré-validée, transmise Direction.`;
                     
                     await db.createNotification({
                        recipientRole: 'DIRECTOR',
                        title: 'Validation Requise',
                        message: `Congés ${req.employeeName} (${req.startDate} - ${req.endDate}). ${staffingInfo}`,
                        type: 'info',
                        actionType: 'LEAVE_VALIDATION',
                        entityId: req.id
                    });
                } else if (req.status === 'PENDING_DIRECTOR' || req.status === 'PENDING_DG') {
                     newStatus = 'VALIDATED';
                     await db.saveLeaveRange(req.employeeId, req.startDate, req.endDate, req.type);
                }
            }

            await db.updateLeaveRequestStatus(req.id, newStatus, commentToSave);
            
            await db.createNotification({ 
                recipientId: req.employeeId, 
                title: isApprove ? 'Congés Validés' : 'Congés Refusés', 
                message: notifMsg, 
                type: isApprove ? 'success' : 'error' 
            } as any);

            setMessage({ text: isApprove ? "Validé." : "Refusé.", type: isApprove ? 'success' : 'warning' });
            setValidationModal(null);
            setSelectedRequest(null); // Clear selection
            loadData();
            onReload();
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            if (evt.target?.result) setMessage({ text: "Import simulé.", type: 'info' });
        };
        reader.readAsText(file);
    };

    const handleExportCSV = () => {
        exportLeavesToCSV(requests, employees);
        setMessage({ text: "Export CSV généré.", type: 'success' });
    };

    const myRequests = requests.filter(r => r.employeeId === currentUser.employeeId);
    const myPreferences = preferences.filter(p => p.employeeId === currentUser.employeeId);
    
    // --- FILTER & SORT LOGIC FOR VALIDATION ---
    const requestsToValidate = useMemo(() => {
        let filtered = requests.filter(r => {
            if (currentUser.role === 'CADRE') return r.status === 'PENDING_CADRE';
            if (currentUser.role === 'DIRECTOR') return r.status === 'PENDING_DIRECTOR';
            if (currentUser.role === 'ADMIN') return true; 
            return false;
        });

        // DATE RANGE FILTER (overlap check)
        if (valFilterStart) {
            filtered = filtered.filter(r => r.endDate >= valFilterStart);
        }
        if (valFilterEnd) {
            filtered = filtered.filter(r => r.startDate <= valFilterEnd);
        }

        // SORT BY CREATION DATE (OLDEST FIRST - FIFO)
        // Ensure oldest request is at the top
        return filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [requests, currentUser, valFilterStart, valFilterEnd]);

    const prefsToValidate = preferences.filter(p => p.status === 'PENDING' && (currentUser.role === 'CADRE' || currentUser.role === 'ADMIN'));
    
    // Summary Data for "Desiderata Summary" View
    const getPreferencesForMonth = (year: number, month: number) => {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        const sStr = startDate.toISOString().split('T')[0];
        const eStr = endDate.toISOString().split('T')[0];

        return preferences.filter(p => {
            if (p.status === 'REFUSED') return false;
            return (p.startDate <= eStr) && (p.endDate >= sStr);
        });
    };

    // Group Summary by Employee
    const summaryByEmployee = useMemo(() => {
        if (mode !== 'desiderata_summary') return [];
        
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const activePrefs = getPreferencesForMonth(year, month);
        
        // Map to filtered employees (showing only those currently visible in filter)
        const empMap = new Map<string, { emp: Employee, prefs: WorkPreference[] }>();
        
        activePrefs.forEach(p => {
            const emp = viewableEmployees.find(e => e.id === p.employeeId);
            if (emp) {
                if (!empMap.has(emp.id)) {
                    empMap.set(emp.id, { emp, prefs: [] });
                }
                empMap.get(emp.id)?.prefs.push(p);
            }
        });

        return Array.from(empMap.values());
    }, [preferences, calendarDate, viewableEmployees, mode]);

    const daysOfWeek = [
        { id: 1, label: 'Lun' }, { id: 2, label: 'Mar' }, { id: 3, label: 'Mer' }, { id: 4, label: 'Jeu' },
        { id: 5, label: 'Ven' }, { id: 6, label: 'Sam' }, { id: 0, label: 'Dim' }
    ];

    const navigateCalendar = (direction: 'prev' | 'next') => {
        const newDate = new Date(calendarDate);
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        setCalendarDate(newDate);
    };

    const getCalendarDays = () => {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };

    const getPrefIcon = (type: string) => {
        switch(type) {
            case 'NO_NIGHT': return <Moon className="w-4 h-4 text-purple-600" />;
            case 'NO_WORK': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'MORNING_ONLY': return <Sun className="w-4 h-4 text-orange-500" />;
            case 'AFTERNOON_ONLY': return <Coffee className="w-4 h-4 text-amber-600" />;
            default: return <Heart className="w-4 h-4 text-pink-500" />;
        }
    };

    const getPrefLabel = (type: string) => {
        switch(type) {
            case 'NO_NIGHT': return 'Pas de Nuit';
            case 'NO_WORK': return 'Indisponible';
            case 'MORNING_ONLY': return 'Matin Uniquement';
            case 'AFTERNOON_ONLY': return 'Soir Uniquement';
            default: return type;
        }
    };

    // ROLES & PERMISSIONS
    const isManager = ['ADMIN', 'DIRECTOR', 'CADRE', 'CADRE_SUP'].includes(currentUser.role);
    const canAccessForecast = isManager; // Explicit definition

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto h-full flex flex-col relative">
            
            {/* VALIDATION MODAL (LEAVES) */}
            {validationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${validationModal.isApprove ? 'text-green-600' : 'text-red-600'}`}>
                            {validationModal.isApprove ? <CheckCircle2 className="w-5 h-5"/> : <XCircle className="w-5 h-5"/>}
                            {validationModal.isApprove ? 'Confirmer Validation' : 'Refuser la Demande'}
                        </h3>
                        
                        <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded mb-4 text-sm dark:text-slate-200">
                            <p><strong>{validationModal.req?.employeeName}</strong></p>
                            <p>{validationModal.req?.type} : {validationModal.req?.startDate} au {validationModal.req?.endDate}</p>
                        </div>

                        {!validationModal.isApprove && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motif du refus (Obligatoire)</label>
                                <textarea 
                                    value={refusalReason}
                                    onChange={(e) => setRefusalReason(e.target.value)}
                                    className="w-full border rounded p-2 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                    rows={3}
                                    placeholder="Ex: Effectif insuffisant..."
                                    autoFocus
                                />
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setValidationModal(null)} className="px-4 py-2 rounded border hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 dark:border-slate-600">Annuler</button>
                            <button 
                                onClick={confirmValidation} 
                                disabled={isLoading || (!validationModal.isApprove && !refusalReason.trim())}
                                className={`px-4 py-2 rounded text-white font-medium ${validationModal.isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}
                            >
                                {isLoading ? 'Traitement...' : 'Confirmer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VALIDATION MODAL (DESIDERATA) */}
            {desiderataValidationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${desiderataValidationModal.isApprove ? 'text-green-600' : 'text-red-600'}`}>
                            {desiderataValidationModal.isApprove ? <CheckCircle2 className="w-5 h-5"/> : <XCircle className="w-5 h-5"/>}
                            {desiderataValidationModal.isApprove ? 'Accepter le Souhait' : 'Refuser le Souhait'}
                        </h3>
                        
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded mb-4 text-sm text-purple-800 dark:text-purple-300">
                            <p><strong>{getPrefLabel(desiderataValidationModal.pref?.type || '')}</strong></p>
                            <p>{desiderataValidationModal.pref?.startDate} au {desiderataValidationModal.pref?.endDate}</p>
                            {desiderataValidationModal.pref?.reason && <p className="italic mt-1">"{desiderataValidationModal.pref?.reason}"</p>}
                        </div>

                        {!desiderataValidationModal.isApprove && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motif du refus (Obligatoire)</label>
                                <textarea 
                                    value={refusalReason}
                                    onChange={(e) => setRefusalReason(e.target.value)}
                                    className="w-full border rounded p-2 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                    rows={3}
                                    placeholder="Ex: Équité de planning, besoins de service..."
                                    autoFocus
                                />
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDesiderataValidationModal(null)} className="px-4 py-2 rounded border hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 dark:border-slate-600">Annuler</button>
                            <button 
                                onClick={confirmDesiderataValidation} 
                                disabled={isLoading || (!desiderataValidationModal.isApprove && !refusalReason.trim())}
                                className={`px-4 py-2 rounded text-white font-medium ${desiderataValidationModal.isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}
                            >
                                {isLoading ? 'Traitement...' : 'Confirmer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-blue-600" /> Gestion des Congés
                </h2>
                
                {(currentUser.role === 'ADMIN' || currentUser.role === 'CADRE' || currentUser.role === 'DIRECTOR' || currentUser.role === 'MANAGER') && (
                    <div className="flex items-center gap-2">
                        <button onClick={handleExportCSV} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm text-sm font-medium">
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm text-sm font-medium">
                            <Upload className="w-4 h-4" /> Import CSV
                        </button>
                    </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImportCSV} className="hidden" accept=".csv" />
            </div>

            {/* SQL FIX ALERT */}
            {schemaError && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 shadow-sm animate-pulse">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 flex-shrink-0 text-red-600 dark:text-red-500">
                            {schemaError.type === 'COLUMN' ? <Database className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-red-800 dark:text-red-400 mb-1 flex items-center gap-2">
                                {schemaError.type === 'COLUMN' ? 'Configuration Base de Données Incomplète' : 'Problème de Droits (Row-Level Security)'}
                            </h3>
                            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                                {schemaError.type === 'COLUMN' 
                                    ? `Une colonne manquante empêche le fonctionnement des préférences.` 
                                    : `Les règles de sécurité de la base de données bloquent l'écriture.`}
                                <br/>Veuillez exécuter la commande suivante dans l'éditeur SQL de Supabase :
                            </p>
                            <div className="relative">
                                <pre className="bg-slate-800 text-green-400 p-3 rounded font-mono text-xs overflow-x-auto select-all border border-slate-600">
                                    {schemaError.type === 'COLUMN' 
                                        ? `ALTER TABLE public.work_preferences ADD COLUMN IF NOT EXISTS recurring_days integer[];`
                                        : `CREATE POLICY "Allow all operations" ON public.work_preferences FOR ALL USING (true) WITH CHECK (true);`
                                    }
                                </pre>
                            </div>
                        </div>
                        <button onClick={() => setSchemaError(null)} className="text-red-400 hover:text-red-600"><X className="w-5 h-5"/></button>
                    </div>
                </div>
            )}

            {/* TABS */}
            <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                <button onClick={() => setMode('my_requests')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'my_requests' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                    Mes Demandes
                </button>
                <button onClick={() => setMode('desiderata')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'desiderata' ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                    Desiderata
                </button>
                {(currentUser.role === 'CADRE' || currentUser.role === 'DIRECTOR' || currentUser.role === 'ADMIN') && (
                    <>
                        <button onClick={() => setMode('desiderata_summary')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${mode === 'desiderata_summary' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                            <List className="w-4 h-4" /> Synthèse Équipe
                        </button>
                        <button onClick={() => setMode('validation')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'validation' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                            Validation ({requestsToValidate.length + prefsToValidate.length})
                        </button>
                    </>
                )}
                <button onClick={() => setMode('calendar')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'calendar' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                    Planning Global (Absences & Souhaits)
                </button>
                
                {canAccessForecast && (
                    <button onClick={() => setMode('forecast')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${mode === 'forecast' ? 'border-orange-500 text-orange-600 dark:text-orange-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                        <CalendarDays className="w-4 h-4" /> Prévisionnel
                    </button>
                )}
            </div>

            <div ref={containerRef} className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 p-6 flex-1 overflow-y-auto min-h-[600px] flex flex-col">
                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : message.type === 'info' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : message.type === 'info' ? <AlertOctagon className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4" />}
                        {message.text}
                    </div>
                )}

                {/* --- MY REQUESTS --- */}
                {mode === 'my_requests' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white">{editingRequestId ? 'Modifier la demande' : 'Nouvelle Demande'}</h3>
                                {editingRequestId && (
                                    <button onClick={cancelEdit} className="text-xs text-red-500 hover:underline">Annuler modif</button>
                                )}
                            </div>
                            <form onSubmit={handleCreateOrUpdate} className={`space-y-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border dark:border-slate-700 ${editingRequestId ? 'border-blue-300 ring-1 ring-blue-100' : ''}`}>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Type</label>
                                    <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                                        <option value="CA">Congés Annuels (CA)</option>
                                        <option value="RTT">RTT</option>
                                        <option value="HS">Hors Saison (HS)</option>
                                        <option value="RC">Repos Cycle (RC)</option>
                                        <option value="NT">Maladie (Arrêt)</option>
                                        <option value="FO">Formation (FO)</option>
                                        <option value="F">Férié (F)</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Début</label>
                                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Fin</label>
                                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" required />
                                    </div>
                                </div>
                                
                                {conflictWarning && leaveType !== 'NT' && (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-3 rounded text-sm text-yellow-800 dark:text-yellow-200">
                                        <div className="flex gap-2 items-start">
                                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div>{conflictWarning}</div>
                                        </div>
                                        <label className="flex items-center gap-2 mt-2 cursor-pointer font-medium">
                                            <input type="checkbox" checked={forceSubmit} onChange={e => setForceSubmit(e.target.checked)} className="rounded text-yellow-600 focus:ring-yellow-500" />
                                            Forcer la demande
                                        </label>
                                    </div>
                                )}

                                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex justify-center gap-2 items-center font-medium shadow-sm transition-colors">
                                    {isLoading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> : <Send className="w-4 h-4"/>}
                                    {editingRequestId ? 'Mettre à jour' : (isLoading ? 'Envoi en cours...' : 'Envoyer')}
                                </button>
                            </form>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Historique</h3>
                            {myRequests.length === 0 ? <p className="text-slate-400 italic">Aucune demande.</p> : myRequests.map(req => {
                                const isPending = req.status.startsWith('PENDING');
                                const effectiveDays = getEffectiveDays(req.startDate, req.endDate);
                                
                                return (
                                    <div key={req.id} className="border border-slate-200 dark:border-slate-700 p-3 rounded-lg flex flex-col mb-2 bg-slate-50 dark:bg-slate-900/50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-slate-700 dark:text-slate-200">{req.type} <span className="text-xs font-normal text-slate-500">({effectiveDays} jours)</span></div>
                                                <div className="text-sm text-slate-500 dark:text-slate-400">{new Date(req.startDate).toLocaleDateString()} au {new Date(req.endDate).toLocaleDateString()}</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`text-xs p-1 rounded font-bold ${
                                                    req.status === 'VALIDATED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                                                    req.status === 'REFUSED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                }`}>
                                                    {req.status === 'PENDING_CADRE' ? 'En attente Cadre' : 
                                                    req.status === 'PENDING_DIRECTOR' ? 'En attente Direction' : 
                                                    req.status === 'PENDING_DG' ? 'En attente DG' : req.status}
                                                </span>
                                                {isPending && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleEditRequest(req)} className="text-blue-500 hover:underline text-xs"><Edit2 className="w-3 h-3"/></button>
                                                        <button onClick={() => handleDeleteRequest(req.id)} className="text-red-500 hover:underline text-xs"><Trash2 className="w-3 h-3"/></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ... (rest of the component remains similar) ... */}
                {/* --- DESIDERATA --- */}
                {mode === 'desiderata' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
                                <Heart className="w-5 h-5 text-purple-600" /> Souhaits / Contraintes
                            </h3>
                            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 p-4 rounded-lg text-sm text-purple-800 dark:text-purple-300 mb-4">
                                Indiquez vos contraintes (ex: Pas de nuit sur une période, ou pas de mercredi). 
                                Ces demandes sont prises en compte par le moteur de planification après validation.
                            </div>
                            <form onSubmit={handleSubmitDesiderata} className="space-y-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                {/* ... form contents ... */}
                                {/* Re-using existing desiderata form code */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Du</label>
                                        <input type="date" value={prefStartDate} onChange={(e) => setPrefStartDate(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Au</label>
                                        <input type="date" value={prefEndDate} onChange={(e) => setPrefEndDate(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" required />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Type de souhait</label>
                                    <select value={prefType} onChange={(e) => setPrefType(e.target.value as any)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                                        <option value="NO_WORK">Ne pas travailler (Repos)</option>
                                        <option value="NO_NIGHT">Pas de nuit</option>
                                        <option value="MORNING_ONLY">Matin uniquement</option>
                                        <option value="AFTERNOON_ONLY">Soir/Après-midi uniquement</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Jours concernés (Récurrence)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {daysOfWeek.map(day => (
                                            <button
                                                type="button"
                                                key={day.id}
                                                onClick={() => togglePrefDay(day.id)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                                    prefDays.includes(day.id)
                                                        ? 'bg-purple-600 text-white border-purple-600'
                                                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                                                }`}
                                            >
                                                {day.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Laissez vide pour appliquer à tous les jours de la période.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Raison</label>
                                    <textarea value={prefReason} onChange={(e) => setPrefReason(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" rows={2} placeholder="Conjoint travaille de nuit, garde d'enfants..." />
                                </div>
                                <button type="submit" disabled={isLoading} className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 font-medium">
                                    Soumettre
                                </button>
                            </form>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Mes Souhaits</h3>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                {myPreferences.map(pref => (
                                    <div key={pref.id} className="border border-slate-200 dark:border-slate-700 p-3 rounded-lg flex flex-col bg-white dark:bg-slate-900/50">
                                        <div className="flex justify-between items-center">
                                            <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                                                {new Date(pref.startDate).toLocaleDateString()} ➜ {new Date(pref.endDate).toLocaleDateString()}
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${
                                                pref.status === 'VALIDATED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                pref.status === 'REFUSED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
                                            }`}>
                                                {pref.status === 'VALIDATED' ? 'Accordé' : pref.status === 'REFUSED' ? 'Refusé' : 'En attente'}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                            {pref.type}
                                            {pref.recurringDays && pref.recurringDays.length > 0 && (
                                                <span className="ml-2 italic text-xs">
                                                    (Uniquement: {pref.recurringDays.map(d => daysOfWeek.find(dw => dw.id === d)?.label).join(', ')})
                                                </span>
                                            )}
                                        </div>
                                        {pref.reason && <div className="text-xs text-slate-500 italic mt-1">"{pref.reason}"</div>}
                                    </div>
                                ))}
                                {myPreferences.length === 0 && <p className="text-slate-400 italic text-sm">Aucun souhait enregistré.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* ... (rest of Desiderata Summary, Validation Mode, Calendar Mode same as previous) ... */}
                {/* --- DESIDERATA SUMMARY (NEW) --- */}
                {mode === 'desiderata_summary' && (
                    <div className="flex flex-col h-full">
                        {/* Copy existing Desiderata Summary render */}
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <List className="w-5 h-5 text-indigo-600" /> Synthèse des Souhaits
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Vue globale des contraintes par agent sur la période affichée.</p>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                                <button onClick={() => navigateCalendar('prev')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"><ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300"/></button>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 px-2 capitalize">{calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                                <button onClick={() => navigateCalendar('next')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"><ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300"/></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {summaryByEmployee.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400 italic">
                                    <Heart className="w-12 h-12 mb-2 opacity-20" />
                                    Aucun desiderata enregistré pour ce mois.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {summaryByEmployee.map(({ emp, prefs }) => (
                                        <div key={emp.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-3 mb-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                                                    {emp.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-slate-800 dark:text-white">{emp.name}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">{emp.role}</div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {prefs.map(p => (
                                                    <div key={p.id} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                                                        <div className="mt-0.5">{getPrefIcon(p.type)}</div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start">
                                                                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{getPrefLabel(p.type)}</div>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                                    p.status === 'VALIDATED' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                                                }`}>
                                                                    {p.status === 'VALIDATED' ? 'Validé' : 'En attente'}
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                                                {new Date(p.startDate).toLocaleDateString()} au {new Date(p.endDate).toLocaleDateString()}
                                                            </div>
                                                            {p.recurringDays && p.recurringDays.length > 0 && (
                                                                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                                                                    Jours : {p.recurringDays.map(d => daysOfWeek.find(dw => dw.id === d)?.label.slice(0,3)).join(', ')}
                                                                </div>
                                                            )}
                                                            {p.reason && (
                                                                <div className="text-[10px] text-slate-400 italic mt-1 border-t border-slate-200 dark:border-slate-700 pt-1">
                                                                    "{p.reason}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {mode === 'validation' && (
                    <div className="flex flex-col lg:flex-row h-full gap-6">
                         {/* LEFT COLUMN: LIST */}
                         <div className="lg:w-1/3 flex flex-col gap-6 overflow-hidden">
                             {/* ... validation list ... */}
                             <div className="flex-shrink-0">
                                 <h3 className="font-bold text-lg mb-2 border-b border-slate-200 dark:border-slate-700 pb-2 text-slate-800 dark:text-white">
                                     Congés à valider
                                 </h3>
                                 
                                 {/* FILTERS */}
                                 <div className="mb-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                     <div className="flex gap-2 text-xs">
                                         <div className="flex-1">
                                             <label className="block text-slate-500 dark:text-slate-400 mb-1">Début &gt;</label>
                                             <input type="date" className="w-full border rounded p-1 dark:bg-slate-800 dark:border-slate-600 dark:text-white" value={valFilterStart} onChange={e => setValFilterStart(e.target.value)} />
                                         </div>
                                         <div className="flex-1">
                                             <label className="block text-slate-500 dark:text-slate-400 mb-1">Fin &lt;</label>
                                             <input type="date" className="w-full border rounded p-1 dark:bg-slate-800 dark:border-slate-600 dark:text-white" value={valFilterEnd} onChange={e => setValFilterEnd(e.target.value)} />
                                         </div>
                                     </div>
                                 </div>

                                 <div className="overflow-y-auto max-h-[40vh] pr-1">
                                     {requestsToValidate.length === 0 ? (
                                         <p className="text-slate-400 text-sm italic">Aucune demande en attente.</p>
                                     ) : (
                                         requestsToValidate.map(req => {
                                             // Check history overlap for managers
                                             const hasN1Overlap = isManager ? checkN1Overlap(req) : false;
                                             const effectiveDays = getEffectiveDays(req.startDate, req.endDate);

                                             return (
                                                 <div 
                                                    key={req.id} 
                                                    onClick={() => handleSelectRequestForComparison(req)}
                                                    className={`border p-3 rounded-lg mb-2 cursor-pointer transition-all hover:shadow-md ${selectedRequest?.id === req.id ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300 dark:bg-blue-900/30 dark:border-blue-600' : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'}`}
                                                 >
                                                     <div className="flex justify-between items-start">
                                                         <div>
                                                             <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{req.employeeName}</div>
                                                             <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                                                                 {req.type} 
                                                                 <span className="ml-1 text-slate-500 font-normal">({effectiveDays} jours hors RH)</span>
                                                             </div>
                                                             <div className="text-xs text-slate-500 dark:text-slate-500">{new Date(req.startDate).toLocaleDateString()} ➜ {new Date(req.endDate).toLocaleDateString()}</div>
                                                             <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                                 <Clock className="w-3 h-3"/> Demandé le {new Date(req.createdAt).toLocaleString()}
                                                             </div>
                                                             {/* HISTORY ALERT */}
                                                             {isManager && hasN1Overlap && (
                                                                 <div className="mt-2 p-1.5 bg-purple-50 border border-purple-200 rounded text-[10px] text-purple-700 flex items-center gap-1 font-medium animate-pulse dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300">
                                                                     <History className="w-3 h-3" />
                                                                     Année N-1 même période
                                                                 </div>
                                                             )}
                                                         </div>
                                                         {selectedRequest?.id === req.id && <Eye className="w-4 h-4 text-blue-500" />}
                                                     </div>
                                                     <div className="flex gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                                                         <button onClick={(e) => {e.stopPropagation(); openValidationModal(req, false)}} className="flex-1 px-2 py-1 bg-white border border-red-200 text-red-700 rounded text-xs hover:bg-red-50">Refuser</button>
                                                         <button onClick={(e) => {e.stopPropagation(); openValidationModal(req, true)}} className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 shadow-sm">
                                                            {req.status === 'PENDING_CADRE' ? 'Pré-valider' : 'Valider'}
                                                         </button>
                                                     </div>
                                                 </div>
                                             );
                                         })
                                     )}
                                 </div>
                             </div>

                             <div className="flex-1 flex flex-col overflow-hidden">
                                 {/* ... desiderata validation list ... */}
                                 <h3 className="font-bold text-lg mb-2 border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2 text-slate-800 dark:text-white">
                                     <Heart className="w-4 h-4 text-purple-600"/> Desiderata à valider
                                 </h3>
                                 <div className="overflow-y-auto flex-1 pr-1">
                                     {prefsToValidate.length === 0 ? (
                                         <p className="text-slate-400 text-sm italic">Aucun souhait.</p>
                                     ) : (
                                         prefsToValidate.map(pref => {
                                             const emp = employees.find(e => e.id === pref.employeeId);
                                             return (
                                                 <div key={pref.id} className="border border-purple-200 dark:border-purple-800 p-3 rounded-lg bg-purple-50/50 dark:bg-purple-900/20 mb-2">
                                                     <div>
                                                         <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{emp?.name || 'Inconnu'}</div>
                                                         <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                                                             {new Date(pref.startDate).toLocaleDateString()} au {new Date(pref.endDate).toLocaleDateString()} : 
                                                             <span className="font-bold"> {pref.type}</span>
                                                         </div>
                                                         <div className="text-xs text-slate-500 italic mt-1">{pref.reason || 'Aucun motif'}</div>
                                                     </div>
                                                     <div className="flex gap-2 mt-2">
                                                         <button onClick={() => openDesiderataValidationModal(pref, false)} className="flex-1 px-2 py-1 bg-white border border-red-200 text-red-700 rounded text-xs hover:bg-red-50">Refuser</button>
                                                         <button onClick={() => openDesiderataValidationModal(pref, true)} className="flex-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 shadow-sm">Valider</button>
                                                     </div>
                                                 </div>
                                             );
                                         })
                                     )}
                                 </div>
                             </div>
                         </div>

                         {/* RIGHT COLUMN: CALENDAR CONTEXT */}
                         <div className="lg:w-2/3 flex flex-col bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                             <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                 <div>
                                     <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                         <Calendar className="w-4 h-4 text-blue-600" />
                                         {selectedRequest ? `Analyse d'impact : ${selectedRequest.employeeName}` : 'Planning Équipe (Vue Globale)'}
                                     </h3>
                                     {selectedRequest && (
                                         <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1">
                                             <Eye className="w-3 h-3" /> Simulation de la demande en cours...
                                         </div>
                                     )}
                                 </div>
                                 <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                                     <button onClick={() => navigateCalendar('prev')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"><ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300"/></button>
                                     <span className="text-xs font-bold text-slate-700 dark:text-slate-200 px-2 capitalize min-w-[100px] text-center">{calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                                     <button onClick={() => navigateCalendar('next')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"><ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300"/></button>
                                 </div>
                             </div>
                             <div className="flex-1 overflow-hidden p-2 relative">
                                 <LeaveCalendar 
                                     employees={employeesWithSimulation} 
                                     startDate={new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1)} 
                                     days={getCalendarDays()} 
                                     pendingRequests={contextPendingRequests} // Add pending context
                                     preferences={preferences} // Add preferences context
                                     serviceConfig={serviceConfig} // PASS CONFIG FOR VALIDATION
                                 />
                                 {selectedRequest && (
                                     <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-600 p-3 rounded-xl flex gap-4 z-40 animate-in slide-in-from-bottom-4">
                                         <div className="text-xs text-slate-500 dark:text-slate-400 pr-4 border-r border-slate-200 dark:border-slate-700">
                                             <div className="font-bold text-slate-800 dark:text-white">Action Rapide</div>
                                             <div>{selectedRequest.type} du {new Date(selectedRequest.startDate).toLocaleDateString()}</div>
                                         </div>
                                         <button onClick={() => openValidationModal(selectedRequest, false)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200">Refuser</button>
                                         <button onClick={() => openValidationModal(selectedRequest, true)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm">Valider</button>
                                     </div>
                                 )}
                             </div>
                             <div className="px-4 py-2 text-[10px] text-slate-500 bg-slate-50 border-t flex gap-4">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded-sm"></span> Validé / Simulé</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-50 border border-dashed border-blue-400 rounded-sm"></span> En attente (Autre)</span>
                                <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-purple-400"/> Souhait</span>
                             </div>
                         </div>
                    </div>
                )}

                {/* --- CALENDAR VIEW (GLOBAL) --- */}
                {mode === 'calendar' && (
                    <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">Planning des Congés & Souhaits</h3>
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                                <button onClick={() => navigateCalendar('prev')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"><ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300"/></button>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 px-2 capitalize">{calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                                <button onClick={() => navigateCalendar('next')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"><ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300"/></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <LeaveCalendar 
                                employees={viewableEmployees} 
                                startDate={new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1)} 
                                days={getCalendarDays()}
                                preferences={isManager ? preferences : myPreferences} // PRIVACY FILTER: Non-managers only see their own wishes overlay, but see ALL absences.
                                serviceConfig={serviceConfig}
                            />
                        </div>
                        <div className="mt-2 text-xs text-slate-500 italic flex gap-4">
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded-sm"></span> Congés Validés (Toute l'équipe)</span>
                            <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-purple-400"/> {isManager ? 'Tous les Souhaits' : 'Mes Souhaits'}</span>
                        </div>
                    </div>
                )}

                {/* --- FORECAST VIEW (NEW) --- */}
                {mode === 'forecast' && canAccessForecast && (
                    <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                                    <CalendarDays className="w-5 h-5 text-orange-500" /> Planning Prévisionnel
                                </h3>
                                <p className="text-sm text-slate-500">Visualisation des congés validés ET en attente avec effectif cible.</p>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                                <button onClick={() => navigateCalendar('prev')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"><ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300"/></button>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 px-2 capitalize">{calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                                <button onClick={() => navigateCalendar('next')} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"><ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300"/></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                            {/* Pass PENDING requests to overlay them */}
                            <LeaveCalendar 
                                employees={viewableEmployees} 
                                startDate={new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1)} 
                                days={getCalendarDays()} 
                                pendingRequests={pendingRequests}
                                serviceConfig={serviceConfig} // IMPORTANT: Pass for calculation
                            />
                        </div>
                        <div className="mt-2 text-xs text-slate-500 italic flex gap-4 items-center">
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded-sm"></span> Congés Validés</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-50 border border-dashed border-blue-400 rounded-sm"></span> En attente de validation</span>
                            <span className="ml-4 font-bold flex items-center gap-1"><span className="w-3 h-3 bg-green-100 border border-green-300"></span> Effectif OK</span>
                            <span className="font-bold flex items-center gap-1"><span className="w-3 h-3 bg-red-100 border border-red-300"></span> Effectif Insuffisant</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
