

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Employee, ShiftCode, LeaveData, ViewMode, LeaveCounters, LeaveRequestWorkflow, UserRole, AppNotification, LeaveRequestStatus, ServiceAssignment } from '../types';
import { Calendar, Upload, CheckCircle2, AlertTriangle, History, Settings, LayoutGrid, Filter, ChevronLeft, ChevronRight, Trash2, Save, Send, XCircle, Check, AlertOctagon, Edit2, X } from 'lucide-react';
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
    const defaultMode = (currentUser.role === 'INFIRMIER' || currentUser.role === 'AIDE_SOIGNANT') ? 'my_requests' : 'validation';

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
    
    // Editing state
    const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

    // Validation Modal State
    const [validationModal, setValidationModal] = useState<{ isOpen: boolean, req: LeaveRequestWorkflow | null, isApprove: boolean } | null>(null);
    const [refusalReason, setRefusalReason] = useState('');

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
                if (['CA', 'RH', 'RC', 'NT', 'FO', 'HS', 'F'].includes(shift)) {
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

    const handleCreateOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser.employeeId || !startDate || !endDate) return;

        setIsLoading(true);
        try {
            const me = employees.find(e => e.id === currentUser.employeeId);
            const isSickLeave = leaveType === 'NT';

            // DÉFINITION DU WORKFLOW HIÉRARCHIQUE
            let initialStatus: LeaveRequestStatus = 'PENDING_CADRE';
            let recipientRole: UserRole | 'DG' = 'CADRE';
            let notifTitle = editingRequestId ? 'Modification Demande' : 'Nouvelle Demande';

            if (isSickLeave) {
                initialStatus = 'VALIDATED'; // Auto-validé
                recipientRole = 'CADRE'; 
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
                    // Note: In a real app, modification might reset validation status.
                    // Here we assume modifying resets it to initial step.
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
                
                // NOTIFICATIONS (Simulated logic similar to Create)
                await db.createNotification({
                    recipientRole: recipientRole === 'DG' ? 'ADMIN' : recipientRole,
                    title: notifTitle,
                    message: `${me!.name} a ${editingRequestId ? 'modifié' : 'créé'} une demande de ${leaveType}.`,
                    type: 'info',
                    actionType: 'LEAVE_VALIDATION',
                    entityId: req.id
                });
                setMessage({ text: "Demande envoyée.", type: 'success' });
            }
            
            // Reset Form
            setStartDate('');
            setEndDate('');
            setEditingRequestId(null);
            setLeaveType('CA');
            loadRequests();
        } catch (err: any) {
            setMessage({ text: err.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
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
            loadRequests();
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

            if (isApprove) {
                if (req.status === 'PENDING_CADRE') {
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
                     newStatus = 'VALIDATED';
                     await db.saveLeaveRange(req.employeeId, req.startDate, req.endDate, req.type);
                }
            }

            await db.updateLeaveRequestStatus(req.id, newStatus, commentToSave);
            
            await db.createNotification({ 
                recipientId: req.employeeId, 
                title: isApprove ? 'Validation Congés' : 'Refus Congés', 
                message: notifMsg, 
                type: isApprove ? 'success' : 'error' 
            } as any);
            
            setMessage({ text: isApprove ? "Demande traitée." : "Refus enregistré.", type: isApprove ? 'success' : 'warning' });
            setValidationModal(null);
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
                setMessage({ text: "Import des demandes de congés effectué (Simulation).", type: 'success' });
            }
        };
        reader.readAsText(file);
    };

    const myRequests = requests.filter(r => r.employeeId === currentUser.employeeId);
    
    const requestsToValidate = requests.filter(r => {
        if (currentUser.role === 'CADRE') return r.status === 'PENDING_CADRE';
        if (currentUser.role === 'DIRECTOR') return r.status === 'PENDING_DIRECTOR';
        if (currentUser.role === 'ADMIN') return r.status === 'PENDING_DG' || r.status === 'PENDING_DIRECTOR' || r.status === 'PENDING_CADRE'; 
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
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${validationModal.isApprove ? 'text-green-600' : 'text-red-600'}`}>
                            {validationModal.isApprove ? <CheckCircle2 className="w-5 h-5"/> : <XCircle className="w-5 h-5"/>}
                            {validationModal.isApprove ? 'Confirmer Validation' : 'Refuser la Demande'}
                        </h3>
                        
                        <div className="bg-slate-50 p-3 rounded mb-4 text-sm">
                            <p><strong>{validationModal.req?.employeeName}</strong></p>
                            <p>{validationModal.req?.type} : {validationModal.req?.startDate} au {validationModal.req?.endDate}</p>
                        </div>

                        {!validationModal.isApprove && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Motif du refus (Obligatoire)</label>
                                <textarea 
                                    value={refusalReason}
                                    onChange={(e) => setRefusalReason(e.target.value)}
                                    className="w-full border rounded p-2 text-sm"
                                    rows={3}
                                    placeholder="Ex: Effectif insuffisant..."
                                    autoFocus
                                />
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setValidationModal(null)} className="px-4 py-2 rounded border hover:bg-slate-50 text-slate-600">Annuler</button>
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
                    <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : message.type === 'info' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : message.type === 'info' ? <AlertOctagon className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4" />}
                        {message.text}
                    </div>
                )}

                {/* --- MY REQUESTS --- */}
                {mode === 'my_requests' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg">{editingRequestId ? 'Modifier la demande' : 'Nouvelle Demande'}</h3>
                                {editingRequestId && (
                                    <button onClick={cancelEdit} className="text-xs text-red-500 hover:underline">Annuler modif</button>
                                )}
                            </div>
                            <form onSubmit={handleCreateOrUpdate} className={`space-y-4 bg-slate-50 p-4 rounded-lg border ${editingRequestId ? 'border-blue-300 ring-1 ring-blue-100' : ''}`}>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Type</label>
                                    <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full p-2 border rounded">
                                        <option value="CA">Congés Annuels (CA)</option>
                                        <option value="RTT">RTT</option>
                                        <option value="HS">Hors Saison (HS)</option>
                                        <option value="RC">Repos Cycle (RC)</option>
                                        <option value="NT">Maladie (Arrêt)</option>
                                        <option value="F">Férié (F)</option>
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
                                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex justify-center gap-2 items-center">
                                    {isLoading && <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>}
                                    {editingRequestId ? 'Mettre à jour' : 'Envoyer'}
                                </button>
                            </form>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-4">Historique</h3>
                            {myRequests.map(req => {
                                const isPending = req.status.startsWith('PENDING');
                                return (
                                    <div key={req.id} className="border p-3 rounded-lg flex flex-col mb-2 bg-slate-50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-slate-700">{req.type}</div>
                                                <div className="text-sm text-slate-500">{new Date(req.startDate).toLocaleDateString()} au {new Date(req.endDate).toLocaleDateString()}</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`text-xs p-1 rounded font-bold ${
                                                    req.status === 'VALIDATED' ? 'bg-green-100 text-green-700' : 
                                                    req.status === 'REFUSED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
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
                                            <div className="mt-2 text-xs text-slate-600 border-t pt-2 italic">
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
                                         <button onClick={() => openValidationModal(req, false)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors">Refuser</button>
                                         <button onClick={() => openValidationModal(req, true)} className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors">
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
                        <LeaveCalendar employees={filteredEmployees} startDate={calStartDate} days={calDays} />
                    </div>
                )}

                {/* --- COUNTERS --- */}
                {mode === 'counters' && (
                    <div>
                         {(currentUser.role === 'ADMIN' || currentUser.role === 'DIRECTOR' || currentUser.role === 'CADRE') && (
                            <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)} className="w-full p-2 border rounded mb-4">
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