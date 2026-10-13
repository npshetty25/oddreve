import { describe, it, expect } from 'vitest';
import { createCommitment, generateNonce, verifyCommitment } from '../commitment';
import { RoomManager } from '../roomManager';
import { setTossCall, selectTossChoice } from '../../engine/match';

describe('Phase 4 Online Multiplayer: Cryptographic Commitment & Lobby Engine', () => {
  it('verifies valid commitment and reveals matching throw + nonce', async () => {
    const nonce = generateNonce();
    const throwVal = 4;
    const commitment = await createCommitment(throwVal, nonce);

    const isValid = await verifyCommitment(commitment, throwVal, nonce);
    expect(isValid).toBe(true);
  });

  it('rejects tampered reveals (different throw or modified nonce)', async () => {
    const nonce = generateNonce();
    const originalThrow = 4;
    const commitment = await createCommitment(originalThrow, nonce);

    // Tampered throw: player tries to reveal 6 instead of 4
    const isTamperedThrowValid = await verifyCommitment(commitment, 6, nonce);
    expect(isTamperedThrowValid).toBe(false);

    // Tampered nonce
    const isTamperedNonceValid = await verifyCommitment(commitment, 4, 'fake-nonce');
    expect(isTamperedNonceValid).toBe(false);
  });

  it('simultaneous throw resolution occurs only after both reveals are verified', async () => {
    const room = new RoomManager('ROOM123', 'host_1', 'Alice');
    room.joinRoom('guest_1', 'Bob');

    // Lobby stage
    expect(room.getRoomState().stage).toBe('lobby');

    // Start match
    let match = room.startMatch();
    expect(room.getRoomState().stage).toBe('playing');

    // Advance to innings1
    match = setTossCall(match, 'team_a', 'odd');
    match.phase = 'innings1'; // Skip straight to batting test
    match.innings1.battingTeamId = 'team_a';
    match.innings1.bowlingTeamId = 'team_b';
    room.getRoomState().match = match;

    // Player A and Player B prepare commitments
    const nonceA = generateNonce();
    const nonceB = generateNonce();
    const commA = await createCommitment(5, nonceA);
    const commB = await createCommitment(2, nonceB);

    // Step 1: Submit commitments
    room.submitCommitment('host_1', commA);
    expect(room.areBothCommitmentsReceived('host_1', 'guest_1')).toBe(false);

    room.submitCommitment('guest_1', commB);
    expect(room.areBothCommitmentsReceived('host_1', 'guest_1')).toBe(true);

    // Round should NOT resolve before reveals
    let res = await room.resolveRoundIfReady('host_1', 'guest_1');
    expect(res.resolved).toBe(false);

    // Step 2: Reveals
    const revA = await room.submitReveal('host_1', 5, nonceA);
    expect(revA.success).toBe(true);

    // Revealing with bad throw fails
    const badRevB = await room.submitReveal('guest_1', 3, nonceB);
    expect(badRevB.success).toBe(false);
    expect(badRevB.error).toContain('Tampered reveal');

    // Revealing with valid throw succeeds
    const goodRevB = await room.submitReveal('guest_1', 2, nonceB);
    expect(goodRevB.success).toBe(true);

    // Step 3: Now both are verified, round resolves
    res = await room.resolveRoundIfReady('host_1', 'guest_1');
    expect(res.resolved).toBe(true);
    expect(res.nextMatchState?.innings1.score).toBe(5);
  });

  it('reconnection grace window (30 seconds) handling', () => {
    const room = new RoomManager('ROOM123', 'host_1', 'Alice');
    room.joinRoom('guest_1', 'Bob');
    room.startMatch();

    const t0 = 100000;
    // Guest disconnects mid-match
    room.handleDisconnect('guest_1', t0);
    expect(room.getRoomState().stage).toBe('paused');

    // 15 seconds later -> Not expired yet
    expect(room.checkReconnectionExpiry(t0 + 15000).expired).toBe(false);

    // Guest reconnects at 20 seconds
    const reconnected = room.joinRoom('guest_1', 'Bob');
    expect(reconnected).toBe(true);
    expect(room.getRoomState().stage).toBe('playing');
    expect(room.getRoomState().reconnectionTimeout).toBeNull();

    // Another disconnect, exceeds 30 seconds
    room.handleDisconnect('guest_1', t0 + 30000);
    const expiredCheck = room.checkReconnectionExpiry(t0 + 30000 + 30001);
    expect(expiredCheck.expired).toBe(true);
    expect(expiredCheck.forfeitedTeamId).toBe('team_b');
  });
});
