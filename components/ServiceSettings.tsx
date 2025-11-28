
import React, { useState } from 'react';
import { Service } from '../types';
import { Settings, Save, Loader2, CheckCircle2 } from 'lucide-react';
import * as db from '../services/db';

interface ServiceSettingsProps {
    service: Service | null;
    onReload: () => void;
}

export const ServiceSettings: React.FC<ServiceSettingsProps> = ({ service, onReload }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [openDays, setOpenDays] = useState<number[]>(service?.config.openDays || [1,2,3,4,5,6]);
    const [message, setMessage] = useState<string | null>(null);

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

    const handleSave = async () => {
        if (!service) return;
        setIsLoading(true);
        try {
            await db.updateServiceConfig(service.id, { openDays });
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
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-500" />
                Configuration du Service : {service.name}
            </h3>
            
            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-3">Jours d'ouverture</label>
                <div className="flex flex-wrap gap-3">
                    {daysOfWeek.map(day => {
                        const isOpen = openDays.includes(day.id);
                        return (
                            <button
                                key={day.id}
                                onClick={() => toggleDay(day.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                    isOpen 
                                        ? 'bg-blue-600 text-white border-blue-600' 
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

            {message && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {message}
                </div>
            )}

            <button 
                onClick={handleSave} 
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Sauvegarder
            </button>
        </div>
    );
};
