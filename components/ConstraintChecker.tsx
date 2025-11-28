
import React from 'react';
import { Employee, ConstraintViolation, ServiceConfig } from '../types';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { checkConstraints } from '../utils/validation';

interface ConstraintCheckerProps {
  employees: Employee[];
  startDate: Date;
  days: number;
  serviceConfig?: ServiceConfig;
}

export const ConstraintChecker: React.FC<ConstraintCheckerProps> = ({ employees, startDate, days, serviceConfig }) => {
  const violations: ConstraintViolation[] = React.useMemo(() => {
    return checkConstraints(employees, startDate, days, serviceConfig);
  }, [employees, startDate, days, serviceConfig]);

  return (
    <div className="bg-white rounded-lg shadow h-full flex flex-col">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-lg">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
           <AlertTriangle className="w-5 h-5 text-orange-500" />
           Contrôle Métier
        </h3>
        <span className="text-xs font-mono bg-slate-200 px-2 py-1 rounded">
          {violations.length} Alertes
        </span>
      </div>
      
      <div className="bg-blue-50 p-3 text-xs text-blue-800 border-b border-blue-100 flex gap-2">
        <Info className="w-4 h-4 flex-shrink-0" />
        <div>
          <p className="font-semibold">Règles actives :</p>
          <ul className="list-disc pl-3 mt-1 space-y-0.5">
            <li>Dimanche = RH (si service fermé)</li>
            <li>48h max / 7 jours glissants</li>
            <li>Max 1 samedi travaillé sur 2</li>
            <li>Poste S suivi impérativement de NT/Repos</li>
            <li>Effectifs : 4 IT, 1 T5, 1 T6</li>
          </ul>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {violations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
            <p>Aucune anomalie détectée</p>
          </div>
        ) : (
          violations.slice(0, 50).map((v, idx) => ( 
            <div key={idx} className={`p-3 rounded border text-sm flex items-start gap-3 ${
              v.severity === 'error' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <XCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${v.severity === 'error' ? 'text-red-500' : 'text-amber-500'}`} />
              <div>
                <div className={`font-semibold ${v.severity === 'error' ? 'text-red-800' : 'text-amber-800'}`}>
                  {v.employeeId === 'ALL' ? 'Effectif Insuffisant' : 'Règle Individuelle'}
                </div>
                <div className="text-slate-600">{v.message}</div>
                {v.employeeId === 'ALL' && (
                    <div className="text-xs text-slate-400 mt-1">{v.date}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
