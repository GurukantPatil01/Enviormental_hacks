/**
 * Community Agent Interface (Future Phase)
 * Generates personalized mission nudges, community challenges, and celebrates resident milestones.
 */

export interface CommunityNudgeRequest {
  communityId: string;
  userId: string;
  streakDays: number;
}

export interface CommunityNudgeResponse {
  message: string;
  suggestedMissionId?: string;
  nudgeChannel: 'IN_APP' | 'PUSH_NOTIFICATION';
}

export interface ICommunityAgent {
  generateNudge(request: CommunityNudgeRequest): Promise<CommunityNudgeResponse>;
}
