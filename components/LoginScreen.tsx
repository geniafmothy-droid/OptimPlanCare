
import React, { useState, useMemo } from 'react';
import { Employee, UserRole } from '../types';
import { ShieldCheck, User, Users, Activity, Stethoscope, FileText, Baby, Search, X, Award } from 'lucide-react';

interface LoginScreenProps {
    employees: Employee[];
    onLogin: (role: UserRole, employee?: Employee) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ employees, onLogin }) => {
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const infirmiers = useMemo(() => employees.filter(e => 
        e.role === 'Infirmier' || 
        e.role === 'Aide-Soignant' || 
        e.role === 'Intérimaire' || 
        e.role === 'Agent Administratif'
    ), [employees]);

    const cadres = useMemo(() => employees.filter(e => 
        e.role === 'Cadre' || 
        e.role === 'Manager'
    ), [employees]);

    const cadresSup = useMemo(() => employees.filter(e => 
        e.role === 'Cadre Supérieur'
    ), [employees]);

    const directors = useMemo(() => employees.filter(e => 
        e.role === 'Directeur' || 
        e.role.toLowerCase().includes('directeur') || 
        e.role.toLowerCase().includes('directrice')
    ), [employees]);

    const medecins = useMemo(() => employees.filter(e => 
        e.role === 'Médecin'
    ), [employees]);

    const secretaires = useMemo(() => employees.filter(e => 
        e.role === 'Secrétaire'
    ), [employees]);

    const sagesFemmes = useMemo(() => employees.filter(e => 
        e.role === 'Sage-Femme'
    ), [employees]);

    const getListForRole = () => {
        let baseList: Employee[] = [];
        if (selectedRole === 'CADRE') baseList = cadres;
        else if (selectedRole === 'CADRE_SUP') baseList = cadresSup;
        else if (selectedRole === 'DIRECTOR') baseList = directors;
        else if (selectedRole === 'MEDECIN') baseList = medecins;
        else if (selectedRole === 'SECRETAIRE') baseList = secretaires;
        else if (selectedRole === 'SAGE_FEMME') baseList = sagesFemmes;
        else baseList = infirmiers;

        // Filtrage par recherche (si 3 caractères ou plus)
        if (searchTerm.length >= 3) {
            const search = searchTerm.toLowerCase();
            return baseList.filter(e => 
                e.name.toLowerCase().includes(search) || 
                e.matricule.toLowerCase().includes(search)
            );
        }

        return baseList;
    };

    const list = getListForRole();

    const handleRoleSelect = (role: UserRole) => {
        setSelectedRole(role);
        setSearchTerm(''); // Reset search on role change
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full overflow-hidden flex flex-col md:flex-row">
                <div className="bg-blue-600 text-white p-8 md:w-1/3 flex flex-col justify-between">
                    <div>
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                            <Activity className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold mb-2">OptiPlan</h1>
                        <p className="text-blue-100">Gestion intelligente des plannings hospitaliers.</p>
                    </div>
                    <div className="text-[10px] opacity-60">
                        Version 2.5.4 - Propulsé par Gemini AI
                    </div>
                </div>

                <div className="p-8 md:w-2/3 flex flex-col min-h-[500px]">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6">Connexion</h2>
                    
                    {!selectedRole ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button onClick={() => onLogin('ADMIN')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group">
                                <ShieldCheck className="w-8 h-8 text-purple-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Administrateur</div>
                                <div className="text-xs text-slate-400 mt-1">Accès total au système</div>
                            </button>
                            
                            <button onClick={() => handleRoleSelect('DIRECTOR')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group">
                                <Users className="w-8 h-8 text-orange-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Directeur / Directrice</div>
                                <div className="text-xs text-slate-400 mt-1">Pilotage et arbitrage</div>
                            </button>

                            <button onClick={() => handleRoleSelect('CADRE_SUP')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group">
                                <Award className="w-8 h-8 text-indigo-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Cadre Supérieur</div>
                                <div className="text-xs text-slate-400 mt-1">Gestion de pôle</div>
                            </button>

                            <button onClick={() => handleRoleSelect('CADRE')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group">
                                <User className="w-8 h-8 text-blue-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Cadre de Santé</div>
                                <div className="text-xs text-slate-400 mt-1">Gestion opérationnelle</div>
                            </button>

                            <button onClick={() => handleRoleSelect('MEDECIN')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group">
                                <Stethoscope className="w-8 h-8 text-teal-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Médecin</div>
                                <div className="text-xs text-slate-400 mt-1">Planning médical</div>
                            </button>

                            <button onClick={() => handleRoleSelect('SAGE_FEMME')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group">
                                <Baby className="w-8 h-8 text-rose-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Sage-Femme</div>
                                <div className="text-xs text-slate-400 mt-1">Services maternité</div>
                            </button>

                            <button onClick={() => handleRoleSelect('INFIRMIER')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group sm:col-span-2">
                                <Activity className="w-8 h-8 text-green-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Équipe Soignante</div>
                                <div className="text-xs text-slate-400 mt-1">Mon espace personnel</div>
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <button onClick={() => setSelectedRole(null)} className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1">
                                ← Retour aux rôles
                            </button>
                            
                            <div className="mb-6">
                                <h3 className="font-bold text-lg text-slate-800">Qui êtes-vous ?</h3>
                                <p className="text-sm text-slate-500">Sélectionnez votre nom dans la liste des {selectedRole === 'DIRECTOR' ? 'directeurs' : 'collaborateurs'}.</p>
                            </div>

                            {/* RECHERCHE */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Rechercher par nom..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                                    autoFocus
                                />
                                {searchTerm && (
                                    <button 
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {searchTerm.length > 0 && searchTerm.length < 3 && (
                                <div className="text-[10px] text-blue-600 font-medium mb-2 animate-pulse">
                                    Saisissez au moins 3 caractères pour filtrer...
                                </div>
                            )}

                            <div className="flex-1 max-h-[350px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {list.map(emp => (
                                    <button 
                                        key={emp.id} 
                                        onClick={() => onLogin(selectedRole, emp)} 
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all group"
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white bg-blue-500 group-hover:scale-110 transition-transform`}>
                                            {emp.name.charAt(0)}
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 truncate">{emp.name}</div>
                                            <div className="text-xs text-slate-500 flex justify-between">
                                                <span>{emp.role}</span>
                                                <span className="font-mono opacity-60">{emp.matricule}</span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                
                                {list.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                        <Users className="w-10 h-10 text-slate-300 mb-2" />
                                        <p className="text-slate-400 text-sm italic">
                                            {searchTerm.length >= 3 
                                                ? "Aucun résultat pour cette recherche." 
                                                : "Aucun profil trouvé pour ce rôle."
                                            }
                                        </p>
                                        {selectedRole === 'DIRECTOR' && (
                                            <p className="text-[10px] text-slate-400 mt-2 px-6">
                                                Vérifiez que le rôle "Directeur" est bien attribué en base de données.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
