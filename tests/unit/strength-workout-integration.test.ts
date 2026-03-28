/**
 * Integration tests for createStrengthWorkout tool method
 * Tests WorkoutTools.createStrengthWorkout() with a mocked GarminClient
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkoutTools } from '../../src/tools/tracking/workout-tools.js';
import { GarminClient } from '../../src/client/garmin-client.js';
import type { WorkoutResponse } from '../../src/types/workout.js';

vi.mock('../../src/client/garmin-client.js');

describe('WorkoutTools.createStrengthWorkout()', () => {
  let workoutTools: WorkoutTools;
  let mockGarminClient: GarminClient;

  const mockWorkoutResponse: WorkoutResponse = {
    workoutId: 999,
    ownerId: 123,
    workoutName: 'Upper Body Strength',
    description: null,
    updatedDate: '2026-03-28T10:00:00Z',
    createdDate: '2026-03-28T10:00:00Z',
    sportType: { sportTypeId: 13, sportTypeKey: 'strength_training', displayOrder: 13 },
  };

  beforeEach(() => {
    mockGarminClient = {
      createWorkout: vi.fn(),
      scheduleWorkout: vi.fn(),
      getScheduledWorkouts: vi.fn(),
      deleteWorkout: vi.fn(),
      unscheduleWorkout: vi.fn(),
      getWorkoutDetails: vi.fn(),
    } as unknown as GarminClient;

    workoutTools = new WorkoutTools(mockGarminClient);
  });

  describe('Input Validation', () => {
    it('should reject missing name', async () => {
      const result = await workoutTools.createStrengthWorkout({
        exercises: [{ name: 'Squat', sets: 3, reps: 10 }],
      } as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Workout name is required');
    });

    it('should reject empty name', async () => {
      const result = await workoutTools.createStrengthWorkout({
        name: '   ',
        exercises: [{ name: 'Squat', sets: 3, reps: 10 }],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Workout name is required');
    });

    it('should reject missing exercises array', async () => {
      const result = await workoutTools.createStrengthWorkout({
        name: 'Test',
      } as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Exercises array is required');
    });

    it('should reject empty exercises array', async () => {
      const result = await workoutTools.createStrengthWorkout({
        name: 'Test',
        exercises: [],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Exercises array is required');
    });

    it('should reject exercise without name', async () => {
      const result = await workoutTools.createStrengthWorkout({
        name: 'Test',
        exercises: [{ name: '', sets: 3, reps: 10 }],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('name is required');
    });

    it('should reject exercise with invalid sets', async () => {
      const result = await workoutTools.createStrengthWorkout({
        name: 'Test',
        exercises: [{ name: 'Squat', sets: 0, reps: 10 }],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('sets must be a positive integer');
    });

    it('should reject exercise without reps or durationSeconds', async () => {
      const result = await workoutTools.createStrengthWorkout({
        name: 'Test',
        exercises: [{ name: 'Squat', sets: 3 } as any],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('either reps or durationSeconds is required');
    });

    it('should reject negative weightKg', async () => {
      const result = await workoutTools.createStrengthWorkout({
        name: 'Test',
        exercises: [{ name: 'Squat', sets: 3, reps: 5, weightKg: -10 }],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('weightKg must be >= 0');
    });

    it('should reject negative restSeconds', async () => {
      const result = await workoutTools.createStrengthWorkout({
        name: 'Test',
        exercises: [{ name: 'Squat', sets: 3, reps: 5, restSeconds: -1 }],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('restSeconds must be >= 0');
    });

    it('should reject non-integer reps', async () => {
      const result = await workoutTools.createStrengthWorkout({
        name: 'Test',
        exercises: [{ name: 'Squat', sets: 3, reps: 5.5 }],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('reps must be a positive integer');
    });
  });

  describe('Success Cases', () => {
    it('should create workout with reps-based exercise', async () => {
      vi.mocked(mockGarminClient.createWorkout).mockResolvedValue(mockWorkoutResponse);

      const result = await workoutTools.createStrengthWorkout({
        name: 'Upper Body Strength',
        exercises: [
          { name: 'Bench Press', sets: 3, reps: 8, weightKg: 80, restSeconds: 90 },
        ],
      });

      expect(result.isError).toBeUndefined();
      expect(mockGarminClient.createWorkout).toHaveBeenCalledOnce();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.workoutId).toBe(999);
      expect(parsed.workoutName).toBe('Upper Body Strength');
    });

    it('should create workout with duration-based exercise', async () => {
      vi.mocked(mockGarminClient.createWorkout).mockResolvedValue(mockWorkoutResponse);

      const result = await workoutTools.createStrengthWorkout({
        name: 'Core Workout',
        exercises: [
          { name: 'Plank', sets: 3, durationSeconds: 60, restSeconds: 45 },
        ],
      });

      expect(result.isError).toBeUndefined();
      expect(mockGarminClient.createWorkout).toHaveBeenCalledOnce();

      const payload = vi.mocked(mockGarminClient.createWorkout).mock.calls[0][0];
      expect(payload.sportType.sportTypeKey).toBe('strength_training');
    });

    it('should create workout with bodyweight exercise (no weight)', async () => {
      vi.mocked(mockGarminClient.createWorkout).mockResolvedValue(mockWorkoutResponse);

      const result = await workoutTools.createStrengthWorkout({
        name: 'Bodyweight Workout',
        exercises: [{ name: 'Pull Up', sets: 3, reps: 8 }],
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it('should create workout with zero rest (superset)', async () => {
      vi.mocked(mockGarminClient.createWorkout).mockResolvedValue(mockWorkoutResponse);

      const result = await workoutTools.createStrengthWorkout({
        name: 'Superset',
        exercises: [
          { name: 'Bicep Curl', sets: 3, reps: 12, restSeconds: 0 },
          { name: 'Tricep Extension', sets: 3, reps: 12, restSeconds: 60 },
        ],
      });

      expect(result.isError).toBeUndefined();
      // payload should have 3 curls + 3 extensions + 1 rest = 7 steps
      const payload = vi.mocked(mockGarminClient.createWorkout).mock.calls[0][0];
      expect(payload.workoutSegments[0].workoutSteps).toHaveLength(7);
    });

    it('should include description when provided', async () => {
      vi.mocked(mockGarminClient.createWorkout).mockResolvedValue(mockWorkoutResponse);

      await workoutTools.createStrengthWorkout({
        name: 'My Workout',
        description: 'A great workout',
        exercises: [{ name: 'Squat', sets: 1, reps: 5, restSeconds: 0 }],
      });

      const payload = vi.mocked(mockGarminClient.createWorkout).mock.calls[0][0];
      expect(payload.description).toBe('A great workout');
    });
  });

  describe('API Error Handling', () => {
    it('should return error result when Garmin API fails', async () => {
      vi.mocked(mockGarminClient.createWorkout).mockRejectedValue(
        new Error('Authentication failed')
      );

      const result = await workoutTools.createStrengthWorkout({
        name: 'Test',
        exercises: [{ name: 'Squat', sets: 1, reps: 5 }],
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it('should return error result when Garmin returns bad request', async () => {
      vi.mocked(mockGarminClient.createWorkout).mockRejectedValue(
        new Error('Bad request: invalid workout data')
      );

      const result = await workoutTools.createStrengthWorkout({
        name: 'Test',
        exercises: [{ name: 'Squat', sets: 1, reps: 5 }],
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
    });
  });
});
