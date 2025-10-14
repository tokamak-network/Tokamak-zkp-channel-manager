# FROST DKG Flow Documentation

## Overview

This document describes the complete flow for the Tokamak FROST Distributed Key Generation (DKG) protocol based on the `frost-dkg` implementation. The protocol enables multiple parties to collectively generate cryptographic keys without any single party knowing the complete private key.

## Key Concepts

- **FROST**: Flexible Round-Optimized Schnorr Threshold signatures on secp256k1
- **DKG**: Distributed Key Generation - a 3-round protocol to generate threshold keys
- **Threshold**: t-of-n signatures (e.g., 2-of-3 means any 2 out of 3 parties can sign)
- **Authenticated Channel**: All messages are ECDSA-signed over Keccak256 digests
- **ECIES Encryption**: Round 2 uses per-recipient encryption (ECDH + AES-256-GCM)

## Prerequisites

### For All Participants

1. **ECDSA Keypair**: Each participant needs a secp256k1 ECDSA keypair
   - Used for message authentication and Round 2 decryption
   - Public key must be registered in the participant roster
   - Private key must be kept secure (same key used for DKG and later signing)

2. **Network Access**: Connection to the DKG coordinator server
   - Default: `ws://127.0.0.1:9000/ws`
   - Server runs the `fserver` binary from the frost-dkg repository

3. **Unique Identifier**: Each participant gets a unique UID (user ID)
   - Used to map to FROST identifiers during the ceremony
   - Registered in the participant roster by the creator

## Flow Overview

```
Phase 1: Setup & Authentication
Phase 2: Session Management  
Phase 3: DKG Rounds (3 rounds)
Phase 4: Finalization & Key Output
```

---

# Creator's Perspective

The **creator** is responsible for initiating the DKG ceremony, managing the participant roster, and coordinating the session.

## Phase 1: Setup & Authentication

### Step 1: Connect to DKG Server
```typescript
// Connect to the WebSocket server
const ws = new WebSocket('ws://127.0.0.1:9000/ws');
```

### Step 2: Request Challenge
```json
// Send to server
{
  "type": "RequestChallenge"
}

// Receive from server  
{
  "type": "Challenge",
  "payload": {
    "challenge": "550e8400-e29b-41d4-a716-446655440000"  // UUID
  }
}
```

### Step 3: Authenticate with Server
```typescript
// 1. Parse challenge UUID and get bytes
const challengeBytes = uuid.parse(challenge).bytes;

// 2. Compute ECDSA signature over Keccak256(challenge_bytes)
const digest = keccak256(challengeBytes);
const signature = ecdsa.sign(digest, privateKey);

// 3. Send login message
{
  "type": "Login",
  "payload": {
    "challenge": "550e8400-e29b-41d4-a716-446655440000",
    "pubkey_hex": "02a1b2c3d4...",  // 33-byte compressed SEC1 format
    "signature_hex": "304402207f..."  // DER format preferred
  }
}

// 4. Receive confirmation
{
  "type": "LoginOk", 
  "payload": {
    "user_id": 1,
    "access_token": "auth_token_here"
  }
}
```

## Phase 2: Session Creation

### Step 4: Prepare Participant Roster

The creator must collect and register all participants:

```typescript
const participants = [
  { uid: 1, publicKey: "02a1b2c3d4...", nickname: "Alice" },
  { uid: 2, publicKey: "03b2c3d4e5...", nickname: "Bob" },
  { uid: 3, publicKey: "02c3d4e5f6...", nickname: "Charlie" }
];
```

**Important Notes:**
- Each participant needs a unique UID and ECDSA public key
- Public keys will be used for authenticated messaging and Round 2 decryption
- The creator should distribute UIDs and ensure everyone has the correct keys

### Step 5: Announce Session

```json
{
  "type": "AnnounceSession",
  "payload": {
    "min_signers": 2,
    "max_signers": 3,
    "group_id": "tokamak_group_1",
    "participants": [1, 2, 3],
    "participants_pubs": [
      [1, "02a1b2c3d4..."],
      [2, "03b2c3d4e5..."], 
      [3, "02c3d4e5f6..."]
    ]
  }
}
```

### Step 6: Receive Session ID

```json
{
  "type": "SessionCreated",
  "payload": {
    "session": "dkg_session_uuid_here"
  }
}
```

**Creator Actions:**
- Save the session ID securely
- Share the session ID with all participants
- Participants will need this ID to join the ceremony

## Phase 3: DKG Ceremony Participation

From this point, the creator participates like any other participant in the 3-round DKG protocol.

### Round 1: Commitments

When all participants join, receive:

```json
{
  "type": "ReadyRound1",
  "payload": {
    "session": "dkg_session_uuid",
    "id_hex": "0001",  // Your FROST identifier  
    "min_signers": 2,
    "max_signers": 3,
    "group_id": "tokamak_group_1",
    "roster": [
      [1, "0001", "02a1b2c3d4..."],  // [uid, id_hex, ecdsa_pub_hex]
      [2, "0002", "03b2c3d4e5..."],
      [3, "0003", "02c3d4e5f6..."]
    ]
  }
}
```

**Creator Actions:**
1. Generate Round 1 package using FROST library
2. Sign the package with authentication payload
3. Submit to server

```json
{
  "type": "Round1Submit", 
  "payload": {
    "session": "dkg_session_uuid",
    "id_hex": "0001",
    "pkg_bincode_hex": "bincode_serialized_frost_r1_package", 
    "sig_ecdsa_hex": "ecdsa_signature_of_auth_payload"
  }
}
```

Authentication payload format:
```
"TOKAMAK_FROST_DKG_R1|" + session + "|" + bincode(id) + bincode(r1_package)
```

### Round 2: Secret Shares

Receive all Round 1 packages:

```json
{
  "type": "Round1All",
  "payload": {
    "session": "dkg_session_uuid",
    "packages": [
      ["0001", "pkg1_hex", "sig1_hex"],
      ["0002", "pkg2_hex", "sig2_hex"], 
      ["0003", "pkg3_hex", "sig3_hex"]
    ]
  }
}

{
  "type": "ReadyRound2",
  "payload": {
    "session": "dkg_session_uuid"
  }
}
```

**Creator Actions:**
1. Verify all Round 1 signatures using roster public keys
2. Generate Round 2 packages for each recipient
3. Encrypt each package with ECIES for the recipient
4. Sign each encrypted envelope
5. Submit all encrypted packages

```json
{
  "type": "Round2Submit",
  "payload": {
    "session": "dkg_session_uuid", 
    "id_hex": "0001",
    "pkgs_cipher_hex": [
      ["0002", "eph_pub_hex", "nonce_hex", "ciphertext_hex", "sig_hex"],
      ["0003", "eph_pub_hex", "nonce_hex", "ciphertext_hex", "sig_hex"]
    ]
  }
}
```

### Round 3: Finalization

Receive encrypted packages from all other participants:

```json
{
  "type": "Round2All",
  "payload": {
    "session": "dkg_session_uuid",
    "packages": [
      ["0002", "eph_pub_hex", "nonce_hex", "ct_hex", "sig_hex"],
      ["0003", "eph_pub_hex", "nonce_hex", "ct_hex", "sig_hex"]
    ]
  }
}
```

**Creator Actions:**
1. Decrypt all packages using your ECDSA private key
2. Complete FROST DKG part3 to generate final KeyPackage
3. Submit signed finalization message

```json
{
  "type": "FinalizeSubmit",
  "payload": {
    "session": "dkg_session_uuid",
    "id_hex": "0001", 
    "group_vk_sec1_hex": "group_public_key_bytes",
    "sig_ecdsa_hex": "signature_of_finalize_payload"
  }
}
```

## Phase 4: Completion

### Step 7: Receive Final Confirmation

```json
{
  "type": "Finalized",
  "payload": {
    "session": "dkg_session_uuid",
    "group_vk_sec1_hex": "agreed_group_public_key"
  }
}
```

### Step 8: Save Generated Artifacts

The creator should save these files locally:

**group.json** (can be shared publicly):
```json
{
  "group_id": "tokamak_group_1",
  "threshold": 2,
  "participants": 3,
  "group_vk_sec1_hex": "04a1b2c3...",
  "session": "dkg_session_uuid"
}
```

**share_0001.json** (KEEP PRIVATE):
```json
{
  "group_id": "tokamak_group_1", 
  "threshold": 2,
  "participants": 3,
  "session": "dkg_session_uuid",
  "signer_id_bincode_hex": "bincode_of_frost_id",
  "secret_share_bincode_hex": "bincode_of_secret_share",
  "verifying_share_bincode_hex": "bincode_of_verifying_share",
  "group_vk_sec1_hex": "04a1b2c3..."
}
```

---

# Participant's Perspective  

A **participant** joins an existing DKG ceremony created by someone else.

## Phase 1: Setup & Authentication

### Step 1: Obtain Session Information

From the creator, you need:
- Session ID (UUID)
- DKG server URL
- Your assigned UID
- Confirmation that your ECDSA public key is registered

### Step 2: Connect and Authenticate

```typescript
// 1. Connect to server
const ws = new WebSocket('ws://127.0.0.1:9000/ws');

// 2. Request challenge
ws.send(JSON.stringify({ type: "RequestChallenge" }));

// 3. Receive challenge and sign it
// (same authentication flow as creator)

// 4. Send login with your ECDSA keypair
{
  "type": "Login",
  "payload": {
    "challenge": "challenge_uuid",
    "pubkey_hex": "your_ecdsa_public_key",
    "signature_hex": "your_signature" 
  }
}
```

## Phase 2: Join Session

### Step 3: Join the DKG Session

```json
{
  "type": "JoinSession",
  "payload": "session_id_from_creator"
}
```

### Step 4: Wait for All Participants

The server will send updates as participants join:

```json
{
  "type": "Info",
  "payload": {
    "message": "joined 2/3"
  }
}
```

## Phase 3: DKG Ceremony Participation

### Step 5: Round 1 - Generate Commitments

When all participants have joined:

```json
{
  "type": "ReadyRound1", 
  "payload": {
    "session": "session_id",
    "id_hex": "0002",  // Your FROST identifier
    "min_signers": 2,
    "max_signers": 3, 
    "group_id": "tokamak_group_1",
    "roster": [
      [1, "0001", "02a1b2c3d4..."],
      [2, "0002", "03b2c3d4e5..."],  // <- This is you
      [3, "0003", "02c3d4e5f6..."]
    ]
  }
}
```

**Participant Actions:**
1. Note your FROST identifier (`id_hex`)
2. Generate FROST Round 1 commitments
3. Sign and submit your package

```json
{
  "type": "Round1Submit",
  "payload": {
    "session": "session_id",
    "id_hex": "0002",
    "pkg_bincode_hex": "your_r1_package_bincode", 
    "sig_ecdsa_hex": "your_auth_signature"
  }
}
```

### Step 6: Round 2 - Secret Shares  

Receive everyone's Round 1 commitments:

```json
{
  "type": "Round1All",
  "payload": {
    "session": "session_id",
    "packages": [
      ["0001", "pkg1_hex", "sig1_hex"],
      ["0002", "pkg2_hex", "sig2_hex"],  // Your own package
      ["0003", "pkg3_hex", "sig3_hex"]
    ]
  }
}

{
  "type": "ReadyRound2", 
  "payload": {
    "session": "session_id"
  }
}
```

**Participant Actions:**
1. Verify all signatures using the roster
2. Generate Round 2 secret shares for each OTHER participant  
3. Encrypt each share for its recipient using ECIES
4. Submit encrypted packages

```json
{
  "type": "Round2Submit",
  "payload": {
    "session": "session_id",
    "id_hex": "0002", 
    "pkgs_cipher_hex": [
      ["0001", "eph_pub_hex", "nonce_hex", "ct_hex", "sig_hex"],  // For participant 1
      ["0003", "eph_pub_hex", "nonce_hex", "ct_hex", "sig_hex"]   // For participant 3
    ]
  }
}
```

### Step 7: Round 3 - Finalization

Receive your encrypted secret shares:

```json
{
  "type": "Round2All",
  "payload": {
    "session": "session_id", 
    "packages": [
      ["0001", "eph_pub_hex", "nonce_hex", "ct_hex", "sig_hex"],  // From participant 1
      ["0003", "eph_pub_hex", "nonce_hex", "ct_hex", "sig_hex"]   // From participant 3  
    ]
  }
}
```

**Participant Actions:**
1. Decrypt packages using your ECDSA private key
2. Complete FROST part3 to derive your KeyPackage
3. Submit finalization with the computed group public key

```json
{
  "type": "FinalizeSubmit", 
  "payload": {
    "session": "session_id",
    "id_hex": "0002",
    "group_vk_sec1_hex": "computed_group_public_key",
    "sig_ecdsa_hex": "finalize_signature"
  }
}
```

## Phase 4: Completion

### Step 8: Ceremony Complete

```json
{
  "type": "Finalized",
  "payload": {
    "session": "session_id", 
    "group_vk_sec1_hex": "final_group_public_key"
  }
}
```

### Step 9: Save Your Key Share

**CRITICAL**: Save your private key share securely:

**share_0002.json** (KEEP PRIVATE - NEVER SHARE):
```json
{
  "group_id": "tokamak_group_1",
  "threshold": 2, 
  "participants": 3,
  "session": "session_id",
  "signer_id_bincode_hex": "your_frost_id_bincode",
  "secret_share_bincode_hex": "your_secret_share_bincode", 
  "verifying_share_bincode_hex": "your_verifying_share_bincode",
  "group_vk_sec1_hex": "group_public_key"
}
```

---

# Security Considerations

## For Creators

1. **Roster Management**: Ensure all participant public keys are authentic
2. **Session ID Security**: Share session IDs through secure channels
3. **Server Security**: Run the DKG server in a secure environment
4. **Backup**: Save all generated artifacts securely

## For Participants  

1. **Key Security**: Never share your ECDSA private key or secret share
2. **Verification**: Verify the creator's identity and session parameters
3. **Network Security**: Use secure connections when possible
4. **Backup**: Save your key share with secure backup procedures

## For Everyone

1. **Message Verification**: All messages are authenticated - verify signatures
2. **Session Isolation**: Each DKG ceremony is isolated by session ID
3. **Replay Protection**: Challenges prevent replay attacks  
4. **Forward Secrecy**: Ephemeral keys used in ECIES encryption

---

# Troubleshooting

## Common Issues

### Authentication Failures
- **Problem**: `ECDSA signature verification failed`
- **Solution**: Ensure you're signing `Keccak256(uuid.as_bytes())` with the correct private key

### Session Join Failures  
- **Problem**: `public key not registered in any session roster`
- **Solution**: Verify the creator registered your correct ECDSA public key

### Round Timeouts
- **Problem**: DKG rounds timeout waiting for participants
- **Solution**: Ensure all participants are online and responsive

### Decryption Failures
- **Problem**: Cannot decrypt Round 2 packages
- **Solution**: Verify you're using the same ECDSA private key that was registered

## Error Recovery

- **Network Disconnection**: Reconnect and rejoin the session if still active
- **Participant Dropout**: Creator may need to restart with a new roster
- **Server Restart**: All sessions are lost (in-memory state only)
- **Key Loss**: No recovery possible - must restart the DKG ceremony

---

# Implementation Notes

## Message Signing Domains

Each message type has a specific authentication domain:

- **Round 1**: `"TOKAMAK_FROST_DKG_R1|" + session + "|" + bincode(id) + bincode(pkg)`
- **Round 2**: `"TOKAMAK_FROST_DKG_R2|" + session + "|" + bincode(from) + bincode(to) + eph_pub + nonce + ct`  
- **Finalize**: `"TOKAMAK_FROST_DKG_FIN|" + session + "|" + bincode(id) + group_vk_sec1`

## ECIES Encryption

Round 2 packages use ECIES with:
- **ECDH**: secp256k1 ephemeral key exchange
- **KDF**: `SHA512("TOKAMAK_FROST_ECIES_v1" || shared_secret).first32()`
- **Encryption**: AES-256-GCM with 12-byte nonce
- **Format**: `(ephemeral_pubkey, nonce, ciphertext_with_tag)`

## File Formats

All data structures use `bincode` serialization for FROST compatibility.

This completes the comprehensive DKG flow documentation from both creator and participant perspectives.