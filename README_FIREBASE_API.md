# 🔥 Firebase API Guide

API for reading and writing data using Firebase Firestore in a Next.js app deployed on Vercel.

---

## 📋 Table of Contents

1. [Setup](#setup)
2. [API Endpoints](#api-endpoints)
3. [Usage Examples](#usage-examples)
4. [Database Schema](#database-schema)
5. [Vercel Deployment](#vercel-deployment)

---

## ⚙️ Setup

### 1. Environment Variables

Add Firebase configuration to your `.env.local` file:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=1:your_sender_id:web:your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-YOUR_MEASUREMENT_ID

# Database Development Mode (for testing without DKG server)
NEXT_PUBLIC_DB_DEVELOPMENT=true  # Set to false for production
```

> **Note**: Get Firebase values from Firebase Console → Project Settings → Your apps → SDK setup and configuration

> **Important**: Set `NEXT_PUBLIC_DB_DEVELOPMENT=true` to enable mock data generation for testing! See [Environment Variables Guide](./docs/ENVIRONMENT_VARIABLES.md) for details.

### 2. Install Firebase Package

```bash
npm install firebase
```

---

## 🌐 API Endpoints

### 📖 Read API: `GET /api/firebase/read`

Reads data from Firestore.

#### Query Parameters

| Parameter        | Required | Description              | Example                                                 |
| ---------------- | -------- | ------------------------ | ------------------------------------------------------- |
| `collection`     | ✅       | Collection name          | `users`                                                 |
| `docId`          | ❌       | Specific document ID     | `user123`                                               |
| `where`          | ❌       | Filter conditions (JSON) | `[{"field":"status","operator":"==","value":"active"}]` |
| `orderBy`        | ❌       | Sort field               | `createdAt`                                             |
| `orderDirection` | ❌       | Sort direction           | `asc` or `desc`                                         |
| `limit`          | ❌       | Limit result count       | `10`                                                    |

#### Response Example

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "doc1",
      "name": "Alice",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "id": "doc2",
      "name": "Bob",
      "status": "active",
      "createdAt": "2024-01-02T00:00:00Z"
    }
  ]
}
```

---

### ✍️ Write API: `POST /api/firebase/write`

Creates, updates, or deletes data in Firestore.

#### Request Body

```json
{
  "operation": "create | update | delete | set",
  "collection": "Collection name",
  "docId": "Document ID (optional)",
  "data": { "Data to save" },
  "merge": true
}
```

#### Operations

| Operation | Description                             | Required Fields               |
| --------- | --------------------------------------- | ----------------------------- |
| `create`  | Create new document (auto-generated ID) | `collection`, `data`          |
| `set`     | Set document (overwrite/merge)          | `collection`, `docId`, `data` |
| `update`  | Update document partially               | `collection`, `docId`, `data` |
| `delete`  | Delete document                         | `collection`, `docId`         |

#### Response Example

```json
{
  "success": true,
  "operation": "create",
  "docId": "auto-generated-id",
  "message": "Document created successfully"
}
```

---

## 💡 Usage Examples

### Example 1: Fetch All Users

```javascript
const response = await fetch('/api/firebase/read?collection=users');
const result = await response.json();
console.log(result.data);
```

### Example 2: Fetch Specific User

```javascript
const response = await fetch('/api/firebase/read?collection=users&docId=user123');
const result = await response.json();
console.log(result.data);
```

### Example 3: Filtering and Sorting

```javascript
const whereConditions = JSON.stringify([
  { field: "status", operator: "==", value: "active" },
  { field: "age", operator: ">", value: 18 }
]);

const url = `/api/firebase/read?collection=users&where=${encodeURIComponent(whereConditions)}&orderBy=createdAt&orderDirection=desc&limit=10`;
const response = await fetch(url);
const result = await response.json();
```

### Example 4: Create New Document

```javascript
const response = await fetch('/api/firebase/write', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'create',
    collection: 'users',
    data: {
      name: 'Alice',
      email: 'alice@example.com',
      status: 'active'
    }
  })
});
const result = await response.json();
console.log(result.docId); // Auto-generated ID
```

### Example 5: Update Document

```javascript
const response = await fetch('/api/firebase/write', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'update',
    collection: 'users',
    docId: 'user123',
    data: {
      status: 'inactive'
    }
  })
});
```

### Example 6: Delete Document

```javascript
const response = await fetch('/api/firebase/write', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'delete',
    collection: 'users',
    docId: 'user123'
  })
});
```

---

## 🗄️ Database Schema

For detailed information about the Firestore database structure, see:

📚 **[Firebase Schema Documentation](./docs/FIREBASE_SCHEMA.md)**
🚀 **[Mock Data Generation Guide](./docs/MOCK_DATA_GENERATION.md)** - Test without DKG server!
🔧 **[Firebase Integration Guide](./docs/FIREBASE_INTEGRATION_GUIDE.md)**
⚙️ **[Environment Variables Guide](./docs/ENVIRONMENT_VARIABLES.md)** - Complete configuration reference

This includes:

- Complete collection structures
- TypeScript type definitions
- Query patterns and indexes
- Security rules
- Data flow diagrams
- **Automatic mock data generation for testing**

### Quick Reference

**Main Collections:**

- `channels` - Channel metadata and configuration
- `transactions` - L2 transactions
- `zkProofs` - Zero-knowledge proofs
- `dkgSessions` - Distributed Key Generation sessions
- `deposits` - User deposits from L1
- `userBalances` - User balance tracking
- `aggregatedProofs` - Batched proofs for L1 submission

**TypeScript Types:**

```typescript
import type {
  Channel,
  Transaction,
  ZKProof,
  Deposit,
  UserBalance,
  DKGSession
} from '@/lib/firebase-types';
```

**Helper Functions:**

```typescript
import {
  getChannel,
  getChannelTransactions,
  getZKProof,
  createChannelWithParticipants,
  createChannelWithMockDKGData  // 🆕 Auto-generate test data!
} from '@/lib/firebase-helpers';
```

### 🎮 Testing Without DKG Server

**NEW!** You can now test the complete Firebase schema without running a DKG server:

```typescript
import { createChannelWithMockDKGData } from '@/lib/firebase-helpers';

// Automatically creates:
// ✅ Channel + Participants
// ✅ Complete DKG session
// ✅ All 3 rounds of DKG messages
// ✅ Sample transactions
// ✅ Deposits and balances
await createChannelWithMockDKGData(
  {
    channelId: "0",
    contractAddress: "0x...",
    networkId: "sepolia",
    threshold: 2,
    leader: "0x...",
  },
  ["0xParticipant1", "0xParticipant2", "0xParticipant3"]
);
```

See **[Mock Data Generation Guide](./docs/MOCK_DATA_GENERATION.md)** for complete details!

---

## 🚀 Vercel Deployment

### 1. Create Vercel Project

```bash
npm install -g vercel
vercel login
vercel
```

### 2. Configure Environment Variables

Navigate to Project Settings → Environment Variables in the Vercel dashboard and add Firebase environment variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

Or configure via CLI:

```bash
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
# ... other environment variables
```

### 3. Deploy

```bash
vercel --prod
```

### 4. Test API

After deployment, test with the following commands:

```bash
# Test read
curl "https://your-app.vercel.app/api/firebase/read?collection=users"

# Test write
curl -X POST "https://your-app.vercel.app/api/firebase/write" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "create",
    "collection": "test",
    "data": {"message": "Hello from Vercel!"}
  }'
```

---

## 📝 Important Notes

1. **Security**: API keys use the `NEXT_PUBLIC_` prefix and are exposed to clients. Configure API key restrictions in Firebase Console.

2. **Firestore Rules**: Set up Firestore Security Rules in Firebase Console to control data access.

3. **Timestamps**: `createdAt` and `updatedAt` fields are automatically added.

4. **Error Handling**: Implement error handling for all API calls.

---

## 🎮 Apply Retro Theme

This project uses an 80s arcade game style. Maintain the retro theme when displaying Firebase data!

```tsx
// Example: Display Firebase data in retro style
<div className="arcade-cabinet">
  <div className="arcade-screen">
    <div className="crt-content">
      <h1 className="pixel-font neon-glow-cyan">FIREBASE DATA</h1>
      {data.map(item => (
        <div key={item.id} className="neon-border-yellow">
          {item.name}
        </div>
      ))}
    </div>
  </div>
</div>
```

---

## 🆘 Troubleshooting

### Firebase Initialization Error

```
Error: Firebase app already initialized
```

**Solution**: Logic to prevent duplicate initialization is included in `lib/firebase.ts`.

### Environment Variables Error After Vercel Deployment

**Solution**: Verify that all environment variables are correctly configured in the Vercel dashboard.

---

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Vercel Deployment](https://vercel.com/docs)

---

**Happy Coding! 🎮✨**
