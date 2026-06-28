<div align="center">

<img src="assets/icon.png" alt="Even Steven" width="84">

# Even Steven

**Fair splits for every trip.**

[![Case study](https://img.shields.io/badge/Case_study-antoniojerkovic.com-080C18?style=for-the-badge)](https://antoniojerkovic.com/projects/even-steven)

![React Native](https://img.shields.io/badge/React_Native-20232A?logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-1B1F23?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?logo=jest&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

A mobile app for groups to track shared expenses and settle up with the fewest payments possible. Instead of 12 separate transfers after a 7-day trip, it works out the minimum set of settlements that makes everyone square. Built for iOS and Android.

## Features

- **Group expenses** — add who paid, who shares the cost, and split evenly or by custom amounts.
- **Smart settle-up** — the app reduces all the debts in a group to the minimum number of payments.
- **Real-time sync** — everyone in a group sees changes live, powered by Supabase Realtime.
- **Multi-currency** — expenses in different currencies, converted with live ECB rates.
- **Push notifications** — get notified when you are added to a group or an expense changes.
- **Deep-link invites** — share a link, tap it, and you are in the group.
- **Google Sign-In** — one-tap auth, session kept across cold restarts.
- **Test-driven** — core split and settlement logic is covered by Jest.

## Tech stack

| Layer | Technology |
| --- | --- |
| Mobile | React Native + TypeScript |
| Framework | Expo (managed workflow) + Expo Router |
| Styling | NativeWind (Tailwind for React Native) |
| Backend | Supabase (Postgres, Realtime, Auth, Storage) |
| Auth | Google OAuth via Supabase Auth |
| State / data | TanStack Query + Zustand |
| Notifications | Expo Notifications |
| Email | Resend |
| Exchange rates | Frankfurter API (ECB) |
| Testing | Jest + Testing Library |

## Run it locally

Prerequisites: Node 18+, the EAS CLI (`npm install -g eas-cli`), a Supabase project, and Google OAuth credentials.

```bash
git clone https://github.com/Kizza00232Jera/even-steven.git
cd even-steven
npm install
cp .env.example .env   # fill in your values
npx expo start
```

Google Sign-In needs a development build rather than Expo Go:

```bash
eas build --profile development --platform android   # or ios
```

### Environment

Create a `.env` at the root (never commit it):

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

For Supabase, enable the Google provider under **Authentication → Providers** and paste your Google Web Client ID and secret. For Google, create a Web client (redirect URI `https://<project>.supabase.co/auth/v1/callback`) and an iOS client (bundle ID `com.evensteven.app`).

## License

[MIT](LICENSE) © Antonio Jerković
