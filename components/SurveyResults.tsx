
import React, { useState, useEffect } from 'react';
import { Smile, Meh, Frown, MessageSquare, Calendar, User, Search, RefreshCcw, ThumbsUp, Briefcase, Scale } from 'lucide-react';
import * as db from '../services/db';

interface ExtendedSurveyResponse {
    id: string;
    date: string;
    satisfaction: number;
    workload: number;
    balance: number;
    comment?: string;
    employees?: {
        name: string;
        role: string;
    };
}

export const SurveyResults: React.FC = () => {
    const [responses, setResponses] = useState<ExtendedSurveyResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filter, setFilter] = useState('all'); // all, with_comment, negative

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const data = await db.fetchSurveyResponses();
        setResponses(data || []);
        setIsLoading(false);
    };

    const getScoreColor = (score: number) => {
        if (score < 40) return 'text-red-500';
        if (score < 70) return 'text-yellow-500';
        return 'text-green-500';
    };

    const getScoreBg = (score: number) => {
        if (score < 40) return 'bg-red-500';
        if (score < 70) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const filteredResponses = responses.filter(r => {
        if (filter === 'with_comment') return !!r.comment;
        if (filter === 'negative') return r.satisfaction < 50;
        return true;
    });

    const averageScore = responses.length > 0 
        ? Math.round(responses.reduce((acc, r) => acc + r.satisfaction, 0) / responses.length)
        : 0;

    return (
        <div className="p-6 h-full overflow-y-auto bg-slate-50 dark:bg-slate-900">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-purple-600" />
                        Résultats des Enquêtes QVT
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">Consultez les retours détaillés des collaborateurs.</p>
                </div>
                <button onClick={loadData} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                    <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-lg">
                        <MessageSquare className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase">Réponses Totales</div>
                        <div className="text-3xl font-bold text-slate-800 dark:text-white">{responses.length}</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${averageScore >= 70 ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                        <ThumbsUp className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase">Satisfaction Moyenne</div>
                        <div className="text-3xl font-bold text-slate-800 dark:text-white">{averageScore}/100</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg">
                        <MessageSquare className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase">Commentaires</div>
                        <div className="text-3xl font-bold text-slate-800 dark:text-white">{responses.filter(r => r.comment).length}</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-6">
                <button 
                    onClick={() => setFilter('all')} 
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'}`}
                >
                    Tout voir
                </button>
                <button 
                    onClick={() => setFilter('with_comment')} 
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'with_comment' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'}`}
                >
                    Avec commentaires
                </button>
                <button 
                    onClick={() => setFilter('negative')} 
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'negative' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'}`}
                >
                    Insatisfaits ({'<'} 50)
                </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredResponses.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-slate-400 italic">Aucune réponse trouvée.</div>
                ) : (
                    filteredResponses.map(r => (
                        <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                                        {r.employees?.name ? r.employees.name.charAt(0) : '?'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 dark:text-white">{r.employees?.name || 'Inconnu'}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <span>{r.employees?.role || 'N/A'}</span>
                                            <span>•</span>
                                            <span>{new Date(r.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`font-bold text-lg ${getScoreColor(r.satisfaction)}`}>
                                    {r.satisfaction}/100
                                </div>
                            </div>

                            <div className="space-y-3 mb-4">
                                <div>
                                    <div className="flex justify-between text-xs mb-1 dark:text-slate-300">
                                        <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3"/> Satisfaction</span>
                                        <span>{r.satisfaction}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className={`h-full ${getScoreBg(r.satisfaction)}`} style={{width: `${r.satisfaction}%`}}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs mb-1 dark:text-slate-300">
                                        <span className="flex items-center gap-1"><Briefcase className="w-3 h-3"/> Charge</span>
                                        <span>{r.workload}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className={`h-full ${r.workload > 80 ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${r.workload}%`}}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs mb-1 dark:text-slate-300">
                                        <span className="flex items-center gap-1"><Scale className="w-3 h-3"/> Équilibre</span>
                                        <span>{r.balance}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className={`h-full ${getScoreBg(r.balance)}`} style={{width: `${r.balance}%`}}></div>
                                    </div>
                                </div>
                            </div>

                            {r.comment ? (
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg text-sm text-slate-700 dark:text-slate-300 italic border border-slate-100 dark:border-slate-800">
                                    "{r.comment}"
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400 italic">Aucun commentaire écrit.</div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
