# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LibreView Glucose Monitor is a Chrome Extension that provides real-time glucose monitoring functionality by integrating with the LibreView API (FreeStyle Libre CGM data). It features dynamic browser icons, interactive popup charts, and glucose trend projections.

## Development Commands

### Building

```bash
# Build Chrome extension for production
pnpm run build

# Build extension with development mode and file watching
pnpm run watch
```

### Code Quality

```bash
# Lint TypeScript/TSX files
pnpm run lint

# Auto-fix linting issues
pnpm run lint:fix

# TypeScript type checking
pnpm exec tsc --noEmit --project .
```

### Development Workflow

**IMPORTANT**: After every code change, automatically run both linting and type checking to ensure code quality:

```bash
pnpm run lint && pnpm exec tsc --noEmit --project .
```

Claude should proactively run these commands after making any code changes to catch and fix TypeScript errors, linting issues, and ensure code quality before proceeding.

## Code Style Guidelines

**IMPORTANT**: All code must follow the guidelines in CODESTYLE.md:

### TypeScript

- Always prefer `type` over `interface`
- Avoid `any` type at any cost
- If casting is unavoidable, make sanity-checks before casting

### React

- Component props are simply called "Props" (not "ComponentNameProps")
- Always do named exports, avoid default exports
- Write small, composable, reusable components
- Every component should have a unique `data-testid` resembling its component name
- Even if not a component, every parent container should have a `data-testid` resembling its container name

## Architecture

### Chrome Extension Structure

**Extension Components** (`src/extension/`):

- `background/background.ts` - Service worker handling API calls, data persistence, alarm scheduling, and dynamic icon updates
- `popup/popup.tsx` - React-based popup interface with Recharts visualization and 60-minute glucose projections
- `popup/config/glucoseConfig.ts` - Centralized configuration for glucose ranges, colors, chart styling, and animations
- `utils/storage.ts` - Chrome Storage API wrapper for secure credential management
- `utils/iconGenerator.ts` - Dynamic browser icon generation with glucose-based color coding

**Shared Types** (`src/types/`):

- `index.ts` - TypeScript interfaces for GlucoseData and ApiResponse used across all extension components

### Key Technical Decisions

**Glucose Projection Algorithm**: Uses simple linear regression to predict glucose trends up to 60 minutes ahead. The algorithm:

- Analyzes last 30 minutes of data for trend calculation
- Applies conservative bounds (max glucose values 40-400 mg/dL)
- Generates 5-minute interval projections
- Uses linear trend analysis for predictable glucose forecasting

**Chrome Extension Persistence**: Uses Chrome Alarms API instead of setInterval for reliable background data fetching every minute, ensuring persistence across browser sessions.

**Icon Generation**: Real-time browser icon updates using OffscreenCanvas with glucose color zones:

- Green (100-155): Normal range
- Orange (156-189): Elevated
- Red (70-99, 190-249): Low/High
- Dark Red (<70, 250+): Very Low/Very High

### Data Flow

1. Background service worker authenticates with LibreView API using stored credentials
2. Fetches glucose data every minute via Chrome alarms
3. Updates browser icon with current glucose value and appropriate color
4. Popup interface displays interactive Recharts visualization with actual + projected data
5. Sequential animation: actual glucose line renders first (1.5s), then projection line (1s)

## Key Dependencies

- **recharts@3.1.2**: Modern chart visualization library with React 19 support
- **axios**: HTTP client for LibreView API integration
- **react@19.1.1** & **react-dom@19.1.1**: Latest React framework with new createRoot API
- **webpack**: Extension bundling with TypeScript support

## Development Notes

### Extension Structure

- `extension/manifest.json` - Chrome Extension Manifest V3 configuration
- `extension/popup/popup.html` - Static HTML shell for React popup
- `dist/` - Built extension files ready for Chrome installation

### TypeScript Configuration

- Uses separate `tsconfig.extension.json` for extension builds
- Chrome types via `@types/chrome`
- React 19 compatibility with updated type definitions (@types/react@19, @types/react-dom@19)

### API Integration

LibreView API endpoints:

- Authentication: POST `/llu/auth/login`
- Glucose data: GET `/llu/connections/{patientId}/graph`
- Automatic token refresh on expiry

### Glucose Configuration System

**Centralized Configuration** (`src/extension/popup/config/glucoseConfig.ts`):

The application uses a centralized configuration system that defines:

- **Glucose Color Zones**: Named color constants (GLUCOSE_COLORS) for consistent styling across all components
- **Glucose Ranges**: Threshold definitions (GLUCOSE_RANGES) for each medical zone
- **Reference Lines & Areas**: Chart configuration for visual glucose range indicators
- **Y-Axis Configuration**: Domain, ticks, and styling for chart axes
- **Chart Styling**: Consistent fonts, colors, and visual properties
- **Animation Timing**: Centralized animation durations and delays

**Medical Glucose Ranges**:

- < 70 mg/dL: Very Low (Dark Red #8B0000)
- 70-99 mg/dL: Low (Red #f44336)
- 100-155 mg/dL: Normal (Green #4caf50)
- 156-189 mg/dL: Elevated (Orange #ff9800)
- 190-249 mg/dL: High (Red #f44336)
- 250+ mg/dL: Very High (Dark Red #8B0000)

**Usage**: All components (charts, icons, status displays) reference the centralized config to ensure consistent glucose zone colors, ranges, and styling. The DelayedReferenceArea component uses config values for the normal range (100-155 mg/dL) visualization.
