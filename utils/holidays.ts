
/**
 * Calcule la date de Pâques pour une année donnée (Algorithme de Meeus/Jones/Butcher)
 */
const getEasterDate = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    
    return new Date(year, month - 1, day);
};

/**
 * Retourne un dictionnaire des jours fériés pour une année donnée.
 * Clé: YYYY-MM-DD
 * Valeur: Nom du jour férié
 */
export const getFrenchHolidays = (year: number): Record<string, string> => {
    const holidays: Record<string, string> = {};

    const formatDate = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    // Jours fixes
    holidays[`${year}-01-01`] = "Jour de l'An";
    holidays[`${year}-05-01`] = "Fête du Travail";
    holidays[`${year}-05-08`] = "Victoire 1945";
    holidays[`${year}-07-14`] = "Fête Nationale";
    holidays[`${year}-08-15`] = "Assomption";
    holidays[`${year}-11-01`] = "Toussaint";
    holidays[`${year}-11-11`] = "Armistice 1918";
    holidays[`${year}-12-25`] = "Noël";

    // Jours mobiles (basés sur Pâques)
    const easter = getEasterDate(year);
    
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    holidays[formatDate(easterMonday)] = "Lundi de Pâques";

    const ascension = new Date(easter);
    ascension.setDate(easter.getDate() + 39);
    holidays[formatDate(ascension)] = "Ascension";

    const pentecost = new Date(easter);
    pentecost.setDate(easter.getDate() + 50);
    holidays[formatDate(pentecost)] = "Lundi de Pentecôte";

    return holidays;
};

/**
 * Vérifie si une date est fériée et retourne son nom ou null
 */
export const getHolidayName = (date: Date): string | null => {
    const year = date.getFullYear();
    const holidays = getFrenchHolidays(year);
    const dateStr = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return holidays[dateStr] || null;
};
