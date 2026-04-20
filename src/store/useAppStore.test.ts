import { describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';

describe('useAppStore', () => {
  it('initializes active camera and analysis from the selected event', () => {
    const state = useAppStore.getState();
    const selectedEvent = state.events.find((event) => event.id === state.selectedEventId);

    expect(selectedEvent).toBeDefined();
    expect(state.activeCameraId).toBe(selectedEvent?.cameraId);
    expect(state.analysis).toEqual(selectedEvent?.analysis);
  });

  it('keeps camera, event, and analysis aligned when selecting an event', () => {
    const targetEvent = useAppStore.getState().events[1];

    useAppStore.getState().selectEvent(targetEvent.id);

    const state = useAppStore.getState();
    expect(state.selectedEventId).toBe(targetEvent.id);
    expect(state.activeCameraId).toBe(targetEvent.cameraId);
    expect(state.analysis).toEqual(targetEvent.analysis);
  });
});
