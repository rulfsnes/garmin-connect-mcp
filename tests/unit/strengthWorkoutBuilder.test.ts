/**
 * StrengthWorkoutBuilder Tests
 */

import { describe, it, expect } from 'vitest';
import { StrengthWorkoutBuilder } from '../../src/services/strengthWorkoutBuilder.js';
import {
  SPORT_TYPE_MAPPING,
  STEP_TYPE_MAPPING,
  END_CONDITION_TYPE_MAPPING,
  isExecutableStep,
} from '../../src/types/workout.js';
import type { ExecutableStep } from '../../src/types/workout.js';

describe('StrengthWorkoutBuilder', () => {
  describe('constructor', () => {
    it('should create builder with a valid name', () => {
      const builder = new StrengthWorkoutBuilder('Upper Body');
      expect(builder).toBeDefined();
    });

    it('should throw when name is empty', () => {
      expect(() => new StrengthWorkoutBuilder('')).toThrow('Workout name is required');
    });

    it('should throw when name is only whitespace', () => {
      expect(() => new StrengthWorkoutBuilder('   ')).toThrow('Workout name is required');
    });
  });

  describe('setDescription()', () => {
    it('should set description on the payload', () => {
      const payload = new StrengthWorkoutBuilder('My Workout')
        .setDescription('A test description')
        .addExercise({ name: 'Push Up', sets: 2, reps: 10 })
        .build();

      expect(payload.description).toBe('A test description');
    });

    it('should treat empty description as undefined', () => {
      const payload = new StrengthWorkoutBuilder('My Workout')
        .setDescription('   ')
        .addExercise({ name: 'Push Up', sets: 2, reps: 10 })
        .build();

      expect(payload.description).toBeUndefined();
    });
  });

  describe('addExercise()', () => {
    it('should add N set steps for an exercise with reps', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Squat', sets: 3, reps: 10, restSeconds: 0 })
        .build();

      const executableSteps = payload.workoutSegments[0].workoutSteps.filter(isExecutableStep);
      expect(executableSteps).toHaveLength(3);
    });

    it('should use iterations end condition for reps-based sets', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Bench Press', sets: 1, reps: 8, restSeconds: 0 })
        .build();

      const step = payload.workoutSegments[0].workoutSteps[0] as ExecutableStep;
      expect(step.endCondition).toEqual(END_CONDITION_TYPE_MAPPING.iterations);
      expect(step.endConditionValue).toBe(8);
    });

    it('should use time end condition for duration-based sets', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Plank', sets: 1, durationSeconds: 45, restSeconds: 0 })
        .build();

      const step = payload.workoutSegments[0].workoutSteps[0] as ExecutableStep;
      expect(step.endCondition).toEqual(END_CONDITION_TYPE_MAPPING.time);
      expect(step.endConditionValue).toBe(45);
    });

    it('should set exerciseName on each set step', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Deadlift', sets: 2, reps: 5, restSeconds: 0 })
        .build();

      for (const step of payload.workoutSegments[0].workoutSteps) {
        if (isExecutableStep(step)) {
          expect(step.exerciseName).toBe('Deadlift');
        }
      }
    });

    it('should set Garmin category and exercise keys when provided', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({
          name: 'Bench Press',
          categoryKey: 'BENCH_PRESS',
          exerciseKey: 'BARBELL_BENCH_PRESS',
          sets: 1,
          reps: 5,
          restSeconds: 0,
        })
        .build();

      const step = payload.workoutSegments[0].workoutSteps[0] as ExecutableStep;
      expect(step.category).toBe('BENCH_PRESS');
      expect(step.exerciseName).toBe('BARBELL_BENCH_PRESS');
    });

    it('should store weightKg as structured weight fields on the primary path', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Bench Press', sets: 1, reps: 5, weightKg: 100, restSeconds: 0 })
        .build();

      const step = payload.workoutSegments[0].workoutSteps[0] as ExecutableStep;
      expect(step.description).toBeNull();
      expect(step.weightValue).toBe(100);
      expect(step.weightUnit).toEqual({ unitKey: 'kilogram' });
    });

    it('should keep weight fields null when no weight provided', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Pull Up', sets: 1, reps: 8, restSeconds: 0 })
        .build();

      const step = payload.workoutSegments[0].workoutSteps[0] as ExecutableStep;
      expect(step.description).toBeNull();
      expect(step.weightValue).toBeNull();
      expect(step.weightUnit).toBeNull();
    });

    it('should store weightKg in description only when legacy weight fallback is enabled', () => {
      const payload = new StrengthWorkoutBuilder('Test', { useLegacyWeightDescription: true })
        .addExercise({ name: 'Bench Press', sets: 1, reps: 5, weightKg: 100, restSeconds: 0 })
        .build();

      const step = payload.workoutSegments[0].workoutSteps[0] as ExecutableStep;
      expect(step.description).toBe('100kg');
      expect(step.weightValue).toBeNull();
      expect(step.weightUnit).toBeNull();
    });

    it('should append a rest step after sets when restSeconds > 0', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Squat', sets: 3, reps: 10, restSeconds: 90 })
        .build();

      const steps = payload.workoutSegments[0].workoutSteps;
      // 3 set steps + 1 rest step
      expect(steps).toHaveLength(4);

      const restStep = steps[3] as ExecutableStep;
      expect(isExecutableStep(restStep)).toBe(true);
      expect(restStep.stepType).toEqual(STEP_TYPE_MAPPING.rest);
      expect(restStep.endConditionValue).toBe(90);
    });

    it('should not append rest step when restSeconds is 0', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Squat', sets: 3, reps: 10, restSeconds: 0 })
        .build();

      expect(payload.workoutSegments[0].workoutSteps).toHaveLength(3);
    });

    it('should use default restSeconds of 60 when not specified', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Squat', sets: 2, reps: 10 })
        .build();

      const steps = payload.workoutSegments[0].workoutSteps;
      // 2 set steps + 1 rest step (default 60s)
      expect(steps).toHaveLength(3);
      const restStep = steps[2] as ExecutableStep;
      expect(restStep.stepType).toEqual(STEP_TYPE_MAPPING.rest);
      expect(restStep.endConditionValue).toBe(60);
    });

    it('should assign sequential stepOrders across multiple exercises', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Squat', sets: 2, reps: 10, restSeconds: 60 })
        .addExercise({ name: 'Lunge', sets: 2, reps: 12, restSeconds: 60 })
        .build();

      const steps = payload.workoutSegments[0].workoutSteps as ExecutableStep[];
      // 2 squats + 1 rest + 2 lunges + 1 rest = 6 steps
      expect(steps).toHaveLength(6);
      steps.forEach((step, i) => {
        expect(step.stepOrder).toBe(i + 1);
      });
    });

    it('should assign sequential stepIds', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Squat', sets: 2, reps: 5, restSeconds: 30 })
        .build();

      const steps = payload.workoutSegments[0].workoutSteps as ExecutableStep[];
      expect(steps[0].stepId).toBe(1);
      expect(steps[1].stepId).toBe(2);
      expect(steps[2].stepId).toBe(3);
    });

    it('should throw when sets < 1', () => {
      expect(() =>
        new StrengthWorkoutBuilder('Test').addExercise({ name: 'Squat', sets: 0, reps: 5 })
      ).toThrow('sets must be a positive integer');
    });

    it('should throw when neither reps nor durationSeconds provided', () => {
      expect(() =>
        new StrengthWorkoutBuilder('Test').addExercise({ name: 'Squat', sets: 3 } as any)
      ).toThrow('either reps or durationSeconds is required');
    });

    it('should throw when reps < 1', () => {
      expect(() =>
        new StrengthWorkoutBuilder('Test').addExercise({ name: 'Squat', sets: 3, reps: 0 })
      ).toThrow('reps must be >= 1');
    });

    it('should throw when durationSeconds < 1', () => {
      expect(() =>
        new StrengthWorkoutBuilder('Test').addExercise({ name: 'Plank', sets: 3, durationSeconds: 0 })
      ).toThrow('durationSeconds must be >= 1');
    });

    it('should throw when weightKg is negative', () => {
      expect(() =>
        new StrengthWorkoutBuilder('Test').addExercise({ name: 'Squat', sets: 3, reps: 5, weightKg: -1 })
      ).toThrow('weightKg must be >= 0');
    });

    it('should throw when restSeconds is negative', () => {
      expect(() =>
        new StrengthWorkoutBuilder('Test').addExercise({ name: 'Squat', sets: 3, reps: 5, restSeconds: -1 })
      ).toThrow('restSeconds must be >= 0');
    });
  });

  describe('build()', () => {
    it('should produce correct sportType for strength_training', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Squat', sets: 1, reps: 5, restSeconds: 0 })
        .build();

      expect(payload.sportType).toEqual(SPORT_TYPE_MAPPING.strength_training);
    });

    it('should set workoutName from constructor', () => {
      const payload = new StrengthWorkoutBuilder('My Strength Session')
        .addExercise({ name: 'Squat', sets: 1, reps: 5, restSeconds: 0 })
        .build();

      expect(payload.workoutName).toBe('My Strength Session');
    });

    it('should include exactly one segment', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Squat', sets: 1, reps: 5, restSeconds: 0 })
        .build();

      expect(payload.workoutSegments).toHaveLength(1);
      expect(payload.workoutSegments[0].segmentOrder).toBe(1);
    });

    it('should throw when no exercises added', () => {
      expect(() => new StrengthWorkoutBuilder('Empty').build()).toThrow(
        'Workout must have at least one exercise'
      );
    });

    it('should set required Garmin API fields', () => {
      const payload = new StrengthWorkoutBuilder('Test')
        .addExercise({ name: 'Squat', sets: 1, reps: 5, restSeconds: 0 })
        .build();

      expect(payload.subSportType).toBeNull();
      expect(payload.estimateType).toBeNull();
      expect(payload.isWheelchair).toBe(false);
      expect(payload.estimatedDistanceUnit).toEqual({ unitKey: null });
    });

    it('should handle a full workout with multiple exercises', () => {
      const payload = new StrengthWorkoutBuilder('Full Body')
        .setDescription('Complete workout')
        .addExercise({ name: 'Squat', sets: 3, reps: 10, weightKg: 60, restSeconds: 90 })
        .addExercise({ name: 'Push Up', sets: 3, reps: 15, restSeconds: 60 })
        .addExercise({ name: 'Plank', sets: 3, durationSeconds: 60, restSeconds: 45 })
        .build();

      // 3 squats + 1 rest + 3 push ups + 1 rest + 3 planks + 1 rest = 12 steps
      expect(payload.workoutSegments[0].workoutSteps).toHaveLength(12);
      expect(payload.workoutName).toBe('Full Body');
      expect(payload.description).toBe('Complete workout');
    });
  });
});
