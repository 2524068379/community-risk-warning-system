import { create } from 'zustand';
import { cameras, defaultAnalysis, events } from '@/data/mock';
import type { CameraPoint, RiskEvent, VlmAnalysis } from '@/types';

interface AppState {
  cameras: CameraPoint[];
  events: RiskEvent[];
  activeCameraId: string;
  selectedEventId?: string;
  analysis: VlmAnalysis;
  setActiveCamera: (cameraId: string) => void;
  selectEvent: (eventId?: string) => void;
  markEventStatus: (eventId: string, status: RiskEvent['status']) => void;
}

const firstCamera = cameras[0];

export const useAppStore = create<AppState>((set, get) => ({
  cameras,
  events,
  activeCameraId: firstCamera.id,
  selectedEventId: events[0]?.id,
  analysis: defaultAnalysis,
  setActiveCamera: (cameraId) => {
    const matchedEvent = get().events.find((eventItem) => eventItem.cameraId === cameraId);

    set({
      activeCameraId: cameraId,
      analysis: matchedEvent?.analysis ?? defaultAnalysis,
      selectedEventId: matchedEvent?.id
    });
  },
  selectEvent: (eventId) => {
    const eventItem = get().events.find((item) => item.id === eventId);
    set({
      selectedEventId: eventId,
      activeCameraId: eventItem?.cameraId ?? get().activeCameraId,
      analysis: eventItem?.analysis ?? get().analysis
    });
  },
  markEventStatus: (eventId, status) =>
    set((state) => ({
      events: state.events.map((item) => (item.id === eventId ? { ...item, status } : item))
    }))
}));
