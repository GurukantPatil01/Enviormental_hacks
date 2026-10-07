# EcoPulse REST API Documentation

Base URL: `http://localhost:4000` (or `EXPO_PUBLIC_API_URL`)

---

## Error Envelope
All error responses adhere to a uniform structure:
```json
{
  "error": {
    "code": "MISSION_ALREADY_COMPLETED",
    "message": "Mission has already been completed.",
    "details": {}
  }
}
```

---

## 1. Authentication

### `POST /auth/register`
Creates a new user profile and returns a session JWT.
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "fullName": "Jane Doe",
    "phone": "+91 98765 43210",
    "role": "RESIDENT"
  }
  ```
- **Response `201`**:
  ```json
  {
    "data": {
      "token": "eyJhbG...",
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "fullName": "Jane Doe",
        "role": "RESIDENT"
      }
    }
  }
  ```

### `POST /auth/login`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response `200`**:
  ```json
  {
    "data": {
      "token": "eyJhbG...",
      "user": { ... }
    }
  }
  ```

### `GET /auth/me`
Requires `Bearer <token>`. Returns currently authenticated user context.

---

## 2. Communities

### `GET /communities`
Lists all registered green communities with progress metrics and member counts.

### `GET /communities/:id`
Retrieves single community details and geographic boundary info.

### `POST /communities/:id/join`
Requires `Bearer <token>`. Adds the authenticated user to the community. Emits `COMMUNITY_JOINED`.

### `GET /communities/:id/members`
Lists active members participating in the community.

---

## 3. Missions & Idempotent Completion

### `GET /missions`
Lists active environmental missions. Accepts optional `?communityId=UUID`. Includes `userParticipationStatus`.

### `GET /missions/:id`
Returns single mission detail.

### `POST /missions/:id/start`
Requires `Bearer <token>`. Transitions participant status to `STARTED`. Emits `MISSION_STARTED`.

### `POST /missions/:id/complete`
Requires `Bearer <token>`.
- **Body**:
  ```json
  {
    "client_event_id": "evt-client-unique-abc-12345",
    "notes": "Walked the trail and cleared plastic bottles.",
    "evidenceUrl": "https://cdn.ecopulse.org/evidence/photo1.jpg"
  }
  ```
- **Idempotency Guarantee**: If the mutation is executed twice with the identical `client_event_id`, the server responds with `"status": "ALREADY_COMPLETED"` and existing ledger points without double-crediting.
- **Response `200`**:
  ```json
  {
    "data": {
      "status": "COMPLETED",
      "missionId": "uuid",
      "pointsAwarded": 15,
      "pointBalance": 355,
      "currentStreak": 13,
      "streakExtended": true,
      "ledgerEntry": {
        "id": "uuid",
        "transactionId": "uuid",
        "amount": 15,
        "source": "MISSION_COMPLETED"
      }
    }
  }
  ```

---

## 4. Resident Stats & Dashboard

### `GET /me`
Requires `Bearer <token>`. Returns aggregated dashboard payload for the Home screen:
- User identity
- Active Community & Current Community Progress %
- Real EcoPoints Balance (computed from ledger)
- Real Active Streak count
- Active Mission
- Recent Activity feed

### `GET /me/points`
Requires `Bearer <token>`. Returns detailed point balance and immutable ledger entry history.

### `GET /me/streak`
Requires `Bearer <token>`. Returns current consecutive streak, longest streak, and last activity date.

### `GET /me/activity`
Requires `Bearer <token>`. Returns chronological activity stream.
