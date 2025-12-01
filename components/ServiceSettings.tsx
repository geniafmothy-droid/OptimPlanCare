import React, { useState, useEffect } from 'react';
import { Service, Skill, Employee, ServiceAssignment } from '../types';
import { Settings, Save, Loader2, CheckCircle2, ShieldCheck, Users, Plus, Trash2, Calendar, Store, Edit2 } from 'lucide-react';
import * as db from '../services/db';

interface ServiceSettingsProps {
    service: Service | null; // Currently active service (from global state), mostly for initial selection if needed
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
            await db.createServiceAssignment(assignEmpId, selectedServiceId, assignStart, assignEnd || undefined);
            setAssignEmpId('');
            setAssignStart('');
            setAssignEnd('');
            await loadAssignments(); // Reload assignments
            setMessage("Membre affecté au service.");
            setTimeout(() => setMessage(null), 3000);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Re-fetch just assignments if needed
    const loadAssignments = async () => {
         const data = await db.fetchServiceAssignments();
         setAssignments(data);
    };

    const handleDeleteAssignment = async (id: string) => {
        if(!confirm("Retirer ce membre du service ?")) return;
        try {
            await db.deleteServiceAssignment(id);
            await loadAssignments();
        } catch (e: any) {
            alert(e.message);
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
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex h-[600px]">
            
            {/* Sidebar List */}
            <div className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col">
                <div className="p-4 border-b border-slate-200">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
                        <Store className="w-5 h-5 text-blue-600" />
                        Services
                    </h3>
                    <button 
                        onClick={() => { setIsCreating(true); setSelectedServiceId(null); }}
                        className="w-full bg-white border border-slate-300 hover:border-blue-400 text-slate-600 hover:text-blue-600 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
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
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'text-slate-600 hover:bg-slate-100'
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
            <div className="flex-1 flex flex-col overflow-hidden">
                {isCreating ? (
                    <div className="p-8 max-w-md mx-auto w-full">
                        <h3 className="text-xl font-bold text-slate-800 mb-6">Créer un nouveau service</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nom du service</label>
                                <input 
                                    type="text" 
                                    value={newServiceName}
                                    onChange={(e) => setNewServiceName(e.target.value)}
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="ex: Cardiologie"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button 
                                    onClick={() => setIsCreating(false)}
                                    className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
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
                        <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-white">
                            <div className="flex-1 mr-8">
                                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Nom du service</label>
                                <input 
                                    type="text" 
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="text-2xl font-bold text-slate-800 w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent transition-colors"
                                />
                            </div>
                            <div className="flex bg-slate-100 rounded-lg p-1 shrink-0">
                                <button 
                                    onClick={() => setActiveTab('config')}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Configuration
                                </button>
                                <button 
                                    onClick={() => setActiveTab('members')}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'members' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Affectation Équipe
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {message && (
                                <div className="mb-6 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
                                    <CheckCircle2 className="w-4 h-4" /> {message}
                                </div>
                            )}

                            {activeTab === 'config' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-200">
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
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
                                                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {day.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <hr className="border-slate-100" />

                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-purple-600" /> Compétences Requises
                                        </h4>
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
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
                                                                    ? 'bg-purple-100 text-purple-800 border-purple-200 ring-1 ring-purple-200'
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            {skill.code}
                                                            {isSelected && <span className="ml-1.5 text-purple-600">✓</span>}
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
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                            <Plus className="w-4 h-4 text-blue-600" /> Affecter un employé
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Employé</label>
                                                <select value={assignEmpId} onChange={(e) => setAssignEmpId(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                                                    <option value="">-- Choisir --</option>
                                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Début (Inclus)</label>
                                                <input type="date" value={assignStart} onChange={(e) => setAssignStart(e.target.value)} className="w-full p-2 border rounded text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Fin (Optionnel)</label>
                                                <input type="date" value={assignEnd} onChange={(e) => setAssignEnd(e.target.value)} className="w-full p-2 border rounded text-sm" />
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleAddAssignment} 
                                            disabled={!assignEmpId || !assignStart || isLoading}
                                            className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                                        >
                                            Affecter au service
                                        </button>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                            <Users className="w-4 h-4 text-slate-500" /> Membres affectés ({activeAssignments.length})
                                        </h4>
                                        <div className="overflow-hidden border border-slate-200 rounded-lg">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                                    <tr>
                                                        <th className="px-4 py-3">Employé</th>
                                                        <th className="px-4 py-3">Période</th>
                                                        <th className="px-4 py-3 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {activeAssignments.map(a => {
                                                        const emp = employees.find(e => e.id === a.employeeId);
                                                        return (
                                                            <tr key={a.id} className="bg-white hover:bg-slate-50">
                                                                <td className="px-4 py-3 font-medium text-slate-800">{emp?.name || 'Inconnu'}</td>
                                                                <td className="px-4 py-3 text-slate-600 flex items-center gap-2">
                                                                    <Calendar className="w-3 h-3 text-slate-400" />
                                                                    {new Date(a.startDate).toLocaleDateString()} 
                                                                    <span className="text-slate-300">➜</span> 
                                                                    {a.endDate ? new Date(a.endDate).toLocaleDateString() : 'Indéfini'}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <button onClick={() => handleDeleteAssignment(a.id)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
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
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                        <Settings className="w-12 h-12 mb-4 text-slate-300" />
                        <p>Sélectionnez un service à gauche pour le configurer</p>
                        <p className="text-sm">ou créez-en un nouveau</p>
                    </div>
                )}
            </div>
        </div>
    );
};
