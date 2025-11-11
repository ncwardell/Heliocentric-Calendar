import { HelioVector, Body, Seasons, SearchPlanetApsis, NextPlanetApsis, Observer, SearchHourAngle, MoonPhase } from 'astronomy-engine';
import moment from 'moment-timezone';
// Constants
const MILLISECONDS_PER_DAY = 86400000;
const DEGREES_IN_CIRCLE = 360;
const DEGREES_PER_MONTH = 30;
const MONTHS_IN_YEAR = 12;
const DEGREE_PRECISION = 0.001; // Precision for orbital birthday calculation (~4 seconds)
const MAX_BINARY_SEARCH_ITERATIONS = 100;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const HOUR_ANGLE_HORIZON = 12; // Hour angle for solar start/end calculation
var Months;
(function (Months) {
    Months[Months["Aries"] = 1] = "Aries";
    Months[Months["Taurus"] = 2] = "Taurus";
    Months[Months["Gemini"] = 3] = "Gemini";
    Months[Months["Cancer"] = 4] = "Cancer";
    Months[Months["Leo"] = 5] = "Leo";
    Months[Months["Virgo"] = 6] = "Virgo";
    Months[Months["Libra"] = 7] = "Libra";
    Months[Months["Scorpio"] = 8] = "Scorpio";
    Months[Months["Sagittarius"] = 9] = "Sagittarius";
    Months[Months["Capricorn"] = 10] = "Capricorn";
    Months[Months["Aquarius"] = 11] = "Aquarius";
    Months[Months["Pisces"] = 12] = "Pisces";
})(Months || (Months = {}));
let calendar = [];
let observer;
/**
 * Generates a complete calendar year based on heliocentric orbital positions
 * @param eventList - Object containing all astronomical events for the year
 */
function generateCalendarYear(eventList) {
    const equinoxSolsticeEvents = [
        { date: eventList.SpringEquinox, name: 'Spring Equinox', description: 'The beginning of Spring.' },
        { date: eventList.SummerSolstice, name: 'Summer Solstice', description: 'The longest day of the year.' },
        { date: eventList.AutumnEquinox, name: 'Autumn Equinox', description: 'The beginning of Autumn.' },
        { date: eventList.WinterSolstice, name: 'Winter Solstice', description: 'The shortest day of the year.' },
        { date: eventList.Aphelion, name: 'Aphelion', description: 'Earth is farthest away from the Sun.' },
        { date: eventList.Perihelion, name: 'Perihelion', description: 'The Earth is closest to the Sun.' },
    ];
    const springEquinoxLongitude = getHeliocentricLongitude(eventList.SpringEquinox.toDate());
    const newCalendar = [];
    for (let m = 1; m <= 12; m++) {
        newCalendar.push({
            Month: m,
            Name: Months[m],
            TotalDays: 0,
            Days: []
        });
    }
    // Calculate the TRUE target birth degree from the ORIGINAL birth moment and keep it constant.
    // eventList.Birth here is the pristine, original birth moment from birthProfile.date.
    const TRUE_TARGET_BIRTH_DEGREE = getBirthDegree(eventList.Birth);
    let currentDate = eventList.SpringEquinox.clone();
    // This variable will store the most accurately found moment for the TRUE_TARGET_BIRTH_DEGREE.
    // Initialize with the original birth moment as a fallback or if not found (though it should be found).
    let finalFoundBirthMoment = eventList.Birth.clone();
    while (currentDate.isBefore(eventList.SpringEquinox2, 'day')) {
        const dayInfo = getDayInfo(currentDate.toDate());
        const SolarStartDegree = getDegree(getHeliocentricLongitude(dayInfo.SolarStart.toDate()), springEquinoxLongitude);
        const SolarEndDegree = getDegree(getHeliocentricLongitude(dayInfo.SolarEnd.toDate()), springEquinoxLongitude);
        // We no longer recalculate birthDegree here; we use TRUE_TARGET_BIRTH_DEGREE.
        // const birthDegree = getBirthDegree(eventList.Birth); // REMOVED THIS LINE
        let birthMomentCurrentIteration = null; // To store finding from current day's search
        // Use the constant TRUE_TARGET_BIRTH_DEGREE in the condition
        // This condition needs to handle the 0/360 degree wrap-around for the day's span if the spring equinox is crossed
        let degreeRangeCoversBirthTarget = false;
        if (SolarStartDegree <= SolarEndDegree) { // Normal case, e.g., 100° to 101°
            if (TRUE_TARGET_BIRTH_DEGREE >= SolarStartDegree && TRUE_TARGET_BIRTH_DEGREE <= SolarEndDegree) {
                degreeRangeCoversBirthTarget = true;
            }
        }
        else { // Wrap-around case for the day's degree span, e.g., day starts at 359° and ends at 0.5°
            if (TRUE_TARGET_BIRTH_DEGREE >= SolarStartDegree || TRUE_TARGET_BIRTH_DEGREE <= SolarEndDegree) {
                degreeRangeCoversBirthTarget = true;
            }
        }
        if (degreeRangeCoversBirthTarget) {
            let startTime = dayInfo.SolarStart.clone();
            let endTime = dayInfo.SolarEnd.clone();
            let low = startTime.valueOf();
            let high = endTime.valueOf();
            let iterations = 0;
            while (low <= high && iterations < MAX_BINARY_SEARCH_ITERATIONS) {
                iterations++;
                const mid = low + Math.floor((high - low) / 2); // More stable midpoint
                const testMoment = moment(mid);
                const testDegree = getDegree(getHeliocentricLongitude(testMoment.toDate()), springEquinoxLongitude);
                // Compare testDegree with the constant TRUE_TARGET_BIRTH_DEGREE
                if (Math.abs(testDegree - TRUE_TARGET_BIRTH_DEGREE) < DEGREE_PRECISION) {
                    birthMomentCurrentIteration = testMoment;
                    break;
                }
                else if (testDegree < TRUE_TARGET_BIRTH_DEGREE) {
                    // Handling potential degree wrap-around for comparison if day crosses 0/360 reference
                    if (SolarStartDegree > SolarEndDegree && testDegree < SolarEndDegree && TRUE_TARGET_BIRTH_DEGREE > SolarStartDegree) {
                        high = mid - 1;
                    }
                    else {
                        low = mid + 1;
                    }
                }
                else { // testDegree > TRUE_TARGET_BIRTH_DEGREE
                    if (SolarStartDegree > SolarEndDegree && testDegree > SolarStartDegree && TRUE_TARGET_BIRTH_DEGREE < SolarEndDegree) {
                        low = mid + 1;
                    }
                    else {
                        high = mid - 1;
                    }
                }
            }
            if (birthMomentCurrentIteration) {
                // Update finalFoundBirthMoment. If the target degree is found on multiple days
                // (possible with rounding if it's right on a day boundary for the SolarStart/End window),
                // this will take the finding from the latest day it was found on.
                // For a birth within the year, it should ideally only be found precisely on one day's search window.
                finalFoundBirthMoment = birthMomentCurrentIteration;
            }
        }
        const currentHelioLongitude = getHeliocentricLongitude(dayInfo.SolarNoon.toDate());
        let monthIndex = Math.floor(getDegree(currentHelioLongitude, springEquinoxLongitude) / DEGREES_PER_MONTH);
        if (monthIndex >= MONTHS_IN_YEAR)
            monthIndex = 0; // Ensure it wraps around for Pisces end of year
        let events;
        // Use finalFoundBirthMoment to check for event placement.
        // This ensures the event is placed based on the single, most accurately determined moment.
        if (finalFoundBirthMoment.format('MM/DD/YY') == currentDate.format('MM/DD/YY')) {
            events = [{ name: 'BirthOrbit', description: 'Birthday', date: finalFoundBirthMoment.format('YYYY-MM-DD HH:mm:ss') }];
        }
        else {
            events = equinoxSolsticeEvents
                .filter(event => event.date.format('MM/DD/YY') === currentDate.format('MM/DD/YY'))
                .map(event => ({ name: event.name, description: event.description, date: event.date.format('YYYY-MM-DD HH:mm:ss') }));
        }
        const day = {
            Number: newCalendar[monthIndex].Days.length + 1,
            Date: currentDate.toDate(),
            SolarStart: dayInfo.SolarStart.format('YYYY-MM-DD HH:mm:ss'),
            SolarNoon: dayInfo.SolarNoon.format('LT'),
            SolarEnd: dayInfo.SolarEnd.format('YYYY-MM-DD HH:mm:ss'),
            Delta: dayInfo.Delta,
            MoonPhase: dayInfo.MoonPhase,
            SolarDegree: getDegree(currentHelioLongitude, springEquinoxLongitude),
            Events: events
        };
        newCalendar[monthIndex].Days.push(day);
        currentDate.add(1, 'days');
    }
    newCalendar.forEach(month => {
        month.TotalDays = month.Days.length;
    });
    calendar.length = 0;
    calendar.push(...newCalendar);
}
/**
 * Calculates the degree offset from the Spring Equinox
 * @param helioLongitude - Current heliocentric longitude
 * @param springEquinoxLongitude - Reference Spring Equinox longitude
 * @returns Normalized degree value (0-360)
 */
const getDegree = (helioLongitude, springEquinoxLongitude) => parseFloat(((helioLongitude - springEquinoxLongitude + DEGREES_IN_CIRCLE) % DEGREES_IN_CIRCLE).toFixed(2));
/**
 * Generates list of astronomical events for a given year
 * @param year - The year to generate events for
 * @param birth - The birth date/time
 * @returns Object containing all major astronomical events
 */
const eventList = (year, birth) => {
    try {
        const season = Seasons(year);
        const nextSeason = Seasons(year + 1);
        const Apsis = SearchPlanetApsis(Body.Earth, new Date(year, 4, 1));
        const list = {
            SpringEquinox: moment(season.mar_equinox.toString()).utc(),
            SummerSolstice: moment(season.jun_solstice.toString()).utc(),
            AutumnEquinox: moment(season.sep_equinox.toString()).utc(),
            WinterSolstice: moment(season.dec_solstice.toString()).utc(),
            SpringEquinox2: moment(nextSeason.mar_equinox.toString()).utc(),
            Aphelion: moment(Apsis.time.toString()).utc(),
            Perihelion: moment(NextPlanetApsis(Body.Earth, Apsis).time.toString()).utc(),
            Birth: birth
        };
        return list;
    }
    catch (error) {
        throw new Error(`Failed to calculate astronomical events for year ${year}: ${error}`);
    }
};
/**
 * Calculates day information including solar times and moon phase
 * @param date - The date to get information for
 * @returns Object containing moon phase, solar start/noon/end times, and day length delta
 */
const getDayInfo = (date) => {
    try {
        const SolarNoon = moment(SearchHourAngle(Body.Sun, observer, 0, date).time.toString());
        const Moon = MoonPhase(SolarNoon.toDate());
        let Phase = "";
        // Determine moon phase based on degree (0-360)
        if (Moon >= 0 && Moon < 45) {
            Phase = "New Moon";
        }
        else if (Moon >= 45 && Moon < 90) {
            Phase = "Waxing Cres.";
        }
        else if (Moon >= 90 && Moon < 135) {
            Phase = "First Quarter";
        }
        else if (Moon >= 135 && Moon < 180) {
            Phase = "Waxing Gibb.";
        }
        else if (Moon >= 180 && Moon < 225) {
            Phase = "Full Moon";
        }
        else if (Moon >= 225 && Moon < 270) {
            Phase = "Waning Gibb.";
        }
        else if (Moon >= 270 && Moon < 315) {
            Phase = "Third Quarter";
        }
        else if (Moon >= 315 && Moon <= 360) {
            Phase = "Waning Cres.";
        }
        // Calculate solar day boundaries (12° below horizon)
        const SolarStart = moment(SearchHourAngle(Body.Sun, observer, HOUR_ANGLE_HORIZON, SolarNoon.toDate(), -1).time.toString()).utc();
        const SolarEnd = moment(SearchHourAngle(Body.Sun, observer, HOUR_ANGLE_HORIZON, SolarNoon.toDate(), +1).time.toString()).utc();
        const TimeInDay = SolarEnd.diff(SolarStart);
        const sign = TimeInDay >= MILLISECONDS_PER_DAY ? '+' : '-';
        const duration = TimeInDay - MILLISECONDS_PER_DAY;
        const formattedDuration = Math.abs(duration) / 1000;
        return {
            MoonPhase: Phase,
            SolarStart: SolarStart,
            SolarNoon: SolarNoon,
            SolarEnd: SolarEnd,
            Delta: `${sign}${formattedDuration}`,
        };
    }
    catch (error) {
        throw new Error(`Failed to calculate day information for ${date}: ${error}`);
    }
};
/**
 * Calculates Earth's heliocentric longitude (orbital position) for a given date
 * @param date - The date to calculate longitude for
 * @returns Heliocentric longitude in degrees (0-360)
 */
function getHeliocentricLongitude(date) {
    try {
        const { x, y } = HelioVector(Body.Earth, date);
        const heliocentricLongitude = (Math.atan2(y, x) * RADIANS_TO_DEGREES + DEGREES_IN_CIRCLE) % DEGREES_IN_CIRCLE;
        return heliocentricLongitude;
    }
    catch (error) {
        throw new Error(`Failed to calculate heliocentric longitude for ${date}: ${error}`);
    }
}
/**
 * Calculates the birth degree relative to the Spring Equinox of the birth year
 * @param birthDate - The birth date/time
 * @returns Birth degree (0-360) from the Spring Equinox
 */
function getBirthDegree(birthDate) {
    try {
        const BirthYearSeasons = Seasons(birthDate.year());
        let springEquinoxLongitude;
        // If birth is before the Spring Equinox, use previous year's equinox as reference
        if (birthDate < moment(BirthYearSeasons.mar_equinox.toString()).utc()) {
            const previousSeasons = Seasons(birthDate.year() - 1);
            springEquinoxLongitude = getHeliocentricLongitude((moment(previousSeasons.mar_equinox.toString()).utc()).toDate());
        }
        else {
            springEquinoxLongitude = getHeliocentricLongitude((moment(BirthYearSeasons.mar_equinox.toString()).utc()).toDate());
        }
        const BirthLongitude = getHeliocentricLongitude(birthDate.utc().toDate());
        return getDegree(BirthLongitude, springEquinoxLongitude);
    }
    catch (error) {
        throw new Error(`Failed to calculate birth degree for ${birthDate.format('YYYY-MM-DD')}: ${error}`);
    }
}
/**
 * Birth profile configuration
 * TODO: Move to configuration file or user input
 */
const birthProfile = {
    observer: new Observer(41.454380, -74.430420, 0), // Latitude, Longitude, Elevation (meters)
    date: moment.tz('2000-02-04 10:00', 'YYYY-MM-DD HH:mm', 'America/New_York').utc()
};
/**
 * Main function to generate a heliocentric calendar
 * @returns Array of months with day information
 */
export const generateCalendar = () => {
    try {
        observer = birthProfile.observer;
        const events = eventList(2025, birthProfile.date);
        generateCalendarYear(events);
        return calendar;
    }
    catch (error) {
        throw new Error(`Failed to generate calendar: ${error}`);
    }
};
//# sourceMappingURL=CalendarGenerator.js.map