
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Employee, ShiftCode, LeaveRequestWorkflow, UserRole, ServiceAssignment, WorkPreference, LeaveRequestStatus } from '../types';
import { Calendar, Upload, CheckCircle2, AlertTriangle, History, Settings, LayoutGrid, Filter, ChevronLeft, ChevronRight, Trash2, Save, Send, XCircle, Check, AlertOctagon, Edit2, X, Heart, FolderClock, ChevronDown, Clock, Database, Lock } from 'lucide-react';
import * as db from '../services/db';
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
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
    const [schemaError, setSchemaError] = useState<{ msg: string, type: 'COLUMN' | 'RLS' } | null>(null);

    // Workflow Data
    const [requests, setRequests] = useState<LeaveRequestWorkflow[]>([]);
    const [preferences, setPreferences] = useState<WorkPreference[]>([]);

    // Form State (New Request)
    const [leaveType, setLeaveType] = useState<string>('CA'); 
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);
    
    // Desiderata State (Advanced)
    const [prefStartDate, setPrefStartDate] = useState('');
    const [prefEndDate, setPrefEndDate] = useState('');
    const [prefType, setPrefType] = useState<'NO_WORK' | 'NO_NIGHT' | 'MORNING_ONLY' | 'AFTERNOON_ONLY'>('NO_WORK');
    const [prefReason, setPrefReason] = useState('');
    const [prefDays, setPrefDays] = useState<number[]>([]); // 0=Sun...
    
    // Editing state
    const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

    // Validation Modal State
    const [validationModal, setValidationModal] = useState<{ isOpen: boolean, req: LeaveRequestWorkflow | null, isApprove: boolean } | null>(null);
    const [refusalReason, setRefusalReason] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

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
                setMessage({ text: "Erreur chargement données. Vérifiez la console.", type: 'error' });
            }
        }
    };

    // Filtered Employees
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
        if (type === 'NT') return null; 

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

    // Calculate approximate staffing presence
    const calculateStaffingInfo = (startStr: string, endStr: string) => {
        const sDate = new Date(startStr);
        const eDate = new Date(endStr);
        let totalDays = 0;
        let totalPresent = 0;

        for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
            const dStr = d.toISOString().split('T')[0];
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
        
        if (!startDate || !endDate) {
             setMessage({ text: "Veuillez sélectionner les dates de début et de fin.", type: 'warning' });
             return;
        }

        if (!currentUser.employeeId) {
             setMessage({ text: "Erreur : Compte utilisateur non lié à une fiche employé.", type: 'error' });
             return;
        }

        const me = employees.find(e => e.id === currentUser.employeeId);
        if (!me) {
             setMessage({ text: "Erreur : Fiche employé introuvable. Veuillez contacter l'administrateur.", type: 'error' });
             return;
        }

        const isSickLeave = leaveType === 'NT';
        if (!isSickLeave && conflictWarning) {
            if (!confirm(`${conflictWarning}\n\nSouhaitez-vous quand même envoyer cette demande pour validation ?`)) {
                return;
            }
        }

        setIsLoading(true);
        try {
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
                const req = await db.createLeaveRequest({
                    employeeId: me.id,
                    employeeName: me.name,
                    type: leaveType as ShiftCode,
                    startDate,
                    endDate,
                }, initialStatus);
                
                await db.createNotification({
                    recipientRole: recipientRole === 'DG' ? 'ADMIN' : recipientRole,
                    title: isSickLeave ? 'Arrêt Maladie' : 'Demande de Congés',
                    message: `${me.name} : ${leaveType} du ${startDate} au ${endDate}`,
                    type: isSickLeave ? 'warning' : 'info',
                    actionType: isSickLeave ? undefined : 'LEAVE_VALIDATION', 
                    entityId: req.id
                });

                if (isSickLeave) {
                    await db.saveLeaveRange(me.id, startDate, endDate, 'NT');
                    setMessage({ text: "Arrêt maladie enregistré et planning mis à jour.", type: 'success' });
                } else {
                    setMessage({ text: "Demande envoyée pour validation.", type: 'success' });
                }
            }
            
            setStartDate('');
            setEndDate('');
            setEditingRequestId(null);
            setLeaveType('CA');
            loadData();
            onReload(); 
        } catch (err: any) {
            if (!checkForDbErrors(err)) {
                setMessage({ text: `Erreur: ${err.message}`, type: 'error' });
            }
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
            setMessage({ text: "Souhait envoyé au cadre.", type: 'success' });
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

    const openValidationModal = (req: LeaveRequestWorkflow, isApprove: boolean) => {
        setRefusalReason('');
        setValidationModal({ isOpen: true, req, isApprove });
    };

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
            let notifMsg = isApprove ? `Votre demande a été validée.` : `Refusé: ${refusalReason}`;

            if (isApprove) {
                if (req.status === 'PENDING_CADRE') {
                     newStatus = 'PENDING_DIRECTOR';
                     const staffingInfo = calculateStaffingInfo(req.startDate, req.endDate);
                     notifMsg = `Pré-validée par le cadre, transmise à la Direction.`;
                     
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
                title: isApprove ? 'Mise à jour Congés' : 'Refus Congés', 
                message: notifMsg, 
                type: isApprove ? 'success' : 'error' 
            } as any);

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
                setMessage({ text: "Import simulé (Fonctionnalité complète requiert Backend).", type: 'info' });
            }
        };
        reader.readAsText(file);
    };

    const myRequests = requests.filter(r => r.employeeId === currentUser.employeeId);
    const myPreferences = preferences.filter(p => p.employeeId === currentUser.employeeId);
    
    const requestsToValidate = requests.filter(r => {
        if (currentUser.role === 'CADRE') return r.status === 'PENDING_CADRE';
        if (currentUser.role === 'DIRECTOR') return r.status === 'PENDING_DIRECTOR';
        if (currentUser.role === 'ADMIN') return r.status === 'PENDING_DG' || r.status === 'PENDING_DIRECTOR' || r.status === 'PENDING_CADRE'; 
        return false;
    });

    const prefsToValidate = preferences.filter(p => p.status === 'PENDING' && (currentUser.role === 'CADRE' || currentUser.role === 'ADMIN'));
    
    // DAYS UI HELPER
    const daysOfWeek = [
        { id: 1, label: 'Lun' }, { id: 2, label: 'Mar' }, { id: 3, label: 'Mer' }, { id: 4, label: 'Jeu' },
        { id: 5, label: 'Ven' }, { id: 6, label: 'Sam' }, { id: 0, label: 'Dim' }
    ];

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
                    <button onClick={() => setMode('validation')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'validation' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                        Validation ({requestsToValidate.length + prefsToValidate.length})
                    </button>
                )}
                <button onClick={() => setMode('calendar')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'calendar' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>
                    Planning Global
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
                                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex justify-center gap-2 items-center font-medium shadow-sm transition-colors">
                                    {isLoading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> : <Send className="w-4 h-4"/>}
                                    {editingRequestId ? 'Mettre à jour' : 'Envoyer'}
                                </button>
                            </form>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Historique</h3>
                            {myRequests.length === 0 ? <p className="text-slate-400 italic">Aucune demande.</p> : myRequests.map(req => {
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

                {/* --- VALIDATION --- */}
                {mode === 'validation' && (
                    <div className="space-y-8">
                         {/* Congés */}
                         <div>
                             <h3 className="font-bold text-lg mb-4 border-b border-slate-200 dark:border-slate-700 pb-2 text-slate-800 dark:text-white">
                                 Congés à valider
                             </h3>
                             {requestsToValidate.length === 0 ? (
                                 <p className="text-slate-400 text-sm italic mb-6">Aucune demande.</p>
                             ) : (
                                 requestsToValidate.map(req => (
                                     <div key={req.id} className="border border-slate-200 dark:border-slate-700 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                                         <div>
                                             <div className="font-bold text-slate-800 dark:text-slate-200">{req.employeeName}</div>
                                             <div className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-0.5">{req.type}</div>
                                             <div className="text-xs text-slate-500 dark:text-slate-500">{req.startDate} ➜ {req.endDate}</div>
                                         </div>
                                         <div className="flex gap-2">
                                             <button onClick={() => openValidationModal(req, false)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200">Refuser</button>
                                             <button onClick={() => openValidationModal(req, true)} className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200">
                                                {req.status === 'PENDING_CADRE' ? 'Pré-valider' : 'Valider'}
                                             </button>
                                         </div>
                                     </div>
                                 ))
                             )}
                         </div>

                         {/* Desiderata */}
                         <div>
                             <h3 className="font-bold text-lg mb-4 border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2 text-slate-800 dark:text-white">
                                 <Heart className="w-4 h-4 text-purple-600"/> Desiderata à valider
                             </h3>
                             {prefsToValidate.length === 0 ? (
                                 <p className="text-slate-400 text-sm italic mb-6">Aucun souhait.</p>
                             ) : (
                                 prefsToValidate.map(pref => {
                                     const emp = employees.find(e => e.id === pref.employeeId);
                                     return (
                                         <div key={pref.id} className="border border-purple-200 dark:border-purple-800 p-4 rounded-lg bg-purple-50/50 dark:bg-purple-900/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                                             <div>
                                                 <div className="font-bold text-slate-800 dark:text-slate-200">{emp?.name || 'Inconnu'}</div>
                                                 <div className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                                                     {new Date(pref.startDate).toLocaleDateString()} au {new Date(pref.endDate).toLocaleDateString()} : 
                                                     <span className="font-bold"> {pref.type}</span>
                                                 </div>
                                                 {pref.recurringDays && pref.recurringDays.length > 0 && (
                                                     <div className="text-xs text-slate-500">Jours: {pref.recurringDays.map(d => daysOfWeek.find(dw => dw.id === d)?.label).join(', ')}</div>
                                                 )}
                                                 {pref.reason && <div className="text-xs text-slate-500 italic">"{pref.reason}"</div>}
                                             </div>
                                             <div className="flex gap-2">
                                                 <button onClick={() => handleValidationDesiderata(pref.id, 'REFUSED')} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200">Refuser</button>
                                                 <button onClick={() => handleValidationDesiderata(pref.id, 'VALIDATED')} className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200">Accorder</button>
                                             </div>
                                         </div>
                                     );
                                 })
                             )}
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};
