
import React, { useState, useEffect } from 'react';
import { Service, Skill, SkillRequirement, Employee, ServiceAssignment } from '../types';
import { Clock, Save, CheckCircle2, AlertCircle, Settings, Plus, Trash2, Users, Calendar, Shield, LayoutGrid, X, Search, UserPlus, UserMinus, ArrowRight, Filter } from 'lucide-react';
import * as db from '../services/db';

interface ServiceSettingsProps {
    service: Service | null | undefined; // Passed for initial context, but we manage the list here
    onReload: () => void;
}

type TabType = 'general' | 'rules' | 'members' | 'config';

export const ServiceSettings: React.FC<ServiceSettingsProps> = ({ service: initialService, onReload }) => {
    // Global Data State
    const [services, setServices] = useState<Service[]>([]);
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [allAssignments, setAllAssignments] = useState<ServiceAssignment[]>([]);
    const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
    
    // UI State
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(initialService?.id || null);
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Editing State (Local Buffer)
    const [editName, setEditName] = useState('');
    const [config, setConfig] = useState<any>({});
    
    // Member Management State
    const [memberSearch, setMemberSearch] = useState('');
    const [showAllEmployees, setShowAllEmployees] = useState(false); // Default: Show only members
    const [assignmentModal, setAssignmentModal] = useState<{ isOpen: boolean, employee: Employee | null, currentAssignment: ServiceAssignment | null }>({ isOpen: false, employee: null, currentAssignment: null });
    const [assignStartDate, setAssignStartDate] = useState('');
    const [assignEndDate, setAssignEndDate] = useState('');

    // --- INITIAL LOAD ---
    useEffect(() => {
        loadAllData();
    }, []);

    // When services load, select the first one if none selected
    useEffect(() => {
        if (services.length > 0 && !selectedServiceId) {
            handleSelectService(services[0]);
        } else if (services.length > 0 && selectedServiceId) {
            // Refresh current selection data if needed
            const s = services.find(x => x.id === selectedServiceId);
            if (s) handleSelectService(s, false); 
        }
    }, [services]);

    const loadAllData = async () => {
        setIsLoading(true);
        try {
            const [srvs, emps, assigns, skills] = await Promise.all([
                db.fetchServices(),
                db.fetchEmployeesWithShifts(),
                db.fetchServiceAssignments(),
                db.fetchSkills()
            ]);
            setServices(srvs);
            setAllEmployees(emps);
            setAllAssignments(assigns);
            setAvailableSkills(skills);
        } catch (e) {
            console.error("Error loading settings data", e);
        } finally {
            setIsLoading(false);
        }
    };

    // --- SELECTION LOGIC ---
    const handleSelectService = (s: Service, fullReset = true) => {
        setSelectedServiceId(s.id);
        if (fullReset) {
            setEditName(s.name);
            // Deep copy config with defaults to prevent undefined properties
            const defaults = { openDays: [1,2,3,4,5,6], requiredSkills: [], shiftTargets: {} };
            const merged = { ...defaults, ...(s.config || {}) };
            
            setConfig(JSON.parse(JSON.stringify(merged)));
            setNotification(null);
            setShowAllEmployees(false); // Reset filter to show only members on switch
        }
    };

    const handleCreateService = async () => {
        const name = prompt("Nom du nouveau service ?");
        if (!name) return;
        setIsLoading(true);
        try {
            await db.createService(name);
            await loadAllData(); // Refresh list
            setNotification({ type: 'success', message: "Service créé avec succès." });
        } catch (e: any) {
            setNotification({ type: 'error', message: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteService = async () => {
        if (!selectedServiceId) return;
        if (!confirm("Supprimer ce service et toutes ses configurations ?")) return;
        setIsLoading(true);
        try {
            await db.deleteService(selectedServiceId);
            setSelectedServiceId(null);
            await loadAllData();
            setNotification({ type: 'success', message: "Service supprimé." });
        } catch (e: any) {
            setNotification({ type: 'error', message: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedServiceId) return;
        setIsLoading(true);
        try {
            // 1. Update Service Name & Config
            await db.updateService(selectedServiceId, editName);
            await db.updateServiceConfig(selectedServiceId, config);

            // Note: Member assignments are now handled atomically in the modal
            
            await loadAllData();
            onReload(); // Refresh parent app
            setNotification({ type: 'success', message: "Configuration enregistrée avec succès !" });
        } catch (e: any) {
            console.error(e);
            setNotification({ type: 'error', message: "Échec de l'enregistrement : " + e.message });
        } finally {
            setIsLoading(false);
        }
    };

    // --- CONFIG HELPERS ---
    const toggleOpenDay = (dayIndex: number) => {
        const current: number[] = config.openDays || [];
        const newDays = current.includes(dayIndex) 
            ? current.filter(d => d !== dayIndex) 
            : [...current, dayIndex].sort();
        setConfig({ ...config, openDays: newDays });
    };

    const toggleSkill = (skillCode: string) => {
        const current: string[] = config.requiredSkills || [];
        const newSkills = current.includes(skillCode) 
            ? current.filter(s => s !== skillCode) 
            : [...current, skillCode];
        setConfig({ ...config, requiredSkills: newSkills });
    };

    const updateSkillReq = (skillCode: string, field: keyof SkillRequirement, value: any) => {
        const currentReqs = config.skillRequirements || [];
        const existingIndex = currentReqs.findIndex((r: SkillRequirement) => r.skillCode === skillCode);
        let newReqs = [...currentReqs];
        
        if (existingIndex >= 0) {
            newReqs[existingIndex] = { ...newReqs[existingIndex], [field]: value };
        } else {
            const newReq: SkillRequirement = { skillCode, minStaff: 0, startTime: '00:00', endTime: '00:00' };
            (newReq as any)[field] = value;
            newReqs.push(newReq);
        }
        setConfig({ ...config, skillRequirements: newReqs });
    };

    const updateShiftTarget = (dayIndex: number, skillCode: string, count: number) => {
        const currentTargets = config.shiftTargets || {};
        const dayTargets = currentTargets[dayIndex] || {};
        
        const newDayTargets = { ...dayTargets, [skillCode]: count };
        
        setConfig({
            ...config,
            shiftTargets: {
                ...currentTargets,
                [dayIndex]: newDayTargets
            }
        });
    };

    // --- MEMBER MANAGEMENT ---

    const openAssignmentModal = (emp: Employee) => {
        const existing = allAssignments.find(a => a.employeeId === emp.id && a.serviceId === selectedServiceId);
        setAssignmentModal({
            isOpen: true,
            employee: emp,
            currentAssignment: existing || null
        });
        setAssignStartDate(existing?.startDate || new Date().toISOString().split('T')[0]);
        setAssignEndDate(existing?.endDate || '');
    };

    const handleSaveAssignment = async () => {
        if (!selectedServiceId || !assignmentModal.employee) return;
        if (!assignStartDate) {
            alert("Une date de début est requise.");
            return;
        }

        setIsLoading(true);
        try {
            if (assignmentModal.currentAssignment) {
                // Update
                await db.updateServiceAssignment(
                    assignmentModal.currentAssignment.id,
                    assignmentModal.employee.id,
                    selectedServiceId,
                    assignStartDate,
                    assignEndDate || undefined
                );
                setNotification({ type: 'success', message: "Affectation mise à jour." });
            } else {
                // Create
                await db.createServiceAssignment(
                    assignmentModal.employee.id,
                    selectedServiceId,
                    assignStartDate,
                    assignEndDate || undefined
                );
                setNotification({ type: 'success', message: "Membre ajouté au service." });
            }
            setAssignmentModal({ ...assignmentModal, isOpen: false });
            await loadAllData();
            onReload();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveAssignment = async () => {
        if (!assignmentModal.currentAssignment) return;
        if (!confirm("Retirer ce membre du service ?")) return;
        
        setIsLoading(true);
        try {
            await db.deleteServiceAssignment(assignmentModal.currentAssignment.id);
            setNotification({ type: 'success', message: "Membre retiré du service." });
            setAssignmentModal({ ...assignmentModal, isOpen: false });
            await loadAllData();
            onReload();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    if (services.length === 0 && !isLoading) {
        return (
            <div className="p-8 text-center bg-white rounded-xl shadow">
                <p className="mb-4 text-slate-500">Aucun service configuré.</p>
                <button onClick={handleCreateService} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 mx-auto"><Plus className="w-4 h-4"/> Créer un service</button>
            </div>
        );
    }

    const selectedService = services.find(s => s.id === selectedServiceId);
    
    // Filter employees based on search AND assignment status (unless showAll is true)
    const filteredEmployees = allEmployees.filter(emp => {
        const search = memberSearch.toLowerCase();
        const matchesSearch = emp.name.toLowerCase().includes(search) || emp.matricule.toLowerCase().includes(search);
        const isAssigned = allAssignments.some(a => a.employeeId === emp.id && a.serviceId === selectedServiceId);

        if (showAllEmployees) {
            return matchesSearch;
        }
        return matchesSearch && isAssigned;
    });

    const activeMembersCount = allAssignments.filter(a => a.serviceId === selectedServiceId).length;

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[700px]">
            {/* LEFT SIDEBAR: SERVICE LIST */}
            <div className="w-full md:w-64 bg-white rounded-xl shadow border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <button onClick={handleCreateService} className="w-full bg-white border border-blue-200 text-blue-600 px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-50 shadow-sm transition-colors">
                        <Plus className="w-4 h-4" /> Nouveau Service
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {services.map(s => (
                        <button
                            key={s.id}
                            onClick={() => handleSelectService(s)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                                selectedServiceId === s.id 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <span>{s.name}</span>
                            {selectedServiceId === s.id && <Settings className="w-3.5 h-3.5 opacity-80" />}
                        </button>
                    ))}
                </div>
                <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
                    <button className="text-xs text-red-500 hover:underline" onClick={() => {/* Placeholder for DB Repair */}}>
                        Réparer Base
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 bg-white rounded-xl shadow border border-slate-200 flex flex-col overflow-hidden relative">
                
                {/* ASSIGNMENT MODAL */}
                {assignmentModal.isOpen && assignmentModal.employee && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Affectation Service</h3>
                                    <div className="text-sm text-blue-600 font-medium">{assignmentModal.employee.name}</div>
                                </div>
                                <button onClick={() => setAssignmentModal({...assignmentModal, isOpen: false})} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-400"/></button>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date de début</label>
                                    <input 
                                        type="date" 
                                        value={assignStartDate} 
                                        onChange={(e) => setAssignStartDate(e.target.value)} 
                                        className="w-full p-2 border rounded bg-slate-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date de fin (Optionnel)</label>
                                    <input 
                                        type="date" 
                                        value={assignEndDate} 
                                        onChange={(e) => setAssignEndDate(e.target.value)} 
                                        className="w-full p-2 border rounded bg-slate-50"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Laissez vide pour une affectation indéterminée.</p>
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end">
                                {assignmentModal.currentAssignment && (
                                    <button 
                                        onClick={handleRemoveAssignment} 
                                        disabled={isLoading}
                                        className="mr-auto px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded text-sm font-medium flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4"/> Désaffecter
                                    </button>
                                )}
                                <button 
                                    onClick={() => setAssignmentModal({...assignmentModal, isOpen: false})} 
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm font-medium"
                                >
                                    Annuler
                                </button>
                                <button 
                                    onClick={handleSaveAssignment} 
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm font-medium shadow-sm"
                                >
                                    {isLoading ? 'Enregistrement...' : 'Valider'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!selectedService ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400">Sélectionnez un service</div>
                ) : (
                    <>
                        {/* HEADER */}
                        <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom du Service</label>
                                <input 
                                    type="text" 
                                    value={editName} 
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="text-xl font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 outline-none w-full max-w-md pb-1"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={handleDeleteService} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer le service">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={handleSave} 
                                    disabled={isLoading}
                                    className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold transition-all disabled:opacity-50"
                                >
                                    {isLoading ? <span className="animate-spin">⌛</span> : <Save className="w-4 h-4" />}
                                    Enregistrer Config
                                </button>
                            </div>
                        </div>

                        {/* NOTIFICATION AREA */}
                        {notification && (
                            <div className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${notification.type === 'success' ? 'bg-green-50 text-green-700 border-b border-green-100' : 'bg-red-50 text-red-700 border-b border-red-100'}`}>
                                {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4"/> : <AlertCircle className="w-4 h-4"/>}
                                {notification.message}
                                <button onClick={() => setNotification(null)} className="ml-auto opacity-50 hover:opacity-100"><X className="w-4 h-4"/></button>
                            </div>
                        )}

                        {/* TABS HEADER */}
                        <div className="px-6 pt-4 border-b border-slate-200 flex gap-6 overflow-x-auto">
                            <button onClick={() => setActiveTab('general')} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                                <Settings className="w-4 h-4" /> Général
                            </button>
                            <button onClick={() => setActiveTab('config')} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'config' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                                <LayoutGrid className="w-4 h-4" /> Compétences & Effectifs
                            </button>
                            <button onClick={() => setActiveTab('rules')} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'rules' ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                                <Shield className="w-4 h-4" /> Règles & Équité
                            </button>
                            <button onClick={() => setActiveTab('members')} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'members' ? 'border-green-600 text-green-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                                <Users className="w-4 h-4" /> Membres ({activeMembersCount})
                            </button>
                        </div>

                        {/* TAB CONTENT */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                            
                            {/* 1. GENERAL TAB */}
                            {activeTab === 'general' && (
                                <div className="space-y-6 max-w-2xl">
                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-500"/> Jours d'ouverture</h4>
                                        <p className="text-sm text-slate-500 mb-4">Sélectionnez les jours où le service est actif. Les jours décochés seront automatiquement marqués en Repos Hebdo (RH) lors de la génération.</p>
                                        <div className="flex gap-2 flex-wrap">
                                            {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
                                                const isOpen = config.openDays?.includes(dayIdx);
                                                return (
                                                    <button
                                                        key={dayIdx}
                                                        onClick={() => toggleOpenDay(dayIdx)}
                                                        className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                                                            isOpen 
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        {daysOfWeek[dayIdx] === 'Dim' ? 'Dimanche' : daysOfWeek[dayIdx]}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 2. CONFIG TAB (SKILLS & TARGETS) */}
                            {activeTab === 'config' && (
                                <div className="space-y-8">
                                    {/* Compétences Actives */}
                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-purple-700">
                                            <CheckCircle2 className="w-5 h-5" /> Compétences & Amplitude
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-slate-500 uppercase font-medium text-xs">
                                                    <tr>
                                                        <th className="p-3 w-10">Actif</th>
                                                        <th className="p-3 w-20">Code</th>
                                                        <th className="p-3">Compétence</th>
                                                        <th className="p-3 w-32">Effectif Min (Défaut)</th>
                                                        <th className="p-3 w-32">Début</th>
                                                        <th className="p-3 w-32">Fin</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {availableSkills.map(s => {
                                                        const isSelected = config.requiredSkills?.includes(s.code);
                                                        const req = config.skillRequirements?.find((r: SkillRequirement) => r.skillCode === s.code);
                                                        return (
                                                            <tr key={s.id} className={isSelected ? 'bg-purple-50/30' : ''}>
                                                                <td className="p-3 text-center">
                                                                    <input type="checkbox" checked={!!isSelected} onChange={() => toggleSkill(s.code)} className="w-4 h-4 text-purple-600 rounded" />
                                                                </td>
                                                                <td className="p-3 font-mono font-bold text-xs">{s.code}</td>
                                                                <td className="p-3 text-slate-700">{s.label}</td>
                                                                <td className="p-3">
                                                                    <input type="number" min="0" disabled={!isSelected} value={req?.minStaff || 0} onChange={(e) => updateSkillReq(s.code, 'minStaff', parseInt(e.target.value))} className="w-full p-1.5 border rounded text-center disabled:bg-slate-50" />
                                                                </td>
                                                                <td className="p-3">
                                                                    <input type="time" disabled={!isSelected} value={req?.startTime || '00:00'} onChange={(e) => updateSkillReq(s.code, 'startTime', e.target.value)} className="w-full p-1.5 border rounded text-xs disabled:bg-slate-50" />
                                                                </td>
                                                                <td className="p-3">
                                                                    <input type="time" disabled={!isSelected} value={req?.endTime || '00:00'} onChange={(e) => updateSkillReq(s.code, 'endTime', e.target.value)} className="w-full p-1.5 border rounded text-xs disabled:bg-slate-50" />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Matrice des Objectifs Hebdomadaires */}
                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-blue-700">
                                            <LayoutGrid className="w-5 h-5" /> Objectifs Journaliers Spécifiques
                                        </h4>
                                        <p className="text-xs text-slate-500 mb-4">
                                            Définissez ici les exceptions (ex: Le lundi, il faut 2 "S" au lieu de 0). 
                                            Laissez vide pour utiliser l'effectif min par défaut défini ci-dessus.
                                        </p>
                                        
                                        {(!config.requiredSkills || config.requiredSkills.length === 0) ? (
                                            <div className="text-center p-4 bg-slate-50 text-slate-400 italic rounded">
                                                Activez d'abord des compétences ci-dessus.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm border-collapse">
                                                    <thead>
                                                        <tr>
                                                            <th className="p-2 border bg-slate-100 text-left w-32">Jour</th>
                                                            {config.requiredSkills.map((code: string) => (
                                                                <th key={code} className="p-2 border bg-slate-50 text-center w-20">
                                                                    {code}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
                                                            const isOpen = config.openDays?.includes(dayIdx);
                                                            if (!isOpen) return null; // Don't show closed days in matrix

                                                            return (
                                                                <tr key={dayIdx}>
                                                                    <td className="p-2 border font-medium text-slate-700">
                                                                        {daysOfWeek[dayIdx] === 'Dim' ? 'Dimanche' : daysOfWeek[dayIdx]}
                                                                    </td>
                                                                    {config.requiredSkills.map((code: string) => {
                                                                        const target = config.shiftTargets?.[dayIdx]?.[code];
                                                                        const defaultVal = config.skillRequirements?.find((r:any) => r.skillCode === code)?.minStaff || 0;
                                                                        
                                                                        return (
                                                                            <td key={`${dayIdx}-${code}`} className="p-1 border text-center relative group">
                                                                                <input 
                                                                                    type="number" 
                                                                                    min="0"
                                                                                    className={`w-full h-full text-center outline-none font-bold ${target !== undefined ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                                                                                    placeholder={defaultVal.toString()}
                                                                                    value={target !== undefined ? target : ''}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                                                                                        // If val is defined, update. If empty, remove key to fallback to default
                                                                                        if (val === undefined) {
                                                                                            const newTargets = {...config.shiftTargets};
                                                                                            if(newTargets[dayIdx]) {
                                                                                                delete newTargets[dayIdx][code];
                                                                                                setConfig({...config, shiftTargets: newTargets});
                                                                                            }
                                                                                        } else {
                                                                                            updateShiftTarget(dayIdx, code, val);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 3. RULES TAB */}
                            {activeTab === 'rules' && (
                                <div className="space-y-6 max-w-2xl">
                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                        <h4 className="font-bold text-slate-800 flex items-center gap-2"><Shield className="w-5 h-5 text-orange-600"/> Règles d'Équité</h4>
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Cible Samedis Travaillés (%)</label>
                                            <input 
                                                type="number" 
                                                value={config.equityRules?.targetSaturdayPercentage || 50}
                                                onChange={e => setConfig({...config, equityRules: {...config.equityRules, targetSaturdayPercentage: parseInt(e.target.value)}})}
                                                className="w-full p-2 border rounded"
                                            />
                                            <p className="text-xs text-slate-500 mt-1">Ex: 50% = 1 samedi sur 2.</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Cible Nuits (%)</label>
                                            <input 
                                                type="number" 
                                                value={config.equityRules?.targetNightPercentage || 33}
                                                onChange={e => setConfig({...config, equityRules: {...config.equityRules, targetNightPercentage: parseInt(e.target.value)}})}
                                                className="w-full p-2 border rounded"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Jours consécutifs maximum</label>
                                            <input 
                                                type="number" 
                                                value={config.maxConsecutiveDays || 5}
                                                onChange={e => setConfig({...config, maxConsecutiveDays: parseInt(e.target.value)})}
                                                className="w-full p-2 border rounded"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 4. MEMBERS TAB */}
                            {activeTab === 'members' && (
                                <div className="bg-white p-0 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full max-h-[550px]">
                                    <div className="p-4 border-b bg-slate-50 flex flex-col gap-3">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-green-600"/> Affectation des membres</h4>
                                            <div className="text-xs text-slate-500">{activeMembersCount} actifs</div>
                                        </div>
                                        
                                        {/* SEARCH BAR & FILTER */}
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                <input 
                                                    type="text" 
                                                    placeholder="Rechercher un membre par nom ou matricule..." 
                                                    value={memberSearch}
                                                    onChange={(e) => setMemberSearch(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <button 
                                                onClick={() => setShowAllEmployees(!showAllEmployees)}
                                                className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-2 transition-colors whitespace-nowrap ${showAllEmployees ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                                            >
                                                {showAllEmployees ? <UserMinus className="w-4 h-4"/> : <UserPlus className="w-4 h-4"/>}
                                                {showAllEmployees ? 'Voir Membres Uniquement' : 'Ajouter / Voir Tout'}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="overflow-y-auto p-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {filteredEmployees.map(emp => {
                                                const existingAssignment = allAssignments.find(a => a.employeeId === emp.id && a.serviceId === selectedServiceId);
                                                const isAssigned = !!existingAssignment;
                                                
                                                // Check if assigned elsewhere
                                                const assignedOther = allAssignments.find(a => a.employeeId === emp.id && a.serviceId !== selectedServiceId);
                                                
                                                return (
                                                    <div 
                                                        key={emp.id} 
                                                        onClick={() => openAssignmentModal(emp)}
                                                        className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-all group ${
                                                            isAssigned 
                                                            ? 'bg-green-50 border-green-200 ring-1 ring-green-200' 
                                                            : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-blue-300'
                                                        }`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isAssigned ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                                                            {isAssigned ? <CheckCircle2 className="w-4 h-4" /> : emp.name.charAt(0)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className={`text-sm font-bold truncate ${isAssigned ? 'text-green-800' : 'text-slate-700'}`}>{emp.name}</div>
                                                            <div className="text-xs text-slate-500 flex justify-between items-center">
                                                                <span>{emp.role}</span>
                                                                {isAssigned && (
                                                                    <span className="text-[10px] text-green-600 font-medium bg-green-100 px-1.5 rounded">
                                                                        {existingAssignment?.startDate ? new Date(existingAssignment.startDate).toLocaleDateString() : 'Active'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {assignedOther && !isAssigned && <div className="text-orange-500 text-[10px] italic mt-0.5">Déjà affecté ailleurs</div>}
                                                        </div>
                                                        <div className="opacity-0 group-hover:opacity-100 text-slate-400">
                                                            {isAssigned ? <Settings className="w-4 h-4"/> : <UserPlus className="w-4 h-4"/>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {filteredEmployees.length === 0 && (
                                                <div className="col-span-full text-center py-8 text-slate-400 italic">
                                                    {showAllEmployees ? "Aucun employé trouvé." : "Aucun membre affecté. Cliquez sur 'Ajouter / Voir Tout' pour ajouter des membres."}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
