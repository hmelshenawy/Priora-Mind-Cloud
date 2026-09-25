const SELECTED_MINDSPACE_KEY = 'priora.selectedMindSpaceId';

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage);
}

export function getSelectedMindSpaceId() {
  if (!canUseStorage()) return null;
  return window.sessionStorage.getItem(SELECTED_MINDSPACE_KEY);
}

export function saveSelectedMindSpaceId(mindSpaceId: string) {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(SELECTED_MINDSPACE_KEY, mindSpaceId);
}

export function clearSelectedMindSpaceId() {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(SELECTED_MINDSPACE_KEY);
}
