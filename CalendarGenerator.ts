import { HelioVector, Body, Seasons, SearchPlanetApsis, NextPlanetApsis, Observer, SearchHourAngle, FlexibleDateTime, MoonPhase } from 'astronomy-engine';
import moment from 'moment-timezone';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Standard day length in milliseconds (24 hours) */
const MILLISECONDS_PER_DAY = 86400000;

/** Complete circle in degrees (360°) */
const DEGREES_IN_CIRCLE = 360;

/** Degrees per zodiac month (360° / 12 months = 30°) */
const DEGREES_PER_MONTH = 30;

/** Number of months in a heliocentric year */
const MONTHS_IN_YEAR = 12;

/**
 * Precision threshold for orbital birthday calculation in degrees
 * 0.001° corresponds to approximately 4 seconds of time
 */
const DEGREE_PRECISION = 0.001;

/** Maximum iterations allowed for binary search to prevent infinite loops */
const MAX_BINARY_SEARCH_ITERATIONS = 100;

/** Conversion factor from radians to degrees (180 / π) */
const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * Hour angle for solar day boundaries
 * 12° corresponds to when the sun is approximately 12° below the horizon
 * This defines the start and end of a "solar day"
 */
const HOUR_ANGLE_HORIZON = 12;

/** Moon phase degree boundaries (in degrees, 0-360) */
const MOON_PHASE_BOUNDARIES = {
    NEW_MOON_END: 45,
    WAXING_CRESCENT_END: 90,
    FIRST_QUARTER_END: 135,
    WAXING_GIBBOUS_END: 180,
    FULL_MOON_END: 225,
    WANING_GIBBOUS_END: 270,
    THIRD_QUARTER_END: 315,
    WANING_CRESCENT_END: 360
};

// ============================================================================
// PERFORMANCE OPTIMIZATION: Heliocentric Longitude Cache
// ============================================================================

/**
 * Cache for heliocentric longitude calculations to avoid redundant computations.
 * Key: ISO date string, Value: heliocentric longitude in degrees
 * This can significantly improve performance when the same date is queried multiple times.
 */
const heliocentricLongitudeCache = new Map<string, number>();

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/**
 * Zodiac months enumeration
 * Each month corresponds to a 30° segment of Earth's orbit around the Sun
 * Starting with Aries at the Spring Equinox (0°-30°)
 */
enum Months {
    Aries = 1,      // Spring Equinox (0°-30°)
    Taurus,         // 30°-60°
    Gemini,         // 60°-90°
    Cancer,         // Summer Solstice (90°-120°)
    Leo,            // 120°-150°
    Virgo,          // 150°-180°
    Libra,          // Autumn Equinox (180°-210°)
    Scorpio,        // 210°-240°
    Sagittarius,    // 240°-270°
    Capricorn,      // Winter Solstice (270°-300°)
    Aquarius,       // 300°-330°
    Pisces          // 330°-360°
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
    Events: { name: string; description: string; date: string }[];
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
 * Collection of astronomical events for a calendar year
 */
interface Events {
    /** Spring (Vernal) Equinox - when day and night are equal, Sun crosses celestial equator */
    SpringEquinox: moment.Moment;

    /** Summer Solstice - longest day of the year in Northern Hemisphere */
    SummerSolstice: moment.Moment;

    /** Autumn (Fall) Equinox - when day and night are equal again */
    AutumnEquinox: moment.Moment;

    /** Winter Solstice - shortest day of the year in Northern Hemisphere */
    WinterSolstice: moment.Moment;

    /** Next year's Spring Equinox - marks the end of the current heliocentric year */
    SpringEquinox2: moment.Moment;

    /** Aphelion - Earth's farthest point from the Sun in its orbit */
    Aphelion: moment.Moment;

    /** Perihelion - Earth's closest point to the Sun in its orbit */
    Perihelion: moment.Moment;

    /** Birth moment - the user's exact birth date/time */
    Birth: moment.Moment
}

// ============================================================================
// GLOBAL STATE
// ============================================================================

/** Generated calendar data (array of 12 months) */
let calendar: Month[] = [];

/** Observer location on Earth for astronomical calculations */
let observer: Observer;

// ============================================================================
// CORE CALENDAR GENERATION FUNCTIONS
// ============================================================================

/**
 * Generates a complete calendar year based on heliocentric orbital positions
 *
 * This function is the core of the heliocentric calendar system. It:
 * 1. Iterates through each day from Spring Equinox to the next Spring Equinox
 * 2. Calculates Earth's orbital position for each day
 * 3. Uses binary search to find the exact moment when Earth returns to the birth position
 * 4. Assigns days to zodiac months based on 30° orbital segments
 *
 * @param eventList - Object containing all astronomical events for the year
 */
function generateCalendarYear(eventList: Events): void {
    console.log('\n--- generateCalendarYear() Started ---');

    // Define major astronomical events that will be displayed on the calendar
    const equinoxSolsticeEvents = [
        { date: eventList.SpringEquinox, name: 'Spring Equinox', description: 'The beginning of Spring.' },
        { date: eventList.SummerSolstice, name: 'Summer Solstice', description: 'The longest day of the year.' },
        { date: eventList.AutumnEquinox, name: 'Autumn Equinox', description: 'The beginning of Autumn.' },
        { date: eventList.WinterSolstice, name: 'Winter Solstice', description: 'The shortest day of the year.' },
        { date: eventList.Aphelion, name: 'Aphelion', description: 'Earth is farthest away from the Sun.' },
        { date: eventList.Perihelion, name: 'Perihelion', description: 'The Earth is closest to the Sun.' },
    ];

    // Get the heliocentric longitude at the Spring Equinox (our 0° reference point)
    const springEquinoxLongitude = getHeliocentricLongitude(eventList.SpringEquinox.toDate());

    // Initialize the calendar structure with 12 empty months
    const newCalendar: Month[] = [];
    for (let m = 1; m <= 12; m++) {
        newCalendar.push({
            Month: m,
            Name: Months[m],
            TotalDays: 0,
            Days: []
        });
    }

    /**
     * Calculate the target birth degree ONCE and keep it constant throughout the year.
     *
     * The "orbital birthday" occurs when Earth returns to the same heliocentric
     * position it was in at the moment of birth. This degree value is calculated
     * relative to the Spring Equinox of the birth year and remains constant.
     *
     * Example: If you were born when Earth was at 45° past the Spring Equinox,
     * your orbital birthday occurs each year when Earth reaches 45° again.
     */
    const TRUE_TARGET_BIRTH_DEGREE = getBirthDegree(eventList.Birth);
    console.log('Birth degree (relative to Spring Equinox):', TRUE_TARGET_BIRTH_DEGREE.toFixed(3) + '°');

    // Start iterating from the Spring Equinox
    let currentDate = eventList.SpringEquinox.clone();
    console.log('Starting date iteration from:', currentDate.format('YYYY-MM-DD'));
    console.log('Ending date iteration at:', eventList.SpringEquinox2.format('YYYY-MM-DD'));

    /**
     * Variable to store the most precisely found moment when Earth returns
     * to the birth position. Initialized with the original birth moment as
     * a fallback (though it should be found within the current year).
     */
    let finalFoundBirthMoment = eventList.Birth.clone();

    // Day counter for progress logging
    let dayCounter = 0;

    // Iterate through each day from Spring Equinox to the next Spring Equinox
    while (currentDate.isBefore(eventList.SpringEquinox2, 'day')) {
        dayCounter++;

        // Log progress every 30 days
        if (dayCounter % 30 === 0) {
            console.log(`Processing day ${dayCounter}: ${currentDate.format('YYYY-MM-DD')}`);
        }
        // Get solar times, moon phase, and delta for the current day
        const dayInfo = getDayInfo(currentDate.toDate());

        // Calculate Earth's heliocentric position at the start and end of this solar day
        const SolarStartDegree = getDegree(getHeliocentricLongitude(dayInfo.SolarStart.toDate()), springEquinoxLongitude);
        const SolarEndDegree = getDegree(getHeliocentricLongitude(dayInfo.SolarEnd.toDate()), springEquinoxLongitude);

        // Variable to store the birth moment if found during this day's binary search
        let birthMomentCurrentIteration: moment.Moment | null = null;

        /**
         * CRITICAL: Check if the birth degree falls within this solar day's degree range
         *
         * We must handle two cases:
         * 1. Normal case: SolarStartDegree < SolarEndDegree (e.g., 100° to 101°)
         *    - Birth degree is in range if: START <= BIRTH <= END
         *
         * 2. Wrap-around case: SolarStartDegree > SolarEndDegree (e.g., 359° to 0.5°)
         *    - This occurs when the day crosses the 0°/360° boundary (Spring Equinox)
         *    - Birth degree is in range if: BIRTH >= START OR BIRTH <= END
         *
         * The wrap-around case is essential for handling dates near the Spring Equinox.
         */
        let degreeRangeCoversBirthTarget = false;
        if (SolarStartDegree <= SolarEndDegree) {
            // Normal case: degree increases throughout the day
            if (TRUE_TARGET_BIRTH_DEGREE >= SolarStartDegree && TRUE_TARGET_BIRTH_DEGREE <= SolarEndDegree) {
                degreeRangeCoversBirthTarget = true;
            }
        } else {
            // Wrap-around case: degree crosses from 359° to 0°
            if (TRUE_TARGET_BIRTH_DEGREE >= SolarStartDegree || TRUE_TARGET_BIRTH_DEGREE <= SolarEndDegree) {
                degreeRangeCoversBirthTarget = true;
            }
        }

        /**
         * BINARY SEARCH ALGORITHM FOR ORBITAL BIRTHDAY
         *
         * If the target birth degree falls within this solar day's range,
         * perform a binary search to find the EXACT moment when Earth reaches
         * that degree. This provides precision down to ~4 seconds.
         *
         * How it works:
         * 1. Start with the full solar day as the search window (low to high)
         * 2. Test the midpoint of the window
         * 3. Check if Earth's position at midpoint matches the birth degree
         * 4. If too low, search the upper half; if too high, search the lower half
         * 5. Repeat until we converge to within DEGREE_PRECISION (0.001°)
         *
         * Special consideration: The algorithm must handle degree wrap-around
         * when the day crosses the 0°/360° boundary.
         */
        if (degreeRangeCoversBirthTarget) {
            let startTime = dayInfo.SolarStart.clone();
            let endTime = dayInfo.SolarEnd.clone();

            // Convert times to milliseconds for binary search
            let low = startTime.valueOf();
            let high = endTime.valueOf();
            let iterations = 0;

            // Binary search loop: narrow down the exact moment
            while (low <= high && iterations < MAX_BINARY_SEARCH_ITERATIONS) {
                iterations++;

                // Calculate midpoint (using overflow-safe method)
                const mid = low + Math.floor((high - low) / 2);
                const testMoment = moment(mid);
                const testDegree = getDegree(getHeliocentricLongitude(testMoment.toDate()), springEquinoxLongitude);

                // Check if we've found the birth degree within acceptable precision
                if (Math.abs(testDegree - TRUE_TARGET_BIRTH_DEGREE) < DEGREE_PRECISION) {
                    birthMomentCurrentIteration = testMoment;
                    console.log(`\n🎂 ORBITAL BIRTHDAY FOUND!`);
                    console.log('  Date/Time:', testMoment.format('YYYY-MM-DD HH:mm:ss'));
                    console.log('  Degree:', testDegree.toFixed(6) + '°');
                    console.log('  Target Degree:', TRUE_TARGET_BIRTH_DEGREE.toFixed(6) + '°');
                    console.log('  Precision:', Math.abs(testDegree - TRUE_TARGET_BIRTH_DEGREE).toFixed(6) + '°');
                    console.log('  Binary search iterations:', iterations);
                    break;
                }
                // Test degree is less than target: search the later half
                else if (testDegree < TRUE_TARGET_BIRTH_DEGREE) {
                    /**
                     * Special handling for wrap-around case:
                     * If the day crosses 0°/360° AND we're in the "wrapped" portion (< end degree)
                     * AND the target is in the "pre-wrap" portion (> start degree),
                     * then we need to search backwards (high = mid - 1) instead of forwards.
                     */
                    if (SolarStartDegree > SolarEndDegree && testDegree < SolarEndDegree && TRUE_TARGET_BIRTH_DEGREE > SolarStartDegree) {
                        high = mid - 1;
                    } else {
                        low = mid + 1;
                    }
                }
                // Test degree is greater than target: search the earlier half
                else {
                    /**
                     * Wrap-around special case (inverse of above):
                     * If we're in the "pre-wrap" portion (> start degree)
                     * AND target is in the "wrapped" portion (< end degree),
                     * search forwards instead of backwards.
                     */
                    if (SolarStartDegree > SolarEndDegree && testDegree > SolarStartDegree && TRUE_TARGET_BIRTH_DEGREE < SolarEndDegree) {
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                }
            }

            // If we found the birth moment during this day's search, store it
            if (birthMomentCurrentIteration) {
                /**
                 * Update the final birth moment. This should only be found once per year
                 * (on the single day when Earth returns to the birth position).
                 * If found multiple times due to boundary rounding, we take the latest finding.
                 */
                finalFoundBirthMoment = birthMomentCurrentIteration;
                console.log(`  >> Birthday found on currentDate: ${currentDate.utc().format('YYYY-MM-DD HH:mm:ss')}`);
            }
        }

        // Determine which zodiac month this day belongs to based on Earth's orbital position
        const currentHelioLongitude = getHeliocentricLongitude(dayInfo.SolarNoon.toDate());
        let monthIndex = Math.floor(getDegree(currentHelioLongitude, springEquinoxLongitude) / DEGREES_PER_MONTH);

        // Handle wrap-around: if we're at 360° or beyond, we're back in Aries (month 0)
        if (monthIndex >= MONTHS_IN_YEAR) monthIndex = 0;

        let events;

        /**
         * Determine which events occur on this day
         *
         * Priority is given to the orbital birthday. If the orbital birthday
         * falls on this day, it's the only event shown. Otherwise, we check
         * for equinoxes, solstices, aphelion, and perihelion.
         */
        if (finalFoundBirthMoment.utc().format('YYYY-MM-DD') === currentDate.utc().format('YYYY-MM-DD')) {
            // This is the orbital birthday - the day Earth returns to birth position
            console.log(`\n✓ BIRTHDAY ASSIGNED TO CALENDAR DAY:`);
            console.log(`  currentDate (UTC): ${currentDate.utc().format('YYYY-MM-DD HH:mm:ss')}`);
            console.log(`  finalFoundBirthMoment (UTC): ${finalFoundBirthMoment.utc().format('YYYY-MM-DD HH:mm:ss')}`);
            console.log(`  Month Index: ${monthIndex} (${Months[monthIndex + 1]})`);
            console.log(`  Day Number in Month: ${newCalendar[monthIndex].Days.length + 1}`);
            events = [{ name: 'BirthOrbit', description: 'Birthday', date: finalFoundBirthMoment.utc().format('YYYY-MM-DD HH:mm:ss') }];
        } else {
            // Check for other astronomical events on this day
            events = equinoxSolsticeEvents
                .filter(event => event.date.utc().format('YYYY-MM-DD') === currentDate.utc().format('YYYY-MM-DD'))
                .map(event => ({ name: event.name, description: event.description, date: event.date.utc().format('YYYY-MM-DD HH:mm:ss') }));
        }

        // Create the day object with all calculated information
        const day: Day = {
            Number: newCalendar[monthIndex].Days.length + 1,    // Day number within the month
            Date: currentDate.clone().utc().hours(12).minutes(0).seconds(0).milliseconds(0).toDate(), // Gregorian date at noon UTC to avoid timezone shift issues
            SolarStart: dayInfo.SolarStart.format('YYYY-MM-DD HH:mm:ss'),
            SolarNoon: dayInfo.SolarNoon.format('LT'),           // Local time format
            SolarEnd: dayInfo.SolarEnd.format('YYYY-MM-DD HH:mm:ss'),
            Delta: dayInfo.Delta,                                // Deviation from 24-hour day
            MoonPhase: dayInfo.MoonPhase,                        // Current moon phase
            SolarDegree: getDegree(currentHelioLongitude, springEquinoxLongitude), // Orbital position
            Events: events                                       // Any special events
        };

        // DEBUG: Log day creation when there are events
        if (events.length > 0) {
            console.log(`\n  Creating day with events:`);
            console.log(`    currentDate (moment UTC): ${currentDate.utc().format('YYYY-MM-DD HH:mm:ss')}`);
            console.log(`    day.Date (JS Date): ${day.Date}`);
            console.log(`    day.Date UTC string: ${moment(day.Date).utc().format('YYYY-MM-DD HH:mm:ss')}`);
            console.log(`    monthIndex: ${monthIndex}, dayNumber: ${day.Number}`);
        }

        // Add this day to the appropriate month
        newCalendar[monthIndex].Days.push(day);

        // Move to the next day
        currentDate.add(1, 'days');
    }

    console.log(`\nProcessed total of ${dayCounter} days`);

    // Update the total day count for each month
    newCalendar.forEach((month) => {
        month.TotalDays = month.Days.length;
        console.log(`${month.Name}: ${month.TotalDays} days`);
    });

    // Replace the global calendar with the newly generated one
    calendar.length = 0;
    calendar.push(...newCalendar);

    // DEBUG: Output full calendar structure with dates and events
    console.log('\n========== FULL CALENDAR DEBUG OUTPUT ==========');
    newCalendar.forEach((month) => {
        console.log(`\n${month.Name} (Month ${month.Month}):`);
        month.Days.forEach((day) => {
            const dateStr = moment(day.Date).utc().format('YYYY-MM-DD');
            const eventsStr = day.Events.length > 0
                ? day.Events.map(e => `${e.name} (${e.date})`).join(', ')
                : 'none';
            console.log(`  Day ${day.Number}: ${dateStr} - Events: ${eventsStr}`);
        });
    });
    console.log('================================================\n');

    console.log('--- generateCalendarYear() Completed ---\n');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculates the degree offset from the Spring Equinox
 *
 * This function normalizes the difference between two heliocentric longitudes
 * to a 0-360° range. It handles the wrap-around case when the difference crosses
 * the 0°/360° boundary.
 *
 * Example:
 * - helioLongitude = 10°, springEquinoxLongitude = 350°
 * - Naive subtraction: 10 - 350 = -340°
 * - After adding 360°: -340 + 360 = 20°
 * - After modulo 360: 20° (correct!)
 *
 * @param helioLongitude - Current heliocentric longitude (0-360°)
 * @param springEquinoxLongitude - Reference Spring Equinox longitude (0-360°)
 * @returns Normalized degree value (0-360°), rounded to 2 decimal places
 */
const getDegree = (helioLongitude: number, springEquinoxLongitude: number): number => parseFloat(
    ((helioLongitude - springEquinoxLongitude + DEGREES_IN_CIRCLE) % DEGREES_IN_CIRCLE).toFixed(2)
);

// ============================================================================
// ASTRONOMICAL EVENT CALCULATION
// ============================================================================

/**
 * Generates list of astronomical events for a given year
 *
 * This function calculates the exact moments of major astronomical events:
 * - Equinoxes: When day and night are equal length (Sun crosses celestial equator)
 * - Solstices: When day length is at maximum or minimum (Sun at furthest declination)
 * - Aphelion: Earth's farthest point from Sun (typically early July)
 * - Perihelion: Earth's closest point to Sun (typically early January)
 *
 * These events are used to mark significant dates on the heliocentric calendar
 * and to define the boundaries of the calendar year (Spring Equinox to Spring Equinox).
 *
 * @param year - The year to generate events for
 * @param birth - The birth date/time (passed through for convenience)
 * @returns Object containing all major astronomical events
 */
const eventList = (year: number, birth: moment.Moment): Events => {
    try {
        // Get the four seasons (equinoxes and solstices) for the current year
        const season = Seasons(year);

        // Get next year's Spring Equinox to define the end of the calendar year
        const nextSeason = Seasons(year + 1);

        /**
         * Search for Earth's aphelion (farthest from Sun)
         * Starting search from May 1st, as aphelion typically occurs in early July
         */
        const Apsis = SearchPlanetApsis(Body.Earth, new Date(year, 4, 1));

        // Compile all events into a single object
        const list: Events = {
            SpringEquinox: moment(season.mar_equinox.toString()).utc(),     // ~March 20
            SummerSolstice: moment(season.jun_solstice.toString()).utc(),   // ~June 21
            AutumnEquinox: moment(season.sep_equinox.toString()).utc(),     // ~September 22
            WinterSolstice: moment(season.dec_solstice.toString()).utc(),   // ~December 21
            SpringEquinox2: moment(nextSeason.mar_equinox.toString()).utc(), // Next year's Spring Equinox
            Aphelion: moment(Apsis.time.toString()).utc(),                  // ~July 4
            Perihelion: moment(NextPlanetApsis(Body.Earth, Apsis).time.toString()).utc(), // ~January 3
            Birth: birth
        };

        return list;
    } catch (error) {
        throw new Error(`Failed to calculate astronomical events for year ${year}: ${error}`);
    }
}

/**
 * Calculates comprehensive day information including solar times and moon phase
 *
 * This function determines:
 * - Solar noon: when the Sun reaches its highest point in the sky
 * - Solar day boundaries: when the Sun is 12° below the horizon
 * - Moon phase: the current phase of the Moon (0-360° with New Moon at 0°)
 * - Delta: how much longer or shorter than 24 hours this solar day is
 *
 * @param date - The date to get information for
 * @returns Object containing moon phase, solar start/noon/end times, and day length delta
 */
const getDayInfo = (date: FlexibleDateTime): {
    MoonPhase: string;
    SolarStart: moment.Moment;
    SolarNoon: moment.Moment;
    SolarEnd: moment.Moment;
    Delta: string;
} => {
    try {
        // Calculate solar noon (when Sun is at 0° hour angle - highest in sky)
        const SolarNoon = moment(SearchHourAngle(Body.Sun, observer, 0, date).time.toString());

        // Get moon phase as a degree value (0-360)
        const Moon = MoonPhase(SolarNoon.toDate());
        let Phase = "";

        /**
         * Map moon phase degree to human-readable name
         *
         * Moon phases are measured as the angle between the Sun and Moon:
         * - 0° (New Moon): Moon is between Earth and Sun
         * - 90° (First Quarter): Moon is 90° ahead of Sun
         * - 180° (Full Moon): Earth is between Moon and Sun
         * - 270° (Third Quarter): Moon is 270° ahead of Sun
         */
        if (Moon >= 0 && Moon < MOON_PHASE_BOUNDARIES.NEW_MOON_END) {
            Phase = "New Moon";
        } else if (Moon >= MOON_PHASE_BOUNDARIES.NEW_MOON_END && Moon < MOON_PHASE_BOUNDARIES.WAXING_CRESCENT_END) {
            Phase = "Waxing Cres.";
        } else if (Moon >= MOON_PHASE_BOUNDARIES.WAXING_CRESCENT_END && Moon < MOON_PHASE_BOUNDARIES.FIRST_QUARTER_END) {
            Phase = "First Quarter";
        } else if (Moon >= MOON_PHASE_BOUNDARIES.FIRST_QUARTER_END && Moon < MOON_PHASE_BOUNDARIES.WAXING_GIBBOUS_END) {
            Phase = "Waxing Gibb.";
        } else if (Moon >= MOON_PHASE_BOUNDARIES.WAXING_GIBBOUS_END && Moon < MOON_PHASE_BOUNDARIES.FULL_MOON_END) {
            Phase = "Full Moon";
        } else if (Moon >= MOON_PHASE_BOUNDARIES.FULL_MOON_END && Moon < MOON_PHASE_BOUNDARIES.WANING_GIBBOUS_END) {
            Phase = "Waning Gibb.";
        } else if (Moon >= MOON_PHASE_BOUNDARIES.WANING_GIBBOUS_END && Moon < MOON_PHASE_BOUNDARIES.THIRD_QUARTER_END) {
            Phase = "Third Quarter";
        } else if (Moon >= MOON_PHASE_BOUNDARIES.THIRD_QUARTER_END && Moon <= MOON_PHASE_BOUNDARIES.WANING_CRESCENT_END) {
            Phase = "Waning Cres.";
        }

        /**
         * Calculate solar day boundaries
         *
         * A "solar day" starts and ends when the Sun is 12° below the horizon.
         * - direction = -1: search backwards from noon to find start
         * - direction = +1: search forwards from noon to find end
         */
        const SolarStart = moment(SearchHourAngle(Body.Sun, observer, HOUR_ANGLE_HORIZON, SolarNoon.toDate(), -1).time.toString()).utc();
        const SolarEnd = moment(SearchHourAngle(Body.Sun, observer, HOUR_ANGLE_HORIZON, SolarNoon.toDate(), +1).time.toString()).utc();

        // Calculate the actual length of this solar day
        const TimeInDay = SolarEnd.diff(SolarStart);

        /**
         * Calculate delta: deviation from standard 24-hour day
         *
         * Solar days vary in length throughout the year due to:
         * 1. Earth's elliptical orbit (moves faster near perihelion)
         * 2. Earth's axial tilt
         *
         * Delta is shown as +/- seconds difference from exactly 24 hours
         */
        const sign = TimeInDay >= MILLISECONDS_PER_DAY ? '+' : '-';
        const duration = TimeInDay - MILLISECONDS_PER_DAY;
        const formattedDuration = Math.abs(duration) / 1000; // Convert to seconds

        return {
            MoonPhase: Phase,
            SolarStart: SolarStart,
            SolarNoon: SolarNoon,
            SolarEnd: SolarEnd,
            Delta: `${sign}${formattedDuration}`,
        };
    } catch (error) {
        throw new Error(`Failed to calculate day information for ${date}: ${error}`);
    }
}

/**
 * Calculates Earth's heliocentric longitude (orbital position) for a given date
 *
 * PERFORMANCE OPTIMIZATION: This function uses a cache to avoid recalculating
 * the heliocentric longitude for the same date multiple times. This can
 * significantly improve performance during calendar generation.
 *
 * How it works:
 * 1. Gets Earth's position vector (x, y) relative to the Sun
 * 2. Converts Cartesian coordinates to polar angle using atan2
 * 3. Converts radians to degrees and normalizes to 0-360° range
 *
 * @param date - The date to calculate longitude for
 * @returns Heliocentric longitude in degrees (0-360)
 */
function getHeliocentricLongitude(date: Date): number {
    try {
        // Create a cache key from the date (ISO string for consistency)
        const cacheKey = date.toISOString();

        // Check if we've already calculated this value
        const cachedValue = heliocentricLongitudeCache.get(cacheKey);
        if (cachedValue !== undefined) {
            return cachedValue;
        }

        // Calculate heliocentric position vector (x, y coordinates)
        const { x, y } = HelioVector(Body.Earth, date);

        /**
         * Convert Cartesian (x, y) to polar coordinates (angle)
         * - atan2(y, x) gives angle in radians
         * - Multiply by RADIANS_TO_DEGREES to convert to degrees
         * - Add DEGREES_IN_CIRCLE and modulo to normalize to 0-360° range
         */
        const heliocentricLongitude = (Math.atan2(y, x) * RADIANS_TO_DEGREES + DEGREES_IN_CIRCLE) % DEGREES_IN_CIRCLE;

        // Store in cache for future lookups
        heliocentricLongitudeCache.set(cacheKey, heliocentricLongitude);

        return heliocentricLongitude;
    } catch (error) {
        throw new Error(`Failed to calculate heliocentric longitude for ${date}: ${error}`);
    }
}


/**
 * Calculates the birth degree relative to the Spring Equinox of the birth year
 *
 * This is a critical function that establishes the "orbital birthday" position.
 * It calculates where Earth was in its orbit (relative to the Spring Equinox)
 * at the moment of birth. This degree value becomes the target that we search
 * for each year to find the orbital birthday.
 *
 * Important: If birth occurs before the Spring Equinox, we use the PREVIOUS
 * year's Spring Equinox as the reference point to ensure the degree value
 * remains in the 0-360° range.
 *
 * Example:
 * - Birth: February 4, 2000 at 10:00 AM
 * - Spring Equinox 2000: March 20, 2000 (hasn't happened yet)
 * - Reference: Use Spring Equinox 1999 instead
 * - Calculate: Earth's position on Feb 4, 2000 relative to Spring Equinox 1999
 *
 * @param birthDate - The exact birth date and time
 * @returns Birth degree (0-360°) measured from the reference Spring Equinox
 */
function getBirthDegree(birthDate: moment.Moment): number {
    try {
        console.log('\n--- getBirthDegree() Debug ---');
        console.log('Birth Date (UTC):', birthDate.utc().format('YYYY-MM-DD HH:mm:ss'));

        // Get the seasons for the birth year
        const BirthYearSeasons = Seasons(birthDate.year());
        const birthYearEquinox = moment(BirthYearSeasons.mar_equinox.toString()).utc();
        console.log('Birth Year Spring Equinox:', birthYearEquinox.format('YYYY-MM-DD HH:mm:ss'));

        let springEquinoxLongitude: number;
        let referenceEquinoxDate: moment.Moment;

        /**
         * Determine which Spring Equinox to use as reference
         *
         * If birth occurs before this year's Spring Equinox (typically Jan 1 - Mar 19),
         * we need to use the PREVIOUS year's Spring Equinox as our 0° reference.
         * Otherwise, the birth degree would be negative or wrap around incorrectly.
         */
        if (birthDate < birthYearEquinox) {
            // Birth is before Spring Equinox: use previous year's equinox
            const previousSeasons = Seasons(birthDate.year() - 1);
            referenceEquinoxDate = moment(previousSeasons.mar_equinox.toString()).utc();
            springEquinoxLongitude = getHeliocentricLongitude(referenceEquinoxDate.toDate());
            console.log('Using PREVIOUS year Spring Equinox:', referenceEquinoxDate.format('YYYY-MM-DD HH:mm:ss'));
        } else {
            // Birth is after Spring Equinox: use current year's equinox
            referenceEquinoxDate = birthYearEquinox;
            springEquinoxLongitude = getHeliocentricLongitude(referenceEquinoxDate.toDate());
            console.log('Using CURRENT year Spring Equinox:', referenceEquinoxDate.format('YYYY-MM-DD HH:mm:ss'));
        }

        // Calculate Earth's heliocentric longitude at the moment of birth
        const BirthLongitude = getHeliocentricLongitude(birthDate.utc().toDate());
        const birthDegree = getDegree(BirthLongitude, springEquinoxLongitude);

        console.log('Spring Equinox Longitude:', springEquinoxLongitude.toFixed(6) + '°');
        console.log('Birth Longitude:', BirthLongitude.toFixed(6) + '°');
        console.log('Birth Degree (offset from equinox):', birthDegree.toFixed(6) + '°');
        console.log('--- getBirthDegree() End ---\n');

        // Return the degree offset from the Spring Equinox
        return birthDegree;
    } catch (error) {
        throw new Error(`Failed to calculate birth degree for ${birthDate.format('YYYY-MM-DD')}: ${error}`);
    }
}


// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

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
 * @param year - The year to generate the calendar for
 * @param birthDate - Birth date in YYYY-MM-DD format
 * @param birthTime - Birth time in HH:mm format
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 * @param latitude - Latitude in decimal degrees (positive = North, negative = South)
 * @param longitude - Longitude in decimal degrees (positive = East, negative = West)
 * @param elevation - Elevation in meters above sea level
 * @returns Array of 12 Month objects with complete day information
 * @throws Error if calendar generation fails
 */
export const generateCalendar = (
    year: number = 2025,
    birthDate: string = '2000-02-04',
    birthTime: string = '10:00',
    timezone: string = 'America/New_York',
    latitude: number = 41.454380,
    longitude: number = -74.430420,
    elevation: number = 0
): Month[] => {
    try {
        console.log('\n=== generateCalendar() Started ===');
        console.log('Parameters:');
        console.log('  Year:', year);
        console.log('  Birth Date:', birthDate);
        console.log('  Birth Time:', birthTime);
        console.log('  Timezone:', timezone);
        console.log('  Location:', { latitude, longitude, elevation });

        // Create observer location for astronomical calculations
        observer = new Observer(latitude, longitude, elevation);
        console.log('Observer created:', { latitude, longitude, elevation });

        // Parse birth date and time
        const birthDateTime = moment.tz(`${birthDate} ${birthTime}`, 'YYYY-MM-DD HH:mm', timezone).utc();
        console.log('Birth DateTime (UTC):', birthDateTime.format('YYYY-MM-DD HH:mm:ss'));

        // Clear the cache to ensure fresh calculations
        heliocentricLongitudeCache.clear();
        console.log('Heliocentric longitude cache cleared');

        // Calculate all astronomical events for the target year
        console.log(`\nCalculating astronomical events for year ${year}...`);
        const events = eventList(year, birthDateTime);
        console.log('Astronomical events calculated:');
        console.log('  Spring Equinox:', events.SpringEquinox.format('YYYY-MM-DD HH:mm:ss'));
        console.log('  Summer Solstice:', events.SummerSolstice.format('YYYY-MM-DD HH:mm:ss'));
        console.log('  Autumn Equinox:', events.AutumnEquinox.format('YYYY-MM-DD HH:mm:ss'));
        console.log('  Winter Solstice:', events.WinterSolstice.format('YYYY-MM-DD HH:mm:ss'));
        console.log('  Aphelion:', events.Aphelion.format('YYYY-MM-DD HH:mm:ss'));
        console.log('  Perihelion:', events.Perihelion.format('YYYY-MM-DD HH:mm:ss'));

        // Generate the complete calendar year
        console.log('\nGenerating calendar year...');
        generateCalendarYear(events);
        console.log('Calendar year generated successfully!');
        console.log('Total months:', calendar.length);

        // Return the generated calendar
        return calendar;
    } catch (error) {
        console.error('ERROR in generateCalendar():', error);
        throw new Error(`Failed to generate calendar: ${error}`);
    }
};

