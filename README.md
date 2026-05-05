# 🐣 Cooped Up

A campus social app that nudges students toward spontaneous outdoor and social activity — surfacing the right opportunities based on real-time weather and on-campus space availability.

---

## What it does

Students spend too much time indoors. Cooped Up watches the weather and checks which campus spaces are free, then surfaces timely nudges: *"It's 22°C and the courtyard is empty — get outside."*

Core features (planned):
- 🌤 Real-time weather-aware activity feed
- 📍 Campus space availability (outdoor + indoor social spots)
- 👥 See what other students are doing / where they're heading
- 🔔 Smart nudge notifications when conditions are right
- 👤 User profiles and activity preferences

---

## Tech stack

| Layer | Technology |
|---|---|
| Mobile framework | React Native + Expo (managed workflow) |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| Auth + Database | Supabase |
| Weather API | Open-Meteo (or OpenWeatherMap) |
| Space availability | TBD (manual / scraped / campus API) |

---

## Getting started

### Prerequisites
- Node.js (v18 or later)
- npm or yarn
- Expo Go app on your phone (for development)

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/cooped-up.git
cd cooped-up

# Install dependencies
npm install

# Copy the environment variable template
cp .env.example .env
# Then fill in your keys in .env

# Start the dev server
npx expo start
```

Scan the QR code in your terminal with the Expo Go app to run on your phone.

---

## Environment variables

Copy `.env.example` to `.env` and fill in the values. Never commit `.env` directly.

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_WEATHER_API_KEY=your_weather_api_key   # if using OpenWeatherMap
```

---

## Project structure

```
cooped-up/
├── app/                  # Expo Router screens
│   ├── (tabs)/           # Bottom tab screens (home, map, profile)
│   ├── auth/             # Login and signup screens
│   └── _layout.tsx       # Root navigation layout
├── components/
│   ├── ui/               # Generic reusable components
│   └── features/         # Feature-specific components
├── hooks/                # Custom React hooks
├── lib/                  # Supabase client and other lib setup
├── services/             # API call logic (weather, spaces)
├── types/                # Shared TypeScript types
├── constants/            # Theme, colours, config
└── assets/               # Images, icons, fonts
```

---

## Branching strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, production-ready code only |
| `dev` | Integration branch — all features merge here first |
| `feature/your-feature-name` | Individual feature work |
| `fix/your-fix-name` | Bug fixes |

**Workflow:**
1. Branch off `dev` → `feature/your-feature`
2. Open a Pull Request into `dev` when done
3. Get at least one teammate to review
4. `dev` merges into `main` for releases

---

## Team

Built by [Your Group Name] as part of [Course / Hackathon / Project].

---

## Licence

MIT
