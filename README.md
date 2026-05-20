# Even Steven

**Fair splits for every trip.**

A mobile app for groups to track shared expenses and calculate the minimum number of settlements needed for everyone to be square. No more splitting 12 separate payments after a 7-day trip.

Available on iOS and Android.

---

## Features

> This section grows as features are built. Nothing is listed until it's shipped.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + TypeScript |
| Framework | Expo (managed workflow) |
| Styling | NativeWind (Tailwind CSS for RN) |
| Routing | Expo Router |
| Backend | Supabase (Postgres, Realtime, Auth, Storage) |
| Auth | Google OAuth via Supabase Auth |
| State | TanStack Query + Zustand |
| Push notifications | Expo Notifications |
| Transactional email | Resend |
| Exchange rates | Frankfurter API (ECB) |

---

## Prerequisites

Before running this project you need:

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **Expo Go** app on your phone — [iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **EAS CLI** — `npm install -g eas-cli` then `eas login`
- A **Supabase** project with Google OAuth configured (see Environment Variables below)
- A **Google Cloud** project with OAuth 2.0 credentials (Web + iOS client IDs)

---

## Setup

```bash
# Clone the repo
git clone https://github.com/Kizza00232Jera/even-steven.git
cd even-steven

# Install dependencies
npm install

# Copy the env template and fill in your values
cp .env.example .env

# Start the development server
npx expo start
```

Scan the QR code with Expo Go on your phone.

> For Google Sign-In to work you need a development build, not Expo Go.
> Run `eas build --profile development --platform ios` (or `android`) for a dev build.

---

## Environment Variables

Create a `.env` file at the root (never commit it):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
GOOGLE_WEB_CLIENT_ID=
GOOGLE_WEB_CLIENT_SECRET=
RESEND_API_KEY=
SUPABASE_DB_PASSWORD=
```

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Authentication → Providers → Google**
3. Paste your Google Web Client ID and Secret
4. Copy your project URL and anon key into `.env`

### Google OAuth setup

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Go to **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
3. Create one **Web** client (redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`)
4. Create one **iOS** client (bundle ID: `com.evensteven.app`)
5. Add the iOS client ID to `.env` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

---

<!-- Screenshots: added once first screens are built -->

---

## Contributing

Branch off `main`, open a PR with a clear description of what changed and why.

```
feature/<description>   # new features
fix/<description>       # bug fixes
db/<description>        # schema changes
chore/<description>     # tooling, config
```
