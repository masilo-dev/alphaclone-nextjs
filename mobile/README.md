# AlphaClone Mobile

React Native mobile application for AlphaClone Business OS built with Expo.

## Features

- 📱 Cross-platform mobile app (iOS & Android)
- 🔐 Secure authentication with Supabase
- 📊 Dashboard with real-time metrics
- 📋 Project management
- 👥 CRM with lead tracking
- 💰 Financial management & invoicing
- 🎨 Modern, responsive UI design
- 🌙 Dark mode support
- 📱 Native device features

## Setup

### Prerequisites

- Node.js (v16 or higher)
- Expo CLI
- iOS Simulator or Android Emulator

### Installation

1. Navigate to the mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create a `.env` file in the mobile directory:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm start
```

## Development

### Running on iOS
```bash
npm run ios
```

### Running on Android
```bash
npm run android
```

### Running on Web
```bash
npm run web
```

## Building for Production

### Configure EAS Build

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Login to Expo:
```bash
eas login
```

3. Configure the project:
```bash
eas build:configure
```

### Build Commands

#### iOS Build
```bash
eas build --platform ios
```

#### Android Build
```bash
eas build --platform android
```

#### Both Platforms
```bash
eas build --platform all
```

## Project Structure

```
mobile/
├── src/
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React contexts (Auth, etc.)
│   ├── screens/        # App screens
│   ├── services/       # API services and utilities
│   └── types/          # TypeScript types
├── assets/             # Images, fonts, etc.
├── app.json            # Expo configuration
└── package.json        # Dependencies and scripts
```

## Key Dependencies

- **Expo**: React Native development platform
- **React Navigation**: Navigation library
- **Supabase**: Backend services
- **React Native Paper**: UI component library
- **React Hook Form**: Form handling
- **Zustand**: State management
- **React Query**: Data fetching and caching

## Features Overview

### Authentication
- Email/password login
- Google OAuth integration
- Secure session management
- Biometric authentication (coming soon)

### Dashboard
- Real-time business metrics
- Quick action buttons
- Recent activity feed
- Performance analytics

### Project Management
- Project list and details
- Task tracking
- Progress visualization
- Deadline management

### CRM
- Lead management
- Contact information
- Deal value tracking
- Status updates

### Finance
- Invoice management
- Payment tracking
- Financial overview
- Revenue analytics

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on multiple devices
5. Submit a pull request

## License

This project is part of the AlphaClone Business OS and follows the same licensing terms.