# 🔥 Firebase Realtime Database API Guide

API for reading and writing data using Firebase Realtime Database in a Next.js app.

---

## 📋 Table of Contents

1. [Setup](#setup)
2. [API Endpoints](#api-endpoints)
3. [Usage Examples](#usage-examples)
4. [Helper Functions](#helper-functions)
5. [Database Schema](#database-schema)

---

## ⚙️ Setup

### 1. Environment Variables

Add Firebase configuration to your `.env.local` file:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=1:your_sender_id:web:your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-YOUR_MEASUREMENT_ID
```

> **Note**: Get Firebase values from Firebase Console → Project Settings → Your apps → SDK setup and configuration

> **Important**: Make sure to enable Realtime Database in your Firebase Console!

### 2. Install Firebase Package

```bash
npm install firebase
```

---

## 🌐 API Endpoints

### 📖 Read API: `GET /api/firebase/realtime-test`

Reads data from Realtime Database.

#### Query Parameters

| Parameter | Required | Description              | Example     |
| --------- | -------- | ------------------------ | ----------- |
| `path`    | ❌       | Database path to read    | `channels`  |

#### Response Example

```json
{
  "success": true,
  "path": "channels",
  "exists": true,
  "data": {
    "channel-1": {
      "channelId": "channel-1",
      "status": "active",
      "participantCount": 3
    }
  },
  "message": "Data read successfully from Realtime Database"
}
```

---

### ✍️ Write API: `POST /api/firebase/realtime-test`

Creates, updates, or deletes data in Realtime Database.

#### Request Body

```json
{
  "operation": "set | push | update | delete",
  "path": "Database path",
  "data": { "Data to save" }
}
```

#### Operations

| Operation | Description                             | Required Fields     |
| --------- | --------------------------------------- | ------------------- |
| `set`     | Set data at path (overwrites existing)  | `path`, `data`      |
| `push`    | Push new data with auto-generated key   | `path`, `data`      |
| `update`  | Update specific fields                  | `path`, `data`      |
| `delete`  | Delete data at path                     | `path`              |

#### Response Example

```json
{
  "success": true,
  "operation": "set",
  "path": "channels/channel-1",
  "message": "Data set successfully",
  "data": {
    "channelId": "channel-1",
    "status": "active",
    "_metadata": {
      "updatedAt": "2025-11-26T15:00:00.000Z",
      "operation": "set"
    }
  }
}
```

---

## 💡 Usage Examples

### Example 1: Read All Channels

```javascript
const response = await fetch('/api/firebase/realtime-test?path=channels');
const result = await response.json();
console.log(result.data);
```

### Example 2: Read Specific Channel

```javascript
const response = await fetch('/api/firebase/realtime-test?path=channels/channel-1');
const result = await response.json();
console.log(result.data);
```

### Example 3: Create New Channel

```javascript
const response = await fetch('/api/firebase/realtime-test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'set',
    path: 'channels/channel-1',
    data: {
      channelId: 'channel-1',
      status: 'active',
      participantCount: 3
    }
  })
});
const result = await response.json();
```

### Example 4: Update Channel

```javascript
const response = await fetch('/api/firebase/realtime-test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'update',
    path: 'channels/channel-1',
    data: {
      status: 'closed'
    }
  })
});
```

### Example 5: Delete Channel

```javascript
const response = await fetch('/api/firebase/realtime-test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'delete',
    path: 'channels/channel-1'
  })
});
```

---

## 🛠️ Helper Functions

Use the helper functions from `@/lib/realtime-db-helpers`:

```typescript
import {
  getChannel,
  getActiveChannels,
  getChannelParticipants,
  getLatestSnapshot,
  getChannelUserBalances,
  setData,
  pushData,
  updateData,
  deleteData,
  getData
} from '@/lib/realtime-db-helpers';

// Get single channel
const channel = await getChannel('channel-1');

// Get all active channels
const channels = await getActiveChannels();

// Get participants
const participants = await getChannelParticipants('channel-1');

// Generic read/write
const data = await getData('some/path');
await setData('some/path', { key: 'value' });
await updateData('some/path', { key: 'newValue' });
await deleteData('some/path');
```

---

## 🗄️ Database Schema

### Data Structure

```
/channels
  /{channelId}
    - channelId: string
    - contractAddress: string
    - chainId: number (e.g., 11155111 for Sepolia, 1 for Mainnet)
    - participantAddresses: string[]
    - participantCount: number
    - allowedTokens: string[]
    - timeout: number
    - leader: string
    - status: "pending" | "active" | "closed"
    - createdAt: string (ISO timestamp)
    - updatedAt: string (ISO timestamp)
    /participants
      /{address}
        - address: string
        - participantIndex: number
        - l1Address: string
        - status: string
        - isLeader: boolean
        - joinedAt: string
    /stateSnapshots
      /{snapshotId}
        - sequenceNumber: number
        - merkleRoot: string
        - ...
    /userBalances
      /{balanceId}
        - userAddressL1: string
        - amount: string
        - ...
```

### TypeScript Types

```typescript
import type {
  Channel,
  StateSnapshot,
  Participant,
  UserBalance,
  Transaction,
  ZKProof
} from '@/lib/firebase-types';
```

---

## 📝 Important Notes

1. **Security**: Configure Firebase Realtime Database rules in Firebase Console.

2. **Timestamps**: All timestamps are stored as ISO 8601 strings (e.g., `"2025-11-26T15:00:00.000Z"`).

3. **Auto-metadata**: The API automatically adds `_metadata.updatedAt` on writes.

4. **Error Handling**: Always implement error handling for API calls.

---

## 🆘 Troubleshooting

### Firebase Initialization Error

```
Error: Firebase app already initialized
```

**Solution**: The `lib/firebase.ts` file includes logic to prevent duplicate initialization.

### Database URL Not Set

```
Error: Cannot read database without databaseURL
```

**Solution**: Make sure `NEXT_PUBLIC_FIREBASE_DATABASE_URL` is set in your `.env.local` file.

### Permission Denied

```
Error: PERMISSION_DENIED
```

**Solution**: Check your Firebase Realtime Database rules in Firebase Console.

---

**Happy Coding! 🎮✨**
