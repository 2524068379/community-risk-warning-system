import { describe, expect, it, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeCameraId: useAppStore.getState().cameras[0].id,
      selectedEventId: useAppStore.getState().events[0]?.id,
      vlmStatus: 'idle',
      vlmError: null,
      detectionBoxes: [],
      analysisTimestamp: null
    });
  });

  it('initializes with waiting analysis state for VLM pipeline', () => {
    const state = useAppStore.getState();
    expect(state.analysis.hasRisk).toBe(false);
    expect(state.analysis.riskScore).toBe(0);
    expect(state.analysis.level).toBe('C');
    expect(state.analysis.summary).toContain('等待');
  });

  it('keeps camera, event, and analysis aligned when selecting an event', () => {
    const targetEvent = useAppStore.getState().events[1];

    useAppStore.getState().selectEvent(targetEvent.id);

    const state = useAppStore.getState();
    expect(state.selectedEventId).toBe(targetEvent.id);
    expect(state.activeCameraId).toBe(targetEvent.cameraId);
    expect(state.analysis).toEqual(targetEvent.analysis);
  });

  it('updates analysis and detection boxes via setAnalysis', () => {
    const mockAnalysis = {
      riskScore: 85,
      level: 'A' as const,
      hasRisk: true,
      confidence: 0.92,
      summary: '消防通道被占用',
      evidenceTimeline: ['12:00:01 检测到障碍物'],
      breakdown: [{ label: '消防风险', value: 100 }],
      trend: []
    };
    const mockBoxes = [
      { x: 0.1, y: 0.2, width: 0.3, height: 0.4, label: '障碍物', confidence: 0.92, risk: true }
    ];

    useAppStore.getState().setAnalysis(mockAnalysis, mockBoxes);

    const state = useAppStore.getState();
    expect(state.analysis).toEqual(mockAnalysis);
    expect(state.detectionBoxes).toEqual(mockBoxes);
    expect(state.analysisTimestamp).toBeGreaterThan(0);
  });

  it('updates VLM status', () => {
    useAppStore.getState().setVlmStatus('analyzing');
    expect(useAppStore.getState().vlmStatus).toBe('analyzing');

    useAppStore.getState().setVlmStatus('error', 'Connection failed');
    expect(useAppStore.getState().vlmStatus).toBe('error');
    expect(useAppStore.getState().vlmError).toBe('Connection failed');
  });
});
