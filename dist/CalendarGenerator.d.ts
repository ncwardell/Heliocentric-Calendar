declare enum Months {
    Aries = 1,
    Taurus = 2,
    Gemini = 3,
    Cancer = 4,
    Leo = 5,
    Virgo = 6,
    Libra = 7,
    Scorpio = 8,
    Sagittarius = 9,
    Capricorn = 10,
    Aquarius = 11,
    Pisces = 12
}
interface Day {
    Number: number;
    Date: Date;
    SolarStart: string;
    SolarNoon: string;
    SolarEnd: string;
    MoonPhase: string;
    Delta: string;
    SolarDegree: number;
    Events: {
        name: string;
        description: string;
        date: string;
    }[];
}
interface Month {
    Month: Months;
    Name: string;
    TotalDays: number;
    Days: Day[];
}
/**
 * Main function to generate a heliocentric calendar
 * @returns Array of months with day information
 */
export declare const generateCalendar: () => Month[];
export {};
//# sourceMappingURL=CalendarGenerator.d.ts.map