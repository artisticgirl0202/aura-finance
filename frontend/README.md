# Aura Finance Frontend - 3D Visualization Dashboard

React Three Fiber-based interactive 3D financial data visualization client.

---

## Core Features

1. **3D City Rendering**
   - React Three Fiber + Three.js
   - WebGL-based high-performance rendering
   - Real-time particle animation per transaction

2. **AI Integration**
   - Real-time communication with the backend classification API
   - Instant 3D visualization of classification results

3. **User Interface**
   - Transaction input panel (single and batch)
   - Budget and goal dashboards
   - Analytics stats dashboard (charts, trends, AI advice)

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

---

## Project Structure

```
src/
├── components/
│   ├── 3d/
│   │   ├── CityScene.tsx          # Main 3D scene
│   │   ├── CityDistrict.tsx       # District buildings per category
│   │   ├── ParticleSystem.tsx     # Particle animation per transaction
│   │   ├── IncomeBeam.tsx         # Income beam visualization
│   │   ├── InvestmentNode.tsx     # Investment node visualization
│   │   └── CelebrationEffect.tsx  # Goal achievement effect
│   └── ui/
│       ├── DashboardWidget.tsx    # Unified widget card (design system)
│       ├── AIInsightCard.tsx      # AI insight rendering card
│       ├── StatsDashboard.tsx     # Charts and analytics panel
│       ├── DashboardOverlay.tsx   # Transaction detail overlay
│       ├── GoalsDashboard.tsx     # Goals management panel
│       └── BudgetPanel.tsx        # Budget management panel
├── hooks/
│   ├── useTransactionClassifier.ts  # API communication hook
│   ├── useBudget.ts                 # Budget state management
│   ├── useAnalyticsOverview.ts      # Analytics data fetching
│   ├── useAnalyticsInsights.ts      # AI insight alerts
│   ├── useGoalAchievements.ts       # Goal achievement detection
│   └── useSimulationMode.ts         # Simulation mode management
├── App.tsx                          # Main application
└── main.tsx                         # Entry point
```

---

## Component Notes

### `CityScene.tsx`
- Main scene managing the full 3D city
- Circular district layout with `radius = 8`
- Lighting, camera, and environment configuration

### `CityDistrict.tsx`
- 3D buildings representing each spending category
- Hover animation (vertical movement, rotation)
- Point light glow effect

### `ParticleSystem.tsx`
- Particles spawned on transaction events
- Particle count: `Math.min(Math.max(Math.floor(amount / 10), 15), 80)`
- Fade-out effect over particle lifetime

### `DashboardWidget.tsx`
- Unified widget card for the cyberpunk design system
- Dark glassmorphism background, neon border, hover glow
- Reused across StatsDashboard, DashboardOverlay, GoalsDashboard

---

## Camera Controls

- **Mouse drag**: Rotate camera
- **Mouse wheel**: Zoom in/out
- **Right-click drag**: Pan camera

---

## Environment Variables

Create a `.env` file:
```env
VITE_API_URL=http://localhost:8000
```

---

## Performance Optimizations

- **Code splitting**: Three.js and React Three Fiber bundled as separate chunks (see `vite.config.ts`)
- **Memoization**: `useMemo` used throughout 3D components to avoid redundant calculations
- **Async rendering**: `Suspense` for 3D scene loading

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` | UI framework |
| `three` | 3D rendering engine |
| `@react-three/fiber` | React wrapper for Three.js |
| `@react-three/drei` | Three.js helper components |
| `axios` | HTTP client |
| `framer-motion` | UI animation |
| `recharts` | 2D charts for analytics dashboard |
| `vite` | Build tool |

---

## Troubleshooting

### 3D not rendering
- Confirm browser supports WebGL
- Update GPU drivers

### API connection failure
- Confirm backend is running at `http://localhost:8000`
- Check CORS configuration

### Performance degradation
- Reduce particle count by lowering the `max` value in `ParticleSystem.tsx`
- Disable anti-aliasing in the Canvas configuration

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
