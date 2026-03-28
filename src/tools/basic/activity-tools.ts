/**
 * @fileoverview Activity data retrieval tools for Garmin Connect workouts and training sessions
 *
 * Provides access to comprehensive activity data including timing, performance metrics,
 * training effects, location, and detailed splits. Essential for analyzing individual
 * workouts, tracking training history, and monitoring performance trends. Supports
 * pagination and flexible response formats (summary vs. detailed) to optimize data
 * transfer for AI analysis.
 *
 * Tools provided:
 * - getActivities: List recent activities with pagination and optional summary format
 * - getActivityDetails: Retrieve comprehensive details for a specific activity including splits
 *
 * @category Basic
 * @see ../../client/garmin-client for Garmin Connect API integration
 * @see ../aggregation/activity-volume-tools for training volume aggregation across activities
 * @see ../analytics/sport-progress for performance trend analysis
 */

import { GarminClient } from '../../client/garmin-client.js';
import { metersToKm, removeEmptyValues } from '../../utils/data-transforms.js';
import { formatError } from '../../utils/response-helpers.js';
import { createSummary } from '../../utils/summary-helpers.js';
import { BaseDirectTool } from '../base/BaseDirectTool.js';
import { GetActivitiesParams, GetActivityDetailsParams } from '../../types/tool-params.js';
import { ToolResult } from '../../types/garmin-types.js';
import { IActivity, IActivityDetails } from 'garmin-connect/dist/garmin/types/activity.js';

export class ActivityTools extends BaseDirectTool {
  constructor(garminClient: GarminClient) {
    super(garminClient);
  }

  /**
   * Retrieve recent activities to analyze training history and patterns
   *
   * Enables analysis of recent workouts, tracking training volume, identifying activity
   * types, and monitoring performance trends. Essential for understanding training load,
   * recovery needs, and progress toward goals. Supports pagination for efficient data access.
   *
   * Uses 'activityList' preset for summary mode which includes key metrics
   * (type, duration, distance, calories, HR) without detailed breakdowns.
   *
   * @param params - Activity list retrieval parameters
   * @param params.start - Starting index for pagination (default: 0)
   * @param params.limit - Maximum activities to return, capped at 50 (default: 20)
   * @param params.includeSummaryOnly - Return only key metrics (type, duration, distance) for faster processing
   * @param params.summary - [DEPRECATED: Use includeSummaryOnly] Legacy summary flag
   * @returns MCP tool result with activity list or error message
   * @throws Error if Garmin API is unavailable or response exceeds size limits
   *
   * @example
   * // Get last 10 activities in summary format
   * const result = await activityTools.getActivities({
   *   limit: 10,
   *   includeSummaryOnly: true
   * });
   *
   * @example
   * // Paginate through activities
   * const result = await activityTools.getActivities({
   *   start: 20,
   *   limit: 20
   * });
   *
   * @see getActivityDetails for detailed single activity analysis
   */
  async getActivities(params: GetActivitiesParams): Promise<ToolResult> {
    const start = params?.start || 0;
    const limit = Math.min(params?.limit || 20, 50); // Cap at 50 for response size
    // includeSummaryOnly takes precedence over deprecated summary parameter
    const useSummary = params?.includeSummaryOnly ?? params?.summary ?? false;

    try {
      const activities = await this.garminClient.getActivities(start, limit);

      if (!activities || activities.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "No activities found for the specified criteria"
          }]
        };
      }

      let processedActivities;

      if (useSummary) {
        // Return compact summary format using activityList preset
        processedActivities = {
          count: activities.length,
          activities: activities.map((activity: IActivity) => {
            const summaryResult = createSummary(activity as unknown as Record<string, unknown>, {
              preset: 'activityList',
              includeMetadata: false
            });
            return summaryResult.data;
          })
        };
      } else {
        // Return detailed format
        processedActivities = {
          count: activities.length,
          pagination: {
            start,
            limit,
            hasMore: activities.length === limit
          },
          activities: activities.map((activity: IActivity) => ({
            activityId: activity.activityId,
            name: activity.activityName,
            description: activity.description,
            type: {
              key: activity.activityType?.typeKey,
              id: activity.activityType?.typeId,
              parentId: activity.activityType?.parentTypeId
            },
            timing: {
              startTimeLocal: activity.startTimeLocal,
              startTimeGMT: activity.startTimeGMT,
              durationSeconds: activity.duration,
              elapsedDurationSeconds: activity.elapsedDuration,
              movingDurationSeconds: activity.movingDuration
            },
            metrics: {
              distance: activity.distance ? metersToKm(activity.distance) : null,
              calories: activity.calories,
              elevationGain: activity.elevationGain,
              elevationLoss: activity.elevationLoss,
              averageSpeed: activity.averageSpeed,
              maxSpeed: activity.maxSpeed,
              steps: activity.steps
            },
            heartRate: {
              average: activity.averageHR,
              max: activity.maxHR
            },
            cadence: {
              averageRunning: activity.averageRunningCadenceInStepsPerMinute,
              maxRunning: activity.maxRunningCadenceInStepsPerMinute,
              averageBiking: activity.averageBikingCadenceInRevPerMinute,
              maxBiking: activity.maxBikingCadenceInRevPerMinute
            },
            training: {
              aerobicEffect: activity.aerobicTrainingEffect,
              anaerobicEffect: activity.anaerobicTrainingEffect,
              trainingEffectLabel: activity.trainingEffectLabel,
              vO2MaxValue: activity.vO2MaxValue
            },
            location: {
              startLatitude: activity.startLatitude,
              startLongitude: activity.startLongitude,
              endLatitude: activity.endLatitude,
              endLongitude: activity.endLongitude,
              locationName: activity.locationName
            }
          }))
        };
      }

      // Clean up empty values
      const cleanedData = removeEmptyValues(processedActivities);

      // Validate response size
      if (!this.validateResponseSize(cleanedData)) {
        return this.createErrorResponse(JSON.stringify({
          error: "Activity data too large - try using summary=true or reducing limit",
          suggestion: "Use get_activity_details(activityId) for detailed single activity data",
          count: activities.length,
          availableOptions: {
            summary: "Set summary=true for compact format",
            limit: "Reduce limit parameter (max 50)",
            pagination: "Use start parameter for pagination"
          }
        }, null, 2));
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(cleanedData, null, 2)
        }]
      };

    } catch (error) {
      return this.createErrorResponse(formatError('api', 'get activities', error instanceof Error ? error : 'Unknown error'));
    }
  }

  /**
   * Retrieve comprehensive details for a specific activity to enable deep performance analysis
   *
   * Provides complete activity data including splits, cadence, elevation, training effects,
   * and advanced running metrics. Essential for analyzing individual workout performance,
   * understanding training stimulus, and identifying areas for improvement.
   *
   * @param params - Activity details retrieval parameters
   * @param params.activityId - Unique identifier of the activity (obtain from getActivities)
   * @returns MCP tool result with detailed activity data or error message
   * @throws Error if activity ID is invalid, not found, or Garmin API is unavailable
   *
   * @example
   * // Get full details for an activity
   * const result = await activityTools.getActivityDetails({
   *   activityId: 12345678901
   * });
   *
   * @see getActivities for listing multiple activities
   */
  async getActivityDetails(params: GetActivityDetailsParams): Promise<ToolResult> {
    const activityId = params?.activityId;

    if (!activityId) {
      return this.createErrorResponse(formatError('validation', 'activityId', 'required'));
    }

    try {
      const activity = await this.garminClient.getActivity({ activityId });

      if (!activity) {
        return {
          content: [{
            type: "text" as const,
            text: `No activity found with ID: ${activityId}`
          }]
        };
      }

      const detail = activity as unknown as IActivityDetails;
      const raw = detail as unknown as Record<string, unknown>;
      const s = (raw.summaryDTO || {}) as Record<string, unknown>;
      const meta = (raw.metadataDTO || {}) as Record<string, unknown>;
      const aType = (raw.activityTypeDTO || {}) as Record<string, unknown>;
      const tz = (raw.timeZoneUnitDTO || {}) as Record<string, unknown>;
      const access = (raw.accessControlRuleDTO || {}) as Record<string, unknown>;
      const deviceMeta = (meta.deviceMetaDataDTO || {}) as Record<string, unknown>;

      // Create processed activity with explicit structure
      const processedActivity: Record<string, unknown> = {
        activityId: raw.activityId,
        basic: {
          name: raw.activityName,
          description: raw.description,
          type: {
            key: aType.typeKey,
            id: aType.typeId,
            parentId: aType.parentTypeId
          },
          privacy: access.typeKey,
          locationName: raw.locationName,
          favorite: meta.favorite,
          personalRecord: meta.personalRecord
        },
        timing: {
          startTimeLocal: s.startTimeLocal,
          startTimeGMT: s.startTimeGMT,
          timeZone: tz.unitKey,
          durationSeconds: s.duration,
          elapsedDurationSeconds: s.elapsedDuration,
          movingDurationSeconds: s.movingDuration
        },
        performance: {
          distance: typeof s.distance === 'number' && s.distance ? metersToKm(s.distance) : null,
          calories: s.calories,
          averageSpeed: s.averageSpeed,
          maxSpeed: s.maxSpeed,
          elevationGain: s.elevationGain,
          elevationLoss: s.elevationLoss,
          minElevation: s.minElevation,
          maxElevation: s.maxElevation,
          steps: s.steps
        },
        power: {
          averagePower: s.averagePower,
          maxPower: s.maxPower,
          normalizedPower: s.normalizedPower,
          functionalThresholdPower: s.functionalThresholdPower,
          maxPowerTwentyMinutes: s.maxPowerTwentyMinutes,
          totalWork: s.totalWork,
          trainingStressScore: s.trainingStressScore,
          intensityFactor: s.intensityFactor,
          leftTorqueEffectiveness: s.leftTorqueEffectiveness,
          rightTorqueEffectiveness: s.rightTorqueEffectiveness,
          leftPedalSmoothness: s.leftPedalSmoothness,
          rightPedalSmoothness: s.rightPedalSmoothness
        },
        heartRate: {
          average: s.averageHR,
          max: s.maxHR,
          min: s.minHR
        },
        cadence: {
          running: {
            average: s.averageRunCadence,
            max: s.maxRunCadence
          },
          biking: {
            average: s.averageBikeCadence,
            max: s.maxBikeCadence
          }
        },
        training: {
          aerobicEffect: s.trainingEffect,
          anaerobicEffect: s.anaerobicTrainingEffect,
          trainingEffectLabel: s.trainingEffectLabel,
          aerobicMessage: s.aerobicTrainingEffectMessage,
          anaerobicMessage: s.anaerobicTrainingEffectMessage,
          trainingLoad: s.activityTrainingLoad
        },
        runningMetrics: {
          avgVerticalOscillation: s.verticalOscillation,
          avgGroundContactTime: s.groundContactTime,
          avgStrideLength: s.strideLength,
          avgVerticalRatio: s.verticalRatio,
          avgGroundContactBalance: s.groundContactBalanceLeft
        },
        respiration: {
          avgRespirationRate: s.avgRespirationRate,
          minRespirationRate: s.minRespirationRate,
          maxRespirationRate: s.maxRespirationRate
        },
        stamina: {
          beginPotentialStamina: s.beginPotentialStamina,
          endPotentialStamina: s.endPotentialStamina,
          minAvailableStamina: s.minAvailableStamina
        },
        sensors: meta.sensors,
        location: {
          start: {
            latitude: s.startLatitude,
            longitude: s.startLongitude
          },
          end: {
            latitude: s.endLatitude,
            longitude: s.endLongitude
          },
          hasPolyline: meta.hasPolyline
        },
        device: {
          manufacturer: meta.manufacturer,
          deviceId: deviceMeta.deviceId
        },
        laps: {
          count: meta.lapCount,
          hasSplits: meta.hasSplits,
          minLapDurationSeconds: s.minActivityLapDuration
        }
      };

      // Add split summaries if available (but check size)
      const splitSummaries = raw.splitSummaries as Array<Record<string, unknown>> | undefined;
      if (splitSummaries && Array.isArray(splitSummaries) && splitSummaries.length > 0) {
        if (splitSummaries.length < 20) {
          processedActivity.splitSummaries = splitSummaries.map((split) => ({
            splitType: split.splitType,
            distance: typeof split.distance === 'number' ? metersToKm(split.distance) : null,
            durationSeconds: split.duration,
            averageSpeed: split.averageSpeed,
            maxSpeed: split.maxSpeed,
            elevationGain: split.totalAscent || split.elevationGain,
            elevationLoss: split.elevationLoss,
            averageHR: split.averageHR,
            maxHR: split.maxHR,
            calories: split.calories,
            noOfSplits: split.noOfSplits
          }));
        } else {
          processedActivity.splitSummaries = {
            count: splitSummaries.length,
            note: "Too many splits to display - use a dedicated splits endpoint if needed"
          };
        }
      }

      // Clean up empty values
      const cleanedData = removeEmptyValues(processedActivity);

      // Validate response size
      if (!this.validateResponseSize(cleanedData)) {
        return this.createErrorResponse(JSON.stringify({
          activityId,
          error: "Activity data too large to display completely",
          summary: {
            name: detail.activityName,
            type: typeof aType.typeKey === 'string' ? aType.typeKey : null,
            durationSeconds: typeof s.duration === 'number' ? s.duration : null,
            distance: typeof s.distance === 'number' ? metersToKm(s.distance) : null,
            calories: typeof s.calories === 'number' ? s.calories : null
          },
          suggestion: "Activity contains extensive data. Consider requesting specific aspects."
        }, null, 2));
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(cleanedData, null, 2)
        }]
      };

    } catch (error) {
      return this.createErrorResponse(formatError('api', 'get activity details', error instanceof Error ? error : 'Unknown error'));
    }
  }
}
