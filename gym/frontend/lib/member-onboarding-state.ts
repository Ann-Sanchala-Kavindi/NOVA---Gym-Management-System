import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export type MemberOnboardingDraft = {
  gender?: 'male' | 'female';
  age?: number;
  height?: number;
  weight?: number;
  goals?: string[];
  activityLevel?: string;
  name?: string;
  mobile?: string;
  whatsapp?: string;
};

type OnboardingState = {
  completedByEmail: Record<string, boolean>;
  activeEmail?: string;
  activeToken?: string;
  draftByEmail: Record<string, MemberOnboardingDraft>;
};

const BASE_DIR = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
const STATE_FILE_PATH = `${BASE_DIR}member-onboarding-state.json`;
const STORAGE_KEY = 'member-onboarding-state';

function normalizeEmail(email?: string) {
  return (email || '').trim().toLowerCase();
}

async function readState(): Promise<OnboardingState> {
  try {
    if (Platform.OS === 'web') {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return { completedByEmail: {}, draftByEmail: {} };
      const parsed = JSON.parse(raw) as OnboardingState;
      return {
        completedByEmail: parsed.completedByEmail || {},
        activeEmail: parsed.activeEmail,
        activeToken: parsed.activeToken,
        draftByEmail: parsed.draftByEmail || {},
      };
    }

    const info = await FileSystem.getInfoAsync(STATE_FILE_PATH);
    if (!info.exists) {
      return { completedByEmail: {}, draftByEmail: {} };
    }

    const raw = await FileSystem.readAsStringAsync(STATE_FILE_PATH);
    const parsed = JSON.parse(raw) as OnboardingState;
    return {
      completedByEmail: parsed.completedByEmail || {},
      activeEmail: parsed.activeEmail,
      activeToken: parsed.activeToken,
      draftByEmail: parsed.draftByEmail || {},
    };
  } catch {
    return { completedByEmail: {}, draftByEmail: {} };
  }
}

async function writeState(nextState: OnboardingState) {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    }
    return;
  }

  if (!STATE_FILE_PATH) return;
  await FileSystem.writeAsStringAsync(STATE_FILE_PATH, JSON.stringify(nextState));
}

export async function setActiveMemberEmail(email?: string) {
  const normalized = normalizeEmail(email);
  const state = await readState();
  state.activeEmail = normalized || undefined;
  await writeState(state);
}

export async function setActiveMemberSession(input: { email?: string; token?: string }) {
  const normalized = normalizeEmail(input.email);
  const state = await readState();
  state.activeEmail = normalized || undefined;
  state.activeToken = input.token || undefined;
  await writeState(state);
}

export async function getActiveMemberSession() {
  const state = await readState();
  return {
    email: state.activeEmail,
    token: state.activeToken,
  };
}

export async function getActiveMemberEmail() {
  const state = await readState();
  return state.activeEmail;
}

export async function isMemberOnboardingCompleted(email?: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const state = await readState();
  return !!state.completedByEmail[normalized];
}

export async function markMemberOnboardingCompleted(email?: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const state = await readState();
  state.completedByEmail[normalized] = true;
  delete state.draftByEmail[normalized];
  if (state.activeEmail === normalized) {
    state.activeToken = undefined;
  }
  await writeState(state);
}

export async function syncMemberOnboardingCompletion(email: string | undefined, completed: boolean) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const state = await readState();
  if (completed) {
    state.completedByEmail[normalized] = true;
  } else {
    delete state.completedByEmail[normalized];
  }
  await writeState(state);
}

export async function getMemberOnboardingDraft(email?: string) {
  const normalized = normalizeEmail(email || (await getActiveMemberEmail()));
  if (!normalized) return {} as MemberOnboardingDraft;

  const state = await readState();
  return state.draftByEmail[normalized] || {};
}

export async function updateMemberOnboardingDraft(
  partial: Partial<MemberOnboardingDraft>,
  email?: string
) {
  const normalized = normalizeEmail(email || (await getActiveMemberEmail()));
  if (!normalized) return;

  const state = await readState();
  const current = state.draftByEmail[normalized] || {};
  state.draftByEmail[normalized] = {
    ...current,
    ...partial,
  };
  await writeState(state);
}
