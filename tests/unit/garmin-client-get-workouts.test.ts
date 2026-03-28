import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GarminClient } from '../../src/client/garmin-client.js';

describe('GarminClient.getWorkouts', () => {
  let client: GarminClient;
  let getWorkoutsMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new GarminClient({ username: 'user', password: 'pass' });
    getWorkoutsMock = vi.fn();

    vi.spyOn(client, 'initialize').mockResolvedValue({
      getWorkouts: getWorkoutsMock,
    } as any);
  });

  it('fetches all workout pages when limit is omitted', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      workoutId: index + 1,
      workoutName: `Workout ${index + 1}`,
      description: '',
      updateDate: '2025-01-15T10:00:00.000Z',
      createdDate: '2025-01-15T10:00:00.000Z',
      sportType: { sportTypeId: 1, sportTypeKey: 'running' },
      estimatedDurationInSecs: 1800,
      estimatedDistanceInMeters: 5000,
    }));
    const secondPage = Array.from({ length: 20 }, (_, index) => ({
      workoutId: index + 101,
      workoutName: `Workout ${index + 101}`,
      description: '',
      updateDate: '2025-01-15T10:00:00.000Z',
      createdDate: '2025-01-15T10:00:00.000Z',
      sportType: { sportTypeId: 1, sportTypeKey: 'running' },
      estimatedDurationInSecs: 1800,
      estimatedDistanceInMeters: 5000,
    }));

    getWorkoutsMock
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);

    const result = await client.getWorkouts();

    expect(result).toHaveLength(120);
    expect(getWorkoutsMock).toHaveBeenCalledTimes(2);
    expect(getWorkoutsMock).toHaveBeenNthCalledWith(1, 0, 100);
    expect(getWorkoutsMock).toHaveBeenNthCalledWith(2, 100, 100);
  });

  it('respects start and limit across multiple pages', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      workoutId: index + 11,
      workoutName: `Workout ${index + 11}`,
      description: '',
      updateDate: '2025-01-15T10:00:00.000Z',
      createdDate: '2025-01-15T10:00:00.000Z',
      sportType: { sportTypeId: 1, sportTypeKey: 'running' },
      estimatedDurationInSecs: 1800,
      estimatedDistanceInMeters: 5000,
    }));
    const secondPage = Array.from({ length: 20 }, (_, index) => ({
      workoutId: index + 111,
      workoutName: `Workout ${index + 111}`,
      description: '',
      updateDate: '2025-01-15T10:00:00.000Z',
      createdDate: '2025-01-15T10:00:00.000Z',
      sportType: { sportTypeId: 1, sportTypeKey: 'running' },
      estimatedDurationInSecs: 1800,
      estimatedDistanceInMeters: 5000,
    }));

    getWorkoutsMock
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);

    const result = await client.getWorkouts(10, 120);

    expect(result).toHaveLength(120);
    expect(getWorkoutsMock).toHaveBeenCalledTimes(2);
    expect(getWorkoutsMock).toHaveBeenNthCalledWith(1, 10, 100);
    expect(getWorkoutsMock).toHaveBeenNthCalledWith(2, 110, 20);
  });

  it('wraps Garmin API errors with workout context', async () => {
    getWorkoutsMock.mockRejectedValueOnce(new Error('500 internal server error'));

    await expect(client.getWorkouts()).rejects.toThrow('Garmin server error');
  });
});
