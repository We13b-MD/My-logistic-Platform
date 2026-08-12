import { create } from 'zustand';

// Global UI state — sidebar, filters, modals
// Use this for CLIENT-side state (what's open/closed, what's selected)
// Use TanStack Query for SERVER-side state (API data)

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
