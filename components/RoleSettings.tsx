
import React, { useState } from 'react';
import { UserRole } from '../types';
import { Users, Edit2, Shield, Briefcase, CheckCircle2 } from 'lucide-react';

interface RoleDefinition {
    id: string;
    code: UserRole;
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
];

export const RoleSettings: React.FC = () => {
    const [roles, setRoles] = useState<RoleDefinition[]>(DEFAULT_ROLES);
    const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);

    const handleSave = () => {
        if (!editingRole) return;
        setRoles(roles.map(r => r.id === editingRole.id ? editingRole : r));
        setEditingRole(null);
    };

    return (
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Briefcase className="w-6 h-6 text-blue-600" /> Rôles & Fonctions
                    </h3>
                    <p className="text-sm text-slate-500">Définissez les fiches de fonctions et les niveaux d'accès.</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-4">
                    {roles.map(role => (
                        <div key={role.id} className="border rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-all">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${role.code === 'ADMIN' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {role.code === 'ADMIN' ? <Shield className="w-5 h-5"/> : <Users className="w-5 h-5"/>}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 text-lg">{role.label}</div>
                                    <div className="text-sm text-slate-500">{role.description}</div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setEditingRole(role)}
                                className="px-4 py-2 border rounded-lg hover:bg-slate-50 text-slate-600 flex items-center gap-2"
                            >
                                <Edit2 className="w-4 h-4" /> Configurer
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal Edit */}
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
                            <div className="bg-blue-50 p-4 rounded text-sm text-blue-800">
                                <strong>Note :</strong> Ce rôle est un rôle système ({editingRole.code}). Les permissions de base ne peuvent pas être modifiées dans cette version de démonstration.
                            </div>
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
