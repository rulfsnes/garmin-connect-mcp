import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutTools } from '../../src/tools/tracking/workout-tools.js';
import { GarminClient } from '../../src/client/garmin-client.js';
import fixture from '../fixtures/garmin-strength-workout-detail-null-exercises.json';

describe('WorkoutTools.getWorkoutDetails() - strength readback', () => {
  let workoutTools: WorkoutTools;
  let mockGarminClient: GarminClient;

  beforeEach(() => {
    mockGarminClient = {
      getWorkoutDetails: vi.fn(),
    } as unknown as GarminClient;

    workoutTools = new WorkoutTools(mockGarminClient);
  });

  it('keeps null exercise metadata readable without fabricating labels', async () => {
    vi.mocked(mockGarminClient.getWorkoutDetails).mockResolvedValue(structuredClone(fixture));

    const result = await workoutTools.getWorkoutDetails({ workoutId: fixture.workoutId });
    const response = JSON.parse(result.content[0].text);
    const firstStep = response.steps[0];

    expect(response.success).toBe(true);
    expect(firstStep.type).toBe('interval');
    expect(firstStep.repetitions).toBe(8);
    expect(firstStep.exerciseKey).toBeUndefined();
    expect(firstStep.exerciseDisplayName).toBeUndefined();
    expect(firstStep.categoryKey).toBeUndefined();
    expect(firstStep.weight).toBeUndefined();
  });

  it('returns resolved exercise labels and structured weight when Garmin keys are present', async () => {
    const detail = structuredClone(fixture);
    const step = detail.workoutSegments[0].workoutSteps[0];
    step.category = 'BENCH_PRESS';
    step.exerciseName = 'BARBELL_BENCH_PRESS';
    step.weightValue = 100;
    step.weightUnit = { unitKey: 'kilogram' };

    vi.mocked(mockGarminClient.getWorkoutDetails).mockResolvedValue(detail);

    const result = await workoutTools.getWorkoutDetails({ workoutId: detail.workoutId });
    const response = JSON.parse(result.content[0].text);
    const firstStep = response.steps[0];

    expect(firstStep.categoryKey).toBe('BENCH_PRESS');
    expect(firstStep.categoryDisplayName).toBe('Benkpress');
    expect(firstStep.exerciseKey).toBe('BARBELL_BENCH_PRESS');
    expect(firstStep.exerciseDisplayName).toBe('Benkpress med stang');
    expect(firstStep.weight).toBe('100 kg');
  });
});
