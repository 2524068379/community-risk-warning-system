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
import type {
  CompetitionTaskEnvelope,
  CompetitionTaskId,
  CompetitionTaskRun
} from '@/types/taskResults';

export type VlmStatus = 'idle' | 'loading' | 'analyzing' | 'ready' | 'response-error' | 'error';

const MAX_TREND_POINTS = 30;

/** D6：比赛任务结果切片（赛题结果只进本切片，不加顶层字段）。 */
export interface TaskRunState {
  status: 'idle' | 'running' | 'done';
  currentTaskId?: CompetitionTaskId;
  startedAt?: number;
  completedAt?: number;
}

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
  /** D6：比赛任务结果切片（taskId → 最新信封）。 */
  taskResults: Partial<Record<CompetitionTaskId, CompetitionTaskEnvelope>>;
  taskRun: TaskRunState;
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
  applyTaskResult: (envelope: CompetitionTaskEnvelope) => void;
  setTaskRun: (run: Pick<CompetitionTaskRun, 'status'> & Partial<CompetitionTaskRun>) => void;
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
  taskResults: {},
  taskRun: { status: 'idle' } as TaskRunState,

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
  setDetectedObjects: (detectedObjects) => set({ detectedObjects }),

  // D6：比赛任务结果切片。只 upsert 该 taskId 的最新信封，不触碰风险流水线状态。
  applyTaskResult: (envelope) =>
    set((state) => ({
      taskResults: { ...state.taskResults, [envelope.taskId]: envelope },
      taskRun: {
        ...state.taskRun,
        status: state.taskRun.status === 'idle' ? 'running' : state.taskRun.status,
        currentTaskId: envelope.taskId
      }
    })),

  setTaskRun: (run) =>
    set((state) => ({
      taskRun: {
        ...state.taskRun,
        ...run,
        startedAt: run.startedAt ?? (run.status === 'running' ? state.taskRun.startedAt ?? Date.now() : state.taskRun.startedAt),
        completedAt: run.status === 'done' ? run.completedAt ?? Date.now() : state.taskRun.completedAt
      }
    }))
}));
