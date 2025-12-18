
import React, { useState } from 'react';
import { UserRole } from '../types';
import { Users, Edit2, Shield, Briefcase, CheckCircle2, ChevronDown, ChevronUp, Plus, X, Stethoscope, FileText } from 'lucide-react';

interface RoleDefinition {
    id: string;
    code: string;
    label: string;
    description: string;
    isSystem: boolean;
}

const DEFAULT_ROLES: RoleDefinition[] = [
    { id: '1', code: 'ADMIN', label: 'Administrateur', description: 'Accès total à la configuration et aux données.', isSystem: true },
    { id: '2', code: 'DIRECTOR', label: 'Directeur / Directrice', description: 'Validation finale des plannings et congés. Vue globale.', isSystem: true },
    { id: '3', code: 'CADRE', label: 'Cadre de Santé', description: 'Gestion opérationnelle des équipes et validation niveau 1.', isSystem: true },
    { id: '4', code: 'INFIRMIER', label: 'Infirmier (IDE)', description: 'Personnel soignant qualifié.', isSystem: true },
    { id: '5', code: 'AIDE_SOIGNANT', label: 'Aide-Soignant (AS)', description: 'Personnel soignant assistant.', isSystem: true },
    { id: '6', code: 'AGENT_ADMIN', label: 'Agent Administratif', description: 'Gestion administrative, secrétariat.', isSystem: true },
    { id: '7', code: 'MEDECIN', label: 'Médecin', description: 'Personnel médical, prescriptions et soins.', isSystem: true },
    { id: '8', code: 'SECRETAIRE', label: 'Secrétaire', description: 'Accueil, prise de rendez-vous et gestion administrative.', isSystem: true },
];

export const RoleSettings: React.FC = () => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [roles, setRoles] = useState<RoleDefinition[]>(DEFAULT_ROLES);
    const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
    const [showAddRole, setShowAddRole] = useState(false);
    
    // New Role State
    const [newCode, setNewCode] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const handleSave = () => {
        if (!editingRole) return;
        setRoles(roles.map(r => r.id === editingRole.id ? editingRole : r));
        setEditingRole(null);
    };

    const handleAddRole = () => {
        if (!newCode || !newLabel) return;
        const newRole: RoleDefinition = {
            id: `custom-${Date.now()}`,
            code: newCode.toUpperCase(),
            label: newLabel,
            description: newDesc,
            isSystem: false
        };
        setRoles([...roles, newRole]);
        setShowAddRole(false);
        setNewCode('');
        setNewLabel('');
        setNewDesc('');
    };

    const getRoleIcon = (code: string) => {
        switch(code) {
            case 'ADMIN': return <Shield className="w-5 h-5"/>;
            case 'MEDECIN': return <Stethoscope className="w-5 h-5"/>;
            case 'SECRETAIRE': return <FileText className="w-5 h-5"/>;
            case 'AGENT_ADMIN': return <FileText className="w-5 h-5"/>;
            default: return <Users className="w-5 h-5"/>;
        }
    };

    const getRoleColor = (code: string) => {
        switch(code) {
            case 'ADMIN': return 'bg-purple-100 text-purple-600';
            case 'MEDECIN': return 'bg-teal-100 text-teal-600';
            case 'SECRETAIRE': return 'bg-pink-100 text-pink-600';
            default: return 'bg-blue-100 text-blue-600';
        }
    };

    return (
        <div className={`bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col transition-all ${isExpanded ? 'max-h-[800px]' : 'h-16'}`}>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg text-purple-700"><Briefcase className="w-5 h-5" /></div>
                    <h3 className="text-lg font-bold text-slate-800">Rôles & Fonctions</h3>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowAddRole(true); }}
                        className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-100 shadow-sm"
                    >
                        <Plus className="w-3.5 h-3.5" /> Ajouter Rôle
                    </button>
                    <div className="text-slate-400 hover:text-slate-600">
                        {isExpanded ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                    </div>
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto p-6 ${!isExpanded && 'hidden'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roles.map(role => (
                        <div key={role.id} className="border rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-all">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getRoleColor(role.code)}`}>
                                    {getRoleIcon(role.code)}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">{role.label} <span className="text-xs text-slate-400 font-normal">({role.code})</span></div>
                                    <div className="text-xs text-slate-500 line-clamp-1">{role.description}</div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setEditingRole(role)}
                                className="px-3 py-1.5 border rounded-lg hover:bg-slate-50 text-slate-600 flex items-center gap-1 text-xs"
                            >
                                <Edit2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal ADD */}
            {showAddRole && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">Nouveau Rôle</h3>
                            <button onClick={() => setShowAddRole(false)}><X className="w-5 h-5 text-slate-400"/></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Code (ex: PSY)</label>
                                <input type="text" value={newCode} onChange={e => setNewCode(e.target.value)} className="w-full p-2 border rounded uppercase" maxLength={10}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Libellé</label>
                                <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="w-full p-2 border rounded"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full p-2 border rounded" rows={2}/>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button onClick={handleAddRole} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Créer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal EDIT */}
            {editingRole && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                        <h3 className="font-bold text-xl mb-6">Configurer : {editingRole.label}</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Libellé</label>
                                <input 
                                    type="text" 
                                    value={editingRole.label}
                                    onChange={e => setEditingRole({...editingRole, label: e.target.value})}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Description / Fiche de poste</label>
                                <textarea 
                                    value={editingRole.description}
                                    onChange={e => setEditingRole({...editingRole, description: e.target.value})}
                                    className="w-full p-2 border rounded"
                                    rows={3}
                                />
                            </div>
                            {editingRole.isSystem && (
                                <div className="bg-blue-50 p-4 rounded text-sm text-blue-800">
                                    <strong>Note :</strong> Ce rôle est un rôle système. Les permissions de base sont verrouillées.
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setEditingRole(null)} className="px-4 py-2 border rounded hover:bg-slate-50">Annuler</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
