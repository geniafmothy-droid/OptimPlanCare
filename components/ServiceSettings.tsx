
import React, { useState, useEffect } from 'react';
import { Service, Skill, Employee, ServiceAssignment, EquityConfig, SkillRequirement } from '../types';
import { Save, Loader2, CheckCircle2, ShieldCheck, Users, Plus, Trash2, Store, Search, XCircle, AlertTriangle, X, Database, ChevronDown, ChevronUp, Pencil, Clock } from 'lucide-react';
import * as db from '../services/db';

interface ServiceSettingsProps {
    service: Service | null; 
    onReload: () => void;
}

const SQL_SCHEMA = `
-- 1. SERVICE ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.service_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date
);
ALTER TABLE ONLY public.service_assignments
    DROP CONSTRAINT IF EXISTS service_assignments_service_id_employee_id_key;
ALTER TABLE ONLY public.service_assignments
    ADD CONSTRAINT service_assignments_service_id_employee_id_key UNIQUE (service_id, employee_id, start_date);

-- 2. WORK PREFERENCES FIX (Missing Column)
ALTER TABLE public.work_preferences 
ADD COLUMN IF NOT EXISTS recurring_days integer[];

-- 3. WORK PREFERENCES RLS (Security)
ALTER TABLE public.work_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations" ON public.work_preferences
FOR ALL USING (true) WITH CHECK (true);
`;

export const ServiceSettings: React.FC<ServiceSettingsProps> = ({ onReload }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'config' | 'members' | 'equity'>('config');
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [isExpanded, setIsExpanded] = useState(true);
    
    // Creation State
    const [isCreating, setIsCreating] = useState(false);
    const [newServiceName, setNewServiceName] = useState('');

    // Config State
    const [editName, setEditName] = useState('');
    const [openDays, setOpenDays] = useState<number[]>([]);
    const [requiredSkills, setRequiredSkills] = useState<string[]>([]); // Simple list (legacy/compat)
    const [skillRequirements, setSkillRequirements] = useState<SkillRequirement[]>([]); // Detailed list
    
    // Equity State
    const [equityRules, setEquityRules] = useState<EquityConfig>({
        targetSaturdayPercentage: 50,
        targetHolidayPercentage: 50,
        targetNightPercentage: 33
    });
    const [maxConsecutiveDays, setMaxConsecutiveDays] = useState<number>(3); 

    // Reference Data
    const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
    
    // Modal States
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [showEditAssignmentModal, setShowEditAssignmentModal] = useState<{open: boolean, assignment: ServiceAssignment | null}>({open: false, assignment: null});
    const [showConfirmRemoveModal, setShowConfirmRemoveModal] = useState<{open: boolean, empId: string, empName: string, assignmentId: string}>({open: false, empId: '', empName: '', assignmentId: ''});
    const [infoModal, setInfoModal] = useState<{open: boolean, type: 'success' | 'error', message: string}>({open: false, type: 'success', message: ''});
    
    // Edit Assignment Temporary State
    const [editStart, setEditStart] = useState('');
    const [editEnd, setEditEnd] = useState('');

    // Search member
    const [memberSearch, setMemberSearch] = useState('');

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        if (selectedServiceId) {
            const svc = services.find(s => s.id === selectedServiceId);
            if (svc) {
                setEditName(svc.name);
                setOpenDays(svc.config.openDays || [1,2,3,4,5,6]);
                setRequiredSkills(svc.config.requiredSkills || []);
                setSkillRequirements(svc.config.skillRequirements || []);
                setEquityRules(svc.config.equityRules || { targetSaturdayPercentage: 50, targetHolidayPercentage: 50, targetNightPercentage: 33 });
                setMaxConsecutiveDays(svc.config.maxConsecutiveDays || 3);
                setIsCreating(false);
            }
        }
    }, [selectedServiceId, services]);

    const loadData = async () => {
        try {
            const [svcData, skillsData, empsData, assignData] = await Promise.all([
                db.fetchServices(),
                db.fetchSkills(),
                db.fetchEmployeesWithShifts(),
                db.fetchServiceAssignments()
            ]);
            setServices(svcData);
            setAvailableSkills(skillsData);
            setEmployees(empsData);
            setAssignments(assignData);
            if (!selectedServiceId && svcData.length > 0) setSelectedServiceId(svcData[0].id);
        } catch (err) { console.error(err); }
    };

    const handleCreateService = async () => {
        if (!newServiceName.trim()) return;
        setIsLoading(true);
        try {
            await db.createService(newServiceName.trim());
            setInfoModal({open: true, type: 'success', message: "Service créé avec succès."});
            setNewServiceName('');
            setIsCreating(false);
            await loadData();
            onReload();
        } catch (e: any) { setInfoModal({open: true, type: 'error', message: e.message}); } 
        finally { setIsLoading(false); }
    };

    const handleDeleteService = async (id: string) => {
        if (!confirm("Supprimer ? Irréversible.")) return;
        setIsLoading(true);
        try {
            await db.deleteService(id);
            setInfoModal({open: true, type: 'success', message: "Service supprimé."});
            setSelectedServiceId(null);
            await loadData();
            onReload();
        } catch (e: any) { setInfoModal({open: true, type: 'error', message: e.message}); } 
        finally { setIsLoading(false); }
    };

    const handleSaveConfig = async () => {
        if (!selectedServiceId) return;
        setIsLoading(true);
        try {
            await db.updateService(selectedServiceId, editName);
            await db.updateServiceConfig(selectedServiceId, { 
                openDays, 
                requiredSkills, // Keep for legacy
                skillRequirements, // Save detailed config
                equityRules,
                maxConsecutiveDays
            });
            setInfoModal({open: true, type: 'success', message: "Configuration sauvegardée avec succès."});
            await loadData();
            onReload();
        } catch (error: any) { setInfoModal({open: true, type: 'error', message: error.message}); } 
        finally { setIsLoading(false); }
    };

    // --- MEMBERS LOGIC ---
    
    // Get members of current service
    const currentMembers = assignments
        .filter(a => a.serviceId === selectedServiceId)
        .map(a => {
            const emp = employees.find(e => e.id === a.employeeId);
            return { assignment: a, emp };
        })
        .filter(item => item.emp !== undefined);

    // Get non-members for adding
    const nonMembers = employees.filter(e => !assignments.some(a => a.serviceId === selectedServiceId && a.employeeId === e.id));

    const handleAddMember = async (empId: string) => {
        if (!selectedServiceId) return;
        setIsLoading(true);
        try {
            await db.createServiceAssignment(empId, selectedServiceId, new Date().toISOString().split('T')[0]);
            setShowAddMemberModal(false);
            setInfoModal({open: true, type: 'success', message: "Agent affecté au service avec succès."});
            await loadData();
        } catch (e: any) {
            setInfoModal({open: true, type: 'error', message: "Erreur lors de l'affectation."});
        } finally {
            setIsLoading(false);
        }
    };

    const confirmRemoveMember = (empId: string, empName: string, assignmentId: string) => {
        setShowConfirmRemoveModal({ open: true, empId, empName, assignmentId });
    };

    const handleRemoveMember = async () => {
        const { assignmentId } = showConfirmRemoveModal;
        if (!assignmentId) return;
        setIsLoading(true);
        try {
            await db.deleteServiceAssignment(assignmentId);
            setShowConfirmRemoveModal({open: false, empId: '', empName: '', assignmentId: ''});
            setInfoModal({open: true, type: 'success', message: "Agent retiré de l'équipe."});
            await loadData();
        } catch (e: any) {
            setInfoModal({open: true, type: 'error', message: "Erreur lors de la suppression."});
        } finally {
            setIsLoading(false);
        }
    };

    const openEditAssignment = (assignment: ServiceAssignment) => {
        setEditStart(assignment.startDate);
        setEditEnd(assignment.endDate || '');
        setShowEditAssignmentModal({open: true, assignment});
    };

    const handleUpdateAssignment = async () => {
        const { assignment } = showEditAssignmentModal;
        if (!assignment || !editStart) return;
        setIsLoading(true);
        try {
            await db.updateServiceAssignment(assignment.id, assignment.employeeId, assignment.serviceId, editStart, editEnd);
            setShowEditAssignmentModal({open: false, assignment: null});
            setInfoModal({open: true, type: 'success', message: "Affectation mise à jour."});
            await loadData();
        } catch (e: any) {
            setInfoModal({open: true, type: 'error', message: "Erreur de mise à jour."});
        } finally {
            setIsLoading(false);
        }
    };

    const daysOfWeek = [
        { id: 1, label: 'Lundi' }, { id: 2, label: 'Mardi' }, { id: 3, label: 'Mercredi' }, 
        { id: 4, label: 'Jeudi' }, { id: 5, label: 'Vendredi' }, { id: 6, label: 'Samedi' }, { id: 0, label: 'Dimanche' },
    ];

    const toggleDay = (dayId: number) => {
        setOpenDays(prev => prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]);
    };

    // Toggle skill in both Simple List and Detailed List
    const toggleSkill = (skillCode: string) => {
        // Update simple list
        setRequiredSkills(prev => prev.includes(skillCode) ? prev.filter(s => s !== skillCode) : [...prev, skillCode]);
        
        // Update detailed list
        setSkillRequirements(prev => {
            if (prev.some(req => req.skillCode === skillCode)) {
                return prev.filter(req => req.skillCode !== skillCode);
            } else {
                // Add default requirement
                return [...prev, { skillCode, minStaff: 1, startTime: '08:00', endTime: '16:00' }];
            }
        });
    };

    const updateSkillReq = (skillCode: string, field: keyof SkillRequirement, value: string | number) => {
        setSkillRequirements(prev => prev.map(req => {
            if (req.skillCode === skillCode) {
                return { ...req, [field]: value };
            }
            return req;
        }));
    };

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col transition-all ${isExpanded ? 'h-[700px]' : 'h-16'}`}>
            {/* Header / Toggle Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-700"><Store className="w-5 h-5" /></div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg">Services & Équipes</h3>
                </div>
                <div className="text-slate-400 hover:text-slate-600">
                    {isExpanded ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                </div>
            </div>

            {/* Content (Only if Expanded) */}
            <div className={`flex flex-1 overflow-hidden ${!isExpanded && 'hidden'}`}>
                {/* Sidebar List */}
                <div className="w-64 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col">
                    <div className="p-4 border-b">
                        <button onClick={() => { setIsCreating(true); setSelectedServiceId(null); }} className="w-full bg-white border border-slate-300 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50">
                            <Plus className="w-4 h-4" /> Nouveau Service
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {services.map(svc => (
                            <button key={svc.id} onClick={() => { setSelectedServiceId(svc.id); setIsCreating(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between group transition-colors ${selectedServiceId === svc.id ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                                <span>{svc.name}</span>
                                {selectedServiceId === svc.id && <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleDeleteService(svc.id); }} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-800 relative">
                    
                    {/* INFO MODAL */}
                    {infoModal.open && (
                        <div className="absolute top-4 right-4 z-50 animate-in slide-in-from-top-5">
                            <div className={`p-4 rounded-lg shadow-lg border flex items-center gap-3 ${infoModal.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                {infoModal.type === 'success' ? <CheckCircle2 className="w-5 h-5"/> : <XCircle className="w-5 h-5"/>}
                                <span className="font-medium text-sm">{infoModal.message}</span>
                                <button onClick={() => setInfoModal({...infoModal, open: false})}><X className="w-4 h-4 opacity-50 hover:opacity-100"/></button>
                            </div>
                        </div>
                    )}

                    {/* ADD MEMBER MODAL */}
                    {showAddMemberModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
                                <div className="p-4 border-b flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800">Ajouter un membre</h3>
                                    <button onClick={() => setShowAddMemberModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button>
                                </div>
                                <div className="p-4 border-b">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                        <input type="text" placeholder="Rechercher..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} className="w-full pl-9 p-2 border rounded-lg text-sm" />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2">
                                    {nonMembers.filter(e => e.name.toLowerCase().includes(memberSearch.toLowerCase())).map(emp => (
                                        <div key={emp.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg">
                                            <div>
                                                <div className="font-bold text-sm text-slate-800">{emp.name}</div>
                                                <div className="text-xs text-slate-500">{emp.role}</div>
                                            </div>
                                            <button onClick={() => handleAddMember(emp.id)} className="bg-blue-100 text-blue-700 p-1.5 rounded-lg hover:bg-blue-200"><Plus className="w-4 h-4"/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EDIT ASSIGNMENT MODAL */}
                    {showEditAssignmentModal.open && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                                <h3 className="text-lg font-bold text-slate-800 mb-4">Modifier l'affectation</h3>
                                <div className="space-y-3 mb-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Date de début</label>
                                        <input type="date" value={editStart} onChange={e => setEditStart(e.target.value)} className="w-full p-2 border rounded" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Date de fin (Optionnel)</label>
                                        <input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="w-full p-2 border rounded" />
                                    </div>
                                </div>
                                <div className="flex gap-3 justify-end">
                                    <button onClick={() => setShowEditAssignmentModal({open: false, assignment: null})} className="px-4 py-2 border rounded hover:bg-slate-50 text-sm">Annuler</button>
                                    <button onClick={handleUpdateAssignment} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Enregistrer</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONFIRM REMOVE MODAL */}
                    {showConfirmRemoveModal.open && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="w-6 h-6 text-red-600"/>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmer la suppression ?</h3>
                                <p className="text-sm text-slate-500 mb-6">
                                    Voulez-vous vraiment retirer <strong>{showConfirmRemoveModal.empName}</strong> de ce service ?
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <button onClick={() => setShowConfirmRemoveModal({open: false, empId: '', empName: '', assignmentId: ''})} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50">Annuler</button>
                                    <button onClick={handleRemoveMember} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm">Confirmer</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isCreating ? (
                        <div className="p-8 max-w-md mx-auto w-full mt-10">
                            <h3 className="text-xl font-bold mb-6">Nouveau Service</h3>
                            <input type="text" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} className="w-full p-2 border rounded-lg mb-4" placeholder="Nom du service" />
                            <button onClick={handleCreateService} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Créer</button>
                        </div>
                    ) : selectedServiceId ? (
                        <div className="flex flex-col h-full">
                            <div className="p-6 border-b flex justify-between items-start bg-slate-50">
                                <div>
                                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="text-3xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:outline-none text-slate-800" />
                                </div>
                                <div className="flex bg-white rounded-lg p-1 border shadow-sm">
                                    <button onClick={() => setActiveTab('config')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'config' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Général</button>
                                    <button onClick={() => setActiveTab('equity')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'equity' ? 'bg-purple-50 text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}>Règles & Équité</button>
                                    <button onClick={() => setActiveTab('members')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'members' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Membres ({currentMembers.length})</button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8">
                                {activeTab === 'config' && (
                                    <div className="space-y-10 max-w-4xl">
                                        <section>
                                            <div className="flex items-center gap-2 text-green-600 font-bold mb-4">
                                                <CheckCircle2 className="w-5 h-5" /> Jours d'ouverture
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {daysOfWeek.map(day => (
                                                    <button key={day.id} onClick={() => toggleDay(day.id)} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${openDays.includes(day.id) ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{day.label}</button>
                                                ))}
                                            </div>
                                        </section>
                                        <section>
                                            <div className="flex items-center gap-2 text-purple-700 font-bold mb-4">
                                                <ShieldCheck className="w-5 h-5" /> Compétences & Amplitudes
                                            </div>
                                            
                                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-slate-50 text-slate-500 uppercase font-medium">
                                                        <tr>
                                                            <th className="p-3 w-10">Actif</th>
                                                            <th className="p-3">Compétence</th>
                                                            <th className="p-3 w-32">Effectif Min</th>
                                                            <th className="p-3 w-40">Début</th>
                                                            <th className="p-3 w-40">Fin</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {availableSkills.map(s => {
                                                            const isSelected = requiredSkills.includes(s.code);
                                                            const req = skillRequirements.find(r => r.skillCode === s.code);
                                                            
                                                            return (
                                                                <tr key={s.id} className={isSelected ? 'bg-purple-50/50' : ''}>
                                                                    <td className="p-3 text-center">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={isSelected} 
                                                                            onChange={() => toggleSkill(s.code)}
                                                                            className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                                        />
                                                                    </td>
                                                                    <td className="p-3 font-medium text-slate-700">
                                                                        {s.label} <span className="text-slate-400 text-xs">({s.code})</span>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <input 
                                                                            type="number" 
                                                                            min="0"
                                                                            disabled={!isSelected}
                                                                            value={req?.minStaff || 0}
                                                                            onChange={(e) => updateSkillReq(s.code, 'minStaff', parseInt(e.target.value))}
                                                                            className="w-full p-1.5 border rounded text-center disabled:bg-slate-100 disabled:text-slate-400"
                                                                        />
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <div className="relative">
                                                                            <Clock className="w-3 h-3 text-slate-400 absolute left-2 top-2.5"/>
                                                                            <input 
                                                                                type="time" 
                                                                                disabled={!isSelected}
                                                                                value={req?.startTime || '00:00'}
                                                                                onChange={(e) => updateSkillReq(s.code, 'startTime', e.target.value)}
                                                                                className="w-full pl-6 p-1.5 border rounded text-xs disabled:bg-slate-100 disabled:text-slate-400"
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <div className="relative">
                                                                            <Clock className="w-3 h-3 text-slate-400 absolute left-2 top-2.5"/>
                                                                            <input 
                                                                                type="time" 
                                                                                disabled={!isSelected}
                                                                                value={req?.endTime || '00:00'}
                                                                                onChange={(e) => updateSkillReq(s.code, 'endTime', e.target.value)}
                                                                                className="w-full pl-6 p-1.5 border rounded text-xs disabled:bg-slate-100 disabled:text-slate-400"
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>
                                        <div className="flex justify-end pt-6">
                                            <button onClick={handleSaveConfig} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold shadow-md hover:bg-blue-700 flex items-center gap-2"><Save className="w-5 h-5" /> Sauvegarder Configuration</button>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'equity' && (
                                    <div className="space-y-6 max-w-2xl">
                                        <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                                            <h3 className="font-bold text-purple-900 mb-4">Taux d'Équité Cibles</h3>
                                            <div className="space-y-6">
                                                <div><label className="flex justify-between mb-2 text-sm font-medium text-purple-800"><span>Samedis Travaillés</span><span>{equityRules.targetSaturdayPercentage}%</span></label><input type="range" className="w-full accent-purple-600" min="0" max="100" value={equityRules.targetSaturdayPercentage} onChange={e => setEquityRules({...equityRules, targetSaturdayPercentage: parseInt(e.target.value)})} /></div>
                                                <div><label className="flex justify-between mb-2 text-sm font-medium text-purple-800"><span>Jours Fériés Travaillés</span><span>{equityRules.targetHolidayPercentage}%</span></label><input type="range" className="w-full accent-purple-600" min="0" max="100" value={equityRules.targetHolidayPercentage} onChange={e => setEquityRules({...equityRules, targetHolidayPercentage: parseInt(e.target.value)})} /></div>
                                                <div><label className="flex justify-between mb-2 text-sm font-medium text-purple-800"><span>Nuits / Soirées (S)</span><span>{equityRules.targetNightPercentage}%</span></label><input type="range" className="w-full accent-purple-600" min="0" max="100" value={equityRules.targetNightPercentage} onChange={e => setEquityRules({...equityRules, targetNightPercentage: parseInt(e.target.value)})} /></div>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-3">Règles de Planning</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="p-3 border rounded-lg bg-slate-50"><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Jours Consécutifs Max</label><input type="number" value={maxConsecutiveDays} onChange={(e) => setMaxConsecutiveDays(parseInt(e.target.value))} className="w-full p-2 border rounded" min={1} max={7} /></div>
                                            </div>
                                        </div>
                                        <button onClick={handleSaveConfig} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-purple-700">Enregistrer Règles</button>
                                    </div>
                                )}

                                {activeTab === 'members' && (
                                    <div>
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="font-bold text-slate-800">Équipe affectée</h3>
                                            <button onClick={() => setShowAddMemberModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-green-700 flex items-center gap-2">
                                                <Plus className="w-4 h-4" /> Ajouter Membre
                                            </button>
                                        </div>
                                        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-slate-500 uppercase font-medium">
                                                    <tr>
                                                        <th className="p-4">Nom</th>
                                                        <th className="p-4">Début</th>
                                                        <th className="p-4">Fin</th>
                                                        <th className="p-4 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {currentMembers.length === 0 ? (
                                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">Aucun membre affecté.</td></tr>
                                                    ) : (
                                                        currentMembers.map(item => (
                                                            <tr key={item.assignment.id} className="hover:bg-slate-50">
                                                                <td className="p-4 font-bold text-slate-700">{item.emp?.name} <span className="text-xs text-slate-400 font-normal">({item.emp?.role})</span></td>
                                                                <td className="p-4">{item.assignment.startDate}</td>
                                                                <td className="p-4 text-slate-500 italic">{item.assignment.endDate || '—'}</td>
                                                                <td className="p-4 text-right flex justify-end gap-2">
                                                                    <button onClick={() => openEditAssignment(item.assignment)} className="text-blue-400 hover:text-blue-600 p-2 rounded hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                                                                    <button onClick={() => item.emp && confirmRemoveMember(item.emp.id, item.emp.name, item.assignment.id)} className="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        {currentMembers.length === 0 && (
                                            <div className="mt-6 p-4 bg-yellow-50 text-yellow-900 text-xs rounded border border-yellow-200">
                                                <div className="flex items-center gap-2 font-bold mb-2"><Database className="w-4 h-4" /> Aide Base de Données</div>
                                                <details><summary className="cursor-pointer font-semibold underline text-yellow-700">Voir le script SQL de création</summary><pre className="bg-slate-800 text-green-400 p-3 rounded mt-2 overflow-x-auto text-[10px] font-mono leading-relaxed">{SQL_SCHEMA}</pre></details>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : <div className="flex-1 flex items-center justify-center text-slate-400">Sélectionnez un service</div>}
                </div>
            </div>
        </div>
    );
};
