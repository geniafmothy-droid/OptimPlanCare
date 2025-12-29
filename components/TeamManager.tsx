
import React, { useState, useEffect } from 'react';
import { Employee, LeaveCounters, Skill, UserRole, RoleDefinition, Service, ServiceAssignment } from '../types';
import { Plus, Search, Edit2, Trash2, Save, X, User, Shield, Briefcase, Calculator, Tag, Percent, Store } from 'lucide-react';
import * as db from '../services/db';

interface TeamManagerProps {
    employees: Employee[];
    allSkills: Skill[];
    currentUser: { role: UserRole, employeeId?: string };
    onReload: () => void;
    services: Service[];
    assignments: ServiceAssignment[];
}

export const TeamManager: React.FC<TeamManagerProps> = ({ employees, allSkills, currentUser, onReload, services, assignments }) => {
    const isReadOnly = !(currentUser.role === 'ADMIN' || currentUser.role === 'DIRECTOR' || currentUser.role === 'CADRE' || currentUser.role === 'MANAGER');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [availableRoles, setAvailableRoles] = useState<RoleDefinition[]>([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmp, setEditingEmp] = useState<Partial<Employee> | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadRoles = async () => {
            const roles = await db.fetchRoles();
            setAvailableRoles(roles);
        };
        loadRoles();
    }, []);

    useEffect(() => {
        if (isReadOnly && currentUser.employeeId) {
            const me = employees.find(e => e.id === currentUser.employeeId);
            if (me) {
                setEditingEmp({ ...me });
                setIsModalOpen(true);
            }
        }
    }, [isReadOnly, currentUser, employees]);

    const filteredEmployees = employees.filter(emp => {
        if (roleFilter !== 'all' && emp.role !== roleFilter) return false;
        if (searchTerm && !emp.name.toLowerCase().includes(searchTerm.toLowerCase()) && !emp.matricule.includes(searchTerm)) return false;
        return true;
    });

    const handleEdit = (emp: Employee) => {
        const safeCounters = emp.leaveCounters ? { ...emp.leaveCounters } : { CA: 0, RTT: 0, HS: 0, RC: 0 };
        setEditingEmp({ 
            ...emp, 
            leaveCounters: safeCounters
        });
        setIsCreating(false);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingEmp({
            matricule: '',
            name: '',
            role: (availableRoles.length > 0 ? availableRoles.find(r => r.code === 'INFIRMIER')?.label : 'Infirmier') as any,
            fte: 1.0,
            skills: [],
            shifts: {},
            leaveCounters: { CA: 25, RTT: 0, HS: 0, RC: 0 }
        });
        setIsCreating(true);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!editingEmp || !editingEmp.name || !editingEmp.matricule) return;
        setIsSaving(true);
        try {
            await db.upsertEmployee(editingEmp as Employee);
            setIsModalOpen(false);
            onReload();
        } catch (error: any) {
            alert("Échec : " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if(!confirm("Supprimer cet employé ?")) return;
        try {
            await db.deleteEmployee(id);
            onReload();
        } catch (error: any) {
            alert(error.message);
        }
    };

    const updateCounter = (key: keyof LeaveCounters, value: string) => {
        if (!editingEmp) return;
        const num = parseFloat(value);
        const currentCounters = editingEmp.leaveCounters || { CA: 0, RTT: 0, HS: 0, RC: 0 };
        setEditingEmp({
            ...editingEmp,
            leaveCounters: { ...currentCounters, [key]: isNaN(num) ? 0 : num }
        });
    };

    const getCounterValue = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'object' && val !== null && 'reliquat' in val) return val.reliquat;
        return 0;
    };

    const toggleSkill = (skillCode: string) => {
        if (!editingEmp) return;
        const currentSkills = editingEmp.skills || [];
        const newSkills = currentSkills.includes(skillCode) 
            ? currentSkills.filter(s => s !== skillCode)
            : [...currentSkills, skillCode];
        setEditingEmp({ ...editingEmp, skills: newSkills });
    };

    const getEmployeeServices = (empId: string) => {
        const today = new Date().toISOString().split('T')[0];
        return assignments
            .filter(a => a.employeeId === empId && (!a.endDate || a.endDate >= today))
            .map(a => services.find(s => s.id === a.serviceId)?.name)
            .filter(Boolean);
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-8 max-w-7xl mx-auto">
            {!isReadOnly && (
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <User className="w-6 h-6 text-blue-600"/> Gestion de l'Équipe
                        </h2>
                        <p className="text-slate-500">Gérez les fiches et rôles de vos collaborateurs.</p>
                    </div>
                    <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium">
                        <Plus className="w-4 h-4" /> Ajouter un équipier
                    </button>
                </div>
            )}

            {!isReadOnly && (
                <div className="bg-white p-4 rounded-xl shadow border border-slate-200 mb-6 flex gap-4 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Nom ou matricule..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <select 
                        value={roleFilter} 
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 min-w-[180px]"
                    >
                        <option value="all">Tous les rôles</option>
                        {availableRoles.map(role => (
                            <option key={role.id} value={role.label}>{role.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {!isReadOnly && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-20">
                    {filteredEmployees.map(emp => {
                        const empServices = getEmployeeServices(emp.id);
                        return (
                            <div key={emp.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow group relative">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                                            {emp.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 line-clamp-1" title={emp.name}>{emp.name}</div>
                                            <div className="text-xs text-slate-500 font-mono">{emp.matricule}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete(emp.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="space-y-2 text-sm text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="font-medium">{emp.role}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Store className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                                        <span className="text-xs font-semibold text-blue-600 line-clamp-1">
                                            {empServices.length > 0 ? empServices.join(', ') : 'Non affecté'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Percent className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{Math.round(emp.fte * 100)}%</span>
                                    </div>
                                </div>
                                <button onClick={() => handleEdit(emp)} className="mt-4 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-medium rounded-lg border border-slate-200 flex items-center justify-center gap-2 transition-colors">
                                    <Edit2 className="w-3.5 h-3.5" /> Modifier
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {isModalOpen && editingEmp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                {isCreating ? <Plus className="w-5 h-5 text-blue-600"/> : <Edit2 className="w-5 h-5 text-blue-600"/>}
                                {isCreating ? 'Nouvel Employé' : `Fiche : ${editingEmp.name}`}
                            </h3>
                            {!isReadOnly && <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>}
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase border-b pb-1">
                                        <User className="w-4 h-4" /> Identité
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Nom Complet</label>
                                            <input type="text" value={editingEmp.name} onChange={e => !isReadOnly && setEditingEmp({...editingEmp, name: e.target.value})} disabled={isReadOnly} className="w-full p-2 border rounded-lg"/>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Matricule</label>
                                            <input type="text" value={editingEmp.matricule} onChange={e => !isReadOnly && setEditingEmp({...editingEmp, matricule: e.target.value})} disabled={isReadOnly} className="w-full p-2 border rounded-lg font-mono"/>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Fonction</label>
                                            <select value={editingEmp.role} onChange={e => !isReadOnly && setEditingEmp({...editingEmp, role: e.target.value as any})} disabled={isReadOnly} className="w-full p-2 border rounded-lg bg-white">
                                                {availableRoles.map(role => (
                                                    <option key={role.id} value={role.label}>{role.label}</option>
                                                ))}
                                                <option value="Intérimaire">Intérimaire</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Quotité (FTE)</label>
                                        <div className="flex items-center gap-4">
                                            <input type="range" min="0.1" max="1.0" step="0.1" value={editingEmp.fte} onChange={e => !isReadOnly && setEditingEmp({...editingEmp, fte: parseFloat(e.target.value)})} disabled={isReadOnly} className="flex-1"/>
                                            <span className="font-bold text-blue-600 w-12 text-right">{Math.round((editingEmp.fte || 1) * 100)}%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase border-b pb-1">
                                            <Tag className="w-4 h-4" /> Compétences
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {allSkills.map(skill => {
                                                const isActive = editingEmp.skills?.includes(skill.code);
                                                return (
                                                    <button key={skill.id} onClick={() => !isReadOnly && toggleSkill(skill.code)} disabled={isReadOnly} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${isActive ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                                                        {skill.code}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase border-b border-slate-200 pb-1 mb-4">
                                        <Calculator className="w-4 h-4" /> Compteurs
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white p-3 rounded shadow-sm border border-slate-100">
                                            <label className="text-xs font-semibold text-blue-600 block mb-1">CA</label>
                                            <input type="number" value={getCounterValue(editingEmp.leaveCounters?.CA)} onChange={e => !isReadOnly && updateCounter('CA', e.target.value)} disabled={isReadOnly} className="w-full text-2xl font-bold text-slate-800 outline-none bg-transparent"/>
                                        </div>
                                        <div className="bg-white p-3 rounded shadow-sm border border-slate-100">
                                            <label className="text-xs font-semibold text-orange-600 block mb-1">RTT</label>
                                            <input type="number" value={getCounterValue(editingEmp.leaveCounters?.RTT)} onChange={e => !isReadOnly && updateCounter('RTT', e.target.value)} disabled={isReadOnly} className="w-full text-2xl font-bold text-slate-800 outline-none bg-transparent"/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {!isReadOnly && (
                            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium">Annuler</button>
                                <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                                    {isSaving ? '...' : <><Save className="w-4 h-4" /> Enregistrer</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
