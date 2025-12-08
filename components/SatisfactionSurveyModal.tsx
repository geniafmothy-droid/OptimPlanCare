
import React, { useState } from 'react';
import { Smile, Meh, Frown, Send, X, ThumbsUp, Scale, Briefcase } from 'lucide-react';
import * as db from '../services/db';

interface SatisfactionSurveyModalProps {
    isOpen: boolean;
    onClose: () => void;
    employeeId: string;
}

export const SatisfactionSurveyModal: React.FC<SatisfactionSurveyModalProps> = ({ isOpen, onClose, employeeId }) => {
    const [step, setStep] = useState(1);
    const [satisfaction, setSatisfaction] = useState(50);
    const [workload, setWorkload] = useState(50);
    const [balance, setBalance] = useState(50);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await db.saveSurveyResponse({
                employeeId,
                date: new Date().toISOString().split('T')[0],
                satisfaction,
                workload,
                balance,
                comment
            });
            setTimeout(() => {
                onClose();
            }, 1000); // Wait a bit to show success state if we added one, or just close
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'envoi.");
            setIsSubmitting(false);
        }
    };

    const getIconColor = (val: number) => {
        if (val < 30) return 'text-red-500';
        if (val < 70) return 'text-yellow-500';
        return 'text-green-500';
    };

    const getIcon = (val: number) => {
        if (val < 30) return <Frown className={`w-8 h-8 ${getIconColor(val)}`} />;
        if (val < 70) return <Meh className={`w-8 h-8 ${getIconColor(val)}`} />;
        return <Smile className={`w-8 h-8 ${getIconColor(val)}`} />;
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10"><X className="w-5 h-5"/></button>
                
                {/* Header */}
                <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-6 text-white text-center">
                    <h3 className="text-xl font-bold mb-1">Votre avis compte ! 💬</h3>
                    <p className="text-pink-100 text-sm">Questionnaire Flash QVT</p>
                </div>

                <div className="p-6 space-y-6">
                    {/* 1. Satisfaction */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <ThumbsUp className="w-4 h-4 text-purple-600"/> Satisfaction Globale
                            </label>
                            {getIcon(satisfaction)}
                        </div>
                        <input 
                            type="range" min="0" max="100" 
                            value={satisfaction} onChange={e => setSatisfaction(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                    </div>

                    {/* 2. Charge de travail */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-blue-600"/> Charge Ressentie
                            </label>
                            <span className="text-xs font-bold text-slate-500">{workload}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="100" 
                            value={workload} onChange={e => setWorkload(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                            <span>Légère</span>
                            <span>Intense</span>
                        </div>
                    </div>

                    {/* 3. Equilibre */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Scale className="w-4 h-4 text-green-600"/> Équilibre Vie Pro/Perso
                            </label>
                            <span className="text-xs font-bold text-slate-500">{balance}/100</span>
                        </div>
                        <input 
                            type="range" min="0" max="100" 
                            value={balance} onChange={e => setBalance(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                        />
                    </div>

                    {/* Commentaire */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Un commentaire ? (Optionnel)</label>
                        <textarea 
                            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            rows={2}
                            placeholder="Une idée, une remarque..."
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                        />
                    </div>

                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-lg shadow-purple-200 flex items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                        {isSubmitting ? 'Envoi...' : <><Send className="w-4 h-4" /> Envoyer</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
