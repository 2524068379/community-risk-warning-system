import { create } from 'zustand';
import { cameras, events } from '@/data/mock';
import type { CameraPoint, RiskEvent, VlmAnalysis, DetectionBox, TrendPoint } from '@/types';

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
  setActiveCamera: (cameraId: string) => void;
  selectEvent: (eventId?: string) => void;
  markEventStatus: (eventId: string, status: RiskEvent['status']) => void;
  setAnalysis: (analysis: VlmAnalysis, boxes: DetectionBox[]) => void;
  setVlmStatus: (status: VlmStatus, error?: string) => void;
}

const waitingAnalysis: VlmAnalysis = {
  riskScore: 0,
  level: 'C',
  hasRisk: false,
  confidence: 0,
  summary: '等待 VLM 模型连接...',
  evidenceTimeline: [],
  breakdown: [
    { label: '规则触发', value: 25 },
    { label: '场景敏感度', value: 25 },
    { label: '持续时长', value: 25 },
    { label: '历史重复性', value: 25 }
  ],
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

  setVlmStatus: (status, error) =>
    set({
      vlmStatus: status,
      vlmError: error ?? null
    })
}));
