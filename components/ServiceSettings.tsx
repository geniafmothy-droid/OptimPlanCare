
import React, { useState, useEffect } from 'react';
import { Service, Skill, Employee, ServiceAssignment } from '../types';
import { Settings, Save, Loader2, CheckCircle2, ShieldCheck, Users, Plus, Trash2, Calendar, Store, Edit2, RotateCcw } from 'lucide-react';
import * as db from '../services/db';

interface ServiceSettingsProps {
    service: Service | null; // Currently active service (from global state)
    onReload: () => void;
}

export const ServiceSettings: React.FC<ServiceSettingsProps> = ({ onReload }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'config' | 'members'>('config');
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    
    // Creation State
    const [isCreating, setIsCreating] = useState(false);
    const [newServiceName, setNewServiceName] = useState('');

    // Config State (for selected service)
    const [editName, setEditName] = useState('');
    const [openDays, setOpenDays] = useState<number[]>([]);
    const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
    
    // Reference Data
    const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    
    // Assignment State
    const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
    const [assignEmpId, setAssignEmpId] = useState('');
    const [assignStart, setAssignStart] = useState('');
    const [assignEnd, setAssignEnd] = useState('');
    const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

    const [message, setMessage] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        loadData();
    }, []);

    // Effect: Update local state when selected service changes
    useEffect(() => {
        if (selectedServiceId) {
            const svc = services.find(s => s.id === selectedServiceId);
            if (svc) {
                setEditName(svc.name);
                setOpenDays(svc.config.openDays || [1,2,3,4,5,6]);
                setRequiredSkills(svc.config.requiredSkills || []);
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

            // Default selection if none
            if (!selectedServiceId && svcData.length > 0) {
                setSelectedServiceId(svcData[0].id);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateService = async () => {
        if (!newServiceName.trim()) return;
        setIsLoading(true);
        try {
            await db.createService(newServiceName.trim());
            setMessage("Service créé avec succès.");
            setNewServiceName('');
            setIsCreating(false);
            await loadData();
            setTimeout(() => setMessage(null), 3000);
            onReload(); // Refresh global app state
        } catch (e: any) {
            alert("Erreur: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteService = async (id: string) => {
        if (!confirm("Supprimer ce service ? Cette action est irréversible.")) return;
        setIsLoading(true);
        try {
            await db.deleteService(id);
            setMessage("Service supprimé.");
            setSelectedServiceId(null);
            await loadData();
            setTimeout(() => setMessage(null), 3000);
            onReload();
        } catch (e: any) {
            alert("Erreur: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        if (!selectedServiceId) return;
        setIsLoading(true);
        try {
            // Update name
            await db.updateService(selectedServiceId, editName);
            // Update config
            await db.updateServiceConfig(selectedServiceId, { openDays, requiredSkills });
            
            setMessage("Configuration enregistrée.");
            await loadData();
            setTimeout(() => setMessage(null), 3000);
            onReload();
        } catch (error: any) {
            alert("Erreur: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddAssignment = async () => {
        if (!selectedServiceId || !assignEmpId || !assignStart) return;
        setIsLoading(true);
        try {
            if (editingAssignmentId) {
                // Update existing
                await db.updateServiceAssignment(editingAssignmentId, assignEmpId, selectedServiceId, assignStart, assignEnd || undefined);
                setMessage("Affectation mise à jour.");
            } else {
                // Create new
                await db.createServiceAssignment(assignEmpId, selectedServiceId, assignStart, assignEnd || undefined);
                setMessage("Membre affecté au service.");
            }

            // Reset form
            setAssignEmpId('');
            setAssignStart('');
            setAssignEnd('');
            setEditingAssignmentId(null);
            
            await loadAssignments(); // Reload assignments
            setTimeout(() => setMessage(null), 3000);
            onReload(); // Refresh Sidebar Counters
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditAssignment = (assignment: ServiceAssignment) => {
        setAssignEmpId(assignment.employeeId);
        setAssignStart(assignment.startDate);
        setAssignEnd(assignment.endDate || '');
        setEditingAssignmentId(assignment.id);
    };

    const handleCancelEdit = () => {
        setAssignEmpId('');
        setAssignStart('');
        setAssignEnd('');
        setEditingAssignmentId(null);
    };

    // Re-fetch just assignments if needed
    const loadAssignments = async () => {
         const data = await db.fetchServiceAssignments();
         setAssignments(data);
    };

    const handleDeleteAssignment = async (id: string) => {
        if(!confirm("Retirer ce membre du service ?")) return;
        setIsLoading(true); // Show loading state
        try {
            await db.deleteServiceAssignment(id);
            await loadAssignments(); // Refresh local list
            onReload(); // Refresh global app counters
            setMessage("Affectation retirée.");
            setTimeout(() => setMessage(null), 3000);
        } catch (e: any) {
            alert("Erreur suppression: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const daysOfWeek = [
        { id: 1, label: 'Lundi' },
        { id: 2, label: 'Mardi' },
        { id: 3, label: 'Mercredi' },
        { id: 4, label: 'Jeudi' },
        { id: 5, label: 'Vendredi' },
        { id: 6, label: 'Samedi' },
        { id: 0, label: 'Dimanche' },
    ];

    const toggleDay = (dayId: number) => {
        setOpenDays(prev => prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]);
    };

    const toggleSkill = (skillCode: string) => {
        setRequiredSkills(prev => prev.includes(skillCode) ? prev.filter(s => s !== skillCode) : [...prev, skillCode]);
    };

    const activeAssignments = assignments.filter(a => a.serviceId === selectedServiceId);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-hidden flex h-[600px]">
            
            {/* Sidebar List */}
            <div className="w-64 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-4">
                        <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        Services
                    </h3>
                    <button 
                        onClick={() => { setIsCreating(true); setSelectedServiceId(null); }}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-blue-400 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> Nouveau Service
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {services.map(svc => (
                        <button
                            key={svc.id}
                            onClick={() => { setSelectedServiceId(svc.id); setIsCreating(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between group transition-colors ${
                                selectedServiceId === svc.id 
                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200' 
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <span>{svc.name}</span>
                            {selectedServiceId === svc.id && (
                                <Trash2 
                                    className="w-4 h-4 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteService(svc.id); }}
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-800">
                {isCreating ? (
                    <div className="p-8 max-w-md mx-auto w-full">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Créer un nouveau service</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom du service</label>
                                <input 
                                    type="text" 
                                    value={newServiceName}
                                    onChange={(e) => setNewServiceName(e.target.value)}
                                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                    placeholder="ex: Cardiologie"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button 
                                    onClick={() => setIsCreating(false)}
                                    className="flex-1 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                    Annuler
                                </button>
                                <button 
                                    onClick={handleCreateService}
                                    disabled={!newServiceName.trim() || isLoading}
                                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Créer'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : selectedServiceId ? (
                    <div className="flex flex-col h-full">
                        {/* Header Content */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start bg-white dark:bg-slate-800">
                            <div className="flex-1 mr-8">
                                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Nom du service</label>
                                <input 
                                    type="text" 
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="text-2xl font-bold text-slate-800 dark:text-white w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent transition-colors"
                                />
                            </div>
                            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1 shrink-0">
                                <button 
                                    onClick={() => setActiveTab('config')}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                        activeTab === 'config' 
                                        ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-200 shadow-sm' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Configuration
                                </button>
                                <button 
                                    onClick={() => setActiveTab('members')}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                        activeTab === 'members' 
                                        ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-200 shadow-sm' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Affectation Équipe
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {message && (
                                <div className="mb-6 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
                                    <CheckCircle2 className="w-4 h-4" /> {message}
                                </div>
                            )}

                            {activeTab === 'config' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-200">
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-green-600" /> Jours d'ouverture
                                        </h4>
                                        <div className="flex flex-wrap gap-3">
                                            {daysOfWeek.map(day => (
                                                <button
                                                    key={day.id}
                                                    onClick={() => toggleDay(day.id)}
                                                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                                        openDays.includes(day.id) 
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                                            : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                                                    }`}
                                                >
                                                    {day.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <hr className="border-slate-100 dark:border-slate-700" />

                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-purple-600" /> Compétences Requises
                                        </h4>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <p className="text-xs text-slate-500 mb-3">Sélectionnez les compétences nécessaires pour travailler dans ce service.</p>
                                            <div className="flex flex-wrap gap-2">
                                                {availableSkills.map(skill => {
                                                    const isSelected = requiredSkills.includes(skill.code);
                                                    return (
                                                        <button
                                                            key={skill.id}
                                                            onClick={() => toggleSkill(skill.code)}
                                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                                                isSelected
                                                                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800 ring-1 ring-purple-200 dark:ring-purple-900'
                                                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            {skill.code}
                                                            {isSelected && <span className="ml-1.5 text-purple-600 dark:text-purple-400">✓</span>}
                                                        </button>
                                                    );
                                                })}
                                                {availableSkills.length === 0 && (
                                                    <span className="text-xs text-slate-400 italic">Aucune compétence définie.</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex justify-end">
                                        <button onClick={handleSaveConfig} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-sm">
                                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Sauvegarder Configuration
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'members' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                                <Plus className="w-4 h-4 text-blue-600" /> 
                                                {editingAssignmentId ? 'Modifier Affectation' : 'Affecter un employé'}
                                            </h4>
                                            {editingAssignmentId && (
                                                <button onClick={handleCancelEdit} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                                                    <RotateCcw className="w-3 h-3"/> Annuler
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Employé</label>
                                                <select 
                                                    value={assignEmpId} 
                                                    onChange={(e) => setAssignEmpId(e.target.value)} 
                                                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                                    disabled={!!editingAssignmentId}
                                                >
                                                    <option value="">-- Choisir --</option>
                                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Début (Inclus)</label>
                                                <input type="date" value={assignStart} onChange={(e) => setAssignStart(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Fin (Optionnel)</label>
                                                <input type="date" value={assignEnd} onChange={(e) => setAssignEnd(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleAddAssignment} 
                                            disabled={!assignEmpId || !assignStart || isLoading}
                                            className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                                        >
                                            {editingAssignmentId ? 'Mettre à jour' : 'Affecter au service'}
                                        </button>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                            <Users className="w-4 h-4 text-slate-500" /> Membres affectés ({activeAssignments.length})
                                        </h4>
                                        <div className="overflow-hidden border border-slate-200 dark:border-slate-700 rounded-lg">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 dark:bg-slate-700 text-xs uppercase text-slate-500 dark:text-slate-300">
                                                    <tr>
                                                        <th className="px-4 py-3">Employé</th>
                                                        <th className="px-4 py-3">Période</th>
                                                        <th className="px-4 py-3 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                    {activeAssignments.map(a => {
                                                        const emp = employees.find(e => e.id === a.employeeId);
                                                        return (
                                                            <tr key={a.id} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{emp?.name || 'Inconnu'}</td>
                                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                                    <Calendar className="w-3 h-3 text-slate-400" />
                                                                    {new Date(a.startDate).toLocaleDateString()} 
                                                                    <span className="text-slate-300 dark:text-slate-600">➜</span> 
                                                                    {a.endDate ? new Date(a.endDate).toLocaleDateString() : 'Indéfini'}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <div className="flex justify-end gap-2">
                                                                        <button 
                                                                            onClick={() => handleEditAssignment(a)}
                                                                            className="text-blue-400 hover:text-blue-600 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                                                                            title="Modifier les dates"
                                                                        >
                                                                            <Edit2 className="w-4 h-4" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleDeleteAssignment(a.id)} 
                                                                            disabled={isLoading}
                                                                            className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-30"
                                                                            title="Supprimer l'affectation"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {activeAssignments.length === 0 && (
                                                        <tr>
                                                            <td colSpan={3} className="p-6 text-center text-slate-400 italic">Aucun membre affecté spécifiquement.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8">
                        <Settings className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-600" />
                        <p>Sélectionnez un service à gauche pour le configurer</p>
                        <p className="text-sm">ou créez-en un nouveau</p>
                    </div>
                )}
            </div>
        </div>
    );
};
