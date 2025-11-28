

import React, { useState, useEffect } from 'react';
import { Service, Skill } from '../types';
import { Settings, Save, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import * as db from '../services/db';

interface ServiceSettingsProps {
    service: Service | null;
    onReload: () => void;
}

export const ServiceSettings: React.FC<ServiceSettingsProps> = ({ service, onReload }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSkillsLoading, setIsSkillsLoading] = useState(true);
    const [openDays, setOpenDays] = useState<number[]>([]);
    const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
    const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
    const [message, setMessage] = useState<string | null>(null);

    // Initialize state when service changes
    useEffect(() => {
        if (service) {
            setOpenDays(service.config.openDays || [1,2,3,4,5,6]);
            setRequiredSkills(service.config.requiredSkills || []);
        }
    }, [service]);

    // Fetch skills for the selector
    useEffect(() => {
        const loadSkills = async () => {
            try {
                const data = await db.fetchSkills();
                setAvailableSkills(data);
            } catch (err) {
                console.error(err);
            } finally {
                setIsSkillsLoading(false);
            }
        };
        loadSkills();
    }, []);

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
        setOpenDays(prev => 
            prev.includes(dayId) 
                ? prev.filter(d => d !== dayId) 
                : [...prev, dayId]
        );
    };

    const toggleSkill = (skillCode: string) => {
        setRequiredSkills(prev => 
            prev.includes(skillCode)
                ? prev.filter(s => s !== skillCode)
                : [...prev, skillCode]
        );
    };

    const handleSave = async () => {
        if (!service) return;
        setIsLoading(true);
        try {
            await db.updateServiceConfig(service.id, { 
                openDays, 
                requiredSkills 
            });
            setMessage("Configuration enregistrée avec succès.");
            setTimeout(() => setMessage(null), 3000);
            onReload();
        } catch (error: any) {
            alert("Erreur: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!service) return <div className="p-8 text-center text-slate-400">Aucun service sélectionné.</div>;

    return (
        <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg">
                <Settings className="w-6 h-6 text-slate-500" />
                Configuration du Service : <span className="text-blue-600">{service.name}</span>
            </h3>
            
            <div className="space-y-8">
                {/* 1. Open Days Config */}
                <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" /> Jours d'ouverture
                    </h4>
                    <div className="flex flex-wrap gap-3">
                        {daysOfWeek.map(day => {
                            const isOpen = openDays.includes(day.id);
                            return (
                                <button
                                    key={day.id}
                                    onClick={() => toggleDay(day.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                        isOpen 
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {day.label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        Décochez les jours où le service est fermé (ex: Dimanche). Le contrôle métier s'adaptera automatiquement.
                    </p>
                </div>

                <hr className="border-slate-100" />

                {/* 2. Required Skills Config */}
                <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-purple-600" /> Compétences & Postes Requis
                    </h4>
                    
                    {isSkillsLoading ? (
                        <div className="text-sm text-slate-400">Chargement des compétences...</div>
                    ) : (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 mb-3">
                                Sélectionnez les compétences ou codes horaires spécifiques utilisés par ce service.
                            </p>
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
                                    <span className="text-xs text-slate-400 italic">Aucune compétence définie dans les paramètres généraux.</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {message && (
                <div className="mt-6 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" /> {message}
                </div>
            )}

            <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end">
                <button 
                    onClick={handleSave} 
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 shadow-sm transition-colors"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Sauvegarder Configuration
                </button>
            </div>
        </div>
    );
};