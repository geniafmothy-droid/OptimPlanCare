
import { Employee } from '../types';

export const exportScheduleToCSV = (employees: Employee[], currentDate: Date) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Obtenir le nombre de jours dans le mois
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // 1. Construire l'en-tête
  // Format compatible avec l'import : Nom;Prénom;Matricule;Fonction;Quotité;Date1;Date2...
  let csvContent = "Nom;Prénom;Matricule;Fonction;Quotité";
  
  const dateKeys: string[] = [];
  
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    // Format d'affichage pour l'en-tête Excel (DD/MM/YYYY)
    const headerDate = d.toLocaleDateString('fr-FR');
    csvContent += `;${headerDate}`;
    
    // Clé pour récupérer la donnée (YYYY-MM-DD)
    // Attention au décalage horaire, on force la construction locale
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dateKeys.push(dateKey);
  }
  
  csvContent += "\n";
  
  // 2. Construire les lignes pour chaque employé
  employees.forEach(emp => {
    // Tentative de séparation Nom/Prénom basique
    const nameParts = emp.name.split(' ');
    const nom = nameParts[0] || "";
    const prenom = nameParts.slice(1).join(' ') || "";
    
    // Mapping des rôles pour correspondre aux codes standards (IDE, AS...)
    let fonctionShort = emp.role as string;
    if (emp.role === 'Infirmier') fonctionShort = 'IDE';
    if (emp.role === 'Aide-Soignant') fonctionShort = 'AS';
    
    // Quotité en pourcentage (1.0 -> 100)
    const quotiteDisplay = Math.round(emp.fte * 100);

    let row = `${nom};${prenom};${emp.matricule};${fonctionShort};${quotiteDisplay}`;
    
    // Ajouter les codes horaires pour chaque jour
    dateKeys.forEach(dateKey => {
      const shift = emp.shifts[dateKey] || '';
      // Si c'est OFF, on laisse vide dans le CSV pour la lisibilité
      row += `;${shift === 'OFF' ? '' : shift}`;
    });
    
    csvContent += row + "\n";
  });
  
  // 3. Déclencher le téléchargement
  // Ajout du BOM (Byte Order Mark) pour qu'Excel ouvre correctement l'UTF-8
  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const fileName = `Planning_${year}_${String(month + 1).padStart(2, '0')}.csv`;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  
  link.click();
  
  // Nettoyage
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
