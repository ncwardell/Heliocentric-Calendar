# Heliocentric Calendar

A custom-built calendar system based on Earth's actual heliocentric (Sun-centered) orbital position, rather than the traditional Gregorian calendar. This calendar divides the year into 12 zodiacal months of approximately 30° each, starting at the Spring Equinox.

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Calendar Structure](#calendar-structure)
- [Technical Details](#technical-details)
- [Known Issues](#known-issues)
- [Potential Improvements](#potential-improvements)
- [Dependencies](#dependencies)
- [License](#license)

## Overview

Unlike the Gregorian calendar that uses arbitrary month lengths and starts the year on January 1st, this Heliocentric Calendar:

- **Starts each year at the Spring Equinox** (when Earth crosses 0° ecliptic longitude)
- **Divides the year into 12 zodiac-based months** (Aries through Pisces), each representing 30° of Earth's orbit
- **Measures days from solar noon to solar noon** rather than midnight to midnight
- **Tracks your personal "orbital birthday"** - the moment when Earth returns to the exact heliocentric position it occupied at your birth

## How It Works

### Heliocentric vs Geocentric

Traditional calendars are **geocentric** (Earth-centered), based on local observations of the Sun, Moon, and stars from Earth's surface. This calendar is **heliocentric** (Sun-centered), based on Earth's actual position in its orbit around the Sun.

### Orbital Mechanics

1. **Reference Point**: The Spring Equinox is set as 0° for each year
2. **Heliocentric Longitude**: Earth's position is calculated using astronomical libraries that compute Earth's XY coordinates relative to the Sun
3. **Month Assignment**: Each month covers 30° of orbital travel:
   - Aries: 0° - 30°
   - Taurus: 30° - 60°
   - Gemini: 60° - 90°
   - ...and so on through Pisces (330° - 360°/0°)

### Solar Days

Days are measured from **solar noon to solar noon** (when the Sun crosses your local meridian), not midnight to midnight. This results in:

- Days that are slightly longer or shorter than 24 hours (shown as Delta)
- More astronomically accurate day boundaries
- Day lengths that vary throughout the year due to Earth's elliptical orbit

### Orbital Birthday Calculation

The calendar calculates your "orbital birthday" by:

1. Finding the heliocentric longitude of Earth at your birth moment
2. Using binary search to find when Earth returns to that exact position each year
3. Accounting for precession and orbital mechanics variations

## Features

- **12 Zodiac Months**: Each month corresponds to a 30° segment of Earth's orbit
- **Astronomical Events**: Displays Spring/Autumn Equinoxes, Summer/Winter Solstices, Aphelion, and Perihelion
- **Orbital Birthday**: Marks the day Earth returns to your birth position
- **Moon Phases**: Shows the current moon phase for each day
- **Solar Noon Times**: Local solar noon for observer's location
- **Day Length Delta**: Shows how much longer/shorter than 24 hours each day is
- **Solar Degree**: Earth's position in degrees (0° - 360°) from the Spring Equinox
- **Print-Friendly Layout**: Designed for printing physical calendars

## Installation

### Prerequisites

- Node.js (v14 or higher recommended)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/ncwardell/Heliocentric-Calendar.git
cd Heliocentric-Calendar
```

2. Install dependencies:
```bash
npm install
```

3. The dependencies include:
   - `astronomy-engine`: Astronomical calculations
   - `moment`: Date/time manipulation
   - `moment-timezone`: Timezone support
   - `sweph`: Swiss Ephemeris (precise planetary positions)

## Usage

### Configuration

Currently, the birth profile and observer location are **hard-coded** in `CalendarGenerator.ts` (lines 292-296):

```typescript
const birthProfile = {
    observer: new Observer(41.454380, -74.430420, 0),
    date: moment.tz('2000-02-04 10:00', 'YYYY-MM-DD HH:mm', 'America/New_York').utc()
}
```

**To customize for your location and birth date:**

1. Open `CalendarGenerator.ts`
2. Modify the `birthProfile` object:
   - `observer`: Update with your latitude, longitude, and elevation (in meters)
   - `date`: Update with your birth date, time, and timezone

### Building

Compile the TypeScript to JavaScript:

```bash
npx tsc CalendarGenerator.ts --module es2020 --target es2020 --outDir dist
```

Or use your preferred TypeScript build configuration.

### Viewing the Calendar

1. Open `MainCalendar.html` in a web browser
2. The calendar will generate for the year 2025 (configurable in line 301 of `CalendarGenerator.ts`)

### Printing

The calendar is designed for printing:

- Each month is on a separate page
- Use your browser's print function (Ctrl+P / Cmd+P)
- Recommended: Print in landscape orientation for better readability

## Calendar Structure

### Month Layout

Each month displays:
- **Month Name**: With zodiac symbol (e.g., ♈ Aries)
- **Week Headers**: Planetary rulers (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn)
- **Day Cells** containing:
  - Day number (1-30 or 31, depending on orbital position)
  - Gregorian date (for reference)
  - Solar noon time (local)
  - Solar degree (Earth's orbital position)
  - Moon phase
  - Delta (day length variation from 24 hours)
  - Events (equinoxes, solstices, orbital birthday, etc.)

### Day Cell Information

```
┌─────────────────────────────┐
│ [Event Name]                │  ← Top: Events (if any)
│                             │
│ 1                  Jan 1st  │  ← Day # and Gregorian date
│ 12:00 PM          ♐        │  ← Solar noon and ruling planet
│                             │
│ Moon Phase  123.45°  +123   │  ← Bottom: Moon phase, Solar degree, Delta
└─────────────────────────────┘
```

## Technical Details

### Technologies Used

- **TypeScript**: Main calendar logic
- **astronomy-engine**: High-precision astronomical calculations
- **moment.js**: Date/time manipulation and timezone handling
- **HTML/CSS**: Frontend display
- **ES Modules**: Modern JavaScript module system

### Key Functions

#### `generateCalendar()`
Main entry point that initializes the observer and generates the calendar for a specific year.

#### `generateCalendarYear(eventList)`
Iterates through each day from one Spring Equinox to the next, calculating:
- Heliocentric longitude
- Month assignment (based on 30° segments)
- Day information (solar times, moon phase, delta)
- Orbital birthday detection (using binary search)

#### `getHeliocentricLongitude(date)`
Calculates Earth's heliocentric longitude (orbital position) for a given date:
```typescript
function getHeliocentricLongitude(date: Date) {
    const { x, y } = HelioVector(Body.Earth, date);
    const heliocentricLongitude = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
    return heliocentricLongitude;
}
```

#### `getBirthDegree(birthDate)`
Calculates the heliocentric degree at birth, relative to that year's Spring Equinox.

#### `getDayInfo(date)`
Retrieves solar times (start, noon, end), moon phase, and calculates day length delta.

### Orbital Birthday Algorithm

The calendar uses a sophisticated binary search (lines 109-155) to find the precise moment when Earth returns to your birth longitude:

1. Checks each day to see if the target degree falls within that day's range
2. If yes, performs binary search within that day to find the exact moment
3. Handles wrap-around cases (when crossing 0°/360° boundary)
4. Precision target: within 0.001° (about 4 seconds of time)

## Known Issues

### Critical Issues

1. **Hard-coded Configuration**: Birth profile and observer location must be manually edited in source code
2. **No Input Validation**: No checks for invalid dates, coordinates, or timezones
3. **No Error Handling**: Astronomical calculations could fail without try-catch blocks

### Code Quality Issues

4. **Debug Console Logs**: Multiple `console.log()` statements left in production code (lines 77, 80, 145, 302, 304)
5. **TypeScript Configuration**: Missing `tsconfig.json` for proper type checking
6. **Implicit `any` Types**: Some function parameters lack explicit type annotations (e.g., line 198)
7. **Magic Numbers**: Hard-coded values like `86400000` (milliseconds in a day), `0.001` (precision threshold), etc.

### User Experience Issues

8. **No User Interface**: No way to customize settings without editing code
9. **Single Year Only**: Generates only one year at a time
10. **Time Zone Confusion**: Mixing UTC and local times could confuse users
11. **Limited Documentation**: No inline comments explaining the heliocentric concept

### Technical Debt

12. **No Build System**: No package.json scripts for building, testing, or linting
13. **No Tests**: No unit tests for critical astronomical calculations
14. **Monolithic Code**: All logic in one file; could benefit from modularization
15. **Unused Code**: Commented-out alternative birth date (line 295)
16. **No Package Lock**: Missing `package-lock.json` for reproducible builds

## Potential Improvements

### High Priority

1. **Add User Interface**:
   - Form to input birth date, time, and timezone
   - Coordinate picker or location search (using geocoding API)
   - Year selector to generate any year's calendar

2. **Configuration System**:
   - JSON configuration file
   - Local storage for browser-based settings persistence
   - Export/import settings

3. **Error Handling**:
   - Input validation (date ranges, coordinate bounds, etc.)
   - Try-catch blocks around astronomical calculations
   - User-friendly error messages

4. **Code Quality**:
   - Remove console.logs or replace with proper logging system
   - Add `tsconfig.json` with strict mode
   - Extract constants to separate file
   - Split code into modules (calc, ui, utils)

### Medium Priority

5. **Documentation**:
   - Inline code comments
   - Explain heliocentric vs geocentric concepts
   - Add calculation methodology explanations
   - Create developer documentation

6. **Build System**:
   - Add npm scripts for build, dev, and test
   - Set up bundler (webpack, vite, or esbuild)
   - Add linting (ESLint) and formatting (Prettier)
   - Implement watch mode for development

7. **Testing**:
   - Unit tests for astronomical calculations
   - Validate against known astronomical events
   - Test edge cases (leap years, time zones, etc.)

8. **Multi-Year Support**:
   - Generate calendars for past or future years
   - Compare multiple years side-by-side
   - Show long-term orbital patterns

### Low Priority

9. **Export Options**:
   - PDF generation
   - iCal/ICS format for digital calendar apps
   - CSV export for data analysis
   - Image export for sharing

10. **Enhanced Display**:
    - Responsive design for mobile devices
    - Dark mode
    - Customizable color schemes
    - Interactive tooltips with detailed event information

11. **Advanced Features**:
    - Multiple observer locations
    - Track other planetary positions
    - Display aspects (angular relationships between planets)
    - Historical event overlay
    - Ephemeris table view

12. **Performance**:
    - Cache astronomical calculations
    - Lazy loading for multi-year views
    - Web worker for heavy calculations

## Dependencies

### Production Dependencies

- **astronomy-engine** (^2.1.19): High-precision astronomical calculations
  - Provides planetary positions, moon phases, seasons, etc.
  - Based on VSOP87 and other accurate astronomical models

- **moment** (^2.30.1): Date and time manipulation
  - Note: Moment.js is in maintenance mode; consider migrating to date-fns or Luxon

- **moment-timezone** (^0.5.46): Timezone support for moment
  - Handles timezone conversions and DST

- **sweph** (^2.10.3-4): Swiss Ephemeris
  - High-precision planetary ephemeris
  - Used for detailed astronomical calculations

### Development Dependencies

Currently none. Consider adding:
- TypeScript
- ESLint
- Prettier
- Jest or Vitest for testing
- Build tools (webpack, vite, etc.)

## Development

### Project Structure

```
Heliocentric-Calendar/
├── CalendarGenerator.ts    # Main calendar logic
├── MainCalendar.html        # HTML display
├── style.css                # Styling
├── package.json             # Dependencies
├── dist/                    # Compiled JavaScript
│   └── CalendarGenerator.js
└── README.md                # This file
```

### Contributing

This project could benefit from:
- UI/UX improvements
- Additional astronomical features
- Performance optimizations
- Bug fixes
- Documentation improvements
- Test coverage

### Future Considerations

- Migrate from moment.js to modern alternatives (Luxon, date-fns)
- Add proper TypeScript configuration and strict typing
- Implement continuous integration/deployment
- Create npm package for reusability
- Add internationalization (i18n) support
- Consider framework integration (React, Vue, Svelte)

## Astronomical Accuracy

This calendar uses the `astronomy-engine` library, which provides:
- Sub-arc-second precision for planetary positions
- Accurate calculations for centuries past and future
- Proper handling of Earth's orbital eccentricity
- Precise equinox and solstice timing

However, note that:
- Very long-term predictions (1000+ years) may have increasing uncertainty
- The calendar doesn't account for leap seconds
- Historical dates before 1582 (Gregorian calendar adoption) may need adjustment

## Credits

Built using:
- [astronomy-engine](https://github.com/cosinekitty/astronomy) by Don Cross
- [moment.js](https://momentjs.com/) timezone handling
- [Swiss Ephemeris](https://www.astro.com/swisseph/) for planetary calculations

## License

[Specify license here - currently not specified in repository]

---

**Note**: This calendar is for educational and personal use. For official date/time needs, always use the standard Gregorian calendar.
