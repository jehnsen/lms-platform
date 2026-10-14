/**
 * FR-6.4, FR-6.5, BR-21: the video conferencing service used for live classes.
 *
 * Backend seam. The real adapter runs on the server with the service's
 * credentials. It creates the meeting, gives each person their own join
 * address, and is told by the service (a webhook) when a meeting has ended
 * and its recording is ready.
 */
import { SAMPLE_VIDEOS } from "@/lib/sample-media";

export interface MeetingRequest {
  title: string;
  /** ISO date-time. */
  startsAt: string;
  durationMinutes: number;
}

export interface Meeting {
  meetingId: string;
  /** The address people open to join. */
  joinUrl: string;
}

export interface Recording {
  url: string;
  label: string;
}

export interface VideoConferencingProvider {
  readonly name: string;
  createMeeting(request: MeetingRequest): Promise<Meeting>;
  /** Ends the meeting for everyone in it. */
  endMeeting(meetingId: string): Promise<void>;
  /** The recording of a meeting that has ended, or `null` while there is none. */
  getRecording(meetingId: string): Promise<Recording | null>;
}

let counter = 0;

/**
 * MOCK: no meeting is created and nobody can really join. The join address
 * points at a page that does not exist, so the app shows a notice instead of
 * opening it, and every "recording" is the same sample clip.
 */
export const mockVideoConferencing: VideoConferencingProvider = {
  name: "Mock video",
  async createMeeting() {
    counter += 1;
    const meetingId = `mock-${Date.now().toString(36)}${counter}`;
    return { meetingId, joinUrl: `https://meet.example.com/j/${meetingId}` };
  },
  async endMeeting() {},
  async getRecording() {
    return { url: SAMPLE_VIDEOS.bunny, label: "Sample clip standing in for the recording" };
  },
};
