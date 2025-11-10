# Interval Timer

A modern, responsive interval timer web application designed for workouts, HIIT training, and other interval-based activities. Built with React, TypeScript, and Vite.

## Features

- **Customizable Intervals**: Configure work and rest periods with minute:second precision
- **Multiple Rounds**: Set up to 100 rounds of work/rest cycles
- **Warmup & Cooldown**: Optional warmup and cooldown periods
- **Audio Cues**: Digital sport-watch style beeps for countdown (3-2-1) and interval transitions
- **Vibration Feedback**: Haptic feedback on interval transitions (mobile devices)
- **Screen Wake Lock**: Keep screen awake during workouts
- **Notifications**: Browser notifications when workout completes
- **Preset Management**: Save, load, rename, and delete custom timer configurations
- **Fullscreen Mode**: Distraction-free fullscreen experience
- **Responsive Design**: Optimized for mobile, tablet, and desktop devices
- **Auto-Scaling Display**: Large, readable timer digits that automatically adjust to screen size
- **Background Resilience**: Timer continues tracking even if the browser tab is backgrounded

## Technologies

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Web Audio API** - Audio cues
- **Screen Wake Lock API** - Keep screen active
- **Vibration API** - Haptic feedback
- **Notifications API** - Workout completion alerts
- **React Icons** - UI icons

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Garko01/interval-timer.git
   cd interval-timer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

### Basic Timer Operation

1. Click the **Settings** (⚙️) button to configure your timer
2. Set your desired:
   - Number of rounds
   - Work interval duration
   - Rest interval duration
   - Optional warmup/cooldown periods
3. Click **Save** to apply settings
4. Press the **Play** button to start the timer
5. Use **Pause** to pause and **Reset** to return to settings

### Managing Presets

1. Configure your desired settings
2. In the Settings modal, enter a name for your preset
3. Click **Save** to store the preset
4. Use **Load** to quickly apply a saved preset
5. **Rename** or **Delete** presets as needed

### Additional Features

- **Fullscreen**: Click the fullscreen button (⛶) in the bottom-right corner
- **Pre-count 3-2-1**: Toggle countdown beeps in the last 3 seconds of each interval
- **Mute sounds**: Disable all audio cues
- **Keep screen awake**: Prevent screen from sleeping during workout
- **Vibrate on transitions**: Enable haptic feedback (mobile devices)
- **Finish notification**: Get browser notification when workout completes

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build locally

### Project Structure

```
interval-timer/
├── src/
│   ├── App.tsx          # Main application component
│   ├── timer.ts         # Timer logic, audio, and utilities
│   ├── main.tsx         # Application entry point
│   ├── styles.css       # Global styles
│   └── vite-env.d.ts    # Vite type definitions
├── public/              # Static assets
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite configuration
```

## Browser Compatibility

- **Chrome/Edge**: Full support for all features
- **Firefox**: Full support for all features
- **Safari**: Full support (iOS 16.4+ for Wake Lock API)
- **Mobile Browsers**: Optimized for touch and smaller screens

Note: Some features like Wake Lock, Vibration, and Notifications may not be available in all browsers or may require user permission.

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
