/**
 * StrengthWorkoutBuilder Service
 *
 * Builds Garmin Connect workout payloads for strength training sessions.
 * Each exercise produces N executable set steps (reps-based or time-based),
 * followed by an optional rest step.
 *
 * @example Basic strength workout
 * ```typescript
 * const workout = new StrengthWorkoutBuilder("Upper Body")
 *   .addExercise({ name: "Bench Press", sets: 3, reps: 10, weightKg: 80, restSeconds: 90 })
 *   .addExercise({ name: "Pull Up", sets: 3, reps: 8, restSeconds: 60 })
 *   .build();
 * ```
 */

import type { WorkoutPayload, WorkoutStep, ExecutableStep } from '../types/workout.js';
import {
  SPORT_TYPE_MAPPING,
  STEP_TYPE_MAPPING,
  TARGET_TYPE_MAPPING,
  END_CONDITION_TYPE_MAPPING,
  WEIGHT_UNIT_MAPPING,
  validateWorkoutPayload,
} from '../types/workout.js';
import type { StrengthExerciseInput } from '../types/tool-params.js';

interface StrengthWorkoutBuilderOptions {
  useLegacyWeightDescription?: boolean;
}

export class StrengthWorkoutBuilder {
  private workoutName: string;
  private description: string | undefined = undefined;
  private steps: WorkoutStep[] = [];
  private currentStepOrder = 1;
  private currentStepId = 1;
  private options: StrengthWorkoutBuilderOptions;

  constructor(name: string, options: StrengthWorkoutBuilderOptions = {}) {
    if (!name || name.trim() === '') {
      throw new Error('Workout name is required');
    }
    this.workoutName = name.trim();
    this.options = options;
  }

  setDescription(description: string): this {
    this.description = description.trim() || undefined;
    return this;
  }

  /**
   * Add a strength exercise, producing N set steps plus an optional rest step.
   */
  addExercise(exercise: StrengthExerciseInput): this {
    const { name, sets, reps, durationSeconds, weightKg, restSeconds = 60 } = exercise;
    const exerciseLabel = name ?? exercise.exerciseKey ?? 'Unnamed exercise';

    if (sets < 1 || !Number.isInteger(sets)) {
      throw new Error(`Exercise "${exerciseLabel}": sets must be a positive integer`);
    }
    if (reps === undefined && durationSeconds === undefined) {
      throw new Error(`Exercise "${exerciseLabel}": either reps or durationSeconds is required`);
    }
    if (reps !== undefined && reps < 1) {
      throw new Error(`Exercise "${exerciseLabel}": reps must be >= 1`);
    }
    if (durationSeconds !== undefined && durationSeconds < 1) {
      throw new Error(`Exercise "${exerciseLabel}": durationSeconds must be >= 1`);
    }
    if (weightKg !== undefined && weightKg < 0) {
      throw new Error(`Exercise "${exerciseLabel}": weightKg must be >= 0`);
    }
    if (restSeconds < 0) {
      throw new Error(`Exercise "${exerciseLabel}": restSeconds must be >= 0`);
    }

    // Add one step per set
    for (let i = 0; i < sets; i++) {
      const setStep = this.buildSetStep(exercise, reps, durationSeconds, weightKg);
      this.steps.push(setStep);
    }

    // Add rest step after all sets if restSeconds > 0
    if (restSeconds > 0) {
      const restStep = this.buildRestStep(restSeconds);
      this.steps.push(restStep);
    }

    return this;
  }

  /**
   * Build the final workout payload.
   */
  build(): WorkoutPayload {
    if (this.steps.length === 0) {
      throw new Error('Workout must have at least one exercise');
    }

    const sportType = SPORT_TYPE_MAPPING.strength_training;

    const payload: WorkoutPayload = {
      workoutName: this.workoutName,
      description: this.description,
      sportType,
      subSportType: null,
      workoutSegments: [
        {
          segmentOrder: 1,
          sportType,
          workoutSteps: this.steps,
        },
      ],
      estimatedDistanceUnit: { unitKey: null },
      avgTrainingSpeed: 0,
      estimatedDurationInSecs: 0,
      estimatedDistanceInMeters: 0,
      estimateType: null,
      isWheelchair: false,
    };

    validateWorkoutPayload(payload);

    return payload;
  }

  private buildSetStep(
    exercise: StrengthExerciseInput,
    reps: number | undefined,
    durationSeconds: number | undefined,
    weightKg: number | undefined
  ): ExecutableStep {
    const usesReps = reps !== undefined;
    const description = this.options.useLegacyWeightDescription && weightKg !== undefined
      ? `${weightKg}kg`
      : null;

    const step: ExecutableStep = {
      type: 'ExecutableStepDTO',
      stepId: this.currentStepId++,
      stepOrder: this.currentStepOrder++,
      childStepId: null,
      description,
      stepType: STEP_TYPE_MAPPING.interval,
      endCondition: usesReps
        ? END_CONDITION_TYPE_MAPPING.iterations
        : END_CONDITION_TYPE_MAPPING.time,
      endConditionValue: usesReps ? reps! : durationSeconds!,
      endConditionCompare: null,
      endConditionZone: null,
      preferredEndConditionUnit: null,
      targetType: TARGET_TYPE_MAPPING['no target'],
      targetValueOne: null,
      targetValueTwo: null,
      zoneNumber: null,
      exerciseName: exercise.exerciseKey ?? exercise.name ?? null,
      strokeType: null,
      equipmentType: null,
      category: exercise.categoryKey ?? null,
      weightValue: this.options.useLegacyWeightDescription ? null : (weightKg ?? null),
      weightUnit: this.options.useLegacyWeightDescription || weightKg === undefined
        ? null
        : WEIGHT_UNIT_MAPPING.kilogram,
    };

    return step;
  }

  private buildRestStep(seconds: number): ExecutableStep {
    return {
      type: 'ExecutableStepDTO',
      stepId: this.currentStepId++,
      stepOrder: this.currentStepOrder++,
      childStepId: null,
      description: null,
      stepType: STEP_TYPE_MAPPING.rest,
      endCondition: END_CONDITION_TYPE_MAPPING.time,
      endConditionValue: seconds,
      endConditionCompare: null,
      endConditionZone: null,
      preferredEndConditionUnit: null,
      targetType: TARGET_TYPE_MAPPING['no target'],
      targetValueOne: null,
      targetValueTwo: null,
      zoneNumber: null,
      exerciseName: null,
      strokeType: null,
      equipmentType: null,
      category: null,
      weightValue: null,
      weightUnit: null,
    };
  }
}
