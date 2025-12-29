
import React, { useState } from 'react';
import { Employee, UserRole } from '../types';
import { ShieldCheck, User, Users, Activity, Stethoscope, FileText, Baby } from 'lucide-react';

interface LoginScreenProps {
    employees: Employee[];
    onLogin: (role: UserRole, employee?: Employee) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ employees, onLogin }) => {
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

    const infirmiers = employees.filter(e => 
        e.role === 'Infirmier' || 
        e.role === 'Aide-Soignant' || 
        e.role === 'Intérimaire' || 
        e.role === 'Agent Administratif'
    );
    const cadres = employees.filter(e => e.role === 'Cadre' || e.role === 'Manager');
    const directors = employees.filter(e => e.role === 'Directeur');
    const medecins = employees.filter(e => e.role === 'Médecin');
    const secretaires = employees.filter(e => e.role === 'Secrétaire');
    const sagesFemmes = employees.filter(e => e.role === 'Sage-Femme');

    const getListForRole = () => {
        if (selectedRole === 'CADRE') return cadres;
        if (selectedRole === 'DIRECTOR') return directors;
        if (selectedRole === 'MEDECIN') return medecins;
        if (selectedRole === 'SECRETAIRE') return secretaires;
        if (selectedRole === 'SAGE_FEMME') return sagesFemmes;
        return infirmiers;
    };

    const list = getListForRole();

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
                </div>

                <div className="p-8 md:w-2/3">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6">Connexion</h2>
                    
                    {!selectedRole ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button onClick={() => onLogin('ADMIN')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group">
                                <ShieldCheck className="w-8 h-8 text-purple-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Administrateur</div>
                            </button>
                            
                            <button onClick={() => setSelectedRole('DIRECTOR')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group">
                                <Users className="w-8 h-8 text-orange-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Directeur / Directrice</div>
                            </button>

                            <button onClick={() => setSelectedRole('CADRE')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group">
                                <User className="w-8 h-8 text-blue-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Cadre de Santé</div>
                            </button>

                            <button onClick={() => setSelectedRole('MEDECIN')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group">
                                <Stethoscope className="w-8 h-8 text-teal-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Médecin</div>
                            </button>

                            <button onClick={() => setSelectedRole('SAGE_FEMME')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group">
                                <Baby className="w-8 h-8 text-rose-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Sage-Femme</div>
                            </button>

                            <button onClick={() => setSelectedRole('INFIRMIER')} className="p-6 border rounded-xl hover:bg-slate-50 hover:border-blue-500 transition-all text-left group">
                                <Activity className="w-8 h-8 text-green-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="font-bold text-slate-800">Équipe Soignante</div>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <button onClick={() => setSelectedRole(null)} className="text-sm text-blue-600 hover:underline mb-2">← Retour</button>
                            <h3 className="font-semibold text-lg">Qui êtes-vous ?</h3>
                            <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                                {list.map(emp => (
                                    <button key={emp.id} onClick={() => onLogin(selectedRole, emp)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-500`}>
                                            {emp.name.charAt(0)}
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-slate-800">{emp.name}</div>
                                            <div className="text-xs text-slate-500">{emp.role}</div>
                                        </div>
                                    </button>
                                ))}
                                {list.length === 0 && <div className="text-slate-400 italic p-4 text-center border border-dashed rounded-lg">Aucun employé trouvé.</div>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
