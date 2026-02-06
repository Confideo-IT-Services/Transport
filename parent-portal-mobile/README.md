# ConventPulse Parent Portal Mobile App

React Native mobile application for parents to view their children's school information.

## Features

- **Attendance**: View attendance records with date filtering
- **Homework**: View homework assignments with completion status
- **Notifications**: View and manage school notifications
- **Fees**: View fee records and download receipts
- **Test Results**: View test/exam results with performance indicators

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (for Mac) or Android Emulator

## Setup Instructions

1. **Install dependencies** (already done):
   ```bash
   npm install
   ```

2. **Configure API URL**:
   - Open `app.json`
   - Update the `extra.apiUrl` field with your backend API URL:
     ```json
     "extra": {
       "apiUrl": "http://your-backend-url:3000/api"
     }
     ```
   - For local development: `http://localhost:3000/api`
   - For production: Update with your production API URL

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Run on device/emulator**:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your physical device

## Project Structure

```
parent-portal-mobile/
├── src/
│   ├── config/
│   │   └── api.ts              # API configuration and endpoints
│   ├── contexts/
│   │   └── AuthContext.tsx     # Authentication context
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── AttendanceScreen.tsx
│   │   ├── HomeworkScreen.tsx
│   │   ├── NotificationsScreen.tsx
│   │   ├── FeesScreen.tsx
│   │   └── TestResultsScreen.tsx
│   ├── components/
│   │   ├── LoadingSpinner.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ChildSelector.tsx
│   │   └── DateRangePicker.tsx
│   └── navigation/
│       └── AppNavigator.tsx    # Navigation setup
├── App.tsx                      # Main app entry point
└── app.json                     # Expo configuration
```

## API Integration

The app uses the same backend APIs as the web application:

- Authentication: `/api/auth/parent/login`
- Children: `/api/parents/children`
- Attendance: `/api/parents/children/:studentId/attendance`
- Homework: `/api/parents/children/:studentId/homework`
- Notifications: `/api/parents/children/:studentId/notifications`
- Fees: `/api/parents/children/:studentId/fees`
- Test Results: `/api/parents/children/:studentId/test-results`

## Development

- The app uses React Navigation for routing
- AsyncStorage for token persistence
- All API calls are defined in `src/config/api.ts`
- Authentication state is managed via Context API

## Building for Production

1. **Build for iOS**:
   ```bash
   eas build --platform ios
   ```

2. **Build for Android**:
   ```bash
   eas build --platform android
   ```

## Notes

- Make sure your backend server is running and accessible
- Update the API URL in `app.json` before building for production
- The app requires internet connection to fetch data from the backend
