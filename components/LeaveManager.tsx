
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Employee, ShiftCode, LeaveData, ViewMode, LeaveCounters, LeaveRequestWorkflow, UserRole, AppNotification, LeaveRequestStatus, ServiceAssignment, WorkPreference } from '../types';
import { Calendar, Upload, CheckCircle2, AlertTriangle, History, Settings, LayoutGrid, Filter, ChevronLeft, ChevronRight, Trash2, Save, Send, XCircle, Check, AlertOctagon, Edit2, X, Heart, FolderClock, ChevronDown } from 'lucide-react';
import * as db from '../services/db';
import * as notifications from '../utils/notifications';
import { parseLeaveCSV } from '../utils/csvImport';
import { LeaveCalendar } from './LeaveCalendar';
import { checkConstraints } from '../utils/validation';
import { Toast } from './Toast';
import { SHIFT_TYPES } from '../constants';

interface LeaveManagerProps {
    employees: Employee[];
    onReload: () => void;
    currentUser: { role: UserRole, employeeId?: string };
    activeServiceId?: string;
    assignmentsList?: ServiceAssignment[];
}

export const LeaveManager: React.FC<LeaveManagerProps> = ({ employees, onReload, currentUser, activeServiceId, assignmentsList }) => {
    // Determine default mode based on role
    const defaultMode = (currentUser.role === 'INFIRMIER' || currentUser.role === 'AIDE_SOIGNANT') ? 'my_requests' : 'validation';

    const [mode, setMode] = useState<'my_requests' | 'desiderata' | 'validation' | 'counters' | 'calendar'>(defaultMode);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'warning' } | null>(null);

    // Workflow Data
    const [requests, setRequests] = useState<LeaveRequestWorkflow[]>([]);
    const [preferences, setPreferences] = useState<WorkPreference[]>([]);

    // Form State (New Request)
    const [leaveType, setLeaveType] = useState<string>('CA'); 
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);
    
    // Desiderata State
    const [prefDate, setPrefDate] = useState('');
    const [prefType, setPrefType] = useState<'NO_WORK' | 'NO_NIGHT' | 'MORNING_ONLY'>('NO_WORK');
    const [prefReason, setPrefReason] = useState('');
    
    // Editing state
    const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

    // Validation Modal State
    const [validationModal, setValidationModal] = useState<{ isOpen: boolean, req: LeaveRequestWorkflow | null, isApprove: boolean } | null>(null);
    const [refusalReason, setRefusalReason] = useState('');

    // History Accordion State
    const [expandedYears, setExpandedYears] = useState<number[]>([]);
    const [expandedMonths, setExpandedMonths] = useState<string[]>([]); // Format "YYYY-MM"

    // Counters State
    const [selectedEmpId, setSelectedEmpId] = useState(currentUser.employeeId || '');

    // Calendar State
    const [calViewMode, setCalViewMode] = useState<ViewMode>('month');
    const [calDate, setCalDate] = useState(new Date());

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [reqs, prefs] = await Promise.all([
            db.fetchLeaveRequests(),
            db.fetchWorkPreferences()
        ]);
        setRequests(reqs);
        setPreferences(prefs);
    };

    // Filtered Employees for Calendar & Counters view
    const filteredEmployees = useMemo(() => {
        if (!activeServiceId || !assignmentsList) return employees;
        const assignedIds = assignmentsList
            .filter(a => a.serviceId === activeServiceId)
            .map(a => a.employeeId);
        return employees.filter(e => assignedIds.includes(e.id));
    }, [employees, activeServiceId, assignmentsList]);


    // --- CONFLICT CHECK LOGIC ---
    const checkConflicts = (start: string, end: string, type: string) => {
        if (!start || !end || !currentUser.employeeId) return null;
        if (type === 'NT') return null; // Maladie -> pas de check

        const me = employees.find(e => e.id === currentUser.employeeId);
        if (!me) return null;

        const sDate = new Date(start);
        const eDate = new Date(end);
        
        let conflictCount = 0;
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
             return "Attention : D'autres collègues ayant les mêmes compétences sont absents sur cette période.";
        }
        return null;
    };

    useEffect(() => {
        if (startDate && endDate) {
            const warn = checkConflicts(startDate, endDate, leaveType);
            setConflictWarning(warn);
        } else {
            setConflictWarning(null);
        }
    }, [startDate, endDate, leaveType]);

    // Calculate approximate staffing presence during a request period
    const calculateStaffingInfo = (startStr: string, endStr: string) => {
        const sDate = new Date(startStr);
        const eDate = new Date(endStr);
        let totalDays = 0;
        let totalPresent = 0;

        for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
            const dStr = d.toISOString().split('T')[0];
            // Count employees present (working) on this day in the filtered list (Service)
            const presentToday = filteredEmployees.reduce((acc, emp) => {
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
        if (!currentUser.employeeId || !startDate || !endDate) return;

        // Force user to acknowledge conflict if exists
        const isSickLeave = leaveType === 'NT';
        if (!isSickLeave && conflictWarning) {
            if (!confirm(`${conflictWarning}\n\nSouhaitez-vous quand même envoyer cette demande pour validation ?`)) {
                return;
            }
        }

        setIsLoading(true);
        try {
            const me = employees.find(e => e.id === currentUser.employeeId);
            
            // DÉFINITION DU WORKFLOW HIÉRARCHIQUE
            let initialStatus: LeaveRequestStatus = 'PENDING_CADRE';
            let recipientRole: UserRole | 'DG' = 'CADRE';
            let notifTitle = editingRequestId ? 'Modification Demande' : 'Nouvelle Demande';
            let notifMessage = `${me!.name} a ${editingRequestId ? 'modifié' : 'créé'} une demande de ${leaveType}.`;

            if (isSickLeave) {
                initialStatus = 'VALIDATED'; // Auto-validé
                recipientRole = 'CADRE'; 
                notifTitle = 'Arrêt Maladie Signalé';
                notifMessage = `${me!.name} a signalé un arrêt maladie du ${startDate} au ${endDate}.`;
            } else {
                if (me?.role === 'Infirmier' || me?.role === 'Aide-Soignant') {
                    initialStatus = 'PENDING_CADRE';
                    recipientRole = 'CADRE';
                } else if (me?.role === 'Cadre' || me?.role === 'Manager') {
                    initialStatus = 'PENDING_DIRECTOR';
                    recipientRole = 'DIRECTOR';
                } else if (me?.role === 'Directeur') {
                    initialStatus = 'PENDING_DG';
                    recipientRole = 'DG';
                }
            }

            if (editingRequestId) {
                // UPDATE
                await db.updateLeaveRequest(editingRequestId, {
                    type: leaveType as ShiftCode,
                    startDate,
                    endDate,
                    status: initialStatus
                });
                setMessage({ text: "Demande mise à jour.", type: 'success' });
            } else {
                // CREATE
                const req = await db.createLeaveRequest({
                    employeeId: me!.id,
                    employeeName: me!.name,
                    type: leaveType as ShiftCode,
                    startDate,
                    endDate,
                }, initialStatus);
                
                // IN-APP NOTIFICATION
                await db.createNotification({
                    recipientRole: recipientRole === 'DG' ? 'ADMIN' : recipientRole,
                    title: notifTitle,
                    message: notifMessage,
                    type: isSickLeave ? 'warning' : 'info',
                    actionType: isSickLeave ? undefined : 'LEAVE_VALIDATION', // No action needed for sick leave
                    entityId: req.id
                });

                // EMAIL NOTIFICATION (Simulated)
                await notifications.sendLeaveRequestEmail(
                    recipientRole,
                    me!.name,
                    leaveType,
                    startDate,
                    endDate,
                    isSickLeave
                );

                if (isSickLeave) {
                    // For sick leave, auto-save the shift as NT immediately in calendar
                    await db.saveLeaveRange(me!.id, startDate, endDate, 'NT');
                    setMessage({ text: "Arrêt maladie enregistré et notifié au cadre.", type: 'success' });
                } else {
                    setMessage({ text: "Demande envoyée pour validation.", type: 'success' });
                }
            }
            
            // Reset Form
            setStartDate('');
            setEndDate('');
            setEditingRequestId(null);
            setLeaveType('CA');
            loadData();
            onReload(); // Reload global app data (shifts)
        } catch (err: any) {
            setMessage({ text: err.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitDesiderata = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser.employeeId || !prefDate) return;
        setIsLoading(true);
        try {
            await db.createWorkPreference({
                employeeId: currentUser.employeeId,
                date: prefDate,
                type: prefType,
                reason: prefReason
            });
            setMessage({ text: "Souhait envoyé au cadre.", type: 'success' });
            setPrefDate('');
            setPrefReason('');
            loadData();
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleValidationDesiderata = async (id: string, status: 'VALIDATED' | 'REFUSED') => {
        if (status === 'REFUSED') {
            const reason = prompt("Motif du refus :");
            if (!reason) return;
            await db.updateWorkPreferenceStatus(id, status, reason);
        } else {
            await db.updateWorkPreferenceStatus(id, status);
        }
        loadData();
    };

    const handleEditRequest = (req: LeaveRequestWorkflow) => {
        setLeaveType(req.type);
        setStartDate(req.startDate);
        setEndDate(req.endDate);
        setEditingRequestId(req.id);
        setMessage({ text: "Vous modifiez une demande existante.", type: 'info' });
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

    // OPEN VALIDATION MODAL
    const openValidationModal = (req: LeaveRequestWorkflow, isApprove: boolean) => {
        setRefusalReason('');
        setValidationModal({ isOpen: true, req, isApprove });
    };

    // CONFIRM VALIDATION / REFUSAL
    const confirmValidation = async () => {
        if (!validationModal || !validationModal.req) return;
        const { req, isApprove } = validationModal;

        if (!isApprove && !refusalReason.trim()) {
            alert("Un motif est obligatoire pour refuser.");
            return;
        }

        setIsLoading(true);
        try {
            let newStatus: LeaveRequestWorkflow['status'] = isApprove ? 'VALIDATED' : 'REFUSED';
            let commentToSave = isApprove ? `Validé par ${currentUser.role}` : `Refusé par ${currentUser.role}: ${refusalReason}`;
            let notifMsg = isApprove ? `Votre demande a été validée.` : `Votre demande a été refusée par ${currentUser.role}. Motif: ${refusalReason}`;

            // LOGIC WORKFLOW
            if (isApprove) {
                if (req.status === 'PENDING_CADRE') {
                     // Cadre -> Director
                     newStatus = 'PENDING_DIRECTOR';
                     const staffingInfo = calculateStaffingInfo(req.startDate, req.endDate);
                     notifMsg = `Pré-validée par le cadre, transmise à la Direction.`;
                     
                     // Notify Director with Staffing Info
                     await db.createNotification({
                        recipientRole: 'DIRECTOR',
                        title: 'Validation Requise (Niv 2)',
                        message: `Le cadre a pré-validé les congés de ${req.employeeName} (${req.startDate} au ${req.endDate}). ${staffingInfo}`,
                        type: 'info',
                        actionType: 'LEAVE_VALIDATION',
                        entityId: req.id
                    });
                } else if (req.status === 'PENDING_DIRECTOR' || req.status === 'PENDING_DG') {
                     // Director/DG Final Validation
                     newStatus = 'VALIDATED';
                     // Apply to schedule
                     await db.saveLeaveRange(req.employeeId, req.startDate, req.endDate, req.type);
                }
            }

            // Update DB Status
            await db.updateLeaveRequestStatus(req.id, newStatus, commentToSave);
            
            // Notify Requester
            await db.createNotification({ 
                recipientId: req.employeeId, 
                title: isApprove ? 'Mise à jour Congés' : 'Refus Congés', 
                message: notifMsg, 
                type: isApprove ? 'success' : 'error' 
            } as any);

            // If Refused by Director, Notify Cadre as well
            if (!isApprove && currentUser.role === 'DIRECTOR') {
                 await db.createNotification({
                    recipientRole: 'CADRE',
                    title: 'Refus Direction',
                    message: `La demande de ${req.employeeName} a été refusée par la direction. Motif: ${refusalReason}`,
                    type: 'warning'
                });
            }
            
            setMessage({ text: isApprove ? "Demande traitée." : "Refus enregistré.", type: isApprove ? 'success' : 'warning' });
            setValidationModal(null);
            loadData();
            onReload();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target?.result as string;
            if (text) {
                setMessage({ text: "Import des demandes de congés effectué (Simulation).", type: 'success' });
            }
        };
        reader.readAsText(file);
    };

    const myRequests = requests.filter(r => r.employeeId === currentUser.employeeId);
    const myPreferences = preferences.filter(p => p.employeeId === currentUser.employeeId);
    
    // Requests to validate (PENDING)
    const requestsToValidate = requests.filter(r => {
        if (currentUser.role === 'CADRE') return r.status === 'PENDING_CADRE';
        if (currentUser.role === 'DIRECTOR') return r.status === 'PENDING_DIRECTOR';
        if (currentUser.role === 'ADMIN') return r.status === 'PENDING_DG' || r.status === 'PENDING_DIRECTOR' || r.status === 'PENDING_CADRE'; 
        return false;
    });

    const prefsToValidate = preferences.filter(p => p.status === 'PENDING' && (currentUser.role === 'CADRE' || currentUser.role === 'ADMIN'));

    // --- HISTORY GROUPING LOGIC ---
    const historyRequests = useMemo(() => {
        if (!['ADMIN', 'DIRECTOR', 'CADRE'].includes(currentUser.role)) return null;

        // Filter: Requests that are PROCESSED (VALIDATED or REFUSED)
        const processed = requests.filter(r => 
            ['VALIDATED', 'REFUSED'].includes(r.status) &&
            r.type !== 'NT' 
        );

        // Group by Year -> Month
        const grouped: Record<number, Record<number, LeaveRequestWorkflow[]>> = {};

        processed.forEach(req => {
            const d = new Date(req.startDate);
            const year = d.getFullYear();
            const month = d.getMonth(); // 0-11

            if (!grouped[year]) grouped[year] = {};
            if (!grouped[year][month]) grouped[year][month] = [];
            grouped[year][month].push(req);
        });

        return grouped;
    }, [requests, currentUser.role]);

    const toggleYear = (year: number) => {
        setExpandedYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
    };

    const toggleMonth = (year: number, month: number) => {
        const key = `${year}-${month}`;
        setExpandedMonths(prev => prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]);
    };

    const { calStartDate, calDays, calLabel } = useMemo(() => {
        const d = new Date(calDate);
        if (calViewMode === 'day') return { calStartDate: d, calDays: 1, calLabel: d.toLocaleDateString() };
        if (calViewMode === 'week') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d);
            monday.setDate(diff);
            return { calStartDate: monday, calDays: 7, calLabel: `Semaine du ${monday.getDate()}` };
        }
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return { calStartDate: start, calDays: days, calLabel: start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) };
    }, [calDate, calViewMode]);

    const handleCalNavigate = (dir: 'prev' | 'next') => {
        const newD = new Date(calDate);
        if (calViewMode === 'month') newD.setMonth(newD.getMonth() + (dir === 'next' ? 1 : -1));
        else newD.setDate(newD.getDate() + (dir === 'next' ? 1 : -1));
        setCalDate(newD);
    };

    const getCounterDisplay = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'object' && val !== null && 'reliquat' in val) return val.reliquat;
        return 0;
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto h-full flex flex-col relative">
            
            {/* VALIDATION MODAL */}
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

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-blue-600" /> Gestion des Congés
                </h2>
                
                {(currentUser.role === 'ADMIN' || currentUser.role === 'CADRE' || currentUser.role === 'DIRECTOR' || currentUser.role === 'MANAGER') && (
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm text-sm font-medium">
                        <Upload className="w-4 h-4" /> Import CSV
                    </button>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImportCSV} className="hidden" accept=".csv" />
            </div>

            {/* TABS */}
            <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                <button onClick={() => setMode('my_requests')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'my_requests' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                    Mes Demandes
                </button>
                <button onClick={() => setMode('desiderata')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'desiderata' ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                    Desiderata
                </button>
                {(currentUser.role === 'CADRE' || currentUser.role === 'DIRECTOR' || currentUser.role === 'ADMIN') && (
                    <button onClick={() => setMode('validation')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'validation' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                        Validation ({requestsToValidate.length + prefsToValidate.length})
                    </button>
                )}
                <button onClick={() => setMode('calendar')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'calendar' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                    Planning Global
                </button>
                <button onClick={() => setMode('counters')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'counters' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                    Compteurs
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 p-6 flex-1 overflow-y-auto">
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
                                {conflictWarning && leaveType !== 'NT' && <div className="bg-yellow-50 text-yellow-800 text-xs p-2 rounded">{conflictWarning}</div>}
                                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex justify-center gap-2 items-center font-medium">
                                    {isLoading && <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>}
                                    {editingRequestId ? 'Mettre à jour' : 'Envoyer'}
                                </button>
                            </form>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Historique</h3>
                            {myRequests.map(req => {
                                const isPending = req.status.startsWith('PENDING');
                                return (
                                    <div key={req.id} className="border border-slate-200 dark:border-slate-700 p-3 rounded-lg flex flex-col mb-2 bg-slate-50 dark:bg-slate-900/50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-slate-700 dark:text-slate-200">{req.type}</div>
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
                                                {/* Edit/Delete Actions for Pending Requests */}
                                                {isPending && (
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => handleEditRequest(req)} 
                                                            className="text-slate-400 hover:text-blue-600" 
                                                            title="Modifier"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteRequest(req.id)} 
                                                            className="text-slate-400 hover:text-red-600" 
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {req.comments && (
                                            <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2 italic">
                                                "{req.comments}"
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {myRequests.length === 0 && <p className="text-slate-400 italic text-sm">Aucune demande.</p>}
                        </div>
                    </div>
                )}

                {/* --- DESIDERATA --- */}
                {mode === 'desiderata' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
                                <Heart className="w-5 h-5 text-purple-600" /> Souhaits / Contraintes
                            </h3>
                            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 p-4 rounded-lg text-sm text-purple-800 dark:text-purple-300 mb-4">
                                Indiquez ici vos préférences (ex: pas de mercredi, pas de nuit spécifique). 
                                Ces demandes doivent être validées par le cadre pour être prises en compte dans la génération automatique.
                            </div>
                            <form onSubmit={handleSubmitDesiderata} className="space-y-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Date</label>
                                    <input type="date" value={prefDate} onChange={(e) => setPrefDate(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Type de souhait</label>
                                    <select value={prefType} onChange={(e) => setPrefType(e.target.value as any)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                                        <option value="NO_WORK">Ne pas travailler</option>
                                        <option value="NO_NIGHT">Pas de nuit</option>
                                        <option value="MORNING_ONLY">Matin uniquement</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Raison (Optionnel)</label>
                                    <textarea value={prefReason} onChange={(e) => setPrefReason(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" rows={2} placeholder="Garde d'enfants, RDV..." />
                                </div>
                                <button type="submit" disabled={isLoading} className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 font-medium">
                                    Soumettre
                                </button>
                            </form>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Mes Souhaits</h3>
                            <div className="space-y-2">
                                {myPreferences.map(pref => (
                                    <div key={pref.id} className="border border-slate-200 dark:border-slate-700 p-3 rounded-lg flex flex-col bg-white dark:bg-slate-900/50">
                                        <div className="flex justify-between items-center">
                                            <div className="font-medium text-slate-800 dark:text-slate-200">{new Date(pref.date).toLocaleDateString()}</div>
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${
                                                pref.status === 'VALIDATED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                pref.status === 'REFUSED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
                                            }`}>
                                                {pref.status === 'VALIDATED' ? 'Accordé' : pref.status === 'REFUSED' ? 'Refusé' : 'En attente'}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                            {pref.type === 'NO_WORK' ? 'Ne pas travailler' : pref.type === 'NO_NIGHT' ? 'Pas de nuit' : 'Matin uniquement'}
                                        </div>
                                        {pref.reason && <div className="text-xs text-slate-500 italic mt-1">"{pref.reason}"</div>}
                                        {pref.rejectionReason && <div className="text-xs text-red-600 mt-1 font-medium">Refus : {pref.rejectionReason}</div>}
                                    </div>
                                ))}
                                {myPreferences.length === 0 && <p className="text-slate-400 italic text-sm">Aucun souhait enregistré.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- VALIDATION --- */}
                {mode === 'validation' && (
                    <div className="space-y-8">
                         {/* Congés (Actions) */}
                         <div>
                             <h3 className="font-bold text-lg mb-4 border-b border-slate-200 dark:border-slate-700 pb-2 text-slate-800 dark:text-white">
                                 Congés à valider
                                 {currentUser.role === 'ADMIN' && <span className="text-xs text-slate-400 ml-2 font-normal">(Vue Admin Globale)</span>}
                             </h3>
                             {requestsToValidate.length === 0 ? (
                                 <p className="text-slate-400 text-sm italic mb-6">Aucune demande en attente.</p>
                             ) : (
                                 requestsToValidate.map(req => (
                                     <div key={req.id} className="border border-slate-200 dark:border-slate-700 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                                         <div>
                                             <div className="font-bold text-slate-800 dark:text-slate-200">{req.employeeName}</div>
                                             <div className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-0.5">{req.type}</div>
                                             <div className="text-xs text-slate-500 dark:text-slate-500">{req.startDate} ➜ {req.endDate}</div>
                                         </div>
                                         <div className="flex gap-2">
                                             <button onClick={() => openValidationModal(req, false)} className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">Refuser</button>
                                             <button onClick={() => openValidationModal(req, true)} className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-sm hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                                                {req.status === 'PENDING_CADRE' ? 'Pré-valider' : 'Valider'}
                                             </button>
                                         </div>
                                     </div>
                                 ))
                             )}
                         </div>

                         {/* Desiderata (Actions) */}
                         <div>
                             <h3 className="font-bold text-lg mb-4 border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2 text-slate-800 dark:text-white">
                                 <Heart className="w-4 h-4 text-purple-600"/> Desiderata à valider
                             </h3>
                             {prefsToValidate.length === 0 ? (
                                 <p className="text-slate-400 text-sm italic mb-6">Aucun souhait en attente.</p>
                             ) : (
                                 prefsToValidate.map(pref => {
                                     const emp = employees.find(e => e.id === pref.employeeId);
                                     return (
                                         <div key={pref.id} className="border border-purple-200 dark:border-purple-800 p-4 rounded-lg bg-purple-50/50 dark:bg-purple-900/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                                             <div>
                                                 <div className="font-bold text-slate-800 dark:text-slate-200">{emp?.name || 'Inconnu'}</div>
                                                 <div className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                                                     {new Date(pref.date).toLocaleDateString()} : 
                                                     {pref.type === 'NO_WORK' ? ' Ne pas travailler' : pref.type === 'NO_NIGHT' ? ' Pas de nuit' : ' Matin uniquement'}
                                                 </div>
                                                 {pref.reason && <div className="text-xs text-slate-500 italic">"{pref.reason}"</div>}
                                             </div>
                                             <div className="flex gap-2">
                                                 <button onClick={() => handleValidationDesiderata(pref.id, 'REFUSED')} className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">Refuser</button>
                                                 <button onClick={() => handleValidationDesiderata(pref.id, 'VALIDATED')} className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-sm hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">Accorder</button>
                                             </div>
                                         </div>
                                     );
                                 })
                             )}
                         </div>

                         {/* Historique des Validations */}
                         {historyRequests && (
                             <div className="mt-10 border-t border-slate-200 dark:border-slate-700 pt-6">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                    <FolderClock className="w-5 h-5 text-slate-500" />
                                    Historique des Demandes
                                </h3>
                                
                                {Object.keys(historyRequests).length === 0 ? (
                                    <p className="text-slate-400 italic text-sm">Aucun historique disponible.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {Object.entries(historyRequests)
                                            .sort(([y1], [y2]) => parseInt(y2) - parseInt(y1)) // Sort years desc
                                            .map(([year, months]) => (
                                            <div key={year} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                                <button 
                                                    onClick={() => toggleYear(parseInt(year))}
                                                    className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-left font-semibold text-slate-700 dark:text-slate-200"
                                                >
                                                    <span>Année {year}</span>
                                                    {expandedYears.includes(parseInt(year)) ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                                </button>
                                                
                                                {expandedYears.includes(parseInt(year)) && (
                                                    <div className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 p-2">
                                                        {Object.entries(months)
                                                            .sort(([m1], [m2]) => parseInt(m2) - parseInt(m1)) // Sort months desc
                                                            .map(([monthStr, reqs]) => {
                                                                const monthIndex = parseInt(monthStr);
                                                                const monthName = new Date(parseInt(year), monthIndex, 1).toLocaleDateString('fr-FR', { month: 'long' });
                                                                const monthKey = `${year}-${monthIndex}`;
                                                                const isExpanded = expandedMonths.includes(monthKey);

                                                                return (
                                                                    <div key={monthKey} className="mb-2 last:mb-0">
                                                                        <button 
                                                                            onClick={() => toggleMonth(parseInt(year), monthIndex)}
                                                                            className="w-full flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-sm font-medium text-slate-600 dark:text-slate-300"
                                                                        >
                                                                            <span className="capitalize">{monthName} ({reqs.length})</span>
                                                                            {isExpanded ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                                                                        </button>

                                                                        {isExpanded && (
                                                                            <div className="pl-4 pr-2 py-2 space-y-2">
                                                                                {reqs.map(req => (
                                                                                    <div key={req.id} className="text-xs border-l-2 pl-3 py-1 flex justify-between items-start" 
                                                                                         style={{ borderColor: req.status === 'VALIDATED' ? '#22c55e' : '#ef4444' }}>
                                                                                        <div>
                                                                                            <div className="font-bold text-slate-700 dark:text-slate-300">{req.employeeName}</div>
                                                                                            <div className="text-slate-500 dark:text-slate-400">
                                                                                                {req.type} du {new Date(req.startDate).toLocaleDateString()} au {new Date(req.endDate).toLocaleDateString()}
                                                                                            </div>
                                                                                            {req.comments && <div className="italic text-slate-400 mt-0.5">"{req.comments}"</div>}
                                                                                        </div>
                                                                                        <span className={`px-1.5 py-0.5 rounded font-bold uppercase text-[10px] ${
                                                                                            req.status === 'VALIDATED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                                        }`}>
                                                                                            {req.status === 'VALIDATED' ? 'Validé' : 'Refusé'}
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                             </div>
                         )}
                    </div>
                )}

                {/* --- CALENDAR --- */}
                {mode === 'calendar' && (
                     <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 p-1 rounded border border-slate-200 dark:border-slate-600">
                                <button onClick={() => handleCalNavigate('prev')}><ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
                                <span className="text-sm font-semibold min-w-[150px] text-center capitalize text-slate-700 dark:text-slate-200">{calLabel}</span>
                                <button onClick={() => handleCalNavigate('next')}><ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
                            </div>
                            {activeServiceId && (
                                <div className="text-xs text-slate-500 italic px-2">
                                    Filtré par service affecté
                                </div>
                            )}
                        </div>
                        <LeaveCalendar employees={filteredEmployees} startDate={calStartDate} days={calDays} />
                    </div>
                )}

                {/* --- COUNTERS --- */}
                {mode === 'counters' && (
                    <div>
                         {(currentUser.role === 'ADMIN' || currentUser.role === 'DIRECTOR' || currentUser.role === 'CADRE') && (
                            <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)} className="w-full p-2 border rounded mb-4 dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                                <option value="">-- Choisir un collaborateur --</option>
                                {filteredEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                            </select>
                         )}
                         {selectedEmpId && (
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {(() => {
                                     const emp = filteredEmployees.find(e => e.id === selectedEmpId);
                                     if(!emp) return null;
                                     const counts = emp.leaveCounters || { CA: 0, RTT: 0, HS: 0, RC: 0 };
                                     return Object.entries(counts).map(([key, val]) => (
                                         <div key={key} className="bg-slate-50 dark:bg-slate-900 p-4 rounded border border-slate-200 dark:border-slate-700 text-center">
                                             <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                                 {getCounterDisplay(val)}
                                             </div>
                                             <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">{key}</div>
                                         </div>
                                     ));
                                })()}
                             </div>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
};
