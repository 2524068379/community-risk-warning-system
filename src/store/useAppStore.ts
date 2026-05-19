import { create } from 'zustand';
import { cameras, events } from '@/data/mock';
import type { CameraPoint, RiskEvent, VlmAnalysis, DetectionBox, TrendPoint, DetectionResult } from '@/types';

export type VlmStatus = 'idle' | 'loading' | 'analyzing' | 'ready' | 'error';

const MAX_TREND_POINTS = 30;

interface AppState {
  cameras: CameraPoint[];
  events: RiskEvent[];
  activeCameraId: string;
  selectedEventId?: string;
  analysis: VlmAnalysis;
  vlmStatus: VlmStatus;
  vlmError: string | null;
  detectionBoxes: DetectionBox[];
  analysisTimestamp: number | null;
  detectorStatus: 'idle' | 'loading' | 'ready' | 'error';
  detectedObjects: DetectionResult[];
  setActiveCamera: (cameraId: string) => void;
  selectEvent: (eventId?: string) => void;
  markEventStatus: (eventId: string, status: RiskEvent['status']) => void;
  setAnalysis: (analysis: VlmAnalysis, boxes: DetectionBox[]) => void;
  setAnalysisSummary: (summary: string) => void;
  setVlmStatus: (status: VlmStatus, error?: string) => void;
  setDetectorStatus: (status: 'idle' | 'loading' | 'ready' | 'error') => void;
  setDetectedObjects: (objects: DetectionResult[]) => void;
}

const waitingAnalysis: VlmAnalysis = {
  riskScore: 0,
  level: 'C',
  hasRisk: false,
  confidence: 0,
  summary: '等待 VLM 模型连接...',
  evidenceTimeline: [],
  breakdown: [],
  trend: []
};

const firstEvent = events[0];
const firstCamera = cameras.find((camera) => camera.id === firstEvent?.cameraId) ?? cameras[0];

export const useAppStore = create<AppState>((set, get) => ({
  cameras,
  events,
  activeCameraId: firstCamera.id,
  selectedEventId: firstEvent?.id,
  analysis: waitingAnalysis,
  vlmStatus: 'idle' as VlmStatus,
  vlmError: null,
  detectionBoxes: [],
  analysisTimestamp: null,
  detectorStatus: 'idle' as const,
  detectedObjects: [],

  setActiveCamera: (cameraId) => {
    set({
      activeCameraId: cameraId,
      detectionBoxes: [],
      selectedEventId: undefined
    });
  },

  selectEvent: (eventId) => {
    const eventItem = get().events.find((item) => item.id === eventId);
    set({
      selectedEventId: eventId,
      activeCameraId: eventItem?.cameraId ?? get().activeCameraId
    });
  },

  markEventStatus: (eventId, status) =>
    set((state) => ({
      events: state.events.map((item) => (item.id === eventId ? { ...item, status } : item))
    })),

  setAnalysis: (analysis, boxes) => {
    const prevTrend = get().analysis.trend;
    const now = new Date();
    const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const newPoint: TrendPoint = { time: timeLabel, value: analysis.riskScore };
    const trend: TrendPoint[] = [...prevTrend, newPoint].slice(-MAX_TREND_POINTS);

    set({
      analysis: { ...analysis, trend },
      detectionBoxes: boxes,
      analysisTimestamp: Date.now()
    });
  },

  setAnalysisSummary: (summary) =>
    set((state) => ({
      analysis: { ...state.analysis, summary }
    })),

  setVlmStatus: (status, error) =>
    set({
      vlmStatus: status,
      vlmError: error ?? null
    }),

  setDetectorStatus: (detectorStatus) => set({ detectorStatus }),
  setDetectedObjects: (detectedObjects) => set({ detectedObjects })
}));
