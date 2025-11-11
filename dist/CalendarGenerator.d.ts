/**
 * Zodiac months enumeration
 * Each month corresponds to a 30° segment of Earth's orbit around the Sun
 * Starting with Aries at the Spring Equinox (0°-30°)
 */
declare enum Months {
    Aries = 1,// Spring Equinox (0°-30°)
    Taurus = 2,// 30°-60°
    Gemini = 3,// 60°-90°
    Cancer = 4,// Summer Solstice (90°-120°)
    Leo = 5,// 120°-150°
    Virgo = 6,// 150°-180°
    Libra = 7,// Autumn Equinox (180°-210°)
    Scorpio = 8,// 210°-240°
    Sagittarius = 9,// 240°-270°
    Capricorn = 10,// Winter Solstice (270°-300°)
    Aquarius = 11,// 300°-330°
    Pisces = 12
}
/**
 * Represents a single day in the heliocentric calendar
 */
interface Day {
    /** Day number within the month (1-based) */
    Number: number;
    /** Gregorian calendar date */
    Date: Date;
    /** Solar day start time (when Sun is 12° below horizon) */
    SolarStart: string;
    /** Solar noon time (when Sun is at highest point) */
    SolarNoon: string;
    /** Solar day end time (when Sun is 12° below horizon) */
    SolarEnd: string;
    /** Current moon phase name */
    MoonPhase: string;
    /** Difference from 24-hour day in seconds (+ or -) */
    Delta: string;
    /** Earth's heliocentric longitude relative to Spring Equinox (0-360°) */
    SolarDegree: number;
    /** Astronomical events occurring on this day */
    Events: {
        name: string;
        description: string;
        date: string;
    }[];
}
/**
 * Represents a month in the heliocentric calendar
 */
interface Month {
    /** Month enumeration value (1-12) */
    Month: Months;
    /** Zodiac name of the month */
    Name: string;
    /** Total number of days in this month */
    TotalDays: number;
    /** Array of days in this month */
    Days: Day[];
}
/**
 * Main function to generate a heliocentric calendar
 *
 * This is the primary entry point for calendar generation. It:
 * 1. Sets the observer location (for solar time calculations)
 * 2. Calculates all astronomical events for the target year
 * 3. Generates the complete calendar with all 12 zodiac months
 * 4. Returns the calendar data structure
 *
 * The calendar is based on Earth's actual orbital position around the Sun,
 * divided into 12 months of 30° each, starting from the Spring Equinox.
 *
 * Current limitations:
 * - Hardcoded to generate calendar for 2025
 * - Uses hardcoded birth profile (see birthProfile constant)
 *
 * Future enhancements:
 * - Accept year as parameter
 * - Accept observer location and birth date as parameters
 * - Clear cache between different calendar generations
 *
 * @returns Array of 12 Month objects with complete day information
 * @throws Error if calendar generation fails
 */
export declare const generateCalendar: () => Month[];
export {};
//# sourceMappingURL=CalendarGenerator.d.ts.map