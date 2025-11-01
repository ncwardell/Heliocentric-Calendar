import { HelioVector, Body, Seasons, SearchPlanetApsis, NextPlanetApsis, Observer, SearchHourAngle, FlexibleDateTime, MoonPhase, AstroTime } from 'astronomy-engine';
import moment from 'moment-timezone';

enum Months {
    Aries = 1,
    Taurus,
    Gemini,
    Cancer,
    Leo,
    Virgo,
    Libra,
    Scorpio,
    Sagittarius,
    Capricorn,
    Aquarius,
    Pisces
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
    Events: { name: string; description: string; date: string }[];
}

interface Month {
    Month: Months;
    Name: string;
    TotalDays: number;
    Days: Day[];
}

interface Events {
    SpringEquinox: moment.Moment;
    SummerSolstice: moment.Moment;
    AutumnEquinox: moment.Moment;
    WinterSolstice: moment.Moment;
    SpringEquinox2: moment.Moment;
    Aphelion: moment.Moment;
    Perihelion: moment.Moment;
    Birth: moment.Moment
}

let calendar: Month[] = [];
let observer: Observer;

function generateCalendarYear(eventList: Events) {
    const equinoxSolsticeEvents = [
        { date: eventList.SpringEquinox, name: 'Spring Equinox', description: 'The beginning of Spring.' },
        { date: eventList.SummerSolstice, name: 'Summer Solstice', description: 'The longest day of the year.' },
        { date: eventList.AutumnEquinox, name: 'Autumn Equinox', description: 'The beginning of Autumn.' },
        { date: eventList.WinterSolstice, name: 'Winter Solstice', description: 'The shortest day of the year.' },
        { date: eventList.Aphelion, name: 'Aphelion', description: 'Earth is farthest away from the Sun.' },
        { date: eventList.Perihelion, name: 'Perihelion', description: 'The Earth is closest to the Sun.' },
    ];

    const springEquinoxLongitude = getHeliocentricLongitude(eventList.SpringEquinox.toDate());

    const newCalendar: Month[] = [];
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
    console.log("Constant TRUE_TARGET_BIRTH_DEGREE set to: ", TRUE_TARGET_BIRTH_DEGREE);

    let currentDate = eventList.SpringEquinox.clone();
    console.log("Initial currentDate UTC for loop:", currentDate.toISOString()); // ADD THIS
    // This variable will store the most accurately found moment for the TRUE_TARGET_BIRTH_DEGREE.
    // Initialize with the original birth moment as a fallback or if not found (though it should be found).
    let finalFoundBirthMoment = eventList.Birth.clone();

    while (currentDate.isBefore(eventList.SpringEquinox2, 'day')) {
        const dayInfo = getDayInfo(currentDate.toDate());

        const SolarStartDegree = getDegree(getHeliocentricLongitude(dayInfo.SolarStart.toDate()), springEquinoxLongitude);
        const SolarEndDegree = getDegree(getHeliocentricLongitude(dayInfo.SolarEnd.toDate()), springEquinoxLongitude);
        
        // We no longer recalculate birthDegree here; we use TRUE_TARGET_BIRTH_DEGREE.
        // const birthDegree = getBirthDegree(eventList.Birth); // REMOVED THIS LINE

        let birthMomentCurrentIteration: moment.Moment | null = null; // To store finding from current day's search

        // Use the constant TRUE_TARGET_BIRTH_DEGREE in the condition
        // This condition needs to handle the 0/360 degree wrap-around for the day's span if the spring equinox is crossed
        let degreeRangeCoversBirthTarget = false;
        if (SolarStartDegree <= SolarEndDegree) { // Normal case, e.g., 100° to 101°
            if (TRUE_TARGET_BIRTH_DEGREE >= SolarStartDegree && TRUE_TARGET_BIRTH_DEGREE <= SolarEndDegree) {
                degreeRangeCoversBirthTarget = true;
            }
        } else { // Wrap-around case for the day's degree span, e.g., day starts at 359° and ends at 0.5°
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
            const maxIterations = 100; // Safety break for binary search

            while (low <= high && iterations < maxIterations) {
                iterations++;
                const mid = low + Math.floor((high - low) / 2); // More stable midpoint
                const testMoment = moment(mid);
                const testDegree = getDegree(getHeliocentricLongitude(testMoment.toDate()), springEquinoxLongitude);

                // Compare testDegree with the constant TRUE_TARGET_BIRTH_DEGREE
                if (Math.abs(testDegree - TRUE_TARGET_BIRTH_DEGREE) < 0.001) {
                    birthMomentCurrentIteration = testMoment;
                    break;
                } else if (testDegree < TRUE_TARGET_BIRTH_DEGREE) {
                    // Handling potential degree wrap-around for comparison if day crosses 0/360 reference
                    if (SolarStartDegree > SolarEndDegree && testDegree < SolarEndDegree && TRUE_TARGET_BIRTH_DEGREE > SolarStartDegree) {
                        high = mid - 1;
                    } else {
                        low = mid + 1;
                    }
                } else { // testDegree > TRUE_TARGET_BIRTH_DEGREE
                    if (SolarStartDegree > SolarEndDegree && testDegree > SolarStartDegree && TRUE_TARGET_BIRTH_DEGREE < SolarEndDegree) {
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                }
            }

            if (birthMomentCurrentIteration) {
                console.log("Target degree " + TRUE_TARGET_BIRTH_DEGREE + " found on " + currentDate.format("YYYY-MM-DD") + " at: " + birthMomentCurrentIteration.format('YYYY-MM-DD HH:mm:ss.SSS'));
                // Update finalFoundBirthMoment. If the target degree is found on multiple days
                // (possible with rounding if it's right on a day boundary for the SolarStart/End window),
                // this will take the finding from the latest day it was found on.
                // For a birth within the year, it should ideally only be found precisely on one day's search window.
                finalFoundBirthMoment = birthMomentCurrentIteration;
            } else {
                // This might happen if the degree is at the very edge and precision issues prevent exact match
                // console.log("Target degree " + TRUE_TARGET_BIRTH_DEGREE + " not precisely matched by binary search on " + currentDate.format("YYYY-MM-DD"));
            }
        }

        const currentHelioLongitude = getHeliocentricLongitude(dayInfo.SolarNoon.toDate());
        let monthIndex = Math.floor(getDegree(currentHelioLongitude, springEquinoxLongitude) / 30);
        if (monthIndex >= 12) monthIndex = 0; // Ensure it wraps around for Pisces end of year

        let events;

        // Use finalFoundBirthMoment to check for event placement.
        // This ensures the event is placed based on the single, most accurately determined moment.
        if (finalFoundBirthMoment.format('MM/DD/YY') == currentDate.format('MM/DD/YY')) {
            events = [{ name: 'BirthOrbit', description: 'Birthday', date: finalFoundBirthMoment.format('YYYY-MM-DD HH:mm:ss') }];
            console.log('BirthOrbit event WILL BE PLACED on ' + currentDate.format('MM/DD/YY') + ' (using found moment: ' + finalFoundBirthMoment.format('YYYY-MM-DD HH:mm:ss') + ')');
        } else {
            events = equinoxSolsticeEvents
                .filter(event => event.date.format('MM/DD/YY') === currentDate.format('MM/DD/YY'))
                .map(event => ({ name: event.name, description: event.description, date: event.date.format('YYYY-MM-DD HH:mm:ss') }));
        }

        const day: Day = {
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

const getDegree = (helioLongitude, springEquinoxLongitude) => parseFloat(
    ((helioLongitude - springEquinoxLongitude + 360) % 360).toFixed(2)
);

const eventList = (year: number, birth: moment.Moment) => {
    const season = Seasons(year);
    const nextSeason = Seasons(year + 1);
    const Apsis = SearchPlanetApsis(Body.Earth, new Date(year, 4, 1));

    const list: Events = {
        SpringEquinox: moment(season.mar_equinox.toString()).utc(),
        SummerSolstice: moment(season.jun_solstice.toString()).utc(),
        AutumnEquinox: moment(season.sep_equinox.toString()).utc(),
        WinterSolstice: moment(season.dec_solstice.toString()).utc(),
        SpringEquinox2: moment(nextSeason.mar_equinox.toString()).utc(),
        Aphelion: moment(Apsis.time.toString()).utc(),
        Perihelion: moment(NextPlanetApsis(Body.Earth, Apsis).time.toString()).utc(),
        Birth: birth
    }
    

    return list;
}

const getDayInfo = (date: FlexibleDateTime) => {
    let SolarNoon = moment(SearchHourAngle(Body.Sun, observer, 0, date).time.toString());
    let Moon = MoonPhase(SolarNoon.toDate());
    let Phase = "";

    if (Moon >= 0 && Moon < 45) {
        Phase = "New Moon";
    } else if (Moon >= 45 && Moon < 90) {
        Phase = "Waxing Cres.";
    } else if (Moon >= 90 && Moon < 135) {
        Phase = "First Quarter";
    } else if (Moon >= 135 && Moon < 180) {
        Phase = "Waxing Gibb.";
    } else if (Moon >= 180 && Moon < 225) {
        Phase = "Full Moon";
    } else if (Moon >= 225 && Moon < 270) {
        Phase = "Waning Gibb.";
    } else if (Moon >= 270 && Moon < 315) {
        Phase = "Third Quarter";
    } else if (Moon >= 315 && Moon <= 360) {
        Phase = "Waning Cres.";
    }

    const SolarStart = moment(SearchHourAngle(Body.Sun, observer, 12, SolarNoon.toDate(), -1).time.toString()).utc();
    const SolarEnd = moment(SearchHourAngle(Body.Sun, observer, 12, SolarNoon.toDate(), +1).time.toString()).utc();

    const TimeInDay = SolarEnd.diff(SolarStart);

    const sign = TimeInDay >= 86400000 ? '+' : '-';
    const duration = TimeInDay - 86400000;

    const formattedDuration = Math.abs(duration) / 1000;



    return {
        MoonPhase: Phase,
        SolarStart: SolarStart,
        SolarNoon: SolarNoon,
        SolarEnd: SolarEnd,
        Delta: `${sign}${formattedDuration}`,
    }
}

function getHeliocentricLongitude(date: Date) {
    const { x, y } = HelioVector(Body.Earth, date);
    const heliocentricLongitude = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
    return heliocentricLongitude;
}


function getBirthDegree(birthDate: moment.Moment) {

    const BirthYearSeasons = Seasons(birthDate.year())
    let springEquinoxLongitude;

    if (birthDate < moment(BirthYearSeasons.mar_equinox.toString()).utc()) {
        const previousSeasons = Seasons(birthDate.year() - 1)
        springEquinoxLongitude = getHeliocentricLongitude((moment(previousSeasons.mar_equinox.toString()).utc()).toDate())
    } else {
        springEquinoxLongitude = getHeliocentricLongitude((moment(BirthYearSeasons.mar_equinox.toString()).utc()).toDate())
    }

    let BirthLongitude = getHeliocentricLongitude(birthDate.utc().toDate());

    return (getDegree(BirthLongitude, springEquinoxLongitude));

}


const birthProfile = {
    observer: new Observer(41.454380, -74.430420, 0),
    date: moment.tz('2000-02-04 10:00', 'YYYY-MM-DD HH:mm', 'America/New_York').utc()
    //date: moment.tz('1999-08-04 9:04', 'YYYY-MM-DD HH:mm', 'America/New_York').utc()
}

export const generateCalendar = () => {
    //observer = new Observer(40.048566, -74.139358, 0); // Example coordinates
    observer= birthProfile.observer
    let events = eventList(2025, birthProfile.date);
    console.log("Initial eventList.SpringEquinox UTC:", events.SpringEquinox.toISOString()); // ADD THIS
    generateCalendarYear(events);
    console.log(calendar)
    return calendar;
};

