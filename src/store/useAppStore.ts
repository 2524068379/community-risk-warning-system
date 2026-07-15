import { create } from 'zustand';
import { cameras, events } from '@/data/mock';
import type {
  AnalysisValidity,
  CameraPoint,
  DetectionBox,
  DetectionResult,
  RiskEvent,
  TrendPoint,
  VlmAnalysis,
  VlmAnalysisContext,
  VlmModelSource
} from '@/types';

export type VlmStatus = 'idle' | 'loading' | 'analyzing' | 'ready' | 'response-error' | 'error';

const MAX_TREND_POINTS = 30;

interface AppState {
  cameras: CameraPoint[];
  events: RiskEvent[];
  activeCameraId: string;
  selectedEventId?: string;
  analysis: VlmAnalysis;
  analysisContext: VlmAnalysisContext | null;
  analysisValidity: AnalysisValidity;
  vlmStatus: VlmStatus;
  vlmError: string | null;
  detectionBoxes: DetectionBox[];
  analysisFrameDataUrl: string | null;
  analysisTimestamp: number | null;
  detectorStatus: 'idle' | 'loading' | 'ready' | 'error';
  detectedObjects: DetectionResult[];
  setActiveCamera: (cameraId: string) => void;
  selectEvent: (eventId?: string) => void;
  markEventStatus: (eventId: string, status: RiskEvent['status']) => void;
  setAnalysis: (
    analysis: VlmAnalysis,
    boxes: DetectionBox[],
    context?: {
      cameraId?: string;
      capturedAt?: number;
      modelSource?: VlmModelSource;
      frameDataUrl?: string;
    }
  ) => void;
  invalidateAnalysis: () => void;
  setVlmStatus: (status: VlmStatus, error?: string) => void;
  setDetectorStatus: (status: 'idle' | 'loading' | 'ready' | 'error') => void;
  setDetectedObjects: (objects: DetectionResult[]) => void;
}

const waitingAnalysis: VlmAnalysis = {
  riskScore: 0,
  level: 'C',
  hasRisk: false,
  confidence: 0,
  summary: '等待摄像头画面与首次分析...',
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
  analysisContext: null,
  analysisValidity: 'unknown',
  vlmStatus: 'idle' as VlmStatus,
  vlmError: null,
  detectionBoxes: [],
  analysisFrameDataUrl: null,
  analysisTimestamp: null,
  detectorStatus: 'idle' as const,
  detectedObjects: [],

  setActiveCamera: (cameraId) => {
    set({
      activeCameraId: cameraId,
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

  setAnalysis: (analysis, boxes, context) => {
    const prevTrend = get().analysis.trend;
    const now = new Date();
    const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const newPoint: TrendPoint = { time: timeLabel, value: analysis.riskScore };
    const trend: TrendPoint[] = [...prevTrend, newPoint].slice(-MAX_TREND_POINTS);

    set({
      analysis: { ...analysis, trend },
      detectionBoxes: boxes,
      analysisFrameDataUrl: context?.frameDataUrl ?? null,
      analysisTimestamp: now.getTime(),
      analysisValidity: 'valid',
      analysisContext: {
        cameraId: context?.cameraId ?? 'LOCAL',
        capturedAt: context?.capturedAt ?? now.getTime(),
        completedAt: now.getTime(),
        modelSource: context?.modelSource ?? 'unknown'
      }
    });
  },

  invalidateAnalysis: () =>
    set((state) => ({
      analysisValidity: state.analysisTimestamp === null ? 'unknown' : 'stale',
      detectionBoxes: [],
      analysisFrameDataUrl: null
    })),

  setVlmStatus: (status, error) =>
    set((state) => ({
      vlmStatus: status,
      vlmError: error ?? null,
      analysisValidity: status === 'error' || status === 'response-error'
        ? state.analysisTimestamp === null ? 'error' : 'stale'
        : (status === 'idle' || status === 'loading' || status === 'analyzing') && state.analysisTimestamp === null
          ? 'unknown'
          : state.analysisValidity
    })),

  setDetectorStatus: (detectorStatus) => set({ detectorStatus }),
  setDetectedObjects: (detectedObjects) => set({ detectedObjects })
}));
