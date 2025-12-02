
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Employee, ShiftCode, LeaveData, ViewMode, LeaveCounters, LeaveRequestWorkflow, UserRole, AppNotification, LeaveRequestStatus, ServiceAssignment } from '../types';
import { Calendar, Upload, CheckCircle2, AlertTriangle, History, Settings, LayoutGrid, Filter, ChevronLeft, ChevronRight, Trash2, Save, Send, XCircle, Check, AlertOctagon } from 'lucide-react';
import * as db from '../services/db';
import { parseLeaveCSV } from '../utils/csvImport';
import { LeaveCalendar } from './LeaveCalendar';
import { checkConstraints } from '../utils/validation';
import { Toast } from './Toast';

interface LeaveManagerProps {
    employees: Employee[];
    onReload: () => void;
    currentUser: { role: UserRole, employeeId?: string };
    activeServiceId?: string;
    assignmentsList?: ServiceAssignment[];
}

export const LeaveManager: React.FC<LeaveManagerProps> = ({ employees, onReload, currentUser, activeServiceId, assignmentsList }) => {
    // Determine default mode based on role
    const defaultMode = currentUser.role === 'INFIRMIER' || currentUser.role === 'AIDE_SOIGNANT' ? 'my_requests' : 'validation';

    const [mode, setMode] = useState<'my_requests' | 'validation' | 'counters' | 'calendar'>(defaultMode);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'warning' } | null>(null);

    // Workflow Data
    const [requests, setRequests] = useState<LeaveRequestWorkflow[]>([]);

    // Form State (New Request)
    const [leaveType, setLeaveType] = useState<string>('CA'); 
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);

    // Counters State
    const [selectedEmpId, setSelectedEmpId] = useState(currentUser.employeeId || '');

    // Calendar State
    const [calViewMode, setCalViewMode] = useState<ViewMode>('month');
    const [calDate, setCalDate] = useState(new Date());

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        const data = await db.fetchLeaveRequests();
        setRequests(data);
    };

    // Filtered Employees for Calendar & Counters view
    const filteredEmployees = useMemo(() => {
        if (!activeServiceId || !assignmentsList) return employees;
        // If Service selected, only show employees assigned to it
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
                if (['CA', 'RH', 'RC', 'NT', 'FO', 'HS'].includes(shift)) {
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

    // --- ACTIONS ---

    const handleCreateRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser.employeeId || !startDate || !endDate) return;

        setIsLoading(true);
        try {
            const me = employees.find(e => e.id === currentUser.employeeId);
            const isSickLeave = leaveType === 'NT';

            // DÉFINITION DU WORKFLOW HIÉRARCHIQUE
            let initialStatus: LeaveRequestStatus = 'PENDING_CADRE';
            let recipientRole: UserRole | 'DG' = 'CADRE';
            let notifTitle = 'Nouvelle Demande de Congé';

            // Si c'est un arrêt maladie, on valide et notifie le cadre
            if (isSickLeave) {
                initialStatus = 'VALIDATED'; // Auto-validé
                recipientRole = 'CADRE'; 
            } else {
                // Workflow Standard
                if (me?.role === 'Infirmier' || me?.role === 'Aide-Soignant') {
                    // -> Cadre
                    initialStatus = 'PENDING_CADRE';
                    recipientRole = 'CADRE';
                } else if (me?.role === 'Cadre' || me?.role === 'Manager') {
                    // -> Directeur
                    initialStatus = 'PENDING_DIRECTOR';
                    recipientRole = 'DIRECTOR';
                } else if (me?.role === 'Directeur') {
                    // -> Directeur Général (DG)
                    initialStatus = 'PENDING_DG';
                    recipientRole = 'DG'; // Simulera une notification système ou Admin
                }
            }

            const req = await db.createLeaveRequest({
                employeeId: me!.id,
                employeeName: me!.name,
                type: leaveType as ShiftCode,
                startDate,
                endDate,
            }, initialStatus);

            if (isSickLeave) {
                // Pour maladie, on écrit direct dans le planning
                await db.saveLeaveRange(me!.id, startDate, endDate, 'NT');
                await db.createNotification({
                    recipientRole: 'CADRE',
                    title: 'Arrêt Maladie Signalé',
                    message: `${me!.name} a signalé un arrêt maladie du ${startDate} au ${endDate}.`,
                    type: 'warning',
                    actionType: 'LEAVE_VALIDATION',
                    entityId: req.id
                });
                setMessage({ text: "Arrêt maladie enregistré et transmis au cadre.", type: 'success' });
            } else {
                // Notification au N+1
                await db.createNotification({
                    recipientRole: recipientRole === 'DG' ? 'ADMIN' : recipientRole, // Fallback Admin pour DG
                    title: notifTitle,
                    message: `${me!.name} (${me!.role}) demande des congés (${leaveType}) du ${startDate} au ${endDate}.`,
                    type: 'info',
                    actionType: 'LEAVE_VALIDATION',
                    entityId: req.id
                });

                if (recipientRole === 'DG') {
                    setMessage({ text: "Demande transmise au Directeur Général.", type: 'success' });
                } else {
                    setMessage({ text: `Demande envoyée au ${recipientRole === 'DIRECTOR' ? 'Directeur' : 'Cadre'} pour validation.`, type: 'success' });
                }
            }

            setStartDate('');
            setEndDate('');
            loadRequests();
        } catch (err: any) {
            setMessage({ text: err.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleValidation = async (req: LeaveRequestWorkflow, approved: boolean) => {
        let refusalReason = '';
        let commentToSave = '';

        if (!approved) {
            const input = prompt("Veuillez indiquer le motif du refus :");
            if (input === null) return; // Annulation par l'utilisateur
            if (!input.trim()) {
                alert("Un motif est obligatoire pour refuser une demande.");
                return;
            }
            refusalReason = input;
            commentToSave = `Refusé par ${currentUser.role}: ${input}`;
        } else {
            if (!confirm("Valider cette demande ?")) return;
            commentToSave = `Validé par ${currentUser.role}`;
        }

        setIsLoading(true);
        try {
            let newStatus: LeaveRequestWorkflow['status'] = approved ? 'VALIDATED' : 'REFUSED';
            let notifMsg = approved ? `Votre demande a été validée.` : `Votre demande a été refusée par ${currentUser.role}. Motif: ${refusalReason}`;

            // Logique de validation en cascade
            if (approved) {
                if (req.status === 'PENDING_CADRE') {
                     // Cadre valide -> Passe au Directeur
                     newStatus = 'PENDING_DIRECTOR';
                     notifMsg = `Pré-validée par le cadre, transmise à la Direction.`;
                     await db.createNotification({
                        recipientRole: 'DIRECTOR',
                        title: 'Validation Requise',
                        message: `Le cadre a pré-validé les congés de ${req.employeeName}. Validation finale requise.`,
                        type: 'info',
                        actionType: 'LEAVE_VALIDATION',
                        entityId: req.id
                    });
                } else if (req.status === 'PENDING_DIRECTOR' || req.status === 'PENDING_DG') {
                     // Validation Finale
                     newStatus = 'VALIDATED';
                     await db.saveLeaveRange(req.employeeId, req.startDate, req.endDate, req.type);
                }
            }

            // Mise à jour de la demande en base
            await db.updateLeaveRequestStatus(req.id, newStatus, commentToSave);

            // Notification au demandeur
            await db.createNotification({ 
                recipientId: req.employeeId, 
                title: approved ? 'Validation Congés' : 'Refus Congés', 
                message: notifMsg, 
                type: approved ? 'success' : 'error' 
            } as any);
            
            setMessage({ text: approved ? "Demande validée/transmise." : "Demande refusée avec succès.", type: approved ? 'success' : 'warning' });
            loadRequests();
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
                // Here we would normally implement bulk import logic for leaves
                // For now, simulate success
                setMessage({ text: "Import des demandes de congés effectué (Simulation).", type: 'success' });
            }
        };
        reader.readAsText(file);
    };

    // --- VUES ---
    const myRequests = requests.filter(r => r.employeeId === currentUser.employeeId);
    
    // Filtres pour l'onglet Validation selon le rôle connecté
    const requestsToValidate = requests.filter(r => {
        if (currentUser.role === 'CADRE') return r.status === 'PENDING_CADRE';
        if (currentUser.role === 'DIRECTOR') return r.status === 'PENDING_DIRECTOR';
        if (currentUser.role === 'ADMIN') return r.status === 'PENDING_DG' || r.status === 'PENDING_DIRECTOR' || r.status === 'PENDING_CADRE'; // Admin sees all
        return false;
    });

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

    // Helper to safely render counter value
    const getCounterDisplay = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'object' && val !== null && 'reliquat' in val) return val.reliquat;
        return 0;
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-blue-600" /> Gestion des Congés
                </h2>
                
                {(currentUser.role === 'ADMIN' || currentUser.role === 'CADRE' || currentUser.role === 'DIRECTOR' || currentUser.role === 'MANAGER') && (
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 shadow-sm text-sm font-medium">
                        <Upload className="w-4 h-4" /> Import CSV
                    </button>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImportCSV} className="hidden" accept=".csv" />
            </div>

            {/* TABS */}
            <div className="flex gap-4 mb-6 border-b border-slate-200 overflow-x-auto">
                <button onClick={() => setMode('my_requests')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'my_requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
                    Mes Demandes
                </button>
                {(currentUser.role === 'CADRE' || currentUser.role === 'DIRECTOR' || currentUser.role === 'ADMIN') && (
                    <button onClick={() => setMode('validation')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'validation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
                        Validation ({requestsToValidate.length})
                    </button>
                )}
                <button onClick={() => setMode('calendar')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'calendar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
                    Planning Global
                </button>
                <button onClick={() => setMode('counters')} className={`pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap ${mode === 'counters' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
                    Compteurs
                </button>
            </div>

            <div className="bg-white rounded-xl shadow border border-slate-200 p-6 flex-1 overflow-y-auto">
                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {message.text}
                    </div>
                )}

                {/* --- MY REQUESTS --- */}
                {mode === 'my_requests' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-bold text-lg mb-4">Nouvelle Demande</h3>
                            <form onSubmit={handleCreateRequest} className="space-y-4 bg-slate-50 p-4 rounded-lg border">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Type</label>
                                    <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full p-2 border rounded">
                                        <option value="CA">Congés Annuels (CA)</option>
                                        <option value="RTT">RTT</option>
                                        <option value="HS">Hors Saison (HS)</option>
                                        <option value="RC">Repos Cycle (RC)</option>
                                        <option value="NT">Maladie (Arrêt)</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Début</label>
                                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border rounded" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Fin</label>
                                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border rounded" required />
                                    </div>
                                </div>
                                {conflictWarning && <div className="bg-yellow-50 text-yellow-800 text-xs p-2 rounded">{conflictWarning}</div>}
                                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Envoyer</button>
                            </form>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-4">Historique</h3>
                            {myRequests.map(req => (
                                <div key={req.id} className="border p-3 rounded-lg flex flex-col mb-2 bg-slate-50">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-slate-700">{req.type}</div>
                                            <div className="text-sm text-slate-500">{new Date(req.startDate).toLocaleDateString()} au {new Date(req.endDate).toLocaleDateString()}</div>
                                        </div>
                                        <span className={`text-xs p-1 rounded font-bold ${
                                            req.status === 'VALIDATED' ? 'bg-green-100 text-green-700' : 
                                            req.status === 'REFUSED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                        }`}>
                                            {req.status === 'PENDING_CADRE' ? 'En attente Cadre' : 
                                             req.status === 'PENDING_DIRECTOR' ? 'En attente Direction' : 
                                             req.status === 'PENDING_DG' ? 'En attente DG' : req.status}
                                        </span>
                                    </div>
                                    {req.comments && (
                                        <div className="mt-2 text-xs text-slate-600 border-t pt-2 italic">
                                            "{req.comments}"
                                        </div>
                                    )}
                                </div>
                            ))}
                            {myRequests.length === 0 && <p className="text-slate-400 italic text-sm">Aucune demande.</p>}
                        </div>
                    </div>
                )}

                {/* --- VALIDATION --- */}
                {mode === 'validation' && (
                    <div>
                         <h3 className="font-bold text-lg mb-4">
                             Demandes à valider
                             {currentUser.role === 'ADMIN' && <span className="text-xs text-slate-400 ml-2 font-normal">(Vue Admin Globale)</span>}
                         </h3>
                         {requestsToValidate.length === 0 ? (
                             <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-lg">
                                 <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-50"/>
                                 Aucune demande en attente de validation pour votre rôle.
                             </div>
                         ) : (
                             requestsToValidate.map(req => (
                                 <div key={req.id} className="border p-4 rounded-lg bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                                     <div>
                                         <div className="font-bold text-slate-800">{req.employeeName}</div>
                                         <div className="text-sm text-slate-600 font-medium mt-0.5">{req.type}</div>
                                         <div className="text-xs text-slate-500">{req.startDate} ➜ {req.endDate}</div>
                                     </div>
                                     <div className="flex gap-2">
                                         <button onClick={() => handleValidation(req, false)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors">Refuser</button>
                                         <button onClick={() => handleValidation(req, true)} className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors">
                                            {req.status === 'PENDING_CADRE' ? 'Pré-valider' : 'Valider'}
                                         </button>
                                     </div>
                                 </div>
                             ))
                         )}
                    </div>
                )}

                {/* --- CALENDAR --- */}
                {mode === 'calendar' && (
                     <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded border">
                                <button onClick={() => handleCalNavigate('prev')}><ChevronLeft className="w-4 h-4" /></button>
                                <span className="text-sm font-semibold min-w-[150px] text-center capitalize">{calLabel}</span>
                                <button onClick={() => handleCalNavigate('next')}><ChevronRight className="w-4 h-4" /></button>
                            </div>
                            {activeServiceId && (
                                <div className="text-xs text-slate-500 italic px-2">
                                    Filtré par service affecté
                                </div>
                            )}
                        </div>
                        {/* We use filteredEmployees to only show relevant people */}
                        <LeaveCalendar employees={filteredEmployees} startDate={calStartDate} days={calDays} />
                    </div>
                )}

                {/* --- COUNTERS --- */}
                {mode === 'counters' && (
                    <div>
                         {(currentUser.role === 'ADMIN' || currentUser.role === 'DIRECTOR' || currentUser.role === 'CADRE') && (
                            <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)} className="w-full p-2 border rounded mb-4">
                                <option value="">-- Choisir un collaborateur --</option>
                                {/* Only show filtered list */}
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
                                         <div key={key} className="bg-slate-50 p-4 rounded border text-center">
                                             <div className="text-2xl font-bold text-blue-600">
                                                 {getCounterDisplay(val)}
                                             </div>
                                             <div className="text-xs text-slate-500 uppercase">{key}</div>
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
